-- Treino v3: faixas de série por exercício
--
-- Cada exercício pode ter vários blocos de série (ex: Warm up 1×12-15,
-- Feeder 2×2-5, Working 3×6-8). O campo `faixas` é um jsonb array.
-- Quando vazio ou nulo, os campos legados (series_planejadas,
-- repeticoes_min, repeticoes_max) continuam valendo.

alter table treino_exercicios
  add column if not exists faixas jsonb default '[]'::jsonb;

-- Atualizar meu_treino() para incluir faixas nos exercícios
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

  select * into v_treino from treinos
    where paciente_id = v_paciente and ativo
    order by created_at desc limit 1;

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
      'videoUrl', e.video_url,
      'faixas', coalesce(e.faixas, '[]'::jsonb)
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

-- Helper para inserir exercícios (mantém salvar_treino curto)
create or replace function _st_inserir_ex(p_tid uuid, p_exs jsonb)
returns void language plpgsql as $$
declare v jsonb; o int := 0;
begin
  delete from treino_exercicios where treino_id = p_tid;
  for v in select * from jsonb_array_elements(p_exs) loop
    o := o + 1;
    insert into treino_exercicios(
      treino_id, nome, ordem, series_planejadas,
      repeticoes_min, repeticoes_max, observacao, video_url, faixas
    ) values (
      p_tid, v->>'nome', o,
      (v->>'seriesPlanejadas')::int,
      (v->>'repeticoesMin')::int,
      (v->>'repeticoesMax')::int,
      nullif(v->>'observacao', ''),
      nullif(v->>'videoUrl', ''),
      coalesce(v->'faixas', '[]'::jsonb)
    );
  end loop;
end;
$$;

-- Atualizar salvar_treino() para aceitar faixas (usa _st_inserir_ex)
create or replace function salvar_treino(
  p_id       uuid,
  p_paciente uuid,
  p_nome     text,
  p_observacao text,
  p_ativo    boolean,
  p_exercicios jsonb
) returns jsonb
language plpgsql security definer
as $$
declare v_pac uuid; v_ori text; v_tid uuid;
begin
  if e_admin() then v_pac := p_paciente; v_ori := 'nutricionista';
  else
    v_pac := meu_paciente_id();
    if v_pac is null then raise exception 'Sem cadastro de paciente.'; end if;
    perform exigir_treino_liberado(v_pac);
    v_ori := 'paciente';
    if exists(select 1 from treinos where paciente_id = v_pac and ativo and origem = 'nutricionista') then
      raise exception 'Você tem um treino ativo montado pela nutricionista. Fale com ela para trocar.';
    end if;
  end if;
  if p_id is not null then
    update treinos set nome = p_nome, observacao = p_observacao, ativo = p_ativo, origem = v_ori
      where id = p_id and paciente_id = v_pac returning id into v_tid;
    if v_tid is null then raise exception 'Treino não encontrado.'; end if;
  else
    insert into treinos(paciente_id, nome, observacao, ativo, origem)
      values(v_pac, p_nome, p_observacao, p_ativo, v_ori) returning id into v_tid;
  end if;
  if p_ativo then
    update treinos set ativo = false where paciente_id = v_pac and id <> v_tid and ativo;
  end if;
  perform _st_inserir_ex(v_tid, p_exercicios);
  return jsonb_build_object('id', v_tid);
end;
$$;

-- Atualizar treinos_do_paciente() para incluir faixas
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
            'videoUrl', e.video_url,
            'faixas', coalesce(e.faixas, '[]'::jsonb)
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
