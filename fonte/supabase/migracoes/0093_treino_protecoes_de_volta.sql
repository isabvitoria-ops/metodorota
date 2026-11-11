-- =============================================================================
-- Treino: as proteções que a versão nova perdeu, de volta
--
-- As migrações 0074 a 0076 reescreveram o treino (vídeo, faixas, duração,
-- vários treinos ativos) e, na reescrita, ficaram para trás cuidados que a
-- 0049 tinha — as baterias 05 e 07 acusavam, e estavam certas:
--
--   1. Linha de exercício em branco virava exercício fantasma no treino.
--   2. Campo de número vazio ("") derrubava a gravação inteira com erro de
--      banco, em vez de ficar em branco.
--   3. A paciente conseguia editar um treino INATIVO da nutricionista — e,
--      ao salvar, ele passava a constar como escrito por ela.
--   4. As recusas saíam sem o código de permissão (42501), então a tela não
--      distinguia "não pode" de "deu erro".
--   5. Pedir as sessões de outra paciente pelo id devolvia as próprias, em
--      silêncio, em vez de recusar.
--   6. "Hoje" era o do servidor (UTC), não o de São Paulo: das 21h à meia-
--      noite o banco aceitava treino com a data de amanhã.
--   7. A administradora que também é paciente (0049) não conseguia mais
--      registrar o próprio treino: a função gravava com paciente nulo.
--
-- O que NÃO muda: a nutricionista continua podendo deixar vários treinos
-- ativos ao mesmo tempo (0076). O que volta é a regra que a tela da paciente
-- já anuncia — "o treino que você tinha escrito continua guardado, e volta
-- assim que este sair": plano da profissional no ar esconde o treino próprio
-- dela, sem apagar.
--
-- De quebra, o banco de produção tinha três auxiliares soltas
-- (`_st_inserir_ex`, `_inserir_exercicios_treino`, `_inserir_series_sessao`),
-- duas delas criadas direto no painel, sem migração. As funções abaixo não
-- dependem de nenhuma; as três saem.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Montar ou editar um treino
-- -----------------------------------------------------------------------------
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
       observacao, video_url, faixas)
    values (
      v_id, btrim(v_item ->> 'nome'), v_ordem,
      nullif(btrim(v_item ->> 'seriesPlanejadas'), '')::integer,
      nullif(btrim(v_item ->> 'repeticoesMin'), '')::integer,
      nullif(btrim(v_item ->> 'repeticoesMax'), '')::integer,
      nullif(btrim(coalesce(v_item ->> 'observacao', '')), ''),
      nullif(btrim(coalesce(v_item ->> 'videoUrl', '')), ''),
      case when jsonb_typeof(v_item -> 'faixas') = 'array' then v_item -> 'faixas' else '[]'::jsonb end
    );
  end loop;

  return jsonb_build_object('id', v_id, 'origem', v_origem);
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Registrar o que foi feito
--
-- `drop` antes: no repositório a função devolvia `void` e em produção
-- devolve `jsonb`, e o Postgres não troca o tipo de retorno com
-- `create or replace`.
-- -----------------------------------------------------------------------------
drop function if exists registrar_sessao_treino(uuid, uuid, uuid, date, text, jsonb, integer);

create function registrar_sessao_treino(
  p_id          uuid,
  p_paciente    uuid,
  p_treino      uuid,
  p_data        date,
  p_observacao  text,
  p_series      jsonb,
  p_duracao_min integer default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin    boolean;
  v_paciente uuid;
  v_id       uuid;
  v_item     jsonb;
  v_nome     text;
  v_n        integer := 0;
begin
  v_admin := e_admin() and p_paciente is not null;

  if v_admin then
    v_paciente := p_paciente;
  else
    -- O `p_paciente` é ignorado para quem não é a profissional: mandar o id
    -- de outra pessoa grava na ficha de quem chamou.
    v_paciente := meu_paciente_id();
  end if;

  if v_paciente is null then
    raise exception 'Sem cadastro de paciente.' using errcode = '42501';
  end if;
  if not v_admin then perform exigir_treino_liberado(v_paciente); end if;
  if p_series is null or jsonb_typeof(p_series) <> 'array' then
    raise exception 'As séries precisam ser uma lista.' using errcode = '22023';
  end if;
  -- Hoje é o de São Paulo, não o do servidor.
  if coalesce(p_data, hoje_sp()) > hoje_sp() then
    raise exception 'Não dá para registrar treino de uma data futura.' using errcode = '22007';
  end if;

  if p_id is null then
    insert into treino_sessoes (paciente_id, treino_id, data, observacao, duracao_min)
    values (v_paciente, p_treino, coalesce(p_data, hoje_sp()),
            nullif(btrim(coalesce(p_observacao, '')), ''), p_duracao_min)
    returning id into v_id;
  else
    update treino_sessoes
    set treino_id = coalesce(p_treino, treino_id),
        data = coalesce(p_data, data),
        observacao = nullif(btrim(coalesce(p_observacao, '')), ''),
        duracao_min = p_duracao_min
    where id = p_id and paciente_id = v_paciente
    returning id into v_id;
    if v_id is null then
      raise exception 'Sessão não encontrada.' using errcode = 'P0002';
    end if;
  end if;

  delete from treino_series where sessao_id = v_id;
  for v_item in select * from jsonb_array_elements(p_series) loop
    v_nome := btrim(coalesce(v_item ->> 'exercicioNome', ''));
    if v_nome = '' then continue; end if;
    v_n := v_n + 1;
    insert into treino_series
      (sessao_id, exercicio_id, exercicio_nome, numero, carga, repeticoes, observacao, criado_em)
    values (
      v_id,
      nullif(btrim(v_item ->> 'exercicioId'), '')::uuid,
      v_nome,
      coalesce(nullif(btrim(v_item ->> 'numero'), '')::integer, 1),
      -- Em branco fica NULO, nunca zero; e vírgula decimal é número também.
      nullif(replace(btrim(v_item ->> 'carga'), ',', '.'), '')::numeric,
      nullif(btrim(v_item ->> 'repeticoes'), '')::integer,
      nullif(btrim(coalesce(v_item ->> 'observacao', '')), ''),
      -- Todas as linhas de uma gravação nascem no mesmo instante. Um
      -- microssegundo por linha guarda a ordem em que ela escreveu.
      now() + (v_n * interval '1 microsecond')
    );
  end loop;

  return jsonb_build_object('id', v_id);
end;
$$;

revoke all on function registrar_sessao_treino(uuid, uuid, uuid, date, text, jsonb, integer)
  from anon, public;
grant execute on function registrar_sessao_treino(uuid, uuid, uuid, date, text, jsonb, integer)
  to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Ler as sessões: pedir as de outra pessoa é recusado, não ignorado
-- -----------------------------------------------------------------------------
create or replace function sessoes_de_treino(
  p_paciente uuid default null,
  p_limite   integer default 200
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_admin    boolean := e_admin();
  v_paciente uuid;
begin
  if v_admin and p_paciente is not null then
    v_paciente := p_paciente;
  else
    v_paciente := meu_paciente_id();
    if p_paciente is not null and p_paciente is distinct from v_paciente then
      raise exception 'Sem permissão para ver os treinos de outra pessoa.' using errcode = '42501';
    end if;
  end if;

  if v_paciente is null then return '[]'::jsonb; end if;
  if not v_admin and not treino_liberado(v_paciente) then return '[]'::jsonb; end if;

  return coalesce((
    select jsonb_agg(linha order by ordem_data desc, ordem_criado desc)
    from (
      select s.data as ordem_data, s.criado_em as ordem_criado,
        jsonb_build_object(
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
            ) order by sr.numero, sr.criado_em)
            from treino_series sr where sr.sessao_id = s.id
          ), '[]'::jsonb)
        ) as linha
      from treino_sessoes s
      where s.paciente_id = v_paciente
      order by s.data desc, s.criado_em desc
      limit greatest(coalesce(p_limite, 200), 0)
    ) sub
  ), '[]'::jsonb);
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. O que a paciente vê
--
-- Com plano da profissional ativo, ela vê os treinos da profissional — todos
-- os ativos. Sem plano da profissional, vê o treino que ela mesma escreveu
-- (o mais recente, mesmo que tenha ficado desativado enquanto o plano
-- esteve no ar): é o "volta assim que este sair" que a tela promete.
-- -----------------------------------------------------------------------------
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
            'faixas', coalesce(e.faixas, '[]'::jsonb)
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

-- `meu_treino()` é a forma antiga (um treino só), mantida por compatibilidade.
-- Mesma regra de cima: o da profissional passa na frente do próprio.
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

-- -----------------------------------------------------------------------------
-- 5. As auxiliares soltas saem
-- -----------------------------------------------------------------------------
drop function if exists _st_inserir_ex(uuid, jsonb);
drop function if exists _inserir_exercicios_treino(uuid, jsonb);
drop function if exists _inserir_series_sessao(uuid, jsonb);
