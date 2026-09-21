-- =============================================================================
-- CENTRAL DO PACIENTE — 0030: evolução de treino
--
-- "A profissional NÃO é personal trainer. O aplicativo NÃO deve prescrever
-- treino." O banco guarda o que foi PLANEJADO por quem programou o treino e
-- o que foi REALIZADO pela paciente, separados. Nada aqui calcula carga,
-- sugere progressão ou monta treino.
--
-- POR QUE PLANEJADO E REALIZADO SÃO TABELAS DIFERENTES
--
-- "Agachamento, 3 séries, 8 a 10 repetições" é o plano. "Série 1: 60 kg ×
-- 8; série 2: 60 kg × 9; série 3: 60 kg × 7" é o que aconteceu. Guardando
-- junto, a sétima repetição da terceira série viraria uma alteração do
-- plano — e a profissional perderia o que ela mesma programou.
--
-- NADA foi reaproveitado de tabela existente porque não havia o que
-- reaproveitar: o banco tem 28 tabelas, nenhuma de treino. O que se
-- reaproveita é o PADRÃO: `pacientes` como dono, RLS em tudo, funções
-- `security definer` guardadas por `e_admin()` e `meu_paciente_id()`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- O treino planejado — escrito pela profissional
-- -----------------------------------------------------------------------------

create table if not exists treinos (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes (id) on delete cascade,
  nome text not null default 'Treino',
  observacao text,
  /**
   * Só o treino ATIVO aparece para a paciente registrar. O antigo não é
   * apagado: o histórico de sessões aponta para ele, e apagar levaria
   * junto a evolução de meses.
   */
  ativo boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists treinos_por_paciente on treinos (paciente_id, ativo desc);

create table if not exists treino_exercicios (
  id uuid primary key default gen_random_uuid(),
  treino_id uuid not null references treinos (id) on delete cascade,
  nome text not null,
  ordem integer not null default 0,
  series_planejadas integer,
  /**
   * A faixa programada: 8 a 10. É o que permite dizer "você chegou ao topo
   * da faixa" — e é NULA quando ela não programou faixa, caso em que não
   * há topo. Inventar um topo seria prescrever.
   */
  repeticoes_min integer,
  repeticoes_max integer,
  observacao text,
  criado_em timestamptz not null default now()
);

create index if not exists exercicios_por_treino on treino_exercicios (treino_id, ordem);

-- -----------------------------------------------------------------------------
-- O treino realizado — registrado pela paciente
-- -----------------------------------------------------------------------------

create table if not exists treino_sessoes (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes (id) on delete cascade,
  /**
   * `on delete set null`, e não cascade: se a profissional apagar um treino
   * velho, as sessões que a paciente fez continuam existindo. Ela treinou;
   * o registro é dela.
   */
  treino_id uuid references treinos (id) on delete set null,
  data date not null default hoje_sp(),
  observacao text,
  criado_em timestamptz not null default now()
);

create index if not exists sessoes_por_paciente on treino_sessoes (paciente_id, data desc);

create table if not exists treino_series (
  id uuid primary key default gen_random_uuid(),
  sessao_id uuid not null references treino_sessoes (id) on delete cascade,
  exercicio_id uuid references treino_exercicios (id) on delete set null,
  /**
   * O nome fica gravado na série, além do id do exercício. Sem isto, apagar
   * um exercício do treino deixaria o histórico com linhas sem nome — e a
   * paciente veria "—, 62 kg × 7" sem saber de que exercício se trata.
   */
  exercicio_nome text not null,
  numero integer not null default 1,
  /** Quilos. Nulo em exercício sem carga (prancha, abdominal) — nunca zero. */
  carga numeric(7, 2),
  repeticoes integer,
  observacao text,
  criado_em timestamptz not null default now(),
  constraint carga_nao_negativa check (carga is null or carga >= 0),
  constraint repeticoes_nao_negativas check (repeticoes is null or repeticoes >= 0)
);

create index if not exists series_por_sessao on treino_series (sessao_id, numero);
create index if not exists series_por_exercicio on treino_series (exercicio_id);

-- -----------------------------------------------------------------------------
-- RLS — o mesmo padrão das outras tabelas
-- -----------------------------------------------------------------------------

alter table treinos enable row level security;
alter table treino_exercicios enable row level security;
alter table treino_sessoes enable row level security;
alter table treino_series enable row level security;

-- A profissional escreve o plano; a paciente só LÊ o plano dela, e só o
-- ativo. "Não pode editar o treino prescrito pelo profissional."
drop policy if exists treinos_nutri on treinos;
create policy treinos_nutri on treinos for all using (e_admin()) with check (e_admin());

drop policy if exists treinos_paciente on treinos;
create policy treinos_paciente on treinos for select
  using (ativo and paciente_id = meu_paciente_id());

drop policy if exists exercicios_nutri on treino_exercicios;
create policy exercicios_nutri on treino_exercicios for all
  using (e_admin()) with check (e_admin());

drop policy if exists exercicios_paciente on treino_exercicios;
create policy exercicios_paciente on treino_exercicios for select
  using (exists (select 1 from treinos t
                 where t.id = treino_id and t.ativo and t.paciente_id = meu_paciente_id()));

-- A sessão é dela: ela cria, ela altera, ela apaga. É o registro do que ela
-- fez, e ninguém corrige a memória de outra pessoa.
drop policy if exists sessoes_nutri on treino_sessoes;
create policy sessoes_nutri on treino_sessoes for all using (e_admin()) with check (e_admin());

drop policy if exists sessoes_paciente on treino_sessoes;
create policy sessoes_paciente on treino_sessoes for all
  using (paciente_id = meu_paciente_id())
  with check (paciente_id = meu_paciente_id());

drop policy if exists series_nutri on treino_series;
create policy series_nutri on treino_series for all using (e_admin()) with check (e_admin());

drop policy if exists series_paciente on treino_series;
create policy series_paciente on treino_series for all
  using (exists (select 1 from treino_sessoes s
                 where s.id = sessao_id and s.paciente_id = meu_paciente_id()))
  with check (exists (select 1 from treino_sessoes s
                      where s.id = sessao_id and s.paciente_id = meu_paciente_id()));

grant select, insert, update, delete on treinos, treino_exercicios,
  treino_sessoes, treino_series to authenticated;
revoke all on table treinos, treino_exercicios, treino_sessoes, treino_series from anon;

-- -----------------------------------------------------------------------------
-- Leitura
-- -----------------------------------------------------------------------------

/** O treino ativo da paciente, com os exercícios em ordem. Nulo se não há. */
create or replace function meu_treino()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
  v_treino treinos;
begin
  v_paciente := meu_paciente_id();
  if v_paciente is null then return null; end if;

  select * into v_treino from treinos
  where paciente_id = v_paciente and ativo
  order by atualizado_em desc limit 1;

  if v_treino.id is null then return null; end if;

  return jsonb_build_object(
    'id', v_treino.id,
    'nome', v_treino.nome,
    'observacao', v_treino.observacao,
    'exercicios', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', e.id, 'nome', e.nome, 'ordem', e.ordem,
               'seriesPlanejadas', e.series_planejadas,
               'repeticoesMin', e.repeticoes_min,
               'repeticoesMax', e.repeticoes_max,
               'observacao', e.observacao) order by e.ordem, e.criado_em)
      from treino_exercicios e where e.treino_id = v_treino.id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function meu_treino() from anon, public;
grant execute on function meu_treino() to authenticated;

/**
 * As sessões de treino de uma paciente, com as séries dentro.
 *
 * Uma função só para as duas telas: a profissional passa o id da paciente,
 * a paciente passa nulo e recebe as próprias. Duas funções que leem a mesma
 * coisa divergiriam na primeira mudança, e a que divergisse calada seria a
 * da paciente.
 */
create or replace function sessoes_de_treino(p_paciente uuid default null, p_limite integer default 200)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
begin
  if p_paciente is null then
    v_paciente := meu_paciente_id();
  elsif e_admin() then
    v_paciente := p_paciente;
  else
    raise exception 'Você só vê os seus treinos.' using errcode = '42501';
  end if;

  if v_paciente is null then return '[]'::jsonb; end if;

  return coalesce((
    select jsonb_agg(linha order by linha ->> 'data' desc)
    from (
      select jsonb_build_object(
               'id', s.id,
               'data', s.data,
               'treinoId', s.treino_id,
               'observacao', s.observacao,
               'series', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'id', x.id, 'exercicioId', x.exercicio_id,
                          'exercicioNome', x.exercicio_nome, 'numero', x.numero,
                          'carga', x.carga, 'repeticoes', x.repeticoes,
                          'observacao', x.observacao) order by x.numero, x.criado_em)
                 from treino_series x where x.sessao_id = s.id
               ), '[]'::jsonb)
             ) as linha
      from treino_sessoes s
      where s.paciente_id = v_paciente
      order by s.data desc, s.criado_em desc
      limit greatest(coalesce(p_limite, 200), 1)
    ) t
  ), '[]'::jsonb);
end;
$$;

revoke all on function sessoes_de_treino(uuid, integer) from anon, public;
grant execute on function sessoes_de_treino(uuid, integer) to authenticated;

-- -----------------------------------------------------------------------------
-- Escrita
-- -----------------------------------------------------------------------------

/**
 * Grava o plano inteiro de uma vez: o treino e os exercícios dele.
 *
 * De uma vez porque é assim que ela edita — a tela mostra a lista toda, e
 * salvar exercício a exercício deixaria o plano pela metade se a conexão
 * caísse no meio.
 */
create or replace function salvar_treino(
  p_id uuid,
  p_paciente uuid,
  p_nome text,
  p_observacao text,
  p_ativo boolean,
  p_exercicios jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_item jsonb;
  v_ordem integer := 0;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista monta o treino.' using errcode = '42501';
  end if;
  if not exists (select 1 from pacientes where id = p_paciente) then
    raise exception 'Paciente não encontrado.' using errcode = 'P0002';
  end if;
  if p_exercicios is null or jsonb_typeof(p_exercicios) <> 'array' then
    raise exception 'Os exercícios precisam ser uma lista.' using errcode = '22023';
  end if;

  if p_id is null then
    insert into treinos (paciente_id, nome, observacao, ativo)
    values (p_paciente, coalesce(nullif(btrim(p_nome), ''), 'Treino'),
            nullif(btrim(coalesce(p_observacao, '')), ''), coalesce(p_ativo, false))
    returning id into v_id;
  else
    update treinos
    set nome = coalesce(nullif(btrim(p_nome), ''), nome),
        observacao = nullif(btrim(coalesce(p_observacao, '')), ''),
        ativo = coalesce(p_ativo, ativo),
        atualizado_em = now()
    where id = p_id and paciente_id = p_paciente
    returning id into v_id;
    if v_id is null then
      raise exception 'Treino não encontrado.' using errcode = 'P0002';
    end if;
  end if;

  -- Um treino ativo por paciente. Dois ativos fariam a tela dela escolher
  -- um dos dois em silêncio, e o outro nunca apareceria.
  if coalesce(p_ativo, false) then
    update treinos set ativo = false where paciente_id = p_paciente and id <> v_id;
  end if;

  delete from treino_exercicios where treino_id = v_id;
  for v_item in select * from jsonb_array_elements(p_exercicios) loop
    if btrim(coalesce(v_item ->> 'nome', '')) = '' then continue; end if;
    insert into treino_exercicios
      (treino_id, nome, ordem, series_planejadas, repeticoes_min, repeticoes_max, observacao)
    values (
      v_id, btrim(v_item ->> 'nome'), v_ordem,
      nullif(v_item ->> 'seriesPlanejadas', '')::integer,
      nullif(v_item ->> 'repeticoesMin', '')::integer,
      nullif(v_item ->> 'repeticoesMax', '')::integer,
      nullif(btrim(coalesce(v_item ->> 'observacao', '')), '')
    );
    v_ordem := v_ordem + 1;
  end loop;

  return jsonb_build_object('id', v_id);
end;
$$;

revoke all on function salvar_treino(uuid, uuid, text, text, boolean, jsonb) from anon, public;
grant execute on function salvar_treino(uuid, uuid, text, text, boolean, jsonb) to authenticated;

create or replace function excluir_treino(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista apaga treino.' using errcode = '42501';
  end if;
  delete from treinos where id = p_id;
end;
$$;

revoke all on function excluir_treino(uuid) from anon, public;
grant execute on function excluir_treino(uuid) to authenticated;

/**
 * Registra uma sessão realizada, com as séries.
 *
 * Quem pode: a própria paciente (é o registro dela) e a profissional (que
 * lança o que a paciente contou na consulta). O `p_paciente` é ignorado
 * quando quem chama é a paciente — senão bastaria mandar outro id para
 * escrever na ficha de outra pessoa.
 */
create or replace function registrar_sessao_treino(
  p_id uuid,
  p_paciente uuid,
  p_treino uuid,
  p_data date,
  p_observacao text,
  p_series jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
  v_id uuid;
  v_item jsonb;
  v_nome text;
begin
  if e_admin() then
    v_paciente := p_paciente;
  else
    v_paciente := meu_paciente_id();
  end if;

  if v_paciente is null then
    raise exception 'Sem cadastro de paciente.' using errcode = '42501';
  end if;
  if p_series is null or jsonb_typeof(p_series) <> 'array' then
    raise exception 'As séries precisam ser uma lista.' using errcode = '22023';
  end if;
  -- Treino não se registra no futuro: quem digita 2027 errou o ano, e o
  -- registro iria para o fim da linha do tempo e ficaria lá.
  if coalesce(p_data, hoje_sp()) > hoje_sp() then
    raise exception 'Não dá para registrar treino de uma data futura.' using errcode = '22007';
  end if;

  if p_id is null then
    insert into treino_sessoes (paciente_id, treino_id, data, observacao)
    values (v_paciente, p_treino, coalesce(p_data, hoje_sp()),
            nullif(btrim(coalesce(p_observacao, '')), ''))
    returning id into v_id;
  else
    update treino_sessoes
    set treino_id = coalesce(p_treino, treino_id),
        data = coalesce(p_data, data),
        observacao = nullif(btrim(coalesce(p_observacao, '')), '')
    where id = p_id and paciente_id = v_paciente
    returning id into v_id;
    if v_id is null then
      raise exception 'Sessão não encontrada.' using errcode = 'P0002';
    end if;
  end if;

  delete from treino_series where sessao_id = v_id;
  for v_item in select * from jsonb_array_elements(p_series) loop
    v_nome := btrim(coalesce(v_item ->> 'exercicioNome', ''));
    if v_nome = '' then continue; end if;
    insert into treino_series
      (sessao_id, exercicio_id, exercicio_nome, numero, carga, repeticoes, observacao)
    values (
      v_id,
      nullif(v_item ->> 'exercicioId', '')::uuid,
      v_nome,
      coalesce(nullif(v_item ->> 'numero', '')::integer, 1),
      -- Em branco fica NULO, não zero: exercício sem carga não pesa zero
      -- quilo, não tem carga. Zero somaria como peso numa conta de volume.
      nullif(v_item ->> 'carga', '')::numeric,
      nullif(v_item ->> 'repeticoes', '')::integer
      , nullif(btrim(coalesce(v_item ->> 'observacao', '')), '')
    );
  end loop;

  return jsonb_build_object('id', v_id);
end;
$$;

revoke all on function registrar_sessao_treino(uuid, uuid, uuid, date, text, jsonb)
  from anon, public;
grant execute on function registrar_sessao_treino(uuid, uuid, uuid, date, text, jsonb)
  to authenticated;

create or replace function excluir_sessao_treino(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if e_admin() then
    delete from treino_sessoes where id = p_id;
  else
    -- A paciente apaga a própria sessão, e só a dela.
    delete from treino_sessoes where id = p_id and paciente_id = meu_paciente_id();
  end if;
end;
$$;

revoke all on function excluir_sessao_treino(uuid) from anon, public;
grant execute on function excluir_sessao_treino(uuid) to authenticated;

/** Os treinos de uma paciente, para a tela da profissional. */
create or replace function treinos_do_paciente(p_paciente uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê os treinos.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', t.id, 'nome', t.nome, 'observacao', t.observacao, 'ativo', t.ativo,
             'exercicios', coalesce((
               select jsonb_agg(jsonb_build_object(
                        'id', e.id, 'nome', e.nome, 'ordem', e.ordem,
                        'seriesPlanejadas', e.series_planejadas,
                        'repeticoesMin', e.repeticoes_min,
                        'repeticoesMax', e.repeticoes_max,
                        'observacao', e.observacao) order by e.ordem, e.criado_em)
               from treino_exercicios e where e.treino_id = t.id
             ), '[]'::jsonb))
           order by t.ativo desc, t.atualizado_em desc)
    from treinos t where t.paciente_id = p_paciente
  ), '[]'::jsonb);
end;
$$;

revoke all on function treinos_do_paciente(uuid) from anon, public;
grant execute on function treinos_do_paciente(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- O acesso diz se há treino, para a tela não oferecer porta vazia
-- -----------------------------------------------------------------------------

create or replace function tenho_treino()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from treinos where ativo and paciente_id = meu_paciente_id())
      or exists (select 1 from treino_sessoes where paciente_id = meu_paciente_id());
$$;

revoke all on function tenho_treino() from anon, public;
grant execute on function tenho_treino() to authenticated;

-- `meu_acesso()` ganha a chave `treino`. Recriada inteira porque é `create
-- or replace` de função sql: o corpo vai todo, não em pedaços.
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
    'treino', e_admin() or tenho_treino()
  );
$$;

grant execute on function meu_acesso() to authenticated;
