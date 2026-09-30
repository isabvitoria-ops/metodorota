-- =============================================================================
-- 0057 — Diário de fotos
--
-- A paciente fotografa a refeição, escolhe qual refeição foi e, se quiser,
-- escreve uma legenda. A nutricionista vê o "feed" da paciente na ficha e pode
-- CURTIR. É só isso, de propósito: sem comentário, sem comparação com o plano.
--
-- Foto de refeição é dado de saúde, e o que muda o tamanho do erro é que aqui
-- há ARQUIVO. Segue o mesmo desenho dos exames (0045), com as duas trancas:
--   1. a TABELA, com RLS;
--   2. o BALDE `diario-fotos`, PRIVADO, com política sobre a primeira pasta
--      do caminho ("<id-da-paciente>/<arquivo>").
-- O aplicativo pede um endereço assinado que expira; balde público seria
-- endereço que funciona para qualquer um, para sempre, sem login.
--
-- A paciente registra, lê e apaga as PRÓPRIAS fotos. Quem curte é só a
-- nutricionista — a paciente não tem como se curtir (não há política de
-- atualização para ela).
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'diario-fotos',
  'diario-fotos',
  false,
  -- 5 MB. A tela reduz a foto antes de enviar (uns 300 KB), então isto é só a
  -- rede de segurança: o plano grátis tem 1 GB no total.
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create table if not exists diario_fotos (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes (id) on delete cascade,
  caminho text not null unique,
  refeicao text not null
    check (refeicao in ('cafe', 'lanche_manha', 'almoco', 'lanche_tarde', 'jantar', 'ceia', 'outro')),
  legenda text,
  -- O dia da refeição (pode ser o de ontem, se ela esqueceu de registrar).
  data date not null default hoje_sp(),
  curtida boolean not null default false,
  curtida_em timestamptz,
  criado_em timestamptz not null default now()
);

comment on table diario_fotos is
  'Diário de fotos das refeições. O arquivo vive no balde privado `diario-fotos`; as duas coisas são protegidas separadamente.';

create index if not exists diario_fotos_por_paciente on diario_fotos (paciente_id, data desc, criado_em desc);

alter table diario_fotos enable row level security;
revoke all on diario_fotos from anon;
grant select, insert, delete on diario_fotos to authenticated;
grant update (curtida, curtida_em) on diario_fotos to authenticated;

drop policy if exists diario_admin on diario_fotos;
create policy diario_admin on diario_fotos
  for all using (e_admin()) with check (e_admin());

drop policy if exists diario_paciente_le on diario_fotos;
create policy diario_paciente_le on diario_fotos
  for select using (paciente_id = meu_paciente_id());

drop policy if exists diario_paciente_registra on diario_fotos;
create policy diario_paciente_registra on diario_fotos
  for insert with check (
    paciente_id = meu_paciente_id()
    and tem_acesso()
    -- Ninguém nasce curtido: a curtida é só da nutricionista.
    and curtida = false
  );

drop policy if exists diario_paciente_apaga on diario_fotos;
create policy diario_paciente_apaga on diario_fotos
  for delete using (paciente_id = meu_paciente_id());

-- O BALDE ---------------------------------------------------------------------

drop policy if exists diario_balde_admin on storage.objects;
create policy diario_balde_admin on storage.objects
  for all
  using (bucket_id = 'diario-fotos' and e_admin())
  with check (bucket_id = 'diario-fotos' and e_admin());

drop policy if exists diario_balde_paciente_le on storage.objects;
create policy diario_balde_paciente_le on storage.objects
  for select using (
    bucket_id = 'diario-fotos'
    and meu_paciente_id() is not null
    and split_part(name, '/', 1) = meu_paciente_id()::text
  );

drop policy if exists diario_balde_paciente_envia on storage.objects;
create policy diario_balde_paciente_envia on storage.objects
  for insert with check (
    bucket_id = 'diario-fotos'
    and tem_acesso()
    and meu_paciente_id() is not null
    and split_part(name, '/', 1) = meu_paciente_id()::text
  );

drop policy if exists diario_balde_paciente_apaga on storage.objects;
create policy diario_balde_paciente_apaga on storage.objects
  for delete using (
    bucket_id = 'diario-fotos'
    and meu_paciente_id() is not null
    and split_part(name, '/', 1) = meu_paciente_id()::text
  );

-- FUNÇÕES ---------------------------------------------------------------------

/** A pasta em que a paciente guarda as fotos: o id dela. */
create or replace function minha_pasta_do_diario()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not tem_acesso() or meu_paciente_id() is null then
    raise exception 'Seu acesso não está liberado.' using errcode = '42501';
  end if;
  return meu_paciente_id()::text;
end;
$$;

/**
 * Registra uma foto já enviada ao balde. Só a paciente, só para ela mesma: o
 * id nunca vem da tela. O caminho é conferido (a primeira pasta tem que ser a
 * dela), e há um teto de 12 fotos por dia para um erro de tela não encher o
 * plano grátis de fotos repetidas.
 */
create or replace function registrar_diario_foto(
  p_caminho text, p_refeicao text, p_legenda text, p_data date)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
  v_data date := coalesce(p_data, hoje_sp());
  v_id uuid;
begin
  if not tem_acesso() then
    raise exception 'Seu acesso não está liberado.' using errcode = '42501';
  end if;
  v_paciente := meu_paciente_id();
  if v_paciente is null then
    raise exception 'Não encontrei o seu cadastro.' using errcode = '42501';
  end if;
  if coalesce(trim(p_caminho), '') = '' then
    raise exception 'Faltou a foto.' using errcode = '22023';
  end if;
  if split_part(p_caminho, '/', 1) <> v_paciente::text then
    raise exception 'A foto não está na sua pasta.' using errcode = '42501';
  end if;
  if v_data > hoje_sp() then
    raise exception 'Não dá para registrar uma refeição de amanhã.' using errcode = '22023';
  end if;
  if v_data < hoje_sp() - 7 then
    raise exception 'Só dá para registrar refeições dos últimos 7 dias.' using errcode = '22023';
  end if;
  if (select count(*) from diario_fotos where paciente_id = v_paciente and criado_em::date = hoje_sp()) >= 12 then
    raise exception 'Você já registrou 12 fotos hoje. Amanhã dá para continuar.' using errcode = '22023';
  end if;

  insert into diario_fotos (paciente_id, caminho, refeicao, legenda, data)
  values (v_paciente, trim(p_caminho), p_refeicao,
          nullif(left(trim(coalesce(p_legenda, '')), 300), ''), v_data)
  returning id into v_id;

  return v_id;
end;
$$;

/** O meu diário, para a paciente (mais recente primeiro). */
create or replace function meu_diario(p_dias integer default 60)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_paciente uuid := meu_paciente_id();
begin
  if v_paciente is null or not tem_acesso() then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', d.id, 'caminho', d.caminho, 'refeicao', d.refeicao, 'legenda', d.legenda,
      'data', d.data, 'curtida', d.curtida, 'criadoEm', d.criado_em)
      order by d.data desc, d.criado_em desc)
    from diario_fotos d
    where d.paciente_id = v_paciente
      and d.data >= hoje_sp() - least(greatest(coalesce(p_dias, 60), 1), 365)
  ), '[]'::jsonb);
end;
$$;

/** O diário de uma paciente, para a nutricionista. */
create or replace function diario_do_paciente(p_paciente uuid, p_dias integer default 60)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê o diário pela ficha.' using errcode = '42501';
  end if;
  if not exists (select 1 from pacientes where id = p_paciente) then
    raise exception 'Paciente não encontrada.' using errcode = '22023';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', d.id, 'caminho', d.caminho, 'refeicao', d.refeicao, 'legenda', d.legenda,
      'data', d.data, 'curtida', d.curtida, 'criadoEm', d.criado_em)
      order by d.data desc, d.criado_em desc)
    from diario_fotos d
    where d.paciente_id = p_paciente
      and d.data >= hoje_sp() - least(greatest(coalesce(p_dias, 60), 1), 365)
  ), '[]'::jsonb);
end;
$$;

/** Curtir ou tirar a curtida. Só a nutricionista. */
create or replace function curtir_diario_foto(p_id uuid, p_curtida boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_curtida boolean;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista curte as fotos.' using errcode = '42501';
  end if;
  update diario_fotos
     set curtida = coalesce(p_curtida, false),
         curtida_em = case when coalesce(p_curtida, false) then now() end
   where id = p_id
  returning curtida into v_curtida;
  if v_curtida is null then
    raise exception 'Foto não encontrada.' using errcode = '22023';
  end if;
  return v_curtida;
end;
$$;

/**
 * Apaga uma foto e devolve o CAMINHO, para a tela apagar o arquivo do balde
 * em seguida (só a linha deixaria o arquivo órfão ocupando espaço). A paciente
 * apaga as dela; a nutricionista, qualquer uma.
 */
create or replace function apagar_diario_foto(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caminho text;
  v_paciente uuid;
begin
  select caminho, paciente_id into v_caminho, v_paciente from diario_fotos where id = p_id;
  if v_caminho is null then
    raise exception 'Foto não encontrada.' using errcode = '22023';
  end if;
  if e_admin() or v_paciente = meu_paciente_id() then
    delete from diario_fotos where id = p_id;
    return v_caminho;
  end if;
  raise exception 'Você não pode apagar esta foto.' using errcode = '42501';
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'minha_pasta_do_diario()', 'registrar_diario_foto(text, text, text, date)',
    'meu_diario(integer)', 'diario_do_paciente(uuid, integer)',
    'curtir_diario_foto(uuid, boolean)', 'apagar_diario_foto(uuid)'] loop
    execute format('revoke all on function %s from anon, public', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
