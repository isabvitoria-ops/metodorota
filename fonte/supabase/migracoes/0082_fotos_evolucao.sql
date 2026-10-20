-- =============================================================================
-- CENTRAL DO PACIENTE — 0081: Fotos evolutivas com comparativo visual
--
-- A paciente registra fotos de poses padronizadas (frente, perfil, costas,
-- abdômen) ao longo do acompanhamento. A nutricionista e a própria paciente
-- visualizam as fotos e comparam antes/depois com um slider.
--
-- Estrutura:
--   · fotos_evolucao: cada linha é uma foto numa pose em uma sessão.
--   · Sessão = (paciente_id, data) — não precisa de tabela separada.
--   · Bucket "fotos-evolucao" com RLS; pastas por paciente.
-- =============================================================================

-- 1) Tipo de pose (enum evita valores inventados)
do $$ begin
  if not exists (select 1 from pg_type where typname = 'pose_foto') then
    create type pose_foto as enum ('frente', 'lado', 'costas', 'abdomen');
  end if;
end $$;

-- 2) Tabela
create table if not exists fotos_evolucao (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes(id) on delete cascade,
  data date not null default (now() at time zone 'America/Sao_Paulo')::date,
  pose pose_foto not null,
  caminho text not null,
  criado_em timestamptz not null default now(),

  constraint fotos_evolucao_unica unique (paciente_id, data, pose)
);

create index if not exists idx_fotos_evolucao_paciente
  on fotos_evolucao (paciente_id, data desc);

-- 3) RLS
alter table fotos_evolucao enable row level security;

create policy "paciente_ve_suas_fotos" on fotos_evolucao
  for select to authenticated
  using (paciente_id = meu_paciente_id() or e_admin());

create policy "admin_gerencia_fotos" on fotos_evolucao
  for all to authenticated
  using (e_admin())
  with check (e_admin());

-- 4) Bucket de storage (idempotente)
insert into storage.buckets (id, name, public)
values ('fotos-evolucao', 'fotos-evolucao', false)
on conflict (id) do nothing;

-- Storage policies
create policy "evolucao_upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fotos-evolucao'
    and (
      e_admin()
      or (storage.foldername(name))[1] = meu_paciente_id()::text
    )
  );

create policy "evolucao_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'fotos-evolucao'
    and (
      e_admin()
      or (storage.foldername(name))[1] = meu_paciente_id()::text
    )
  );

create policy "evolucao_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'fotos-evolucao'
    and e_admin()
  );

-- 5) A paciente descobre sua pasta
create or replace function minha_pasta_de_evolucao()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select id::text from pacientes where perfil_id = auth.uid();
$$;

revoke all on function minha_pasta_de_evolucao() from anon, public;
grant execute on function minha_pasta_de_evolucao() to authenticated;

-- 6) Registrar foto (paciente ou admin)
create or replace function registrar_foto_evolucao(
  p_caminho text,
  p_pose pose_foto,
  p_data date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
  v_data date;
  v_id uuid;
begin
  if e_admin() then
    v_paciente := (
      select id from pacientes
      where id::text = split_part(p_caminho, '/', 1)
    );
  else
    v_paciente := meu_paciente_id();
  end if;

  if v_paciente is null then
    raise exception 'Paciente não encontrada.' using errcode = '22023';
  end if;

  v_data := coalesce(p_data, (now() at time zone 'America/Sao_Paulo')::date);

  insert into fotos_evolucao (paciente_id, data, pose, caminho)
  values (v_paciente, v_data, p_pose, p_caminho)
  on conflict (paciente_id, data, pose)
  do update set caminho = excluded.caminho, criado_em = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function registrar_foto_evolucao(text, pose_foto, date) from anon, public;
grant execute on function registrar_foto_evolucao(text, pose_foto, date) to authenticated;

-- 7) Minhas fotos evolutivas (paciente)
create or replace function minhas_fotos_evolucao()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
begin
  v_paciente := meu_paciente_id();
  if v_paciente is null then return '[]'::jsonb; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', f.id,
      'data', f.data,
      'pose', f.pose,
      'caminho', f.caminho,
      'criadoEm', f.criado_em
    ) order by f.data desc, f.pose)
    from fotos_evolucao f
    where f.paciente_id = v_paciente
  ), '[]'::jsonb);
end;
$$;

revoke all on function minhas_fotos_evolucao() from anon, public;
grant execute on function minhas_fotos_evolucao() to authenticated;

-- 8) Fotos evolutivas de uma paciente (admin)
create or replace function fotos_evolucao_do_paciente(p_paciente uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', f.id,
      'data', f.data,
      'pose', f.pose,
      'caminho', f.caminho,
      'criadoEm', f.criado_em
    ) order by f.data desc, f.pose)
    from fotos_evolucao f
    where f.paciente_id = p_paciente
  ), '[]'::jsonb);
end;
$$;

revoke all on function fotos_evolucao_do_paciente(uuid) from anon, public;
grant execute on function fotos_evolucao_do_paciente(uuid) to authenticated;

-- 9) Apagar foto (admin)
create or replace function apagar_foto_evolucao(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caminho text;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista apaga fotos evolutivas.' using errcode = '42501';
  end if;

  delete from fotos_evolucao where id = p_id returning caminho into v_caminho;

  if v_caminho is null then
    raise exception 'Foto não encontrada.' using errcode = '22023';
  end if;

  return v_caminho;
end;
$$;

revoke all on function apagar_foto_evolucao(uuid) from anon, public;
grant execute on function apagar_foto_evolucao(uuid) to authenticated;
