-- =============================================================================
-- 0079 — Restrições alimentares com alertas inteligentes.
--
-- A nutricionista registra alergias, intolerâncias, sensibilidades e
-- preferências de cada paciente. A paciente vê a lista no app.
-- O protocolo e as trocas podem cruzar essas restrições depois.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Tabela de restrições
-- ---------------------------------------------------------------------------

create table if not exists restricoes_alimentares (
  id            uuid primary key default gen_random_uuid(),
  paciente_id   uuid not null references pacientes(id) on delete cascade,
  tipo          text not null check (tipo in ('alergia', 'intolerancia', 'sensibilidade', 'preferencia')),
  alimento      text not null,
  gravidade     text not null default 'moderada'
                  check (gravidade in ('leve', 'moderada', 'grave')),
  notas         text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index restricoes_por_paciente
  on restricoes_alimentares (paciente_id);

alter table restricoes_alimentares enable row level security;

create policy "admin_le_restricoes"
  on restricoes_alimentares for select using (e_admin());
create policy "admin_grava_restricoes"
  on restricoes_alimentares for all using (e_admin());
create policy "paciente_le_proprias_restricoes"
  on restricoes_alimentares for select
  using (paciente_id = (select id from pacientes where perfil_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- 2. Admin: salvar restrição (insert ou update)
-- ---------------------------------------------------------------------------

create or replace function salvar_restricao(
  p_paciente_id uuid,
  p_id          uuid,
  p_tipo        text,
  p_alimento    text,
  p_gravidade   text,
  p_notas       text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not e_admin() then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;

  if p_id is null then
    insert into restricoes_alimentares (paciente_id, tipo, alimento, gravidade, notas)
    values (p_paciente_id, p_tipo, p_alimento, p_gravidade, p_notas)
    returning id into v_id;
  else
    update restricoes_alimentares
    set tipo = p_tipo,
        alimento = p_alimento,
        gravidade = p_gravidade,
        notas = p_notas,
        atualizado_em = now()
    where id = p_id and paciente_id = p_paciente_id;
    v_id := p_id;
  end if;

  return jsonb_build_object('id', v_id);
end;
$$;

revoke all on function salvar_restricao(uuid, uuid, text, text, text, text) from anon, public;
grant execute on function salvar_restricao(uuid, uuid, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Admin: excluir restrição
-- ---------------------------------------------------------------------------

create or replace function excluir_restricao(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;

  delete from restricoes_alimentares where id = p_id;
end;
$$;

revoke all on function excluir_restricao(uuid) from anon, public;
grant execute on function excluir_restricao(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Admin: restrições de um paciente
-- ---------------------------------------------------------------------------

create or replace function restricoes_do_paciente(p_paciente_id uuid)
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

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',           r.id,
      'tipo',         r.tipo,
      'alimento',     r.alimento,
      'gravidade',    r.gravidade,
      'notas',        r.notas,
      'criadoEm',     r.criado_em,
      'atualizadoEm', r.atualizado_em
    ) order by
      case r.gravidade when 'grave' then 1 when 'moderada' then 2 else 3 end,
      r.alimento
    )
    from restricoes_alimentares r
    where r.paciente_id = p_paciente_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function restricoes_do_paciente(uuid) from anon, public;
grant execute on function restricoes_do_paciente(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Paciente: minhas restrições
-- ---------------------------------------------------------------------------

create or replace function minhas_restricoes()
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
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',           r.id,
      'tipo',         r.tipo,
      'alimento',     r.alimento,
      'gravidade',    r.gravidade,
      'notas',        r.notas,
      'criadoEm',     r.criado_em,
      'atualizadoEm', r.atualizado_em
    ) order by
      case r.gravidade when 'grave' then 1 when 'moderada' then 2 else 3 end,
      r.alimento
    )
    from restricoes_alimentares r
    where r.paciente_id = v_paciente_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function minhas_restricoes() from anon, public;
grant execute on function minhas_restricoes() to authenticated;

commit;
