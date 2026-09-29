-- =============================================================================
-- 0055 — Condutas em Kanban, com modelos reutilizáveis
--
-- O protocolo era texto. Agora as CONDUTAS viram tarefas com prazo e status
-- (A fazer → Em andamento → Concluída), por paciente.
--
--   * MODELOS: a nutricionista monta os dela ("Protocolo SIBO/disbiose",
--     "Reintrodução FODMAP"), cada etapa com um prazo RELATIVO em dias
--     (D+0, D+7, D+14…). Nenhum modelo vem pronto: a lista é dela.
--   * APLICAR um modelo numa paciente cria as tarefas com a DATA calculada a
--     partir da data escolhida. A tela mostra as datas e deixa editar antes de
--     confirmar — o banco só recebe o que ela confirmou.
--   * A tarefa guarda o nome do modelo de onde veio (foto): apagar ou mudar o
--     modelo depois não mexe no que já foi aplicado.
--   * Também dá para criar tarefa solta, sem modelo.
--
-- Tudo é da nutricionista: a paciente não lê nem escreve aqui.
-- =============================================================================

create table if not exists modelos_conduta (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists modelos_conduta_etapas (
  id uuid primary key default gen_random_uuid(),
  modelo_id uuid not null references modelos_conduta (id) on delete cascade,
  ordem integer not null default 0,
  titulo text not null,
  descricao text,
  -- "D+7": quantos dias depois da data de aplicação. 0 = no próprio dia.
  dias integer not null default 0 check (dias between 0 and 3650)
);
create index if not exists modelos_conduta_etapas_modelo on modelos_conduta_etapas (modelo_id, ordem);

create table if not exists condutas (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes (id) on delete cascade,
  titulo text not null,
  descricao text,
  prazo date,
  status text not null default 'a_fazer' check (status in ('a_fazer', 'andamento', 'concluida')),
  ordem integer not null default 0,
  modelo_id uuid references modelos_conduta (id) on delete set null,
  -- Foto do nome do modelo no dia em que foi aplicado.
  modelo_nome text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  concluida_em timestamptz
);
create index if not exists condutas_paciente on condutas (paciente_id, status, prazo);
create index if not exists condutas_pendentes on condutas (status, prazo) where status <> 'concluida';

comment on table condutas is 'Tarefas de conduta por paciente (Kanban). Só a nutricionista.';

do $$
declare t text;
begin
  foreach t in array array['modelos_conduta', 'modelos_conduta_etapas', 'condutas'] loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from anon', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
    execute format('drop policy if exists so_admin on %I', t);
    execute format('create policy so_admin on %I for all using (e_admin()) with check (e_admin())', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Modelos
-- -----------------------------------------------------------------------------

create or replace function listar_modelos_conduta()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê os modelos de conduta.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', m.id, 'nome', m.nome, 'descricao', m.descricao,
      'etapas', coalesce((
        select jsonb_agg(jsonb_build_object('id', e.id, 'titulo', e.titulo, 'descricao', e.descricao, 'dias', e.dias)
                         order by e.ordem, e.dias)
        from modelos_conduta_etapas e where e.modelo_id = m.id), '[]'::jsonb))
      order by m.nome)
    from modelos_conduta m
  ), '[]'::jsonb);
end;
$$;

-- Grava o modelo inteiro (nome + lista de etapas, que substitui a anterior).
create or replace function salvar_modelo_conduta(p_id uuid, p_nome text, p_descricao text, p_etapas jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_nome text := btrim(coalesce(p_nome, ''));
  e jsonb;
  i integer := 0;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista cria modelos de conduta.' using errcode = '42501';
  end if;
  if v_nome = '' then
    raise exception 'O modelo precisa de um nome.' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_etapas, '[]'::jsonb)) <> 'array' then
    raise exception 'Etapas inválidas.' using errcode = '22023';
  end if;

  if p_id is null then
    insert into modelos_conduta (nome, descricao)
    values (v_nome, nullif(btrim(coalesce(p_descricao, '')), ''))
    returning id into v_id;
  else
    update modelos_conduta
       set nome = v_nome, descricao = nullif(btrim(coalesce(p_descricao, '')), ''), atualizado_em = now()
     where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'Modelo não encontrado.' using errcode = 'P0002';
    end if;
    delete from modelos_conduta_etapas where modelo_id = v_id;
  end if;

  for e in select * from jsonb_array_elements(coalesce(p_etapas, '[]'::jsonb)) loop
    continue when btrim(coalesce(e ->> 'titulo', '')) = '';
    i := i + 1;
    insert into modelos_conduta_etapas (modelo_id, ordem, titulo, descricao, dias)
    values (v_id, i, btrim(e ->> 'titulo'),
            nullif(btrim(coalesce(e ->> 'descricao', '')), ''),
            greatest(0, least(3650, coalesce((e ->> 'dias')::integer, 0))));
  end loop;
  return v_id;
end;
$$;

create or replace function excluir_modelo_conduta(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista apaga modelos.' using errcode = '42501';
  end if;
  -- As condutas já aplicadas ficam: modelo_id vira nulo, o nome continua.
  delete from modelos_conduta where id = p_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Condutas da paciente
-- -----------------------------------------------------------------------------

-- Aplica um modelo com as datas que ela CONFIRMOU na tela:
-- p_etapas = [{ "titulo", "descricao", "prazo": "AAAA-MM-DD" }, …]
create or replace function aplicar_modelo_conduta(p_paciente uuid, p_modelo uuid, p_etapas jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
  v_modelo uuid;
  v_ordem integer;
  e jsonb;
  n integer := 0;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista aplica condutas.' using errcode = '42501';
  end if;
  if not exists (select 1 from pacientes where id = p_paciente) then
    raise exception 'Paciente não encontrada.' using errcode = 'P0002';
  end if;
  -- Se o modelo foi apagado entre abrir a tela e confirmar, as tarefas
  -- entram soltas em vez de a aplicação inteira falhar.
  select id, nome into v_modelo, v_nome from modelos_conduta where id = p_modelo;
  select coalesce(max(ordem), 0) into v_ordem from condutas where paciente_id = p_paciente;

  for e in select * from jsonb_array_elements(coalesce(p_etapas, '[]'::jsonb)) loop
    continue when btrim(coalesce(e ->> 'titulo', '')) = '';
    n := n + 1;
    insert into condutas (paciente_id, titulo, descricao, prazo, ordem, modelo_id, modelo_nome)
    values (p_paciente, btrim(e ->> 'titulo'),
            nullif(btrim(coalesce(e ->> 'descricao', '')), ''),
            nullif(e ->> 'prazo', '')::date,
            v_ordem + n, v_modelo, v_nome);
  end loop;
  return n;
end;
$$;

create or replace function condutas_de(p_paciente uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê as condutas.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'pacienteId', c.paciente_id, 'titulo', c.titulo, 'descricao', c.descricao,
      'prazo', c.prazo, 'status', c.status, 'modeloNome', c.modelo_nome,
      'criadoEm', c.criado_em, 'concluidaEm', c.concluida_em)
      order by c.prazo nulls last, c.ordem)
    from condutas c where c.paciente_id = p_paciente
  ), '[]'::jsonb);
end;
$$;

-- Criar ou editar uma tarefa solta (ou editar uma que veio de modelo).
create or replace function salvar_conduta(
  p_id uuid, p_paciente uuid, p_titulo text, p_descricao text, p_prazo date, p_status text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_titulo text := btrim(coalesce(p_titulo, ''));
  v_status text := case when p_status in ('a_fazer', 'andamento', 'concluida') then p_status else 'a_fazer' end;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista cria condutas.' using errcode = '42501';
  end if;
  if v_titulo = '' then
    raise exception 'A conduta precisa de um título.' using errcode = '22023';
  end if;
  if p_id is null then
    if not exists (select 1 from pacientes where id = p_paciente) then
      raise exception 'Paciente não encontrada.' using errcode = 'P0002';
    end if;
    insert into condutas (paciente_id, titulo, descricao, prazo, status, ordem, concluida_em)
    values (p_paciente, v_titulo, nullif(btrim(coalesce(p_descricao, '')), ''), p_prazo, v_status,
            (select coalesce(max(ordem), 0) + 1 from condutas where paciente_id = p_paciente),
            case when v_status = 'concluida' then now() end)
    returning id into v_id;
  else
    update condutas
       set titulo = v_titulo,
           descricao = nullif(btrim(coalesce(p_descricao, '')), ''),
           prazo = p_prazo,
           status = v_status,
           concluida_em = case when v_status = 'concluida' then coalesce(concluida_em, now()) end,
           atualizado_em = now()
     where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'Conduta não encontrada.' using errcode = 'P0002';
    end if;
  end if;
  return v_id;
end;
$$;

-- Mover no Kanban. Devolve o status que ficou gravado.
create or replace function mover_conduta(p_id uuid, p_status text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista move condutas.' using errcode = '42501';
  end if;
  if p_status not in ('a_fazer', 'andamento', 'concluida') then
    raise exception 'Status inválido.' using errcode = '22023';
  end if;
  update condutas
     set status = p_status,
         concluida_em = case when p_status = 'concluida' then coalesce(concluida_em, now()) end,
         atualizado_em = now()
   where id = p_id
  returning status into v_status;
  if v_status is null then
    raise exception 'Conduta não encontrada.' using errcode = 'P0002';
  end if;
  return v_status;
end;
$$;

create or replace function excluir_conduta(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista apaga condutas.' using errcode = '42501';
  end if;
  delete from condutas where id = p_id;
end;
$$;

-- A visão geral: o que está pendente em TODAS as pacientes, prazo primeiro.
create or replace function condutas_pendentes()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê as condutas.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'pacienteId', c.paciente_id, 'pacienteNome', p.nome,
      'titulo', c.titulo, 'descricao', c.descricao, 'prazo', c.prazo,
      'status', c.status, 'modeloNome', c.modelo_nome, 'criadoEm', c.criado_em)
      order by c.prazo nulls last, p.nome, c.ordem)
    from condutas c join pacientes p on p.id = c.paciente_id
    where c.status <> 'concluida'
  ), '[]'::jsonb);
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'listar_modelos_conduta()', 'salvar_modelo_conduta(uuid, text, text, jsonb)',
    'excluir_modelo_conduta(uuid)', 'aplicar_modelo_conduta(uuid, uuid, jsonb)',
    'condutas_de(uuid)', 'salvar_conduta(uuid, uuid, text, text, date, text)',
    'mover_conduta(uuid, text)', 'excluir_conduta(uuid)', 'condutas_pendentes()'] loop
    execute format('revoke all on function %s from anon, public', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
