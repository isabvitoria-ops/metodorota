-- 0109 — Treino: trocas de exercício e biset (pedidos dela em 25/11/2026,
-- aprovada a mudança no banco no mesmo dia).
--
-- * TROCAS: "às vezes a academia está cheia, ou nem tem o aparelho". Cada
--   exercício guarda uma lista de trocas, cada uma com nome e vídeo de
--   execução opcional. A paciente vê embaixo do exercício.
-- * BISET: "apoio no solo e abdominal remador, com o vídeo e a faixa de série
--   dos dois, no mesmo lugar". Cada exercício continua com o próprio vídeo e
--   as próprias faixas; `biset_com_proximo` junta ele ao exercício seguinte
--   no mesmo cartão.
--
-- Os treinos que já existem ficam iguais (sem troca, sem biset): as colunas
-- nascem com o valor vazio. As quatro funções abaixo são as da 0093/0076
-- (conferidas iguais às de produção em 25/11/2026), só com os dois campos a
-- mais. Nada é apagado.

alter table public.treino_exercicios
  add column if not exists trocas jsonb not null default '[]'::jsonb,
  add column if not exists biset_com_proximo boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'treino_exercicios_trocas_lista') then
    alter table public.treino_exercicios
      add constraint treino_exercicios_trocas_lista check (jsonb_typeof(trocas) = 'array');
  end if;
end;
$$;

create or replace function salvar_treino(
  p_id         uuid,
  p_paciente   uuid,
  p_nome       text,
  p_observacao text,
  p_ativo      boolean,
  p_exercicios jsonb,
  p_rotulo     text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin    boolean;
  v_paciente uuid;
  v_origem   text;
  v_ativo    boolean;
  v_id       uuid;
  v_item     jsonb;
  v_ordem    integer := 0;
  v_alvo     treinos;
begin
  -- Administradora SEM paciente informado está cuidando do próprio treino,
  -- como paciente que também é (0049).
  v_admin := e_admin() and p_paciente is not null;

  if v_admin then
    v_paciente := p_paciente;
    v_origem := 'nutricionista';
    v_ativo := coalesce(p_ativo, false);
  else
    v_paciente := meu_paciente_id();
    v_origem := 'paciente';
    -- O treino próprio nasce e fica ativo: inativo, a tela de registro não
    -- acharia exercício nenhum.
    v_ativo := true;

    if v_paciente is null then
      raise exception 'Sem cadastro de paciente.' using errcode = '42501';
    end if;

    perform exigir_treino_liberado(v_paciente);

    if exists (select 1 from treinos
               where paciente_id = v_paciente and ativo and origem = 'nutricionista') then
      raise exception 'Você tem um treino ativo montado pela nutricionista. Fale com ela para trocar.'
        using errcode = '42501';
    end if;

    -- Ela só edita o que ELA escreveu. Um treino da profissional, mesmo
    -- desativado, não vira treino próprio.
    if p_id is not null then
      select * into v_alvo from treinos where id = p_id;
      if v_alvo.id is null
         or v_alvo.paciente_id <> v_paciente
         or v_alvo.origem <> 'paciente' then
        raise exception 'Este treino não pode ser alterado aqui.' using errcode = '42501';
      end if;
    end if;
  end if;

  if not exists (select 1 from pacientes where id = v_paciente) then
    raise exception 'Paciente não encontrado.' using errcode = 'P0002';
  end if;
  if p_exercicios is null or jsonb_typeof(p_exercicios) <> 'array' then
    raise exception 'Os exercícios precisam ser uma lista.' using errcode = '22023';
  end if;

  if p_id is null then
    insert into treinos (paciente_id, nome, observacao, ativo, origem, rotulo)
    values (v_paciente,
            coalesce(nullif(btrim(coalesce(p_nome, '')), ''), 'Treino'),
            nullif(btrim(coalesce(p_observacao, '')), ''),
            v_ativo, v_origem,
            nullif(btrim(coalesce(p_rotulo, '')), ''))
    returning id into v_id;
  else
    update treinos
    set nome = coalesce(nullif(btrim(coalesce(p_nome, '')), ''), nome),
        observacao = nullif(btrim(coalesce(p_observacao, '')), ''),
        ativo = v_ativo,
        origem = v_origem,
        rotulo = nullif(btrim(coalesce(p_rotulo, '')), ''),
        atualizado_em = now()
    where id = p_id and paciente_id = v_paciente
    returning id into v_id;
    if v_id is null then
      raise exception 'Treino não encontrado.' using errcode = 'P0002';
    end if;
  end if;

  -- Treino ativo novo tira de cena o que a PACIENTE escreveu: o dela (ela só
  -- tem um por vez) ou, quando quem salva é a profissional, o que a paciente
  -- tinha — o plano prescrito passa na frente. Os outros treinos da
  -- profissional continuam ativos: é a divisão da semana (0076).
  if v_ativo then
    update treinos set ativo = false
    where paciente_id = v_paciente and id <> v_id and ativo and origem = 'paciente';
  end if;

  delete from treino_exercicios where treino_id = v_id;
  for v_item in select * from jsonb_array_elements(p_exercicios) loop
    -- Linha sem nome é o que sobra de uma linha em branco na tela.
    if btrim(coalesce(v_item ->> 'nome', '')) = '' then continue; end if;
    v_ordem := v_ordem + 1;
    insert into treino_exercicios
      (treino_id, nome, ordem, series_planejadas, repeticoes_min, repeticoes_max,
       observacao, video_url, faixas, trocas, biset_com_proximo)
    values (
      v_id, btrim(v_item ->> 'nome'), v_ordem,
      nullif(btrim(v_item ->> 'seriesPlanejadas'), '')::integer,
      nullif(btrim(v_item ->> 'repeticoesMin'), '')::integer,
      nullif(btrim(v_item ->> 'repeticoesMax'), '')::integer,
      nullif(btrim(coalesce(v_item ->> 'observacao', '')), ''),
      nullif(btrim(coalesce(v_item ->> 'videoUrl', '')), ''),
      case when jsonb_typeof(v_item -> 'faixas') = 'array' then v_item -> 'faixas' else '[]'::jsonb end,
      -- Trocas: só as que têm nome; o vídeo é opcional.
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'nome', btrim(t ->> 'nome'),
          'videoUrl', nullif(btrim(coalesce(t ->> 'videoUrl', '')), '')
        ))
        from jsonb_array_elements(
          case when jsonb_typeof(v_item -> 'trocas') = 'array' then v_item -> 'trocas' else '[]'::jsonb end
        ) t
        where jsonb_typeof(t) = 'object' and btrim(coalesce(t ->> 'nome', '')) <> ''
      ), '[]'::jsonb),
      coalesce(v_item ->> 'bisetComProximo', '') = 'true'
    );
  end loop;

  return jsonb_build_object('id', v_id, 'origem', v_origem);
end;
$$;

create or replace function meus_treinos()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_paciente uuid := meu_paciente_id();
  v_tem_da_nutri boolean;
  v_proprio uuid;
begin
  if v_paciente is null then return '[]'::jsonb; end if;
  if not treino_liberado(v_paciente) then return '[]'::jsonb; end if;

  v_tem_da_nutri := exists (select 1 from treinos
                            where paciente_id = v_paciente and ativo and origem = 'nutricionista');
  if not v_tem_da_nutri then
    select id into v_proprio from treinos
    where paciente_id = v_paciente and origem = 'paciente'
    order by ativo desc, atualizado_em desc, criado_em desc limit 1;
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
            'faixas', coalesce(e.faixas, '[]'::jsonb),
            'trocas', coalesce(e.trocas, '[]'::jsonb),
            'bisetComProximo', coalesce(e.biset_com_proximo, false)
          ) order by e.ordem)
          from treino_exercicios e where e.treino_id = t.id
        ), '[]'::jsonb)
      )
      order by t.criado_em, t.id
    )
    from treinos t
    where t.paciente_id = v_paciente
      and case when v_tem_da_nutri then t.ativo and t.origem = 'nutricionista'
               else t.id = v_proprio end
  ), '[]'::jsonb);
end;
$$;

create or replace function meu_treino()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_paciente uuid := meu_paciente_id();
  v_treino treinos;
  v_exercicios jsonb;
begin
  if v_paciente is null then return null; end if;
  if not treino_liberado(v_paciente) then return null; end if;

  select * into v_treino from treinos
  where paciente_id = v_paciente and ativo and origem = 'nutricionista'
  order by criado_em desc, id limit 1;

  if v_treino.id is null then
    select * into v_treino from treinos
    where paciente_id = v_paciente and origem = 'paciente'
    order by ativo desc, atualizado_em desc, criado_em desc limit 1;
  end if;

  if v_treino.id is null then return null; end if;

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
      'faixas', coalesce(e.faixas, '[]'::jsonb),
      'trocas', coalesce(e.trocas, '[]'::jsonb),
      'bisetComProximo', coalesce(e.biset_com_proximo, false)
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

create or replace function treinos_do_paciente(p_paciente uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
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
            'faixas', coalesce(e.faixas, '[]'::jsonb),
            'trocas', coalesce(e.trocas, '[]'::jsonb),
            'bisetComProximo', coalesce(e.biset_com_proximo, false)
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
