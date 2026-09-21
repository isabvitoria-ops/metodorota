-- =============================================================================
-- CENTRAL DO PACIENTE — 0033: a aba de treino é liberada paciente a paciente
--
-- "Os treinos vou liberar a aba só para alguns. Na central nutri quero esse
-- controle igual tenho com rastreio."
--
-- Mesmo desenho da 0021, que fez isso com a rastreabilidade: um interruptor
-- por paciente, na mão da nutricionista, DESLIGADO por padrão.
--
-- POR QUE DESLIGADO POR PADRÃO
--
-- Porque é o que ela pediu — "só para alguns" — e porque o erro barato é o
-- inverso do erro caro. Nascendo desligado, o pior caso é ela ligar para uma
-- paciente que já esperava a aba. Nascendo ligado, o pior caso é a aba
-- aparecer para todo mundo no minuto da publicação, e ela descobrir isso
-- pela paciente.
--
-- A TRANCA NÃO É A TELA
--
-- Esconder a aba no JavaScript não é controle de acesso: o endereço continua
-- lá, e quem digitar `/treino` entra. Por isso o interruptor entra em TODAS
-- as funções do caminho da paciente — treino, sessões, cardio e metas. Com a
-- aba desligada, o banco devolve lista vazia na leitura e recusa a escrita,
-- e aí não importa por onde se tente entrar.
--
-- O QUE NÃO ACONTECE: nada é apagado. Desligar a aba esconde; religar traz
-- tudo de volta exatamente como estava. E a nutricionista continua vendo o
-- histórico da paciente na área dela, aba ligada ou não — o interruptor é
-- sobre o que a PACIENTE alcança.
-- =============================================================================

alter table pacientes
  add column if not exists treino_liberado boolean not null default false;

/**
 * Quem tem a aba de treino liberada. Sem paciente, desligado.
 *
 * A pergunta só é respondida para a NUTRICIONISTA e para a própria pessoa.
 * A função é `security definer`, então sem esta linha qualquer paciente
 * logada poderia perguntar pelo id de outra e descobrir, uma por uma, quem
 * está com a área de treino ligada. É pouco — e é informação sobre a
 * paciente de outra pessoa mesmo assim.
 */
create or replace function treino_liberado(p_paciente uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_paciente is null then false
    when e_admin() or p_paciente = meu_paciente_id() then
      coalesce((select p.treino_liberado from pacientes p where p.id = p_paciente), false)
    else false
  end;
$$;

revoke all on function treino_liberado(uuid) from anon, public;
grant execute on function treino_liberado(uuid) to authenticated;

/**
 * A recusa, numa função só.
 *
 * Repetir o `raise` em nove lugares daria nove mensagens que envelhecem em
 * ritmos diferentes; e bastaria esquecer um `not` num deles para abrir a
 * porta num caminho só — que é exatamente o tipo de falha que ninguém nota.
 */
create or replace function exigir_treino_liberado(p_paciente uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if e_admin() then return; end if;
  if not treino_liberado(p_paciente) then
    raise exception 'A área de treino não está liberada para você.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function exigir_treino_liberado(uuid) from anon, public;
grant execute on function exigir_treino_liberado(uuid) to authenticated;

/** A nutricionista liga e desliga. Só ela. */
create or replace function definir_treino_do_paciente(p_paciente uuid, p_ativo boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista libera a área de treino.' using errcode = '42501';
  end if;
  if not exists (select 1 from pacientes where id = p_paciente) then
    raise exception 'Paciente não encontrada.' using errcode = '22023';
  end if;

  update pacientes set treino_liberado = coalesce(p_ativo, false) where id = p_paciente;

  -- Devolve o estado GRAVADO, e não o que foi pedido: é o que deixa a tela
  -- mostrar a verdade do banco em vez do palpite do clique. Foi a lição do
  -- `tornar-admin.sql`, que rodou, alterou zero linhas e não avisou.
  return (select treino_liberado from pacientes where id = p_paciente);
end;
$$;

revoke all on function definir_treino_do_paciente(uuid, boolean) from anon, public;
grant execute on function definir_treino_do_paciente(uuid, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- A porta: a aba só aparece para quem foi liberada
-- -----------------------------------------------------------------------------

create or replace function tenho_treino()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select treino_liberado(meu_paciente_id());
$$;

revoke all on function tenho_treino() from anon, public;
grant execute on function tenho_treino() to authenticated;

-- -----------------------------------------------------------------------------
-- As funções do caminho da paciente, agora com o interruptor
--
-- Os corpos são os mesmos da 0030, 0031 e 0032 — o que mudou em cada um é a
-- linha do interruptor. Vão inteiros porque `create or replace` substitui a
-- função toda; não existe "aplicar um pedaço".
-- -----------------------------------------------------------------------------

create or replace function meu_treino()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
  v_treino treinos;
begin
  v_paciente := meu_paciente_id();
  if v_paciente is null then return null; end if;
  -- Sem a aba liberada, não há treino para ela — nem o que a nutricionista
  -- escreveu, nem o que ela escreveu antes de a aba ser desligada.
  if not treino_liberado(v_paciente) then return null; end if;

  select * into v_treino from treinos
  where paciente_id = v_paciente and ativo
  order by atualizado_em desc limit 1;

  -- Sem treino ativo, mas com um próprio guardado: é o dela, é o que ela vê.
  -- Acontece quando a nutricionista apaga o plano que tinha mandado.
  if v_treino.id is null then
    select * into v_treino from treinos
    where paciente_id = v_paciente and origem = 'paciente'
    order by atualizado_em desc limit 1;
  end if;

  if v_treino.id is null then return null; end if;

  return jsonb_build_object(
    'id', v_treino.id,
    'nome', v_treino.nome,
    'observacao', v_treino.observacao,
    'origem', v_treino.origem,
    'podeEditar', v_treino.origem = 'paciente',
    'exercicios', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', e.id, 'nome', e.nome, 'ordem', e.ordem,
               'seriesPlanejadas', e.series_planejadas,
               'repeticoesMin', e.repeticoes_min,
               'repeticoesMax', e.repeticoes_max,
               'observacao', e.observacao) order by e.ordem, e.criado_em)
      from treino_exercicios e where e.treino_id = v_treino.id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function meu_treino() from anon, public;
grant execute on function meu_treino() to authenticated;

create or replace function posso_escrever_treino()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
  v_da_nutri treinos;
  v_meu treinos;
begin
  v_paciente := meu_paciente_id();
  if v_paciente is null then
    return jsonb_build_object('pode', false, 'motivo', 'sem_cadastro');
  end if;

  if not treino_liberado(v_paciente) then
    return jsonb_build_object('pode', false, 'motivo', 'nao_liberado', 'meuTreinoId', null);
  end if;

  select * into v_da_nutri from treinos
  where paciente_id = v_paciente and ativo and origem = 'nutricionista' limit 1;

  select * into v_meu from treinos
  where paciente_id = v_paciente and origem = 'paciente'
  order by atualizado_em desc limit 1;

  -- Com plano da profissional no ar, a paciente não escreve por cima nem ao
  -- lado. Dois planos ativos ao mesmo tempo fariam a tela de registro
  -- oferecer duas listas de exercício, e a evolução compararia sessões de
  -- treinos diferentes como se fossem o mesmo.
  if v_da_nutri.id is not null then
    return jsonb_build_object(
      'pode', false,
      'motivo', 'treino_da_nutricionista',
      'meuTreinoId', v_meu.id);
  end if;

  return jsonb_build_object('pode', true, 'motivo', null, 'meuTreinoId', v_meu.id);
end;
$$;

revoke all on function posso_escrever_treino() from anon, public;
grant execute on function posso_escrever_treino() to authenticated;

create or replace function salvar_treino(
  p_id uuid,
  p_paciente uuid,
  p_nome text,
  p_observacao text,
  p_ativo boolean,
  p_exercicios jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin boolean;
  v_paciente uuid;
  v_origem text;
  v_ativo boolean;
  v_id uuid;
  v_item jsonb;
  v_ordem integer := 0;
  v_alvo treinos;
begin
  v_admin := e_admin();

  if v_admin then
    v_paciente := p_paciente;
    v_origem := 'nutricionista';
    v_ativo := coalesce(p_ativo, false);
  else
    -- O id que veio da tela não é consultado em nenhum momento.
    v_paciente := meu_paciente_id();
    v_origem := 'paciente';
    -- O treino que ela escreve é para usar hoje; nascer desativado faria a
    -- tela de registro não achar exercício nenhum logo depois de salvar.
    v_ativo := true;

    if v_paciente is null then
      raise exception 'Sem cadastro de paciente.' using errcode = '42501';
    end if;

    perform exigir_treino_liberado(v_paciente);

    if exists (select 1 from treinos
               where paciente_id = v_paciente and ativo and origem = 'nutricionista') then
      raise exception 'Sua nutricionista enviou um treino; ele não pode ser alterado aqui.'
        using errcode = '42501';
    end if;

    if p_id is not null then
      select * into v_alvo from treinos where id = p_id;
      -- Treino de outra pessoa e treino da nutricionista dão o MESMO erro e a
      -- MESMA mensagem: responder "esse não é seu" para um id e "esse é da
      -- nutricionista" para outro contaria, id a id, o que existe no banco.
      if v_alvo.id is null
         or v_alvo.paciente_id <> v_paciente
         or v_alvo.origem <> 'paciente' then
        raise exception 'Este treino não pode ser alterado aqui.' using errcode = '42501';
      end if;
    end if;
  end if;

  if v_paciente is null then
    raise exception 'Paciente não informado.' using errcode = 'P0002';
  end if;
  if not exists (select 1 from pacientes where id = v_paciente) then
    raise exception 'Paciente não encontrado.' using errcode = 'P0002';
  end if;
  if p_exercicios is null or jsonb_typeof(p_exercicios) <> 'array' then
    raise exception 'Os exercícios precisam ser uma lista.' using errcode = '22023';
  end if;

  if p_id is null then
    insert into treinos (paciente_id, nome, observacao, ativo, origem)
    values (v_paciente, coalesce(nullif(btrim(p_nome), ''), 'Treino'),
            nullif(btrim(coalesce(p_observacao, '')), ''), v_ativo, v_origem)
    returning id into v_id;
  else
    update treinos
    set nome = coalesce(nullif(btrim(p_nome), ''), nome),
        observacao = nullif(btrim(coalesce(p_observacao, '')), ''),
        ativo = case when v_admin then coalesce(p_ativo, ativo) else true end,
        atualizado_em = now()
    where id = p_id and paciente_id = v_paciente
    returning id into v_id;
    if v_id is null then
      raise exception 'Treino não encontrado.' using errcode = 'P0002';
    end if;
  end if;

  -- Um treino ativo por paciente. Dois ativos fariam a tela dela escolher
  -- um dos dois em silêncio, e o outro nunca apareceria.
  --
  -- Salvando pela paciente, a desativação alcança SÓ os treinos próprios. A
  -- checagem acima já garante que não há plano ativo da nutricionista, então
  -- este filtro não muda nenhum resultado hoje — ele existe para que, no dia
  -- em que aquela checagem mudar, o pior caso seja um treino duplicado da
  -- paciente, e não o plano da profissional desligado por ela.
  if v_ativo then
    update treinos set ativo = false
    where paciente_id = v_paciente
      and id <> v_id
      and (v_admin or origem = 'paciente');
  end if;

  delete from treino_exercicios where treino_id = v_id;
  for v_item in select * from jsonb_array_elements(p_exercicios) loop
    if btrim(coalesce(v_item ->> 'nome', '')) = '' then continue; end if;
    insert into treino_exercicios
      (treino_id, nome, ordem, series_planejadas, repeticoes_min, repeticoes_max, observacao)
    values (
      v_id, btrim(v_item ->> 'nome'), v_ordem,
      nullif(v_item ->> 'seriesPlanejadas', '')::integer,
      nullif(v_item ->> 'repeticoesMin', '')::integer,
      nullif(v_item ->> 'repeticoesMax', '')::integer,
      nullif(btrim(coalesce(v_item ->> 'observacao', '')), '')
    );
    v_ordem := v_ordem + 1;
  end loop;

  return jsonb_build_object('id', v_id, 'origem', v_origem);
end;
$$;

revoke all on function salvar_treino(uuid, uuid, text, text, boolean, jsonb) from anon, public;
grant execute on function salvar_treino(uuid, uuid, text, text, boolean, jsonb) to authenticated;

create or replace function excluir_treino(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alvo treinos;
begin
  if e_admin() then
    delete from treinos where id = p_id;
    return;
  end if;

  perform exigir_treino_liberado(meu_paciente_id());

  select * into v_alvo from treinos where id = p_id;
  if v_alvo.id is null
     or v_alvo.paciente_id is distinct from meu_paciente_id()
     or v_alvo.origem <> 'paciente' then
    raise exception 'Este treino não pode ser apagado aqui.' using errcode = '42501';
  end if;

  delete from treinos where id = p_id;
end;
$$;

revoke all on function excluir_treino(uuid) from anon, public;
grant execute on function excluir_treino(uuid) to authenticated;

create or replace function sessoes_de_treino(p_paciente uuid default null, p_limite integer default 200)
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
    raise exception 'Você só vê os seus treinos.' using errcode = '42501';
  end if;

  if v_paciente is null then return '[]'::jsonb; end if;
  if not e_admin() and not treino_liberado(v_paciente) then return '[]'::jsonb; end if;

  return coalesce((
    select jsonb_agg(linha order by linha ->> 'data' desc)
    from (
      select jsonb_build_object(
               'id', s.id,
               'data', s.data,
               'treinoId', s.treino_id,
               'observacao', s.observacao,
               'series', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'id', x.id, 'exercicioId', x.exercicio_id,
                          'exercicioNome', x.exercicio_nome, 'numero', x.numero,
                          'carga', x.carga, 'repeticoes', x.repeticoes,
                          'observacao', x.observacao) order by x.numero, x.criado_em)
                 from treino_series x where x.sessao_id = s.id
               ), '[]'::jsonb)
             ) as linha
      from treino_sessoes s
      where s.paciente_id = v_paciente
      order by s.data desc, s.criado_em desc
      limit greatest(coalesce(p_limite, 200), 1)
    ) t
  ), '[]'::jsonb);
end;
$$;

revoke all on function sessoes_de_treino(uuid, integer) from anon, public;
grant execute on function sessoes_de_treino(uuid, integer) to authenticated;

create or replace function registrar_sessao_treino(
  p_id uuid,
  p_paciente uuid,
  p_treino uuid,
  p_data date,
  p_observacao text,
  p_series jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
  v_id uuid;
  v_item jsonb;
  v_nome text;
begin
  if e_admin() then
    v_paciente := p_paciente;
  else
    v_paciente := meu_paciente_id();
  end if;

  if v_paciente is null then
    raise exception 'Sem cadastro de paciente.' using errcode = '42501';
  end if;
  if not e_admin() then perform exigir_treino_liberado(v_paciente); end if;
  if p_series is null or jsonb_typeof(p_series) <> 'array' then
    raise exception 'As séries precisam ser uma lista.' using errcode = '22023';
  end if;
  -- Treino não se registra no futuro: quem digita 2027 errou o ano, e o
  -- registro iria para o fim da linha do tempo e ficaria lá.
  if coalesce(p_data, hoje_sp()) > hoje_sp() then
    raise exception 'Não dá para registrar treino de uma data futura.' using errcode = '22007';
  end if;

  if p_id is null then
    insert into treino_sessoes (paciente_id, treino_id, data, observacao)
    values (v_paciente, p_treino, coalesce(p_data, hoje_sp()),
            nullif(btrim(coalesce(p_observacao, '')), ''))
    returning id into v_id;
  else
    update treino_sessoes
    set treino_id = coalesce(p_treino, treino_id),
        data = coalesce(p_data, data),
        observacao = nullif(btrim(coalesce(p_observacao, '')), '')
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
    insert into treino_series
      (sessao_id, exercicio_id, exercicio_nome, numero, carga, repeticoes, observacao)
    values (
      v_id,
      nullif(v_item ->> 'exercicioId', '')::uuid,
      v_nome,
      coalesce(nullif(v_item ->> 'numero', '')::integer, 1),
      -- Em branco fica NULO, não zero: exercício sem carga não pesa zero
      -- quilo, não tem carga. Zero somaria como peso numa conta de volume.
      nullif(v_item ->> 'carga', '')::numeric,
      nullif(v_item ->> 'repeticoes', '')::integer
      , nullif(btrim(coalesce(v_item ->> 'observacao', '')), '')
    );
  end loop;

  return jsonb_build_object('id', v_id);
end;
$$;

revoke all on function registrar_sessao_treino(uuid, uuid, uuid, date, text, jsonb)
  from anon, public;
grant execute on function registrar_sessao_treino(uuid, uuid, uuid, date, text, jsonb)
  to authenticated;

create or replace function excluir_sessao_treino(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if e_admin() then
    delete from treino_sessoes where id = p_id;
  else
    perform exigir_treino_liberado(meu_paciente_id());
    -- A paciente apaga a própria sessão, e só a dela.
    delete from treino_sessoes where id = p_id and paciente_id = meu_paciente_id();
  end if;
end;
$$;

revoke all on function excluir_sessao_treino(uuid) from anon, public;
grant execute on function excluir_sessao_treino(uuid) to authenticated;

-- ------------------------------------------------- cardio e metas da semana

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
  if not e_admin() and not treino_liberado(v_paciente) then return '[]'::jsonb; end if;

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

  if v_paciente is not null and not e_admin() then
    perform exigir_treino_liberado(v_paciente);
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
    perform exigir_treino_liberado(meu_paciente_id());
    delete from cardio_sessoes where id = p_id and paciente_id = meu_paciente_id();
  end if;
end;
$$;

revoke all on function excluir_cardio(uuid) from anon, public;
grant execute on function excluir_cardio(uuid) to authenticated;

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
  if not e_admin() and not treino_liberado(v_paciente) then return '[]'::jsonb; end if;

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
