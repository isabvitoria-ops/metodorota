-- 0110 — Acesso por código (pedido dela em 25/11/2026, aprovado no mesmo dia).
--
-- "No DietSystem, quando dá problema, eles dão um acesso via código: a
-- paciente digita o código na primeira vez, coloca um e-mail a gosto dela,
-- cria uma senha, e pronto." O e-mail do Supabase gratuito sai só cerca de
-- duas vezes por hora; o código não depende de e-mail nenhum.
--
-- * A nutricionista gera o código na ficha (gerar_codigo_de_acesso). Vale 7
--   dias e uma vez só; gerar outro cancela o anterior.
-- * O banco guarda só o sha256 do código, nunca o código.
-- * Quem usa o código é a função do servidor `entrar-com-codigo` (chave de
--   serviço): confere o código e o e-mail (conferir_codigo_de_acesso), cria
--   ou acerta a conta com a senha escolhida e liga a conta à ficha
--   (concluir_codigo_de_acesso). Nenhuma das duas é chamável por quem está
--   no navegador.
-- * Tentativa errada fica anotada; com 30 erradas em 15 minutos, o servidor
--   para de conferir por um tempo (ninguém fica chutando código).

create table if not exists public.codigos_de_acesso (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  codigo_hash text not null unique,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  usado_em timestamptz,
  criado_por uuid
);
create index if not exists codigos_de_acesso_paciente on public.codigos_de_acesso (paciente_id, criado_em desc);

create table if not exists public.tentativas_de_codigo (
  id bigserial primary key,
  em timestamptz not null default now()
);
create index if not exists tentativas_de_codigo_em on public.tentativas_de_codigo (em);

alter table public.codigos_de_acesso enable row level security;
alter table public.tentativas_de_codigo enable row level security;
revoke all on public.codigos_de_acesso from anon, authenticated;
revoke all on public.tentativas_de_codigo from anon, authenticated;
-- Sem política: ninguém do navegador lê nem escreve. Tudo passa pelas funções.

-- O código digitado, do jeito que o banco compara: maiúsculo, sem espaço nem
-- traço, e em sha256.
create or replace function _hash_do_codigo(p_codigo text)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(sha256(convert_to(upper(regexp_replace(coalesce(p_codigo, ''), '[^A-Za-z0-9]', '', 'g')), 'UTF8')), 'hex')
$$;

-- -----------------------------------------------------------------------------
-- 1. A nutricionista gera
-- -----------------------------------------------------------------------------
create or replace function gerar_codigo_de_acesso(p_paciente uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Sem letras e números que se confundem (O/0, I/1/L).
  v_alfabeto constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_codigo text := '';
  v_expira timestamptz := now() + interval '7 days';
  i integer;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista gera código de acesso.' using errcode = '42501';
  end if;
  if not exists (select 1 from pacientes where id = p_paciente) then
    raise exception 'Paciente não encontrada.' using errcode = 'P0002';
  end if;

  -- O código anterior que ainda valia deixa de valer.
  update codigos_de_acesso set expira_em = now()
  where paciente_id = p_paciente and usado_em is null and expira_em > now();

  -- 8 caracteres a partir de bytes aleatórios (gen_random_uuid usa o
  -- gerador seguro do Postgres).
  v_bytes := uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid());
  for i in 0..7 loop
    v_codigo := v_codigo || substr(v_alfabeto, (get_byte(v_bytes, i) % length(v_alfabeto)) + 1, 1);
  end loop;

  insert into codigos_de_acesso (paciente_id, codigo_hash, expira_em, criado_por)
  values (p_paciente, _hash_do_codigo(v_codigo), v_expira, auth.uid());

  return jsonb_build_object(
    'codigo', substr(v_codigo, 1, 4) || '-' || substr(v_codigo, 5, 4),
    'expiraEm', v_expira
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. O servidor confere o código e o e-mail escolhido
-- -----------------------------------------------------------------------------
create or replace function conferir_codigo_de_acesso(p_codigo text, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_codigo codigos_de_acesso;
  v_paciente pacientes;
  v_usuario uuid;
  v_papel text;
begin
  if (select count(*) from tentativas_de_codigo where em > now() - interval '15 minutes') >= 30 then
    return jsonb_build_object('ok', false, 'motivo', 'muitas_tentativas');
  end if;

  select * into v_codigo from codigos_de_acesso
  where codigo_hash = _hash_do_codigo(p_codigo) and usado_em is null and expira_em > now();
  if v_codigo.id is null then
    insert into tentativas_de_codigo default values;
    return jsonb_build_object('ok', false, 'motivo', 'codigo');
  end if;

  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false, 'motivo', 'email_invalido');
  end if;

  select * into v_paciente from pacientes where id = v_codigo.paciente_id;

  -- E-mail que já é de OUTRA ficha não pode.
  if exists (select 1 from pacientes where lower(btrim(email)) = v_email and id <> v_paciente.id) then
    return jsonb_build_object('ok', false, 'motivo', 'email_de_outra');
  end if;

  select u.id into v_usuario from auth.users u where lower(u.email) = v_email limit 1;
  if v_usuario is not null then
    select papel into v_papel from perfis where id = v_usuario;
    -- A conta da nutricionista, ou uma conta ligada a outra ficha, nunca.
    if v_papel = 'admin'
       or exists (select 1 from pacientes where perfil_id = v_usuario and id <> v_paciente.id) then
      return jsonb_build_object('ok', false, 'motivo', 'email_de_outra');
    end if;
  end if;

  return jsonb_build_object('ok', true, 'pacienteId', v_paciente.id, 'usuarioId', v_usuario);
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. O servidor liga a conta à ficha e gasta o código
-- -----------------------------------------------------------------------------
create or replace function concluir_codigo_de_acesso(p_codigo text, p_perfil uuid, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_codigo codigos_de_acesso;
begin
  select * into v_codigo from codigos_de_acesso
  where codigo_hash = _hash_do_codigo(p_codigo) and usado_em is null and expira_em > now()
  for update;
  if v_codigo.id is null then
    raise exception 'Código inválido, vencido ou já usado.' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users where id = p_perfil and lower(email) = v_email) then
    raise exception 'Conta não confere com o e-mail.' using errcode = '22023';
  end if;
  if exists (select 1 from pacientes where perfil_id = p_perfil and id <> v_codigo.paciente_id) then
    raise exception 'Esta conta já é de outra ficha.' using errcode = '42501';
  end if;

  update pacientes
  set perfil_id = p_perfil,
      email = v_email,
      status = case when status = 'convite_pendente' then 'ativo' else status end,
      atualizado_em = now()
  where id = v_codigo.paciente_id;

  update codigos_de_acesso set usado_em = now() where id = v_codigo.id;

  return jsonb_build_object('pacienteId', v_codigo.paciente_id);
end;
$$;

revoke all on function _hash_do_codigo(text) from public, anon, authenticated;
revoke all on function gerar_codigo_de_acesso(uuid) from public, anon;
grant execute on function gerar_codigo_de_acesso(uuid) to authenticated;
revoke all on function conferir_codigo_de_acesso(text, text) from public, anon, authenticated;
revoke all on function concluir_codigo_de_acesso(text, uuid, text) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function conferir_codigo_de_acesso(text, text) to service_role;
    grant execute on function concluir_codigo_de_acesso(text, uuid, text) to service_role;
    grant execute on function _hash_do_codigo(text) to service_role;
  end if;
end;
$$;
