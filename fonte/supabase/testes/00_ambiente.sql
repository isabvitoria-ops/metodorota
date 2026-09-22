-- =============================================================================
-- Ambiente de teste — imita o que o Supabase já oferece pronto.
--
-- ESTE ARQUIVO NÃO VAI PARA O SUPABASE. Ele existe só para rodar as
-- migrações num Postgres local e conferir as políticas de acesso de verdade,
-- com papéis e sessões, em vez de confiar que elas "devem funcionar".
-- =============================================================================

create extension if not exists citext;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email citext unique not null,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);

-- No Supabase, `auth.uid()` lê o identificador do token da requisição.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end;
$$;

grant usage on schema public, auth to anon, authenticated;

-- Coletor de resultados: um teste que falha não derruba a bateria, para que
-- a saída mostre tudo o que está errado de uma vez.
create table if not exists resultados_teste (
  id serial primary key,
  nome text not null,
  passou boolean not null
);

create or replace function teste(p_nome text, p_condicao boolean)
returns void
language plpgsql
security definer
as $$
begin
  insert into resultados_teste (nome, passou) values (p_nome, coalesce(p_condicao, false));
  if coalesce(p_condicao, false) then
    raise notice '  ok   %', p_nome;
  else
    raise warning 'FALHA  %', p_nome;
  end if;
end;
$$;

-- Falhar ao escrever é o resultado esperado em vários testes; estas duas
-- funções transformam "o banco recusou" em booleano em vez de erro fatal.
--
-- A distinção importa: um INSERT barrado pela política levanta erro, mas um
-- UPDATE barrado simplesmente não encontra linha nenhuma e termina em
-- silêncio, afetando zero linhas. `nao_alterou` cobre os dois casos, que é o
-- que interessa saber — o dado não mudou.
create or replace function recusou(p_sql text)
returns boolean
language plpgsql
as $$
begin
  execute p_sql;
  return false;
exception when others then
  return true;
end;
$$;

create or replace function nao_alterou(p_sql text)
returns boolean
language plpgsql
as $$
declare
  v_linhas integer;
begin
  execute p_sql;
  get diagnostics v_linhas = row_count;
  return v_linhas = 0;
exception when others then
  return true;
end;
$$;

/**
 * O código do erro, não só "deu erro".
 *
 * `recusou` acima devolve verdadeiro para QUALQUER falha, inclusive um erro
 * de digitação no próprio teste — um teste assim passa sem provar nada. Onde
 * o motivo da recusa importa ("42501 = não é sua", "22023 = dado inválido",
 * "P0002 = não existe"), esta é a função a usar. Devolve '00000' quando
 * nada falhou, que é o código do sucesso no Postgres.
 */
create or replace function estado_de(p_sql text)
returns text
language plpgsql
as $$
begin
  execute p_sql;
  return '00000';
exception when others then
  return sqlstate;
end;
$$;

-- Sem `security definer`, de propósito: `estado_de` tem de rodar com os
-- privilégios de quem chama, senão a recusa que ela mede não seria a mesma
-- que a paciente encontraria.
grant execute on function estado_de(text) to anon, authenticated;

grant all on resultados_teste to anon, authenticated;
grant usage, select on sequence resultados_teste_id_seq to anon, authenticated;

-- -----------------------------------------------------------------------------
-- O `storage` de mentira
-- -----------------------------------------------------------------------------
--
-- O Supabase guarda arquivo numa tabela `storage.objects` protegida por RLS,
-- igual a qualquer outra. Sem esta imitacao, as politicas dos exames ficariam
-- sem bateria -- e e exatamente ali que mora o pior defeito possivel deste
-- modulo: uma paciente alcancar o exame da outra.
--
-- So as colunas que as politicas usam. Nao e o storage de verdade; e o
-- suficiente para as politicas serem exercitadas com papel e sessao.

create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets(id),
  -- O caminho dentro do balde: "<id-da-paciente>/<arquivo>". A primeira
  -- pasta e quem separa uma paciente da outra.
  name text not null,
  owner uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table storage.objects enable row level security;

grant usage on schema storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
grant select on storage.buckets to authenticated;
