-- =============================================================================
-- 0070 — Marcadores de exame (resultados laboratoriais tipados)
--
-- Hoje o exame é uma caixa preta: PDF ou foto. A nutricionista sabe que a
-- ferritina da paciente caiu, mas o sistema não sabe — não tem como desenhar
-- um gráfico de evolução nem comparar com a faixa de referência.
--
-- O que esta migração faz:
--
--   1. Tabela `marcadores_exame` — cada linha é UM resultado (ex.: ferritina
--      = 45 ng/mL) vinculado a uma data e a uma paciente. O vínculo com a
--      tabela `exames` é OPCIONAL: se a nutricionista registrou o valor à mão,
--      não existe arquivo.
--
--   2. `registrar_marcadores(p_paciente, p_data, p_marcadores, p_exame_id)`
--      — grava vários marcadores de uma vez. Cada marcador traz código, valor,
--      unidade e faixa de referência (min/max). O exame_id é opcional.
--
--   3. `marcadores_do_paciente(p_paciente)` — todos os marcadores de uma
--      paciente, agrupados por data, para a nutricionista.
--
--   4. `evolucao_marcador(p_paciente, p_codigo)` — série temporal de um
--      marcador específico, para desenhar o gráfico de evolução.
--
--   5. `apagar_marcadores_da_data(p_paciente, p_data)` — remove todos os
--      marcadores de uma data (desfaz um registro errado).
--
-- Apenas a nutricionista registra e vê marcadores. A paciente não lança
-- valores — ela manda o PDF, e a nutricionista digita os que importam.
-- =============================================================================

-- 1. Tabela

create table if not exists marcadores_exame (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes(id) on delete cascade,
  exame_id uuid references exames(id) on delete set null,
  data date not null,
  codigo text not null,
  nome text not null,
  valor numeric not null,
  unidade text not null default '',
  ref_min numeric,
  ref_max numeric,
  criado_em timestamptz not null default now()
);

create index if not exists marcadores_por_paciente
  on marcadores_exame (paciente_id, codigo, data desc);

alter table marcadores_exame enable row level security;

grant select, insert, update, delete on marcadores_exame to authenticated;

drop policy if exists marcadores_admin on marcadores_exame;
create policy marcadores_admin on marcadores_exame
  for all using (e_admin()) with check (e_admin());

-- 2. Registrar marcadores (lote)

create or replace function registrar_marcadores(
  p_paciente uuid,
  p_data date,
  p_marcadores jsonb,
  p_exame_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_m jsonb;
  v_n integer := 0;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista registra marcadores.' using errcode = '42501';
  end if;
  if not exists (select 1 from pacientes where id = p_paciente) then
    raise exception 'Paciente não encontrada.' using errcode = '22023';
  end if;
  if p_data is null then
    raise exception 'A data do exame é obrigatória.' using errcode = '22023';
  end if;
  if p_exame_id is not null and not exists (
    select 1 from exames where id = p_exame_id and paciente_id = p_paciente
  ) then
    raise exception 'Exame não pertence a esta paciente.' using errcode = '22023';
  end if;

  for v_m in select * from jsonb_array_elements(p_marcadores) loop
    insert into marcadores_exame (
      paciente_id, exame_id, data, codigo, nome, valor, unidade, ref_min, ref_max
    ) values (
      p_paciente,
      p_exame_id,
      p_data,
      v_m->>'codigo',
      v_m->>'nome',
      (v_m->>'valor')::numeric,
      coalesce(v_m->>'unidade', ''),
      (v_m->>'refMin')::numeric,
      (v_m->>'refMax')::numeric
    );
    v_n := v_n + 1;
  end loop;

  return v_n;
end;
$$;

revoke all on function registrar_marcadores(uuid, date, jsonb, uuid) from anon, public;
grant execute on function registrar_marcadores(uuid, date, jsonb, uuid) to authenticated;

-- 3. Todos os marcadores de uma paciente, agrupados por data

create or replace function marcadores_do_paciente(p_paciente uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê os marcadores.' using errcode = '42501';
  end if;
  if not exists (select 1 from pacientes where id = p_paciente) then
    raise exception 'Paciente não encontrada.' using errcode = '22023';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'data', d.data,
      'exameId', d.exame_id,
      'marcadores', d.marcadores)
    order by d.data desc)
    from (
      select m.data, m.exame_id,
             jsonb_agg(jsonb_build_object(
               'id', m.id,
               'codigo', m.codigo,
               'nome', m.nome,
               'valor', m.valor,
               'unidade', m.unidade,
               'refMin', m.ref_min,
               'refMax', m.ref_max)
             order by m.nome) as marcadores
        from marcadores_exame m
       where m.paciente_id = p_paciente
       group by m.data, m.exame_id
    ) d
  ), '[]'::jsonb);
end;
$$;

revoke all on function marcadores_do_paciente(uuid) from anon, public;
grant execute on function marcadores_do_paciente(uuid) to authenticated;

-- 4. Série temporal de um marcador

create or replace function evolucao_marcador(p_paciente uuid, p_codigo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê a evolução.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'data', m.data,
      'valor', m.valor,
      'unidade', m.unidade,
      'refMin', m.ref_min,
      'refMax', m.ref_max)
    order by m.data)
    from marcadores_exame m
    where m.paciente_id = p_paciente and m.codigo = p_codigo
  ), '[]'::jsonb);
end;
$$;

revoke all on function evolucao_marcador(uuid, text) from anon, public;
grant execute on function evolucao_marcador(uuid, text) to authenticated;

-- 5. Apagar marcadores de uma data

create or replace function apagar_marcadores_da_data(
  p_paciente uuid,
  p_data date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista apaga marcadores.' using errcode = '42501';
  end if;

  delete from marcadores_exame
   where paciente_id = p_paciente and data = p_data;
  get diagnostics v_n = row_count;

  if v_n = 0 then
    raise exception 'Nenhum marcador nesta data.' using errcode = '22023';
  end if;

  return v_n;
end;
$$;

revoke all on function apagar_marcadores_da_data(uuid, date) from anon, public;
grant execute on function apagar_marcadores_da_data(uuid, date) to authenticated;

-- Conferência
select column_name from information_schema.columns
 where table_name = 'marcadores_exame'
 order by ordinal_position;
