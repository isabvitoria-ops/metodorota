-- =============================================================================
-- Bateria dos questionarios e do check-in semanal (0041)
--
-- Um motor so para as duas coisas: um check-in semanal E um questionario
-- que volta toda segunda. O que nao pode falhar:
--
--   * o PERIODO nao vem da tela. Se viesse, daria para reescrever a semana
--     passada mudando um campo escondido, e a serie temporal do check-in
--     deixaria de valer;
--   * corrigir o enunciado de uma pergunta NAO apaga as respostas. Apagar a
--     pergunta apagaria a resposta em cascata, em silencio, e o historico de
--     check-in de todas as pacientes iria junto;
--   * desatribuir e "pare de perguntar", nao "esqueca o que ela disse";
--   * uma paciente nao le, nao responde e nem descobre questionario que nao
--     e dela;
--   * peso e inversao nao chegam na tela da paciente: sao a regua com que a
--     nutricionista pontua, e ver isso muda a resposta.
-- =============================================================================

truncate resultados_teste;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000fa01', 'quest-a@paciente.test'),
  ('00000000-0000-0000-0000-00000000fa02', 'quest-b@paciente.test');

insert into pacientes (email, nome, plano_id, data_inicio, data_fim) values
  ('quest-a@paciente.test', 'Alda Quest', 'mensal', hoje_sp() - 5, hoje_sp() + 25),
  ('quest-b@paciente.test', 'Bela Quest', 'mensal', hoje_sp() - 5, hoje_sp() + 25);

create or replace function alda() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'quest-a@paciente.test' $$;
create or replace function bela() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'quest-b@paciente.test' $$;

-- Helpers `security definer`: dentro da sessao da paciente, um `select`
-- simples devolve NULL porque a RLS esconde a linha -- e um teste que compara
-- com NULL passa por engano. Esta armadilha ja custou duas baterias.
create or replace function quest_id(p_titulo text) returns uuid
  language sql stable security definer as $$
  select id from questionarios where titulo = p_titulo $$;
create or replace function pergunta_id(p_texto text) returns uuid
  language sql stable security definer as $$
  select id from questionario_perguntas where texto = p_texto limit 1 $$;
create or replace function quantos_envios(p_paciente uuid) returns integer
  language sql stable security definer as $$
  select count(*)::integer from questionario_envios where paciente_id = p_paciente $$;
create or replace function quantas_respostas(p_paciente uuid) returns integer
  language sql stable security definer as $$
  select count(*)::integer from questionario_respostas r
   join questionario_envios e on e.id = r.envio_id
   where e.paciente_id = p_paciente $$;
create or replace function periodo_do_envio(p_paciente uuid) returns date
  language sql stable security definer as $$
  select periodo from questionario_envios where paciente_id = p_paciente
   order by respondido_em desc limit 1 $$;
create or replace function texto_da_resposta(p_paciente uuid, p_pergunta uuid) returns text
  language sql stable security definer as $$
  select r.valor_texto from questionario_respostas r
   join questionario_envios e on e.id = r.envio_id
   where e.paciente_id = p_paciente and r.pergunta_id = p_pergunta limit 1 $$;
create or replace function numero_da_resposta(p_paciente uuid, p_pergunta uuid) returns numeric
  language sql stable security definer as $$
  select r.valor_numero from questionario_respostas r
   join questionario_envios e on e.id = r.envio_id
   where e.paciente_id = p_paciente and r.pergunta_id = p_pergunta limit 1 $$;

grant execute on function alda(), bela(), quest_id(text), pergunta_id(text),
  quantos_envios(uuid), quantas_respostas(uuid), periodo_do_envio(uuid),
  texto_da_resposta(uuid, uuid), numero_da_resposta(uuid, uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- So a nutricionista monta
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000fa01', true);

select teste('a paciente nao cria questionario',
  estado_de($q$select salvar_questionario(null, 'X', null, 'unica', true, '[]'::jsonb)$q$) = '42501');
select teste('a paciente nao lista os questionarios dela mesma pela funcao da nutri',
  estado_de('select listar_questionarios()') = '42501');
select teste('nem escreve direto na tabela',
  nao_alterou($q$insert into questionarios (titulo) values ('pela porta dos fundos')$q$));
commit;

-- -----------------------------------------------------------------------------
-- A nutricionista monta um check-in semanal e um de vez unica
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select salvar_questionario(null, 'Check-in da semana', 'Como foi a semana', 'semanal', true,
  $j$[
    {"texto": "Como estava seu intestino?", "tipo": "escala", "peso": 2},
    {"texto": "Quanta dor voce sentiu?", "tipo": "escala", "peso": 1, "invertida": true},
    {"texto": "Conte em uma frase", "tipo": "texto", "peso": 0, "obrigatoria": false}
  ]$j$::jsonb);

select salvar_questionario(null, 'Anamnese inicial', null, 'unica', true,
  $j$[{"texto": "Ha quanto tempo tem sintomas?", "tipo": "texto"}]$j$::jsonb);

select teste('o check-in foi criado', quest_id('Check-in da semana') is not null);
select teste('com as tres perguntas',
  (select count(*) from questionario_perguntas where questionario_id = quest_id('Check-in da semana')) = 3);
select teste('a ordem veio da lista, nao do acaso',
  (select texto from questionario_perguntas
    where questionario_id = quest_id('Check-in da semana') and ordem = 1) = 'Como estava seu intestino?');
select teste('o peso foi guardado',
  (select peso from questionario_perguntas where texto = 'Como estava seu intestino?') = 2);
select teste('a escala invertida foi guardada',
  (select invertida from questionario_perguntas where texto = 'Quanta dor voce sentiu?'));
select teste('peso zero e guardado como zero, e nao virou 1',
  (select peso from questionario_perguntas where texto = 'Conte em uma frase') = 0);
select teste('periodicidade invalida e recusada',
  estado_de($q$select salvar_questionario(null, 'X', null, 'todo ano', true, '[]'::jsonb)$q$) = '22023');
select teste('questionario sem titulo e recusado',
  estado_de($q$select salvar_questionario(null, '   ', null, 'unica', true, '[]'::jsonb)$q$) = '22023');
commit;

-- -----------------------------------------------------------------------------
-- Sem atribuicao, a paciente nao ve nem responde
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000fa01', true);

select teste('sem atribuicao, a lista dela vem vazia',
  jsonb_array_length(meus_questionarios()) = 0);
select teste('e responder e recusado, mesmo sabendo o id',
  estado_de(format('select responder_questionario(%L, %L::jsonb)',
    quest_id('Check-in da semana'), '[]')) = '42501');
select teste('ela nao le a tabela de questionarios',
  (select count(*) from questionarios) = 0);
select teste('nem a de perguntas',
  (select count(*) from questionario_perguntas) = 0);
commit;

-- -----------------------------------------------------------------------------
-- Atribuido: aparece, e aparece PENDENTE
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select teste('a nutricionista atribui, e a funcao devolve o estado gravado',
  definir_questionario_do_paciente(quest_id('Check-in da semana'), alda(), true));
select teste('atribuir de novo nao duplica',
  definir_questionario_do_paciente(quest_id('Check-in da semana'), alda(), true));
select teste('atribuir a uma paciente que nao existe e recusado',
  estado_de(format('select definir_questionario_do_paciente(%L, %L, true)',
    quest_id('Check-in da semana'),
    '00000000-0000-0000-0000-0000000000ff')) = '22023');
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000fa01', true);

select teste('agora ela ve um questionario', jsonb_array_length(meus_questionarios()) = 1);
select teste('e ele esta PENDENTE, sem nada ter rodado de madrugada',
  (meus_questionarios() -> 0 ->> 'pendente')::boolean);
select teste('o periodo oferecido e a segunda desta semana',
  (meus_questionarios() -> 0 ->> 'periodo')::date = semana_de(hoje_sp()));
select teste('as perguntas vem junto',
  jsonb_array_length(meus_questionarios() -> 0 -> 'perguntas') = 3);

-- A regua da nutricionista nao aparece para quem responde.
select teste('o peso NAO chega na tela da paciente',
  not (meus_questionarios() -> 0 -> 'perguntas' -> 0 ? 'peso'));
select teste('a inversao tambem NAO chega',
  not (meus_questionarios() -> 0 -> 'perguntas' -> 1 ? 'invertida'));
commit;

-- -----------------------------------------------------------------------------
-- Ela responde. O PERIODO NAO VEM DA TELA.
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000fa01', true);

select responder_questionario(quest_id('Check-in da semana'), jsonb_build_array(
  jsonb_build_object('perguntaId', pergunta_id('Como estava seu intestino?'), 'numero', 7),
  jsonb_build_object('perguntaId', pergunta_id('Quanta dor voce sentiu?'), 'numero', 3),
  jsonb_build_object('perguntaId', pergunta_id('Conte em uma frase'), 'texto', 'semana corrida')
));

select teste('gravou um envio', quantos_envios(alda()) = 1);
select teste('com as tres respostas', quantas_respostas(alda()) = 3);
select teste('o periodo gravado e a segunda desta semana, calculada no banco',
  periodo_do_envio(alda()) = semana_de(hoje_sp()));
select teste('o texto foi guardado',
  texto_da_resposta(alda(), pergunta_id('Conte em uma frase')) = 'semana corrida');
select teste('agora nao esta mais pendente',
  not (meus_questionarios() -> 0 ->> 'pendente')::boolean);
select teste('e ela rele o que enviou',
  jsonb_array_length(meus_questionarios() -> 0 -> 'enviados') = 1);

-- Reenviar na MESMA semana atualiza; nao cria uma segunda linha.
select responder_questionario(quest_id('Check-in da semana'), jsonb_build_array(
  jsonb_build_object('perguntaId', pergunta_id('Como estava seu intestino?'), 'numero', 9)
));
select teste('reenviar na mesma semana NAO cria um segundo envio', quantos_envios(alda()) = 1);
select teste('e o valor foi atualizado',
  numero_da_resposta(alda(), pergunta_id('Como estava seu intestino?')) = 9);
select teste('o que nao veio no reenvio continua la, e nao foi apagado',
  texto_da_resposta(alda(), pergunta_id('Conte em uma frase')) = 'semana corrida');

-- A escala e presa no banco, e nao so no controle da tela.
select responder_questionario(quest_id('Check-in da semana'), jsonb_build_array(
  jsonb_build_object('perguntaId', pergunta_id('Como estava seu intestino?'), 'numero', 9999)
));
select teste('um 9999 vindo por fora e preso em 10, e nao estoura a pontuacao',
  numero_da_resposta(alda(), pergunta_id('Como estava seu intestino?')) = 10);

-- Pergunta de outro questionario e ignorada, e nao derruba o envio inteiro.
select responder_questionario(quest_id('Check-in da semana'), jsonb_build_array(
  jsonb_build_object('perguntaId', pergunta_id('Ha quanto tempo tem sintomas?'), 'texto', 'intruso'),
  jsonb_build_object('perguntaId', pergunta_id('Quanta dor voce sentiu?'), 'numero', 1)
));
select teste('pergunta de outro questionario e ignorada em silencio',
  texto_da_resposta(alda(), pergunta_id('Ha quanto tempo tem sintomas?')) is null);
select teste('e o resto do envio foi gravado assim mesmo',
  numero_da_resposta(alda(), pergunta_id('Quanta dor voce sentiu?')) = 1);
commit;

-- -----------------------------------------------------------------------------
-- Uma paciente nao alcanca a outra
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000fa02', true);

select teste('a outra nao tem questionario nenhum',
  jsonb_array_length(meus_questionarios()) = 0);
select teste('nem responde o da primeira, sabendo o id',
  estado_de(format('select responder_questionario(%L, %L::jsonb)',
    quest_id('Check-in da semana'), '[]')) = '42501');
select teste('nao le os envios da outra', (select count(*) from questionario_envios) = 0);
select teste('nem as respostas da outra', (select count(*) from questionario_respostas) = 0);
select teste('e nao le as respostas pela funcao da nutricionista',
  estado_de(format('select questionarios_do_paciente(%L)', alda())) = '42501');
commit;

-- -----------------------------------------------------------------------------
-- Corrigir o enunciado NAO apaga o historico
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select salvar_questionario(quest_id('Check-in da semana'), 'Check-in da semana', null, 'semanal', true,
  jsonb_build_array(
    jsonb_build_object('id', pergunta_id('Como estava seu intestino?'),
                       'texto', 'Como estava seu intestino nesta semana?', 'tipo', 'escala', 'peso', 2),
    jsonb_build_object('id', pergunta_id('Quanta dor voce sentiu?'),
                       'texto', 'Quanta dor voce sentiu?', 'tipo', 'escala', 'peso', 1, 'invertida', true),
    jsonb_build_object('id', pergunta_id('Conte em uma frase'),
                       'texto', 'Conte em uma frase', 'tipo', 'texto', 'peso', 0)
  ));

select teste('o enunciado mudou',
  pergunta_id('Como estava seu intestino nesta semana?') is not null);
select teste('e as respostas continuam todas la', quantas_respostas(alda()) = 3);
select teste('inclusive a da pergunta renomeada',
  numero_da_resposta(alda(), pergunta_id('Como estava seu intestino nesta semana?')) = 10);

-- Tirar uma pergunta JA RESPONDIDA da lista nao pode apagar a resposta.
select salvar_questionario(quest_id('Check-in da semana'), 'Check-in da semana', null, 'semanal', true,
  jsonb_build_array(
    jsonb_build_object('id', pergunta_id('Como estava seu intestino nesta semana?'),
                       'texto', 'Como estava seu intestino nesta semana?', 'tipo', 'escala', 'peso', 2)
  ));
select teste('tirar da lista uma pergunta ja respondida NAO apaga a resposta',
  quantas_respostas(alda()) = 3);
select teste('a pergunta respondida continua existindo',
  pergunta_id('Conte em uma frase') is not null);

-- Uma pergunta que ninguem respondeu some de verdade.
select salvar_questionario(null, 'Descartavel', null, 'unica', true,
  $j$[{"texto": "Pergunta que ninguem respondeu", "tipo": "texto"}]$j$::jsonb);
select salvar_questionario(quest_id('Descartavel'), 'Descartavel', null, 'unica', true, '[]'::jsonb);
select teste('pergunta que ninguem respondeu some de verdade',
  pergunta_id('Pergunta que ninguem respondeu') is null);
commit;

-- -----------------------------------------------------------------------------
-- Desatribuir e "pare de perguntar", nao "esqueca o que ela disse"
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select teste('desatribuir devolve falso', not definir_questionario_do_paciente(
  quest_id('Check-in da semana'), alda(), false));
select teste('as respostas ficam', quantas_respostas(alda()) = 3);
select teste('e a nutricionista ainda le o historico dela',
  jsonb_array_length(questionarios_do_paciente(alda())) >= 1);
select teste('o peso e a inversao chegam para a nutricionista, que e quem pontua',
  (questionarios_do_paciente(alda()) -> 0 -> 'perguntas' -> 0) ? 'peso');
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000fa01', true);
select teste('do lado dela, o questionario sumiu da lista',
  jsonb_array_length(meus_questionarios()) = 0);
commit;

-- -----------------------------------------------------------------------------
-- Revisado: a marca e DELA, e a paciente nao sabe
-- -----------------------------------------------------------------------------
create or replace function envio_de(p_paciente uuid) returns uuid
  language sql stable security definer as $$
  select id from questionario_envios where paciente_id = p_paciente
   order by respondido_em desc limit 1 $$;
grant execute on function envio_de(uuid) to anon, authenticated;

begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000fa01', true);
select teste('a paciente nao marca nada como revisado',
  estado_de(format('select marcar_revisado(%L, true)', envio_de(alda()))) = '42501');
-- A chave: o campo nao sai na funcao dela. Um "visto" visivel criaria
-- expectativa de resposta que o aplicativo nao promete.
select teste('a marca NAO chega na tela da paciente',
  not (meus_questionarios() -> 0 -> 'enviados' -> 0 ? 'revisado')
  or jsonb_array_length(meus_questionarios()) = 0);
commit;

begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select teste('nasce nao revisado',
  not (questionarios_do_paciente(alda()) -> 0 -> 'envios' -> 0 ->> 'revisado')::boolean);
select teste('a nutricionista marca, e volta o estado GRAVADO',
  marcar_revisado(envio_de(alda()), true));
select teste('e a leitura confirma',
  (questionarios_do_paciente(alda()) -> 0 -> 'envios' -> 0 ->> 'revisado')::boolean);
select teste('desmarcar volta atras', not marcar_revisado(envio_de(alda()), false));
select teste('envio que nao existe e recusado',
  estado_de(format('select marcar_revisado(%L, true)',
    '00000000-0000-0000-0000-0000000000fe')) = '22023');
commit;

-- -----------------------------------------------------------------------------
-- A semana e a segunda-feira
-- -----------------------------------------------------------------------------
begin;
select teste('segunda-feira devolve ela mesma', semana_de('2026-09-21'::date) = '2026-09-21'::date);
select teste('domingo pertence a semana que comecou na segunda anterior',
  semana_de('2026-09-27'::date) = '2026-09-21'::date);
select teste('terca pertence a segunda da mesma semana',
  semana_de('2026-09-22'::date) = '2026-09-21'::date);
commit;

select
  count(*) filter (where passou) || '/' || count(*) || ' verificações dos questionários passaram'
    as resultado
from resultados_teste;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% verificação(ões) dos questionários falharam', v_falhas;
  end if;
end;
$$;
