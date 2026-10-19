-- =============================================================================
-- 0078 — Rastreio de hidratação com meta personalizada.
--
-- A nutricionista define a meta diária (em mL) por paciente. O padrão
-- sugerido é peso × 50 mL/kg, mas ela ajusta.
--
-- O paciente registra cada copo ao longo do dia. O app mostra o
-- progresso e o histórico.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Meta de hidratação por paciente
-- ---------------------------------------------------------------------------

create table if not exists hidratacao_metas (
  paciente_id uuid primary key references pacientes(id) on delete cascade,
  meta_ml     integer not null check (meta_ml > 0 and meta_ml <= 10000),
  atualizado_em timestamptz not null default now()
);

alter table hidratacao_metas enable row level security;

create policy "admin_le_metas_hidratacao"
  on hidratacao_metas for select using (e_admin());
create policy "admin_grava_metas_hidratacao"
  on hidratacao_metas for all using (e_admin());
create policy "paciente_le_propria_meta"
  on hidratacao_metas for select
  using (paciente_id = (select id from pacientes where perfil_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 2. Registros diários
-- ---------------------------------------------------------------------------

create table if not exists hidratacao_registros (
  id          uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes(id) on delete cascade,
  data        date not null default hoje_sp(),
  ml          integer not null check (ml > 0 and ml <= 5000),
  tipo        text not null default 'agua'
                check (tipo in ('agua', 'cha', 'suco', 'outro')),
  criado_em   timestamptz not null default now()
);

create index hidratacao_por_paciente_data
  on hidratacao_registros (paciente_id, data desc);

alter table hidratacao_registros enable row level security;

create policy "admin_le_registros_hidratacao"
  on hidratacao_registros for select using (e_admin());
create policy "paciente_le_proprios_registros"
  on hidratacao_registros for select
  using (paciente_id = (select id from pacientes where perfil_id = auth.uid()));
create policy "paciente_insere_registro"
  on hidratacao_registros for insert
  with check (
    paciente_id = (select id from pacientes where perfil_id = auth.uid())
    and tem_acesso()
  );
create policy "paciente_apaga_proprio_registro"
  on hidratacao_registros for delete
  using (paciente_id = (select id from pacientes where perfil_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 3. Admin: definir meta
-- ---------------------------------------------------------------------------

create or replace function definir_meta_hidratacao(
  p_paciente_id uuid,
  p_meta_ml     integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;
  insert into hidratacao_metas (paciente_id, meta_ml, atualizado_em)
  values (p_paciente_id, p_meta_ml, now())
  on conflict (paciente_id)
  do update set meta_ml = excluded.meta_ml, atualizado_em = now();
end;
$$;

revoke all on function definir_meta_hidratacao(uuid, integer) from anon, public;
grant execute on function definir_meta_hidratacao(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Admin: ver hidratação de um paciente (últimos N dias)
-- ---------------------------------------------------------------------------

create or replace function hidratacao_do_paciente(
  p_paciente_id uuid,
  p_dias        integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'metaMl', (select meta_ml from hidratacao_metas where paciente_id = p_paciente_id),
    'dias', coalesce((
      select jsonb_agg(jsonb_build_object(
        'data',    d.data,
        'totalMl', d.total
      ) order by d.data desc)
      from (
        select r.data, sum(r.ml)::integer as total
        from hidratacao_registros r
        where r.paciente_id = p_paciente_id
          and r.data >= hoje_sp() - p_dias
        group by r.data
      ) d
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function hidratacao_do_paciente(uuid, integer) from anon, public;
grant execute on function hidratacao_do_paciente(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Paciente: registrar ingestão
-- ---------------------------------------------------------------------------

create or replace function registrar_hidratacao(
  p_ml   integer,
  p_tipo text default 'agua'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paciente_id uuid;
  v_registro_id uuid;
begin
  select id into v_paciente_id
    from pacientes
   where perfil_id = auth.uid()
   limit 1;

  if v_paciente_id is null then
    raise exception 'Paciente não encontrado.' using errcode = 'P0002';
  end if;

  if not tem_acesso() then
    raise exception 'Acesso expirado.' using errcode = '42501';
  end if;

  insert into hidratacao_registros (paciente_id, data, ml, tipo)
  values (v_paciente_id, hoje_sp(), p_ml, p_tipo)
  returning id into v_registro_id;

  return jsonb_build_object('id', v_registro_id);
end;
$$;

revoke all on function registrar_hidratacao(integer, text) from anon, public;
grant execute on function registrar_hidratacao(integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Paciente: desfazer registro
-- ---------------------------------------------------------------------------

create or replace function desfazer_hidratacao(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paciente_id uuid;
begin
  select id into v_paciente_id
    from pacientes where perfil_id = auth.uid() limit 1;

  delete from hidratacao_registros
   where id = p_id
     and paciente_id = v_paciente_id
     and data = hoje_sp();
end;
$$;

revoke all on function desfazer_hidratacao(uuid) from anon, public;
grant execute on function desfazer_hidratacao(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Paciente: minha hidratação de hoje + meta + histórico recente
-- ---------------------------------------------------------------------------

create or replace function minha_hidratacao()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_paciente_id uuid;
begin
  select id into v_paciente_id
    from pacientes where perfil_id = auth.uid() limit 1;

  if v_paciente_id is null then
    return null;
  end if;

  return jsonb_build_object(
    'metaMl', (select meta_ml from hidratacao_metas where paciente_id = v_paciente_id),
    'hoje', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'ml', r.ml,
        'tipo', r.tipo,
        'criadoEm', r.criado_em
      ) order by r.criado_em desc)
      from hidratacao_registros r
      where r.paciente_id = v_paciente_id
        and r.data = hoje_sp()
    ), '[]'::jsonb),
    'historico', coalesce((
      select jsonb_agg(jsonb_build_object(
        'data', d.data,
        'totalMl', d.total
      ) order by d.data desc)
      from (
        select r.data, sum(r.ml)::integer as total
        from hidratacao_registros r
        where r.paciente_id = v_paciente_id
          and r.data >= hoje_sp() - 30
          and r.data < hoje_sp()
        group by r.data
      ) d
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function minha_hidratacao() from anon, public;
grant execute on function minha_hidratacao() to authenticated;

commit;
