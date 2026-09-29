-- =============================================================================
-- Bateria do score por eixo e do congelamento (0054)
--
-- O que nao pode falhar:
--   * EIXO e da nutricionista. A paciente nao le, nao cria, nao apaga.
--   * a MULTIPLA ESCOLHA pontua pelos pontos de cada opcao.
--   * ao responder, a REGUA e fotografada no envio (regua_snapshot).
--   * mudar o peso DEPOIS nao mexe na foto -- a nota da semana ja
--     respondida fica como estava. Este e o coracao do pedido dela.
--   * a nota so chega para a paciente quando mostra_pontuacao e true.
-- =============================================================================

truncate resultados_teste;

-- Helpers `security definer` (a RLS esconderia a linha e o teste passaria
-- comparando com NULL).
create or replace function eixo_id_por_nome(p_nome text) returns uuid
  language sql stable security definer as $$
  select id from checkin_eixos where nome = p_nome limit 1 $$;
create or replace function conta_eixos() returns integer
  language sql stable security definer as $$
  select count(*)::integer from checkin_eixos $$;
create or replace function snapshot_do_ultimo(p_paciente uuid) returns jsonb
  language sql stable security definer as $$
  select regua_snapshot from questionario_envios where paciente_id = p_paciente
   order by respondido_em desc limit 1 $$;
create or replace function peso_no_snapshot(p_paciente uuid, p_pergunta uuid) returns numeric
  language sql stable security definer as $$
  select (e.value ->> 'peso')::numeric
    from questionario_envios env,
         jsonb_array_elements(env.regua_snapshot) e
   where env.paciente_id = p_paciente
     and (e.value ->> 'perguntaId')::uuid = p_pergunta
   order by env.respondido_em desc limit 1 $$;

grant execute on function eixo_id_por_nome(text), conta_eixos(),
  snapshot_do_ultimo(uuid), peso_no_snapshot(uuid, uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- A nutricionista cria eixos e um questionario que pontua
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select salvar_eixos_checkin('[{"nome":"Intestino"},{"nome":"Sono"}]'::jsonb);
select teste('a nutricionista cria os eixos', conta_eixos() = 2);
select teste('e os le de volta', jsonb_array_length(listar_eixos_checkin()) = 2);

-- Questionario com uma escala (Intestino) e uma escolha pontuada (Sono).
select salvar_questionario(
  null, 'Check-in do intestino', null, 'semanal', true,
  jsonb_build_array(
    jsonb_build_object('texto', 'Como esteve o intestino?', 'tipo', 'escala',
      'peso', 2, 'invertida', false, 'eixoId', eixo_id_por_nome('Intestino')),
    jsonb_build_object('texto', 'Dormiu bem?', 'tipo', 'escolha',
      'opcoes', jsonb_build_array('Nunca','As vezes','Sempre'),
      'pontosOpcoes', jsonb_build_array(0, 5, 10),
      'peso', 1, 'eixoId', eixo_id_por_nome('Sono'))),
  true) as qid
\gset

select teste('o questionario nasce com mostra_pontuacao ligado quando pedido',
  (select mostra_pontuacao from questionarios where id = :'qid'::uuid));
select teste('a pergunta de escolha guardou os pontos por opcao',
  (select pontos_opcoes from questionario_perguntas
    where questionario_id = :'qid'::uuid and tipo = 'escolha') = '[0, 5, 10]'::jsonb);
select teste('a pergunta guardou o eixo',
  (select eixo_id from questionario_perguntas
    where questionario_id = :'qid'::uuid and tipo = 'escala') = eixo_id_por_nome('Intestino'));

-- Libera para a Alda (fixture da bateria 14).
select definir_questionario_do_paciente(:'qid'::uuid, alda(), true);
commit;

-- -----------------------------------------------------------------------------
-- A paciente NAO alcanca os eixos
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000fa01', true);

select teste('a paciente NAO lista eixos', estado_de('select listar_eixos_checkin()') = '42501');
select teste('a paciente NAO cria eixos',
  estado_de($$select salvar_eixos_checkin('[{"nome":"Intruso"}]'::jsonb)$$) = '42501');
select teste('a paciente NAO le a tabela de eixos', (select count(*) from checkin_eixos) = 0);
commit;

-- -----------------------------------------------------------------------------
-- A paciente responde: a regua e fotografada
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000fa01', true);

select responder_questionario(:'qid'::uuid, jsonb_build_array(
  jsonb_build_object('perguntaId', pergunta_id('Como esteve o intestino?'), 'numero', '8'),
  jsonb_build_object('perguntaId', pergunta_id('Dormiu bem?'), 'texto', 'As vezes')));

select teste('o envio guardou a foto da regua',
  jsonb_array_length(snapshot_do_ultimo(alda())) = 2);
select teste('a foto guardou o peso vigente da escala (2)',
  peso_no_snapshot(alda(), pergunta_id('Como esteve o intestino?')) = 2);
commit;

-- -----------------------------------------------------------------------------
-- O CONGELAMENTO: mudar o peso depois nao mexe na foto
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

-- Troca o peso da escala de 2 para 9.
select salvar_questionario(
  :'qid'::uuid, 'Check-in do intestino', null, 'semanal', true,
  jsonb_build_array(
    jsonb_build_object('id', pergunta_id('Como esteve o intestino?'),
      'texto', 'Como esteve o intestino?', 'tipo', 'escala',
      'peso', 9, 'invertida', false, 'eixoId', eixo_id_por_nome('Intestino')),
    jsonb_build_object('id', pergunta_id('Dormiu bem?'),
      'texto', 'Dormiu bem?', 'tipo', 'escolha',
      'opcoes', jsonb_build_array('Nunca','As vezes','Sempre'),
      'pontosOpcoes', jsonb_build_array(0, 5, 10),
      'peso', 1, 'eixoId', eixo_id_por_nome('Sono'))),
  true);

select teste('a regua atual mudou para peso 9',
  (select peso from questionario_perguntas
    where texto = 'Como esteve o intestino?' and questionario_id = :'qid'::uuid) = 9);
select teste('mas a FOTO do envio ja respondido continua com peso 2',
  peso_no_snapshot(alda(), pergunta_id('Como esteve o intestino?')) = 2);

-- A saida de emergencia: reaplicar a regua atual para tras.
select reaplicar_regua(:'qid'::uuid, alda());
select teste('reaplicar a regua atualiza a foto para o peso novo (9)',
  peso_no_snapshot(alda(), pergunta_id('Como esteve o intestino?')) = 9);
commit;

-- -----------------------------------------------------------------------------
-- Com mostra_pontuacao = true, a regua chega para a paciente (de proposito)
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000fa01', true);

select teste('com a nota mostrada, o questionario diz mostraPontuacao true',
  (select (q ->> 'mostraPontuacao')::boolean
     from jsonb_array_elements(meus_questionarios()) q
    where q ->> 'titulo' = 'Check-in do intestino'));
select teste('e agora o peso da regua chega para ela (nao e nulo)',
  (select (pg -> 'peso') <> 'null'::jsonb
     from jsonb_array_elements(meus_questionarios()) q,
          jsonb_array_elements(q -> 'perguntas') pg
    where q ->> 'titulo' = 'Check-in do intestino'
      and pg ->> 'texto' = 'Como esteve o intestino?'));
commit;

select
  count(*) filter (where passou) || '/' || count(*) || ' verificacoes do score por eixo passaram'
    as resultado
from resultados_teste;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% verificacao(oes) do score por eixo falharam', v_falhas;
  end if;
end;
$$;
