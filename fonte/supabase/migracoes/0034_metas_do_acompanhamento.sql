-- =============================================================================
-- CENTRAL DO PACIENTE — 0034: metas do acompanhamento
--
-- "Criar um módulo de METAS. As metas são individuais e devem ser criadas
-- pelo nutricionista de acordo com cada paciente. Não utilizar uma lista
-- fixa de metas. As metas precisam ser totalmente personalizáveis."
--
-- POR QUE ISTO NÃO REAPROVEITA `metas_semanais`
--
-- Já existe uma tabela de metas no banco, da 0031, e ela NÃO serve aqui —
-- olhar o nome e concluir que serve seria o erro caro desta migração.
--
--   `metas_semanais` é "4 treinos nesta semana". O alvo é fechado (treino ou
--   cardio), o progresso é CONTADO das sessões que a paciente registrou, e
--   ninguém marca nada à mão. É um placar do módulo de treino.
--
--   `metas` é "beber 2 litros de água por dia", "levar marmita 3x na semana",
--   "dormir antes da meia-noite". O texto é dela, a unidade é dela, e o
--   progresso vem de a paciente MARCAR que fez.
--
-- Forçar as duas na mesma tabela daria uma coluna `tipo` decidindo de onde o
-- progresso vem, e metade das colunas nula em cada linha. Ficam separadas, e
-- a tela mostra as duas coisas junto — que é onde elas se parecem.
--
-- O PROGRESSO NÃO É GUARDADO
--
-- Mesma regra da 0031, e pela mesma razão: um contador gravado fica errado
-- no dia em que um registro é apagado, e fica errado em silêncio. O
-- progresso é contado dos registros, na hora, toda vez.
-- =============================================================================

create table if not exists metas (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes (id) on delete cascade,

  titulo text not null,
  descricao text,
  /** Escrita por ela, livre. Sem lista fixa: foi o pedido, literalmente. */
  categoria text,

  /**
   * 'diaria'  — vale por dia. "Beber 2 litros" é para todo dia.
   * 'semanal' — vale por semana. "Levar marmita 3x" é na semana inteira.
   *
   * O que muda é o PERÍODO em que o alvo é contado, e nada mais.
   */
  frequencia text not null default 'diaria',

  /**
   * Quanto, e de quê. NULOS quando a meta é só "fez ou não fez" — e aí
   * marcar uma vez no período já cumpre.
   *
   * Nulo não é zero: alvo zero seria uma meta que nasce cumprida.
   */
  alvo numeric(10, 2),
  unidade text,

  inicio date not null default hoje_sp(),
  /** Quando ela espera que termine. Nula em meta sem prazo. */
  prazo date,

  status text not null default 'ativa',

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  constraint meta_frequencia_conhecida check (frequencia in ('diaria', 'semanal')),
  constraint meta_status_conhecido check (status in ('ativa', 'pausada', 'concluida', 'cancelada')),
  constraint meta_alvo_positivo check (alvo is null or alvo > 0),
  constraint meta_prazo_depois_do_inicio check (prazo is null or prazo >= inicio)
);

create index if not exists metas_por_paciente on metas (paciente_id, status, inicio desc);

/**
 * O que a paciente marcou.
 *
 * Uma linha por vez que ela registrou, e não um acumulado por dia: o
 * acumulado perderia a hora de cada marcação, e "bebi 1 copo agora" seria
 * indistinguível de "bebi 8 de uma vez". Somar é barato; desagregar depois
 * seria impossível.
 */
create table if not exists meta_registros (
  id uuid primary key default gen_random_uuid(),
  meta_id uuid not null references metas (id) on delete cascade,
  data date not null default hoje_sp(),
  /** Quanto, na unidade da meta. Nulo em meta de "fez ou não fez". */
  quantidade numeric(10, 2),
  observacao text,
  criado_em timestamptz not null default now(),
  constraint registro_quantidade_nao_negativa check (quantidade is null or quantidade >= 0)
);

create index if not exists registros_por_meta on meta_registros (meta_id, data desc);

-- -----------------------------------------------------------------------------
-- RLS — o padrão de sempre
-- -----------------------------------------------------------------------------

alter table metas enable row level security;
alter table meta_registros enable row level security;

drop policy if exists metas_nutri on metas;
create policy metas_nutri on metas for all using (e_admin()) with check (e_admin());

-- A paciente LÊ as metas dela. Quem cria, edita e apaga é a profissional:
-- a meta é decisão clínica, e a paciente mudando o alvo mudaria a régua do
-- próprio acompanhamento.
drop policy if exists metas_paciente on metas;
create policy metas_paciente on metas for select
  using (paciente_id = meu_paciente_id());

drop policy if exists registros_nutri on meta_registros;
create policy registros_nutri on meta_registros for all
  using (e_admin()) with check (e_admin());

-- O registro é dela: ela marca, ela desmarca. É o que ela fez, e ninguém
-- corrige a memória de outra pessoa.
drop policy if exists registros_paciente on meta_registros;
create policy registros_paciente on meta_registros for all
  using (exists (select 1 from metas m
                 where m.id = meta_id and m.paciente_id = meu_paciente_id()))
  with check (exists (select 1 from metas m
                      where m.id = meta_id and m.paciente_id = meu_paciente_id()));

grant select, insert, update, delete on metas, meta_registros to authenticated;
revoke all on table metas, meta_registros from anon;

-- -----------------------------------------------------------------------------
-- Leitura
-- -----------------------------------------------------------------------------

/**
 * As metas de uma paciente, com os registros do período corrente e o
 * histórico recente.
 *
 * Uma função para as duas telas — a profissional passa o id, a paciente
 * passa nulo e recebe as próprias. Duas funções lendo a mesma coisa
 * divergiriam na primeira mudança, e a que divergisse calada seria a da
 * paciente.
 *
 * Os registros vêm CRUS, e quem conta o progresso é a tela. É de propósito:
 * a mesma conta roda em `utils/progressoMetas.ts`, com teste, e um segundo
 * cálculo aqui dentro só criaria a chance de os dois discordarem.
 */
create or replace function metas_de(p_paciente uuid default null, p_dias integer default 90)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
  v_desde date;
begin
  if p_paciente is null then
    v_paciente := meu_paciente_id();
  elsif e_admin() then
    v_paciente := p_paciente;
  else
    raise exception 'Você só vê as suas metas.' using errcode = '42501';
  end if;

  if v_paciente is null then return '[]'::jsonb; end if;
  v_desde := hoje_sp() - greatest(coalesce(p_dias, 90), 1);

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', m.id,
             'titulo', m.titulo,
             'descricao', m.descricao,
             'categoria', m.categoria,
             'frequencia', m.frequencia,
             'alvo', m.alvo,
             'unidade', m.unidade,
             'inicio', m.inicio,
             'prazo', m.prazo,
             'status', m.status,
             'registros', coalesce((
               select jsonb_agg(jsonb_build_object(
                        'id', r.id, 'data', r.data,
                        'quantidade', r.quantidade, 'observacao', r.observacao)
                      order by r.data desc, r.criado_em desc)
               from meta_registros r
               where r.meta_id = m.id and r.data >= v_desde
             ), '[]'::jsonb))
           -- Ativa primeiro, depois pausada, e o que acabou por último:
           -- a tela abre no que ainda pede ação.
           order by (m.status = 'ativa') desc, (m.status = 'pausada') desc,
                    m.inicio desc, m.criado_em desc)
    from metas m where m.paciente_id = v_paciente
  ), '[]'::jsonb);
end;
$$;

revoke all on function metas_de(uuid, integer) from anon, public;
grant execute on function metas_de(uuid, integer) to authenticated;

-- -----------------------------------------------------------------------------
-- Escrita — a profissional
-- -----------------------------------------------------------------------------

create or replace function salvar_meta(
  p_id uuid,
  p_paciente uuid,
  p_titulo text,
  p_descricao text,
  p_categoria text,
  p_frequencia text,
  p_alvo numeric,
  p_unidade text,
  p_inicio date,
  p_prazo date,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_titulo text;
  v_frequencia text;
  v_status text;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista cria e altera metas.' using errcode = '42501';
  end if;

  v_titulo := btrim(coalesce(p_titulo, ''));
  if v_titulo = '' then
    raise exception 'A meta precisa de um título.' using errcode = '22023';
  end if;

  -- Frequência e status desconhecidos viram o padrão em vez de derrubar a
  -- gravação: quem digitou a meta inteira não pode perder o texto por causa
  -- de um valor que a tela mandou errado.
  v_frequencia := case when p_frequencia in ('diaria', 'semanal') then p_frequencia else 'diaria' end;
  v_status := case when p_status in ('ativa', 'pausada', 'concluida', 'cancelada')
                   then p_status else 'ativa' end;

  if p_id is null then
    if not exists (select 1 from pacientes where id = p_paciente) then
      raise exception 'Paciente não encontrada.' using errcode = 'P0002';
    end if;
    insert into metas (paciente_id, titulo, descricao, categoria, frequencia,
                       alvo, unidade, inicio, prazo, status)
    values (p_paciente, v_titulo,
            nullif(btrim(coalesce(p_descricao, '')), ''),
            nullif(btrim(coalesce(p_categoria, '')), ''),
            v_frequencia,
            case when p_alvo is null or p_alvo <= 0 then null else p_alvo end,
            nullif(btrim(coalesce(p_unidade, '')), ''),
            coalesce(p_inicio, hoje_sp()),
            p_prazo, v_status)
    returning id into v_id;
  else
    update metas
    set titulo = v_titulo,
        descricao = nullif(btrim(coalesce(p_descricao, '')), ''),
        categoria = nullif(btrim(coalesce(p_categoria, '')), ''),
        frequencia = v_frequencia,
        alvo = case when p_alvo is null or p_alvo <= 0 then null else p_alvo end,
        unidade = nullif(btrim(coalesce(p_unidade, '')), ''),
        inicio = coalesce(p_inicio, inicio),
        prazo = p_prazo,
        status = v_status,
        atualizado_em = now()
    where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'Meta não encontrada.' using errcode = 'P0002';
    end if;
  end if;

  return jsonb_build_object('id', v_id);
end;
$$;

revoke all on function salvar_meta(uuid, uuid, text, text, text, text, numeric, text, date, date, text)
  from anon, public;
grant execute on function salvar_meta(uuid, uuid, text, text, text, text, numeric, text, date, date, text)
  to authenticated;

/**
 * Pausar, concluir, reativar.
 *
 * Separado do `salvar_meta` porque é o botão que ela mais vai usar, e
 * mandar a meta inteira de volta só para mudar uma palavra é a chance de
 * sobrescrever o texto com o que a tela tinha em memória.
 */
create or replace function definir_status_meta(p_id uuid, p_status text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista muda o status da meta.' using errcode = '42501';
  end if;
  if p_status not in ('ativa', 'pausada', 'concluida', 'cancelada') then
    raise exception 'Status desconhecido.' using errcode = '22023';
  end if;

  update metas set status = p_status, atualizado_em = now() where id = p_id;
  select status into v_status from metas where id = p_id;
  if v_status is null then
    raise exception 'Meta não encontrada.' using errcode = 'P0002';
  end if;
  -- Devolve o que ficou GRAVADO, não o que foi pedido.
  return v_status;
end;
$$;

revoke all on function definir_status_meta(uuid, text) from anon, public;
grant execute on function definir_status_meta(uuid, text) to authenticated;

create or replace function excluir_meta(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista apaga metas.' using errcode = '42501';
  end if;
  delete from metas where id = p_id;
end;
$$;

revoke all on function excluir_meta(uuid) from anon, public;
grant execute on function excluir_meta(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Escrita — a paciente marca o que fez
-- -----------------------------------------------------------------------------

/**
 * Marca um registro na meta.
 *
 * Quem pode: a própria paciente (é o que ELA fez) e a profissional (que
 * lança o que a paciente contou na consulta). A meta tem de ser da paciente
 * que está chamando — e é o BANCO que confere isso, não a tela.
 */
create or replace function registrar_meta(
  p_meta uuid,
  p_data date,
  p_quantidade numeric,
  p_observacao text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meta metas;
  v_id uuid;
begin
  select * into v_meta from metas where id = p_meta;
  if v_meta.id is null then
    raise exception 'Meta não encontrada.' using errcode = 'P0002';
  end if;

  if not e_admin() and v_meta.paciente_id is distinct from meu_paciente_id() then
    raise exception 'Esta meta não é sua.' using errcode = '42501';
  end if;

  -- Meta pausada, concluída ou cancelada não recebe marcação nova: seria
  -- progresso entrando depois de a profissional ter encerrado a conta.
  if v_meta.status <> 'ativa' then
    raise exception 'Esta meta não está ativa.' using errcode = '42501';
  end if;

  -- Marcar no futuro não: quem digita 2027 errou o ano, e o registro iria
  -- para o fim da linha do tempo e ficaria lá.
  if coalesce(p_data, hoje_sp()) > hoje_sp() then
    raise exception 'Não dá para marcar uma data futura.' using errcode = '22007';
  end if;

  insert into meta_registros (meta_id, data, quantidade, observacao)
  values (p_meta, coalesce(p_data, hoje_sp()),
          case when p_quantidade is null or p_quantidade < 0 then null else p_quantidade end,
          nullif(btrim(coalesce(p_observacao, '')), ''))
  returning id into v_id;

  return jsonb_build_object('id', v_id);
end;
$$;

revoke all on function registrar_meta(uuid, date, numeric, text) from anon, public;
grant execute on function registrar_meta(uuid, date, numeric, text) to authenticated;

create or replace function apagar_registro_meta(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if e_admin() then
    delete from meta_registros where id = p_id;
    return;
  end if;

  delete from meta_registros r
  where r.id = p_id
    and exists (select 1 from metas m
                where m.id = r.meta_id and m.paciente_id = meu_paciente_id());
end;
$$;

revoke all on function apagar_registro_meta(uuid) from anon, public;
grant execute on function apagar_registro_meta(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- O atalho só aparece para quem tem meta
-- -----------------------------------------------------------------------------

create or replace function tenho_metas()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from metas
                 where paciente_id = meu_paciente_id()
                   and status in ('ativa', 'pausada', 'concluida'));
$$;

revoke all on function tenho_metas() from anon, public;
grant execute on function tenho_metas() to authenticated;

-- `meu_acesso()` ganha a chave `metas`. Recriada inteira porque é
-- `create or replace` de função sql: o corpo vai todo, não em pedaços.
create or replace function meu_acesso()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'autenticado', auth.uid() is not null,
    'perfilId', auth.uid(),
    'papel', coalesce((select papel from perfis where id = auth.uid()), 'paciente'),
    'nome', (select coalesce(pa.nome, pe.nome) from perfis pe
             left join pacientes pa on pa.perfil_id = pe.id where pe.id = auth.uid()),
    'email', (select email::text from perfis where id = auth.uid()),
    'temAcesso', tem_acesso() or e_admin(),
    'situacao', coalesce(
      (select situacao_paciente(p.status, p.perfil_id, p.data_inicio, p.data_fim)
         from pacientes p where p.perfil_id = auth.uid()),
      case when e_admin() then 'admin' else 'sem_cadastro' end
    ),
    'dataInicio', (select data_inicio from pacientes where perfil_id = auth.uid()),
    'dataFim', (select data_fim from pacientes where perfil_id = auth.uid()),
    'diasRestantes', (select data_fim - hoje_sp() from pacientes where perfil_id = auth.uid()),
    'plano', (select pl.nome from pacientes p join planos pl on pl.id = p.plano_id
               where p.perfil_id = auth.uid()),
    'rastreio', e_admin() or coalesce(rastreio_ativo(meu_paciente_id()), false),
    'protocolo', e_admin() or tenho_protocolo(),
    'avaliacao', e_admin() or tenho_avaliacao(),
    'treino', e_admin() or tenho_treino(),
    'metas', e_admin() or tenho_metas()
  );
$$;

grant execute on function meu_acesso() to authenticated;
