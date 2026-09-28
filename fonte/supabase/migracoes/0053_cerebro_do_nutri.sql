-- =============================================================================
-- 0053 — Cérebro do Nutri
--
-- A caixa fechada onde a nutricionista guarda o material dela: PDFs de
-- artigo, capítulo de livro, protocolo, apostila, texto que ela mesma
-- escreveu. Ao atender uma paciente, o aplicativo lê o que está aqui,
-- traz os trechos que se parecem com a dúvida da consulta e propõe uma
-- conduta com CITAÇÃO — a resposta que sai vem sempre com "vi isto aqui,
-- do fulano, na página tal". Ela aceita, edita ou rejeita, e a decisão
-- volta para a ficha da paciente.
--
-- É PRIVADA. Só quem é admin lê e mexe. A paciente nunca vê a base, nunca
-- vê a pergunta, nunca vê a resposta bruta — vê a conduta final, se e
-- quando a nutricionista escolher gravar. Uma paciente logada NÃO tem
-- acesso a nenhuma linha destas tabelas, e as políticas garantem isso.
--
-- FUNCIONA SEM CHAVE DE API. Voyage AI (embeddings) e Anthropic (LLM) são
-- pagos e ainda não estão contratados. O banco não sabe disso e não
-- precisa saber: guarda o texto extraído e um tsvector com pt_unaccent,
-- e a busca cai em pesquisa textual quando o embedding é `null`. Quando
-- as chaves entrarem, os trechos antigos podem ser reprocessados sem
-- migração nova.
--
-- 1024 dimensões porque voyage-3-large tem 1024 e é o que o app vai usar.
-- Se um dia a nutri trocar de modelo, cria coluna nova em vez de
-- redimensionar a que já tem — perder o embedding calculado é mais caro
-- que perder um punhado de bytes.
-- =============================================================================

create extension if not exists vector;

-- -----------------------------------------------------------------------------
-- O balde: onde os PDFs ficam
-- -----------------------------------------------------------------------------
--
-- 20 MB por arquivo. Artigo científico costuma pesar 500 KB a 3 MB;
-- capítulo escaneado passa fácil dos 10. PDF, e nada mais: a base é de
-- texto, uma imagem de receita solta ali não serve o modelo nem o
-- contexto — se um dia entrar imagem, é outra decisão.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cerebro-do-nutri',
  'cerebro-do-nutri',
  false,
  20971520,
  array['application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- As fontes: cada linha é um documento inteiro
-- -----------------------------------------------------------------------------

create table if not exists base_conhecimento (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  -- O autor, revista, editora — livre, porque a nutri anota como quer.
  fonte text,
  tipo text not null check (tipo in ('pdf', 'texto')),
  -- Caminho no balde para pdf; nulo para texto colado direto.
  caminho text unique,
  -- O texto extraído inteiro. GUARDADO no banco de propósito: o PDF
  -- pode ser apagado do balde por engano, e sem o texto aqui a base
  -- ficaria com trechos órfãos apontando para nada.
  conteudo text not null default '',
  tamanho bigint not null default 0,
  criado_em timestamptz not null default now()
);

comment on table base_conhecimento is
  'Cérebro do Nutri: o material que a nutricionista guarda para consultar. Privado, só ela lê.';

create index if not exists base_conhecimento_por_data
  on base_conhecimento (criado_em desc);

alter table base_conhecimento enable row level security;

grant select, insert, update, delete on base_conhecimento to authenticated;

-- SÓ a admin. A paciente logada não tem política de leitura NENHUMA — a
-- tabela é invisível para ela.
drop policy if exists base_conhecimento_admin on base_conhecimento;
create policy base_conhecimento_admin on base_conhecimento
  for all using (e_admin()) with check (e_admin());

-- -----------------------------------------------------------------------------
-- Os trechos: cada linha é um pedaço buscável
-- -----------------------------------------------------------------------------
--
-- Um PDF de 30 páginas vira 40 a 80 trechos de umas 800 palavras. É o
-- pedaço que a busca traz e que a citação nomeia.
--
-- `embedding` nulo é normal: ou a fonte ainda não foi processada pela
-- Edge Function, ou a chave de embeddings não está configurada. A busca
-- lida com isso.

create table if not exists base_conhecimento_trechos (
  id uuid primary key default gen_random_uuid(),
  fonte_id uuid not null references base_conhecimento(id) on delete cascade,
  ordem integer not null,
  trecho text not null,
  embedding vector(1024),
  -- tsvector em português, sem acentos. `unaccent` porque "diabetes" e
  -- "diabéticos" nunca chegariam a se encontrar sem isso. Populado por
  -- trigger porque `unaccent` é apenas STABLE (depende do dicionário),
  -- e uma coluna gerada exige função IMMUTABLE.
  tsv tsvector,
  criado_em timestamptz not null default now(),
  unique (fonte_id, ordem)
);

create or replace function base_conhecimento_trechos_tsv_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.tsv := to_tsvector('portuguese', unaccent(coalesce(new.trecho, '')));
  return new;
end;
$$;

drop trigger if exists trechos_tsv on base_conhecimento_trechos;
create trigger trechos_tsv
  before insert or update of trecho on base_conhecimento_trechos
  for each row execute function base_conhecimento_trechos_tsv_trigger();

revoke all on function base_conhecimento_trechos_tsv_trigger() from anon, public, authenticated;

comment on table base_conhecimento_trechos is
  'Os pedaços buscáveis do Cérebro. Cada linha é ~800 palavras, com embedding e tsvector.';

create index if not exists base_conhecimento_trechos_por_fonte
  on base_conhecimento_trechos (fonte_id, ordem);

create index if not exists base_conhecimento_trechos_tsv
  on base_conhecimento_trechos using gin (tsv);

-- Índice do vetor: HNSW para busca por similaridade coseno. Só cria
-- quando existe pelo menos um embedding preenchido, senão o Postgres
-- reclama que o índice está vazio — o `create if not exists` protege
-- reruns.
create index if not exists base_conhecimento_trechos_embedding
  on base_conhecimento_trechos using hnsw (embedding vector_cosine_ops);

alter table base_conhecimento_trechos enable row level security;

grant select, insert, update, delete on base_conhecimento_trechos to authenticated;

drop policy if exists trechos_admin on base_conhecimento_trechos;
create policy trechos_admin on base_conhecimento_trechos
  for all using (e_admin()) with check (e_admin());

-- -----------------------------------------------------------------------------
-- As sugestões: uma per pergunta feita, com o resultado do laço aceita/edita/rejeita
-- -----------------------------------------------------------------------------
--
-- Cada linha é uma pergunta que a nutri fez ao Cérebro sobre uma
-- paciente e o que a IA respondeu. A conduta que ela decidiu adotar
-- (aceita como veio, editada, ou nenhuma porque rejeitou) fica junto.
-- Isso é o histórico dela para saber "o que já discutimos sobre a
-- Fulana" e o combustível de aprendizagem: uma resposta rejeitada com
-- motivo escrito é uma pista clara do que não fazer.

create table if not exists base_conhecimento_sugestoes (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes(id) on delete cascade,
  pergunta text not null,
  resposta text,
  -- Lista de {trecho_id, titulo, fonte} — o que a IA disse ter usado
  -- para responder. Jsonb porque tem que aguentar a fonte ser apagada
  -- depois: as citações antigas continuam legíveis mesmo com o vínculo
  -- quebrado.
  citacoes jsonb not null default '[]'::jsonb,
  feedback text check (feedback in ('aceita', 'editada', 'rejeitada')),
  conduta_final text,
  motivo text,
  criado_em timestamptz not null default now(),
  respondido_em timestamptz
);

comment on table base_conhecimento_sugestoes is
  'Perguntas do Cérebro por paciente, com resposta, citações e o laço aceita/edita/rejeita.';

create index if not exists sugestoes_por_paciente
  on base_conhecimento_sugestoes (paciente_id, criado_em desc);

alter table base_conhecimento_sugestoes enable row level security;

grant select, insert, update, delete on base_conhecimento_sugestoes to authenticated;

drop policy if exists sugestoes_admin on base_conhecimento_sugestoes;
create policy sugestoes_admin on base_conhecimento_sugestoes
  for all using (e_admin()) with check (e_admin());

-- -----------------------------------------------------------------------------
-- As políticas do balde
-- -----------------------------------------------------------------------------
--
-- Balde inteiro só para admin. Nenhum caminho por paciente, nenhuma
-- concessão à paciente: a base é da nutricionista, e nem os próprios
-- PDFs vazam.

drop policy if exists cerebro_balde_admin on storage.objects;
create policy cerebro_balde_admin on storage.objects
  for all
  using (bucket_id = 'cerebro-do-nutri' and e_admin())
  with check (bucket_id = 'cerebro-do-nutri' and e_admin());

-- -----------------------------------------------------------------------------
-- As funções
-- -----------------------------------------------------------------------------

/**
 * Registra uma fonte já preparada pelo cliente.
 *
 * O cliente faz a extração de texto (pdf.js roda no navegador) e passa o
 * conteúdo pronto — o banco não abre PDF nem chama biblioteca externa.
 * Se o tipo é 'pdf', o arquivo já subiu para o balde antes desta chamada.
 */
create or replace function registrar_fonte(
  p_titulo text, p_fonte text, p_tipo text,
  p_caminho text, p_conteudo text, p_tamanho bigint)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista mexe no Cérebro.' using errcode = '42501';
  end if;
  if coalesce(trim(p_titulo), '') = '' then
    raise exception 'Faltou o título.' using errcode = '22023';
  end if;
  if p_tipo not in ('pdf', 'texto') then
    raise exception 'Tipo inválido.' using errcode = '22023';
  end if;
  if p_tipo = 'pdf' and coalesce(trim(p_caminho), '') = '' then
    raise exception 'Faltou o arquivo do PDF.' using errcode = '22023';
  end if;

  insert into base_conhecimento (titulo, fonte, tipo, caminho, conteudo, tamanho)
  values (trim(p_titulo), nullif(trim(p_fonte), ''), p_tipo,
          nullif(trim(p_caminho), ''),
          coalesce(p_conteudo, ''),
          greatest(coalesce(p_tamanho, 0), 0))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function registrar_fonte(text, text, text, text, text, bigint) from anon, public;
grant execute on function registrar_fonte(text, text, text, text, text, bigint) to authenticated;

/**
 * Guarda os trechos de uma fonte.
 *
 * Vem em jsonb `[{ordem, trecho, embedding?}]`. `embedding` é opcional e
 * pode ser omitido inteiro (chave de embeddings não configurada) ou
 * enviado depois pela Edge Function num segundo passe. Repetir a
 * chamada substitui os trechos daquela fonte — reprocessar uma fonte
 * não deve deixar sujeira.
 */
create or replace function salvar_trechos(p_fonte_id uuid, p_trechos jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista mexe no Cérebro.' using errcode = '42501';
  end if;
  if not exists (select 1 from base_conhecimento where id = p_fonte_id) then
    raise exception 'Fonte não encontrada.' using errcode = '22023';
  end if;

  delete from base_conhecimento_trechos where fonte_id = p_fonte_id;

  insert into base_conhecimento_trechos (fonte_id, ordem, trecho, embedding)
  select p_fonte_id,
         (t->>'ordem')::integer,
         t->>'trecho',
         case when t ? 'embedding' and jsonb_typeof(t->'embedding') = 'array'
              then (t->>'embedding')::vector
              else null end
  from jsonb_array_elements(p_trechos) t
  where coalesce(trim(t->>'trecho'), '') <> '';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function salvar_trechos(uuid, jsonb) from anon, public;
grant execute on function salvar_trechos(uuid, jsonb) to authenticated;

/**
 * Busca no Cérebro.
 *
 * Duas estratégias, escolhidas pelo que veio: se `p_embedding` for
 * passado, ordena por proximidade coseno; senão, cai em busca textual
 * com tsvector — a nutri pode fazer o Cérebro funcionar mesmo sem
 * chave de API contratada, e a resposta ainda cita a fonte certa.
 *
 * `p_limite` limita o retorno. 8 é o padrão do lado do cliente; a
 * função aceita qualquer valor razoável para permitir experimentação.
 */
create or replace function buscar_no_cerebro(
  p_pergunta text, p_embedding vector(1024) default null, p_limite integer default 8)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_limite integer;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista consulta o Cérebro.' using errcode = '42501';
  end if;
  v_limite := greatest(1, least(coalesce(p_limite, 8), 30));

  if p_embedding is not null then
    return coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'fonteId', t.fonte_id, 'titulo', f.titulo, 'fonte', f.fonte,
        'ordem', t.ordem, 'trecho', t.trecho,
        'distancia', t.embedding <=> p_embedding)
      order by t.embedding <=> p_embedding)
      from (
        select id, fonte_id, ordem, trecho, embedding
        from base_conhecimento_trechos
        where embedding is not null
        order by embedding <=> p_embedding
        limit v_limite
      ) t
      join base_conhecimento f on f.id = t.fonte_id
    ), '[]'::jsonb);
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', t.id, 'fonteId', t.fonte_id, 'titulo', f.titulo, 'fonte', f.fonte,
      'ordem', t.ordem, 'trecho', t.trecho,
      'peso', ts_rank(t.tsv, q))
    order by ts_rank(t.tsv, q) desc)
    from (
      select t.id, t.fonte_id, t.ordem, t.trecho, t.tsv, q.q
      from base_conhecimento_trechos t,
           plainto_tsquery('portuguese', unaccent(coalesce(p_pergunta, ''))) q
      where t.tsv @@ q.q
      order by ts_rank(t.tsv, q.q) desc
      limit v_limite
    ) t
    join base_conhecimento f on f.id = t.fonte_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function buscar_no_cerebro(text, vector, integer) from anon, public;
grant execute on function buscar_no_cerebro(text, vector, integer) to authenticated;

/**
 * Guarda uma sugestão nova.
 *
 * A resposta pode entrar já pronta (com a chave de LLM configurada) ou
 * vazia (`respondido_em` nulo), para a nutri responder por conta
 * própria mais tarde. As duas situações são fluxo válido: a base
 * funciona antes de ter chaves.
 */
create or replace function registrar_sugestao(
  p_paciente uuid, p_pergunta text,
  p_resposta text, p_citacoes jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista pergunta ao Cérebro.' using errcode = '42501';
  end if;
  if not exists (select 1 from pacientes where id = p_paciente) then
    raise exception 'Paciente não encontrada.' using errcode = '22023';
  end if;
  if coalesce(trim(p_pergunta), '') = '' then
    raise exception 'Faltou a pergunta.' using errcode = '22023';
  end if;

  insert into base_conhecimento_sugestoes
    (paciente_id, pergunta, resposta, citacoes, respondido_em)
  values (p_paciente, trim(p_pergunta),
          nullif(trim(p_resposta), ''),
          coalesce(p_citacoes, '[]'::jsonb),
          case when coalesce(trim(p_resposta), '') <> '' then now() else null end)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function registrar_sugestao(uuid, text, text, jsonb) from anon, public;
grant execute on function registrar_sugestao(uuid, text, text, jsonb) to authenticated;

/**
 * Fecha o laço: a nutri aceita, edita ou rejeita.
 *
 * Uma sugestão respondida sem feedback fica na fila. Uma com feedback
 * é decisão tomada e não muda mais.
 */
create or replace function dar_feedback_sugestao(
  p_id uuid, p_feedback text, p_conduta text, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista dá feedback.' using errcode = '42501';
  end if;
  if p_feedback not in ('aceita', 'editada', 'rejeitada') then
    raise exception 'Feedback inválido.' using errcode = '22023';
  end if;

  update base_conhecimento_sugestoes
     set feedback = p_feedback,
         conduta_final = case
           when p_feedback = 'rejeitada' then null
           else nullif(trim(p_conduta), '')
         end,
         motivo = case
           when p_feedback = 'rejeitada' then nullif(trim(p_motivo), '')
           else null
         end
   where id = p_id;

  if not found then
    raise exception 'Sugestão não encontrada.' using errcode = '22023';
  end if;
end;
$$;

revoke all on function dar_feedback_sugestao(uuid, text, text, text) from anon, public;
grant execute on function dar_feedback_sugestao(uuid, text, text, text) to authenticated;

/**
 * O histórico de sugestões de uma paciente, para mostrar na ficha.
 */
create or replace function sugestoes_do_paciente(p_paciente uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê as sugestões.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id, 'pergunta', s.pergunta, 'resposta', s.resposta,
      'citacoes', s.citacoes, 'feedback', s.feedback,
      'condutaFinal', s.conduta_final, 'motivo', s.motivo,
      'criadoEm', s.criado_em, 'respondidoEm', s.respondido_em)
    order by s.criado_em desc)
    from base_conhecimento_sugestoes s where s.paciente_id = p_paciente
  ), '[]'::jsonb);
end;
$$;

revoke all on function sugestoes_do_paciente(uuid) from anon, public;
grant execute on function sugestoes_do_paciente(uuid) to authenticated;

/**
 * Lista as fontes do Cérebro. Para a tela da base.
 */
create or replace function fontes_do_cerebro()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', f.id, 'titulo', f.titulo, 'fonte', f.fonte, 'tipo', f.tipo,
      'caminho', f.caminho, 'tamanho', f.tamanho,
      'trechos', (select count(*) from base_conhecimento_trechos t where t.fonte_id = f.id),
      'comEmbedding',
        (select count(*) from base_conhecimento_trechos t
          where t.fonte_id = f.id and t.embedding is not null),
      'criadoEm', f.criado_em)
    order by f.criado_em desc)
    from base_conhecimento f
  ), '[]'::jsonb);
end;
$$;

revoke all on function fontes_do_cerebro() from anon, public;
grant execute on function fontes_do_cerebro() to authenticated;

/**
 * Apaga uma fonte. Devolve o caminho para o cliente limpar o balde.
 */
create or replace function apagar_fonte(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caminho text;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista.' using errcode = '42501';
  end if;

  select caminho into v_caminho from base_conhecimento where id = p_id;
  if not found then
    raise exception 'Fonte não encontrada.' using errcode = '22023';
  end if;

  delete from base_conhecimento where id = p_id;
  return v_caminho;
end;
$$;

revoke all on function apagar_fonte(uuid) from anon, public;
grant execute on function apagar_fonte(uuid) to authenticated;

/**
 * Quantos trechos ainda estão sem embedding.
 *
 * A tela do Cérebro mostra este número, para saber quando a Edge
 * Function terminou de indexar. Também usado para a nutri decidir se
 * ainda faz sentido pedir a chave de embeddings.
 */
create or replace function trechos_pendentes_de_embedding()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'total', (select count(*) from base_conhecimento_trechos),
    'pendentes',
      (select count(*) from base_conhecimento_trechos where embedding is null),
    'fontes', (select count(*) from base_conhecimento));
end;
$$;

revoke all on function trechos_pendentes_de_embedding() from anon, public;
grant execute on function trechos_pendentes_de_embedding() to authenticated;
