-- Treino v2: vídeo nos exercícios, duração da sessão, "treino que conta"
--
-- O que muda:
--   1. exercício ganha `video_url` — link de YouTube que a profissional ou
--      a paciente pode colar. Mostrar o exercício é uma coisa; prescrever é
--      outra, e o link não prescreve.
--   2. sessão ganha `duracao_min` — quanto tempo durou o treino. A paciente
--      preenche quando quer; nulo é válido.
--   3. "treino que conta" não é coluna: é contagem que o front faz a partir
--      de (duração ≥ 20 min) E (pelo menos metade das séries planejadas
--      feitas). Não precisa de migration pra isso; os critérios ficam no
--      código, como as metas semanais.

-- 1. Vídeo de demonstração no exercício
alter table treino_exercicios
  add column if not exists video_url text;

-- 2. Duração da sessão
alter table treino_sessoes
  add column if not exists duracao_min integer
    check (duracao_min is null or duracao_min >= 0);

-- 3. Atualizar meu_treino() para incluir video_url nos exercícios
create or replace function meu_treino()
returns jsonb
language plpgsql security definer stable
as $$
declare
  v_paciente uuid := meu_paciente_id();
  v_treino record;
  v_exercicios jsonb;
begin
  if v_paciente is null then return null; end if;
  if not treino_liberado(v_paciente) then return null; end if;

  -- Primeiro tenta o treino ativo (da nutricionista ou dele mesmo).
  select * into v_treino from treinos
    where paciente_id = v_paciente and ativo
    order by created_at desc limit 1;

  -- Se não há treino ativo, tenta o treino da própria paciente (mesmo inativo).
  if v_treino is null then
    select * into v_treino from treinos
      where paciente_id = v_paciente and origem = 'paciente'
      order by created_at desc limit 1;
  end if;

  if v_treino is null then return null; end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', e.id,
      'nome', e.nome,
      'ordem', e.ordem,
      'seriesPlanejadas', e.series_planejadas,
      'repeticoesMin', e.repeticoes_min,
      'repeticoesMax', e.repeticoes_max,
      'observacao', e.observacao,
      'videoUrl', e.video_url
    ) order by e.ordem
  ), '[]'::jsonb) into v_exercicios
  from treino_exercicios e where e.treino_id = v_treino.id;

  return jsonb_build_object(
    'id', v_treino.id,
    'nome', v_treino.nome,
    'observacao', v_treino.observacao,
    'ativo', v_treino.ativo,
    'origem', v_treino.origem,
    'podeEditar', v_treino.origem = 'paciente',
    'exercicios', v_exercicios
  );
end;
$$;

-- 4. Atualizar salvar_treino() para aceitar video_url
create or replace function salvar_treino(
  p_id       uuid,
  p_paciente uuid,
  p_nome     text,
  p_observacao text,
  p_ativo    boolean,
  p_exercicios jsonb
) returns void
language plpgsql security definer
as $$
declare
  v_paciente uuid;
  v_origem   text;
  v_treino_id uuid;
  v_ex       jsonb;
  v_ordem    int := 0;
begin
  if e_admin() then
    v_paciente := p_paciente;
    v_origem   := 'nutricionista';
  else
    v_paciente := meu_paciente_id();
    if v_paciente is null then
      raise exception 'Sem cadastro de paciente.';
    end if;
    exigir_treino_liberado(v_paciente);
    v_origem := 'paciente';

    -- Paciente não pode salvar se existe treino ativo da nutricionista
    if exists (
      select 1 from treinos
        where paciente_id = v_paciente and ativo and origem = 'nutricionista'
    ) then
      raise exception 'Você tem um treino ativo montado pela nutricionista. Fale com ela para trocar.';
    end if;
  end if;

  if p_id is not null then
    -- Atualizar treino existente
    update treinos set
      nome = p_nome,
      observacao = p_observacao,
      ativo = p_ativo,
      origem = v_origem
    where id = p_id
      and paciente_id = v_paciente
    returning id into v_treino_id;

    if v_treino_id is null then
      raise exception 'Treino não encontrado.';
    end if;
  else
    -- Criar treino novo
    insert into treinos (paciente_id, nome, observacao, ativo, origem)
    values (v_paciente, p_nome, p_observacao, p_ativo, v_origem)
    returning id into v_treino_id;
  end if;

  -- Um paciente ativo por vez: desativa os outros quando este é ativo
  if p_ativo then
    update treinos set ativo = false
      where paciente_id = v_paciente and id <> v_treino_id and ativo;
  end if;

  -- Recriar exercícios
  delete from treino_exercicios where treino_id = v_treino_id;
  for v_ex in select * from jsonb_array_elements(p_exercicios)
  loop
    v_ordem := v_ordem + 1;
    insert into treino_exercicios (
      treino_id, nome, ordem, series_planejadas,
      repeticoes_min, repeticoes_max, observacao, video_url
    ) values (
      v_treino_id,
      v_ex->>'nome',
      v_ordem,
      (v_ex->>'seriesPlanejadas')::int,
      (v_ex->>'repeticoesMin')::int,
      (v_ex->>'repeticoesMax')::int,
      nullif(v_ex->>'observacao', ''),
      nullif(v_ex->>'videoUrl', '')
    );
  end loop;
end;
$$;

-- 5. Atualizar sessoes_de_treino() para incluir duracao_min
create or replace function sessoes_de_treino(
  p_paciente uuid default null,
  p_limite   int  default 200
) returns jsonb
language plpgsql security definer stable
as $$
declare
  v_paciente uuid;
begin
  if p_paciente is not null and e_admin() then
    v_paciente := p_paciente;
  else
    v_paciente := meu_paciente_id();
  end if;
  if v_paciente is null then return '[]'::jsonb; end if;
  if not e_admin() then
    if not treino_liberado(v_paciente) then return '[]'::jsonb; end if;
  end if;

  return coalesce((
    select jsonb_agg(linha order by linha->>'data' desc)
    from (
      select jsonb_build_object(
        'id', s.id,
        'data', s.data,
        'treinoId', s.treino_id,
        'observacao', s.observacao,
        'duracaoMin', s.duracao_min,
        'series', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', sr.id,
            'exercicioId', sr.exercicio_id,
            'exercicioNome', sr.exercicio_nome,
            'numero', sr.numero,
            'carga', sr.carga,
            'repeticoes', sr.repeticoes,
            'observacao', sr.observacao
          ) order by sr.numero)
          from treino_series sr where sr.sessao_id = s.id
        ), '[]'::jsonb)
      ) as linha
      from treino_sessoes s
      where s.paciente_id = v_paciente
      order by s.data desc
      limit p_limite
    ) sub
  ), '[]'::jsonb);
end;
$$;

-- 6. Atualizar registrar_sessao_treino() para aceitar duracao_min
create or replace function registrar_sessao_treino(
  p_id         uuid,
  p_paciente   uuid,
  p_treino     uuid,
  p_data       date,
  p_observacao text,
  p_series     jsonb,
  p_duracao_min integer default null
) returns void
language plpgsql security definer
as $$
declare
  v_paciente uuid;
  v_sessao   uuid;
  v_serie    jsonb;
begin
  if p_data > current_date then
    raise exception 'Data futura não é permitida.';
  end if;

  if e_admin() then
    v_paciente := p_paciente;
  else
    v_paciente := meu_paciente_id();
    if v_paciente is null then
      raise exception 'Sem cadastro de paciente.';
    end if;
    exigir_treino_liberado(v_paciente);
  end if;

  if p_id is not null then
    update treino_sessoes set
      data = p_data,
      observacao = p_observacao,
      duracao_min = p_duracao_min
    where id = p_id
      and paciente_id = v_paciente
    returning id into v_sessao;

    if v_sessao is null then
      raise exception 'Sessão não encontrada.';
    end if;
    delete from treino_series where sessao_id = v_sessao;
  else
    insert into treino_sessoes (paciente_id, treino_id, data, observacao, duracao_min)
    values (v_paciente, p_treino, p_data, p_observacao, p_duracao_min)
    returning id into v_sessao;
  end if;

  for v_serie in select * from jsonb_array_elements(p_series)
  loop
    insert into treino_series (
      sessao_id, exercicio_id, exercicio_nome,
      numero, carga, repeticoes, observacao
    ) values (
      v_sessao,
      (v_serie->>'exercicioId')::uuid,
      v_serie->>'exercicioNome',
      (v_serie->>'numero')::int,
      (v_serie->>'carga')::numeric,
      (v_serie->>'repeticoes')::int,
      nullif(v_serie->>'observacao', '')
    );
  end loop;
end;
$$;

-- 7. Atualizar treinos_do_paciente() para incluir video_url
create or replace function treinos_do_paciente(p_paciente uuid)
returns jsonb
language plpgsql security definer stable
as $$
begin
  if not e_admin() then
    raise exception 'Sem permissão.';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'nome', t.nome,
        'observacao', t.observacao,
        'ativo', t.ativo,
        'origem', t.origem,
        'podeEditar', false,
        'exercicios', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', e.id,
            'nome', e.nome,
            'ordem', e.ordem,
            'seriesPlanejadas', e.series_planejadas,
            'repeticoesMin', e.repeticoes_min,
            'repeticoesMax', e.repeticoes_max,
            'observacao', e.observacao,
            'videoUrl', e.video_url
          ) order by e.ordem)
          from treino_exercicios e where e.treino_id = t.id
        ), '[]'::jsonb)
      )
      order by t.ativo desc, t.created_at desc
    )
    from treinos t where t.paciente_id = p_paciente
  ), '[]'::jsonb);
end;
$$;
