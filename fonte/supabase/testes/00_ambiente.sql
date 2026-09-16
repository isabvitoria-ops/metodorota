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

grant all on resultados_teste to anon, authenticated;
grant usage, select on sequence resultados_teste_id_seq to anon, authenticated;
