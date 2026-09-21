-- =============================================================================
-- CENTRAL DO PACIENTE — 0031: cardio e metas semanais
--
-- Duas coisas, e a diferença entre elas é quem manda:
--
--   * CARDIO é registro da paciente. Ela anda, ela anota. O aplicativo não
--     prescreve cardio, não sugere duração e não define intensidade;
--   * META é decisão da PROFISSIONAL. "4 treinos por semana" é clínico, e
--     o aplicativo não cria meta sozinho nem ajusta a que ela pôs.
--
-- O PROGRESSO NÃO TEM TABELA, e é de propósito.
--
-- O desenho original previa `weekly_goal_progress`. Guardado, o progresso
-- envelheceria: a paciente apaga uma sessão lançada por engano e o contador
-- continuaria em 3/4; ela corrige a data de um treino e a semana errada
-- ficaria marcada como cumprida. Contado a partir das sessões, o número é
-- sempre o que está lá — e não existe um segundo lugar para a verdade morar.
-- =============================================================================

create table if not exists cardio_sessoes (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes (id) on delete cascade,
  data date not null default hoje_sp(),
  /** "Caminhada", "Esteira", "Bike". Texto livre: é o que ela faz. */
  tipo text not null default 'Cardio',
  duracao_min integer,
  /**
   * Nulas quando não se aplicam: a bicicleta ergométrica da academia não
   * dá distância, e nem toda paciente tem zona de intensidade definida.
   * Zero diria que ela andou zero quilômetro — afirmação diferente de
   * "não dá para medir aqui".
   */
  distancia_km numeric(6, 2),
  intensidade text,
  observacao text,
  criado_em timestamptz not null default now(),
  constraint duracao_nao_negativa check (duracao_min is null or duracao_min >= 0),
  constraint distancia_nao_negativa check (distancia_km is null or distancia_km >= 0)
);

create index if not exists cardio_por_paciente on cardio_sessoes (paciente_id, data desc);

create table if not exists metas_semanais (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes (id) on delete cascade,
  /** Sempre a SEGUNDA-FEIRA da semana. Ver a normalização em `definir_meta`. */
  semana_inicio date not null,
  tipo text not null check (tipo in ('treino', 'cardio')),
  alvo numeric(7, 2) not null check (alvo > 0),
  unidade text not null default 'treinos',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  -- Uma meta por tipo por semana. Duas metas de treino na mesma semana
  -- fariam a tela mostrar "3/4" e "3/5" lado a lado, e nenhuma das duas
  -- seria a resposta.
  constraint meta_unica_por_semana unique (paciente_id, semana_inicio, tipo)
);

create index if not exists metas_por_paciente on metas_semanais (paciente_id, semana_inicio desc);

alter table cardio_sessoes enable row level security;
alter table metas_semanais enable row level security;

-- O cardio é registro dela: ela cria, altera e apaga o dela. A profissional
-- também alcança, para lançar o que a paciente contou na consulta.
drop policy if exists cardio_nutri on cardio_sessoes;
create policy cardio_nutri on cardio_sessoes for all using (e_admin()) with check (e_admin());

drop policy if exists cardio_paciente on cardio_sessoes;
create policy cardio_paciente on cardio_sessoes for all
  using (paciente_id = meu_paciente_id())
  with check (paciente_id = meu_paciente_id());

-- A meta é da profissional. A paciente LÊ e mais nada: "não pode alterar
-- metas definidas pelo profissional".
drop policy if exists metas_nutri on metas_semanais;
create policy metas_nutri on metas_semanais for all using (e_admin()) with check (e_admin());

drop policy if exists metas_paciente on metas_semanais;
create policy metas_paciente on metas_semanais for select
  using (paciente_id = meu_paciente_id());

grant select, insert, update, delete on cardio_sessoes, metas_semanais to authenticated;
revoke all on table cardio_sessoes, metas_semanais from anon;

/** A segunda-feira da semana daquela data. Domingo pertence à semana que passou. */
create or replace function segunda_da_semana(p_data date)
returns date
language sql
immutable
set search_path = public
as $$
  -- `isodow` é 1 na segunda e 7 no domingo, que é exatamente a régua certa:
  -- com `dow` (0 no domingo), o domingo viraria o começo da semana e a
  -- semana de quem treina no fim de semana ficaria partida ao meio.
  select p_data - (extract(isodow from p_data)::integer - 1);
$$;

revoke all on function segunda_da_semana(date) from anon, public;
grant execute on function segunda_da_semana(date) to authenticated;

/**
 * As sessões de cardio. Sem `p_paciente`, as de quem chamou.
 *
 * Mesma forma de `sessoes_de_treino`, e pelo mesmo motivo: duas funções
 * lendo a mesma coisa divergiriam na primeira mudança, e a que divergisse
 * calada seria a da paciente.
 */
create or replace function sessoes_de_cardio(p_paciente uuid default null, p_limite integer default 200)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
begin
  if p_paciente is null then
    v_paciente := meu_paciente_id();
  elsif e_admin() then
    v_paciente := p_paciente;
  else
    raise exception 'Você só vê os seus registros.' using errcode = '42501';
  end if;

  if v_paciente is null then return '[]'::jsonb; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', c.id, 'data', c.data, 'tipo', c.tipo,
             'duracaoMin', c.duracao_min, 'distanciaKm', c.distancia_km,
             'intensidade', c.intensidade, 'observacao', c.observacao)
           order by c.data desc, c.criado_em desc)
    from (
      select * from cardio_sessoes
      where paciente_id = v_paciente
      order by data desc, criado_em desc
      limit greatest(coalesce(p_limite, 200), 1)
    ) c
  ), '[]'::jsonb);
end;
$$;

revoke all on function sessoes_de_cardio(uuid, integer) from anon, public;
grant execute on function sessoes_de_cardio(uuid, integer) to authenticated;

create or replace function registrar_cardio(
  p_id uuid,
  p_paciente uuid,
  p_data date,
  p_tipo text,
  p_duracao integer,
  p_distancia numeric,
  p_intensidade text,
  p_observacao text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
  v_id uuid;
begin
  -- O `p_paciente` é IGNORADO quando quem chama é paciente: senão bastaria
  -- mandar outro id para escrever na ficha de outra pessoa.
  if e_admin() then
    v_paciente := p_paciente;
  else
    v_paciente := meu_paciente_id();
  end if;

  if v_paciente is null then
    raise exception 'Sem cadastro de paciente.' using errcode = '42501';
  end if;
  if coalesce(p_data, hoje_sp()) > hoje_sp() then
    raise exception 'Não dá para registrar cardio de uma data futura.' using errcode = '22007';
  end if;

  if p_id is null then
    insert into cardio_sessoes
      (paciente_id, data, tipo, duracao_min, distancia_km, intensidade, observacao)
    values (
      v_paciente, coalesce(p_data, hoje_sp()),
      coalesce(nullif(btrim(coalesce(p_tipo, '')), ''), 'Cardio'),
      p_duracao, p_distancia,
      nullif(btrim(coalesce(p_intensidade, '')), ''),
      nullif(btrim(coalesce(p_observacao, '')), '')
    )
    returning id into v_id;
  else
    update cardio_sessoes
    set data = coalesce(p_data, data),
        tipo = coalesce(nullif(btrim(coalesce(p_tipo, '')), ''), tipo),
        duracao_min = p_duracao,
        distancia_km = p_distancia,
        intensidade = nullif(btrim(coalesce(p_intensidade, '')), ''),
        observacao = nullif(btrim(coalesce(p_observacao, '')), '')
    where id = p_id and paciente_id = v_paciente
    returning id into v_id;
    if v_id is null then
      raise exception 'Registro não encontrado.' using errcode = 'P0002';
    end if;
  end if;

  return jsonb_build_object('id', v_id);
end;
$$;

revoke all on function registrar_cardio(uuid, uuid, date, text, integer, numeric, text, text)
  from anon, public;
grant execute on function registrar_cardio(uuid, uuid, date, text, integer, numeric, text, text)
  to authenticated;

create or replace function excluir_cardio(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if e_admin() then
    delete from cardio_sessoes where id = p_id;
  else
    delete from cardio_sessoes where id = p_id and paciente_id = meu_paciente_id();
  end if;
end;
$$;

revoke all on function excluir_cardio(uuid) from anon, public;
grant execute on function excluir_cardio(uuid) to authenticated;

/** As metas. Sem `p_paciente`, as de quem chamou. */
create or replace function metas_semanais_de(p_paciente uuid default null, p_semanas integer default 12)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
begin
  if p_paciente is null then
    v_paciente := meu_paciente_id();
  elsif e_admin() then
    v_paciente := p_paciente;
  else
    raise exception 'Você só vê as suas metas.' using errcode = '42501';
  end if;

  if v_paciente is null then return '[]'::jsonb; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', m.id, 'semanaInicio', m.semana_inicio, 'tipo', m.tipo,
             'alvo', m.alvo, 'unidade', m.unidade)
           order by m.semana_inicio desc, m.tipo)
    from (
      select * from metas_semanais
      where paciente_id = v_paciente
      order by semana_inicio desc
      limit greatest(coalesce(p_semanas, 12), 1) * 2
    ) m
  ), '[]'::jsonb);
end;
$$;

revoke all on function metas_semanais_de(uuid, integer) from anon, public;
grant execute on function metas_semanais_de(uuid, integer) to authenticated;

/**
 * Define (ou refaz) a meta daquela semana.
 *
 * A data é NORMALIZADA para a segunda-feira: sem isso, a mesma meta
 * definida numa quarta e noutra quinta viraria duas semanas diferentes, e
 * a restrição de "uma por semana" não seguraria nada.
 */
create or replace function definir_meta_semanal(
  p_paciente uuid,
  p_semana date,
  p_tipo text,
  p_alvo numeric,
  p_unidade text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_semana date;
  v_id uuid;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista define meta.' using errcode = '42501';
  end if;
  if p_tipo not in ('treino', 'cardio') then
    raise exception 'Tipo de meta desconhecido: %', p_tipo using errcode = '22023';
  end if;
  if p_alvo is null or p_alvo <= 0 then
    raise exception 'A meta precisa ser maior que zero.' using errcode = '22023';
  end if;

  -- Normalizada para a segunda: sem isso, a mesma meta definida numa quarta
  -- e noutra quinta viraria duas semanas diferentes, e a restrição de "uma
  -- por semana" não seguraria nada.
  v_semana := segunda_da_semana(coalesce(p_semana, hoje_sp()));

  insert into metas_semanais (paciente_id, semana_inicio, tipo, alvo, unidade)
  values (p_paciente, v_semana, p_tipo, p_alvo,
          coalesce(nullif(btrim(coalesce(p_unidade, '')), ''),
                   case when p_tipo = 'treino' then 'treinos' else 'minutos' end))
  on conflict (paciente_id, semana_inicio, tipo)
  do update set alvo = excluded.alvo, unidade = excluded.unidade, atualizado_em = now()
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'semanaInicio', v_semana);
end;
$$;

revoke all on function definir_meta_semanal(uuid, date, text, numeric, text) from anon, public;
grant execute on function definir_meta_semanal(uuid, date, text, numeric, text) to authenticated;

create or replace function excluir_meta_semanal(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista apaga meta.' using errcode = '42501';
  end if;
  delete from metas_semanais where id = p_id;
end;
$$;

revoke all on function excluir_meta_semanal(uuid) from anon, public;
grant execute on function excluir_meta_semanal(uuid) to authenticated;

-- `tenho_treino()` passa a contar o cardio e a meta também: quem só faz
-- caminhada tem o que ver na tela de evolução, e sem isto o atalho não
-- apareceria para ela.
create or replace function tenho_treino()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from treinos where ativo and paciente_id = meu_paciente_id())
      or exists (select 1 from treino_sessoes where paciente_id = meu_paciente_id())
      or exists (select 1 from cardio_sessoes where paciente_id = meu_paciente_id())
      or exists (select 1 from metas_semanais where paciente_id = meu_paciente_id());
$$;

revoke all on function tenho_treino() from anon, public;
grant execute on function tenho_treino() to authenticated;
