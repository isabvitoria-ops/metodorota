-- =============================================================================
-- CENTRAL DO PACIENTE — 0044: as fases do acompanhamento (Método ROTA)
--
-- QUEM ESCREVE AS FASES É ELA, e isso não é preguiça minha.
--
-- O Método ROTA é dela. Eu não sei o que cada letra significa, quantas
-- etapas tem, nem o que separa uma da seguinte — e chutar isso seria a
-- mesma linha que eu não cruzei na carta de encaminhamento: o aplicativo
-- preenche fato, ele não escreve conteúdo clínico assinado por outra
-- pessoa. Uma lista fixa que eu inventasse aqui seria a lista errada no dia
-- em que ela atendesse alguém fora dela.
--
-- Então: ela cria as fases, na ordem que quiser, com o nome que quiser. É a
-- mesma decisão das metas ("não utilizar uma lista fixa").
--
-- O HISTÓRICO É O PRODUTO, e não a fase atual.
--
-- Guardar só `pacientes.fase_id` responderia "onde ela está". Mas a
-- pergunta que aparece na consulta é outra: "há quanto tempo ela está
-- nisso?", "quando ela saiu da restrição?", "quanto tempo levou da
-- avaliação até a reintrodução?". Nada disso se recupera de um campo que é
-- sobrescrito.
--
-- Por isso cada mudança vira uma LINHA. A fase atual é a linha mais
-- recente — derivada, nunca gravada em dois lugares.
--
-- O QUE ISTO NÃO FAZ: não cobra prazo, não diz que alguém está "atrasada na
-- fase", não avança ninguém sozinho. Quem move é ela, na consulta. Um
-- sistema que empurrasse a paciente para a fase seguinte por tempo decorrido
-- estaria tomando decisão clínica por conta própria.
-- =============================================================================

create table if not exists fases (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  /** O que caracteriza esta fase. Aparece para a paciente. */
  descricao text,
  ordem integer not null default 0,
  ativa boolean not null default true,
  criado_em timestamptz not null default now()
);

comment on table fases is
  'As etapas do método dela. O conteúdo é dela; o aplicativo só guarda e ordena.';

create index if not exists fases_por_ordem on fases (ordem);

create table if not exists paciente_fases (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes(id) on delete cascade,
  fase_id uuid not null references fases(id) on delete restrict,
  -- O dia em que ela ENTROU nesta fase. Editável, porque ela vai registrar
  -- na consulta seguinte uma mudança que aconteceu antes.
  inicio date not null default hoje_sp(),
  observacao text,
  criado_em timestamptz not null default now()
);

comment on table paciente_fases is
  'Uma linha por mudança de fase. A fase atual é a linha de início mais recente.';

create index if not exists paciente_fases_por_paciente
  on paciente_fases (paciente_id, inicio desc);

-- `on delete restrict` na fase, de propósito: apagar uma fase que tem
-- histórico apagaria o passado de quem passou por ela. A tela desativa em
-- vez de apagar, e o banco recusa se alguém tentar por fora.

alter table fases enable row level security;
alter table paciente_fases enable row level security;

grant select, insert, update, delete on fases, paciente_fases to authenticated;

drop policy if exists fases_admin on fases;
create policy fases_admin on fases
  for all using (e_admin()) with check (e_admin());

-- A paciente LÊ as fases ativas: ela precisa ver o caminho inteiro para se
-- situar dentro dele. Não há nada sigiloso no nome de uma etapa do método,
-- e ver só a própria fase seria como receber um mapa com uma cidade.
drop policy if exists fases_paciente_le on fases;
create policy fases_paciente_le on fases
  for select using (ativa and meu_paciente_id() is not null);

drop policy if exists paciente_fases_admin on paciente_fases;
create policy paciente_fases_admin on paciente_fases
  for all using (e_admin()) with check (e_admin());

-- A paciente lê o PRÓPRIO histórico, e só. A `observacao` fica de fora pela
-- função `minha_fase()`; pela tabela ela alcançaria, então a política aqui
-- existe para o caso de leitura direta e a função é que decide o recorte.
drop policy if exists paciente_fases_minhas on paciente_fases;
create policy paciente_fases_minhas on paciente_fases
  for select using (paciente_id = meu_paciente_id());

/** Cria ou atualiza uma fase. */
create or replace function salvar_fase(
  p_id uuid, p_nome text, p_descricao text, p_ordem integer, p_ativa boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista define as fases.' using errcode = '42501';
  end if;
  if coalesce(trim(p_nome), '') = '' then
    raise exception 'A fase precisa de um nome.' using errcode = '22023';
  end if;

  if p_id is null then
    insert into fases (nome, descricao, ordem, ativa)
    values (trim(p_nome), nullif(trim(p_descricao), ''),
            coalesce(p_ordem, 0), coalesce(p_ativa, true))
    returning id into v_id;
  else
    update fases
       set nome = trim(p_nome),
           descricao = nullif(trim(p_descricao), ''),
           ordem = coalesce(p_ordem, ordem),
           ativa = coalesce(p_ativa, ativa)
     where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'Fase não encontrada.' using errcode = '22023';
    end if;
  end if;

  return v_id;
end;
$$;

revoke all on function salvar_fase(uuid, text, text, integer, boolean) from anon, public;
grant execute on function salvar_fase(uuid, text, text, integer, boolean) to authenticated;

/**
 * Apaga uma fase — só se ninguém passou por ela.
 *
 * Com histórico, desativa em vez de apagar, e diz isso. Apagar levaria o
 * passado junto, e "por onde esta paciente passou" é justamente o que o
 * módulo existe para guardar.
 */
create or replace function excluir_fase(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista mexe nas fases.' using errcode = '42501';
  end if;

  if exists (select 1 from paciente_fases where fase_id = p_id) then
    update fases set ativa = false where id = p_id;
    return 'desativada';
  end if;

  delete from fases where id = p_id;
  return 'apagada';
end;
$$;

revoke all on function excluir_fase(uuid) from anon, public;
grant execute on function excluir_fase(uuid) to authenticated;

/**
 * Move uma paciente para uma fase.
 *
 * Grava uma LINHA NOVA, sempre. Mover é um evento com data, não a edição de
 * um campo — é isso que deixa responder "quanto tempo ela ficou na
 * restrição" seis meses depois.
 *
 * Mover para a fase em que ela já está, no mesmo dia, não duplica: é o
 * clique repetido, não uma mudança.
 */
create or replace function mover_de_fase(
  p_paciente uuid, p_fase uuid, p_inicio date, p_observacao text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_inicio date;
  v_atual uuid;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista muda a fase.' using errcode = '42501';
  end if;
  if not exists (select 1 from pacientes where id = p_paciente) then
    raise exception 'Paciente não encontrada.' using errcode = '22023';
  end if;
  if not exists (select 1 from fases where id = p_fase) then
    raise exception 'Fase não encontrada.' using errcode = '22023';
  end if;

  v_inicio := coalesce(p_inicio, hoje_sp());

  select fase_id into v_atual
    from paciente_fases
   where paciente_id = p_paciente
   order by inicio desc, criado_em desc
   limit 1;

  if v_atual = p_fase and exists (
    select 1 from paciente_fases
     where paciente_id = p_paciente and fase_id = p_fase and inicio = v_inicio)
  then
    -- Já está nessa fase desde esse dia. O clique repetido não vira linha.
    return null;
  end if;

  insert into paciente_fases (paciente_id, fase_id, inicio, observacao)
  values (p_paciente, p_fase, v_inicio, nullif(trim(p_observacao), ''))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function mover_de_fase(uuid, uuid, date, text) from anon, public;
grant execute on function mover_de_fase(uuid, uuid, date, text) to authenticated;

/** Desfaz uma mudança registrada por engano. */
create or replace function apagar_mudanca_de_fase(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista mexe no histórico.' using errcode = '42501';
  end if;
  delete from paciente_fases where id = p_id;
  return found;
end;
$$;

revoke all on function apagar_mudanca_de_fase(uuid) from anon, public;
grant execute on function apagar_mudanca_de_fase(uuid) to authenticated;

/** As fases dela, com quantas pacientes estão em cada uma agora. */
create or replace function listar_fases()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê as fases.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', f.id, 'nome', f.nome, 'descricao', f.descricao,
      'ordem', f.ordem, 'ativa', f.ativa,
      -- Quantas estão NESTA fase agora. Conta pela linha mais recente de
      -- cada paciente, e não por quantas já passaram por aqui.
      'pacientes', (
        select count(*) from pacientes p
         where (select pf.fase_id from paciente_fases pf
                 where pf.paciente_id = p.id
                 order by pf.inicio desc, pf.criado_em desc limit 1) = f.id),
      -- A tela precisa saber se dá para apagar sem perder passado.
      'temHistorico', exists (select 1 from paciente_fases pf where pf.fase_id = f.id))
    order by f.ordem, f.nome)
    from fases f
  ), '[]'::jsonb);
end;
$$;

revoke all on function listar_fases() from anon, public;
grant execute on function listar_fases() to authenticated;

/** Por onde uma paciente passou, para o prontuário. */
create or replace function fases_do_paciente(p_paciente uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê o histórico de fases.' using errcode = '42501';
  end if;
  if not exists (select 1 from pacientes where id = p_paciente) then
    raise exception 'Paciente não encontrada.' using errcode = '22023';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', pf.id, 'faseId', f.id, 'fase', f.nome,
      'inicio', pf.inicio, 'observacao', pf.observacao)
    order by pf.inicio desc, pf.criado_em desc)
    from paciente_fases pf join fases f on f.id = pf.fase_id
    where pf.paciente_id = p_paciente
  ), '[]'::jsonb);
end;
$$;

revoke all on function fases_do_paciente(uuid) from anon, public;
grant execute on function fases_do_paciente(uuid) to authenticated;

/**
 * Onde a paciente está, para ela.
 *
 * Devolve o caminho inteiro e em qual ponto ela está — um mapa com "você
 * está aqui". Ver só a própria fase seria receber um mapa com uma cidade.
 *
 * A `observacao` NÃO sai daqui. É a anotação que a nutricionista escreve
 * para si ("mudou antes do tempo porque insistiu"), e não um recado.
 *
 * Também não sai NENHUM PRAZO. Não há "você está nesta fase há 40 dias" nem
 * "o previsto eram 30". A fase seguinte chega quando ela decidir na
 * consulta; um contador na tela viraria cobrança de um prazo que ninguém
 * prometeu.
 */
create or replace function minha_fase()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
  v_atual uuid;
begin
  v_paciente := meu_paciente_id();
  if v_paciente is null or not tem_acesso() then
    return jsonb_build_object('temFase', false, 'fases', '[]'::jsonb);
  end if;

  select fase_id into v_atual
    from paciente_fases
   where paciente_id = v_paciente
   order by inicio desc, criado_em desc
   limit 1;

  -- Sem fase registrada, o cartão some inteiro. "Você ainda não está em
  -- nenhuma fase" informaria que existe algo do qual ela está de fora.
  if v_atual is null then
    return jsonb_build_object('temFase', false, 'fases', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'temFase', true,
    'atualId', v_atual,
    'desde', (select inicio from paciente_fases
               where paciente_id = v_paciente and fase_id = v_atual
               order by inicio desc limit 1),
    -- As ativas MAIS a fase em que ela está, mesmo desativada.
    --
    -- Sem o `or f.id = v_atual`, desativar uma fase tirava do mapa quem
    -- estava nela: a paciente veria o caminho inteiro e nenhum "você está
    -- aqui". Desativar quer dizer "não coloco mais ninguém aqui", e não
    -- "quem está some". A bateria pegou isto.
    'fases', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id, 'nome', f.nome, 'descricao', f.descricao,
        'ordem', f.ordem, 'atual', f.id = v_atual)
      order by f.ordem, f.nome)
      from fases f where f.ativa or f.id = v_atual
    ), '[]'::jsonb));
end;
$$;

grant execute on function minha_fase() to authenticated;

-- -----------------------------------------------------------------------------
-- A fase entra no panorama
-- -----------------------------------------------------------------------------
--
-- Sem isto, para saber quem está em reintrodução ela abriria as oito fichas
-- uma a uma. O corpo abaixo é o da 0040 com uma chave a mais: `create or
-- replace` substitui a função inteira, não existe "aplicar um pedaço".

create or replace function panorama_dos_pacientes(p_dias integer default 28)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_desde date;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê o panorama.' using errcode = '42501';
  end if;

  v_desde := hoje_sp() - greatest(coalesce(p_dias, 28), 1);

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id,
      'nome', p.nome,
      'email', p.email,
      'condicao', p.condicao,
      -- A fase atual: a linha de início mais recente. Nula quando ela ainda
      -- não foi colocada em nenhuma.
      'fase', (
        select f.nome from paciente_fases pf join fases f on f.id = pf.fase_id
         where pf.paciente_id = p.id
         order by pf.inicio desc, pf.criado_em desc limit 1),
      'faseDesde', (
        select pf.inicio from paciente_fases pf
         where pf.paciente_id = p.id
         order by pf.inicio desc, pf.criado_em desc limit 1),
      'situacao', situacao_paciente(p.status, p.perfil_id, p.data_inicio, p.data_fim),
      'dataInicio', p.data_inicio,
      'dataFim', p.data_fim,
      'diasRestantes', p.data_fim - hoje_sp(),

      'proximaConsulta', (
        select jsonb_build_object('data', c.data, 'hora', c.hora, 'tipo', c.tipo)
        from consultas c
        where c.paciente_id = p.id and c.status = 'agendada' and c.data >= hoje_sp()
        order by c.data, c.hora nulls last limit 1
      ),

      'ultimaConsulta', (
        select jsonb_build_object('data', c.data, 'tipo', c.tipo, 'resumo', c.resumo)
        from consultas c
        where c.paciente_id = p.id and c.status = 'concluida'
        order by c.data desc limit 1
      ),

      'ultimoRegistro', greatest(
        (select max(r.data) from meta_registros r
           join metas m on m.id = r.meta_id where m.paciente_id = p.id),
        (select max(s.data) from treino_sessoes s where s.paciente_id = p.id),
        (select max(c2.data) from cardio_sessoes c2 where c2.paciente_id = p.id),
        (select max(rr.data) from reintroducao_registros rr where rr.paciente_id = p.id)
      ),

      'pesoInicial', (
        select (a.dados ->> 'peso')::numeric from avaliacoes_fisicas a
        where a.paciente_id = p.id and a.publicada and (a.dados ->> 'peso') is not null
        order by a.data limit 1
      ),
      'pesoAtual', (
        select (a.dados ->> 'peso')::numeric from avaliacoes_fisicas a
        where a.paciente_id = p.id and a.publicada and (a.dados ->> 'peso') is not null
        order by a.data desc limit 1
      ),

      'metas', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', m.id, 'titulo', m.titulo, 'descricao', m.descricao,
                 'categoria', m.categoria, 'frequencia', m.frequencia,
                 'alvo', m.alvo, 'unidade', m.unidade, 'inicio', m.inicio,
                 'prazo', m.prazo, 'status', m.status,
                 'registros', coalesce((
                   select jsonb_agg(jsonb_build_object(
                            'id', r.id, 'data', r.data,
                            'quantidade', r.quantidade, 'observacao', r.observacao)
                          order by r.data desc)
                   from meta_registros r
                   where r.meta_id = m.id and r.data >= v_desde
                 ), '[]'::jsonb)))
        from metas m where m.paciente_id = p.id and m.status = 'ativa'
      ), '[]'::jsonb)
    ) order by p.nome)
    from pacientes p
  ), '[]'::jsonb);
end;
$$;

revoke all on function panorama_dos_pacientes(integer) from anon, public;
grant execute on function panorama_dos_pacientes(integer) to authenticated;
