-- Treino v4: múltiplos treinos ativos por paciente
--
-- Antes, só um treino podia ser ativo por vez — a paciente via o treino
-- único na tela. Agora a nutricionista pode montar vários treinos ativos
-- (Segunda - Quadríceps, Terça - Superiores, Quinta - Posterior) e a
-- paciente vê todos, escolhe qual fazer e registra.
--
-- O que muda:
--   1. treinos ganha `rotulo` — texto livre (ex: "Segunda", "Treino A").
--   2. salvar_treino() para admin NÃO desativa mais os outros treinos.
--      Para paciente, continua desativando (ela só edita o dela).
--   3. meus_treinos() — nova função que devolve TODOS os treinos ativos.
--   4. meu_treino() atualizada para incluir rotulo.
--   5. treinos_do_paciente() atualizada para incluir rotulo.

-- 1. Rótulo do treino (dia da semana, letra, o que a nutri quiser)
alter table treinos
  add column if not exists rotulo text;

-- 2. Trocar salvar_treino(): admin não desativa os outros
drop function if exists salvar_treino(uuid, uuid, text, text, boolean, jsonb);

create or replace function salvar_treino(
  p_id         uuid,
  p_paciente   uuid,
  p_nome       text,
  p_observacao text,
  p_ativo      boolean,
  p_exercicios jsonb,
  p_rotulo     text default null
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
    update treinos set nome = p_nome, observacao = p_observacao, ativo = p_ativo,
      origem = v_ori, rotulo = p_rotulo
      where id = p_id and paciente_id = v_pac returning id into v_tid;
    if v_tid is null then raise exception 'Treino não encontrado.'; end if;
  else
    insert into treinos(paciente_id, nome, observacao, ativo, origem, rotulo)
      values(v_pac, p_nome, p_observacao, p_ativo, v_ori, p_rotulo) returning id into v_tid;
  end if;
  -- Paciente: só um ativo por vez (ela não monta split).
  -- Admin: múltiplos ativos permitidos.
  if p_ativo and not e_admin() then
    update treinos set ativo = false where paciente_id = v_pac and id <> v_tid and ativo;
  end if;
  perform _st_inserir_ex(v_tid, p_exercicios);
  return jsonb_build_object('id', v_tid);
end;
$$;

-- 3. meus_treinos() — todos os treinos ativos da paciente
create or replace function meus_treinos()
returns jsonb
language plpgsql security definer stable
as $$
declare
  v_paciente uuid := meu_paciente_id();
begin
  if v_paciente is null then return '[]'::jsonb; end if;
  if not treino_liberado(v_paciente) then return '[]'::jsonb; end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'nome', t.nome,
        'rotulo', t.rotulo,
        'observacao', t.observacao,
        'ativo', t.ativo,
        'origem', t.origem,
        'podeEditar', t.origem = 'paciente',
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
      order by t.criado_em
    )
    from treinos t
    where t.paciente_id = v_paciente and t.ativo
  ), '[]'::jsonb);
end;
$$;

-- 4. meu_treino() atualizada com rotulo (compatibilidade)
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
    order by criado_em desc limit 1;

  if v_treino is null then
    select * into v_treino from treinos
      where paciente_id = v_paciente and origem = 'paciente'
      order by criado_em desc limit 1;
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
    'rotulo', v_treino.rotulo,
    'observacao', v_treino.observacao,
    'ativo', v_treino.ativo,
    'origem', v_treino.origem,
    'podeEditar', v_treino.origem = 'paciente',
    'exercicios', v_exercicios
  );
end;
$$;

-- 5. treinos_do_paciente() atualizada com rotulo
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
        'rotulo', t.rotulo,
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
      order by t.ativo desc, t.criado_em desc
    )
    from treinos t where t.paciente_id = p_paciente
  ), '[]'::jsonb);
end;
$$;
