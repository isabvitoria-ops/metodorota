-- 0065_checkin_v2_seed.sql
-- Popula o banco de perguntas do check-in semanal V2:
--   • 6 eixos (blocos de score)
--   • 1 questionário semanal com 49 perguntas
--   • Cada pergunta tem versoes, codigo, cadencia, modulo, regras, alertas

begin;

-- =========================================================================
-- 1. Eixos (blocos de score)
-- =========================================================================
-- Limpa eixos antigos que a migração anterior possa ter criado como exemplo
delete from checkin_eixos where nome in (
  'Hidratação e alimentação', 'Sono e energia', 'Corpo e treino',
  'Intestino', 'Humor', 'Tratamento');

insert into checkin_eixos (id, nome, ordem) values
  ('a0000000-0000-0000-0000-000000000001', 'Hidratação e alimentação', 1),
  ('a0000000-0000-0000-0000-000000000002', 'Sono e energia',           2),
  ('a0000000-0000-0000-0000-000000000003', 'Corpo e treino',           3),
  ('a0000000-0000-0000-0000-000000000004', 'Intestino',                4),
  ('a0000000-0000-0000-0000-000000000005', 'Humor',                    5),
  ('a0000000-0000-0000-0000-000000000006', 'Tratamento',               6)
on conflict (id) do update set nome = excluded.nome, ordem = excluded.ordem;

-- =========================================================================
-- 2. Questionário + 49 perguntas
-- =========================================================================

-- Criar o questionário-mãe (semanal, mostra pontuação)
insert into questionarios (id, titulo, descricao, periodicidade, ativo, mostra_pontuacao)
values (
  'c0000000-0000-0000-0000-000000000001',
  'Feedback Semanal',
  'Check-in semanal de saúde e bem-estar. Versões: V1 Estética, V2 Intestinal, V3 GLP-1.',
  'semanal', true, true
)
on conflict (id) do update set
  titulo = excluded.titulo,
  descricao = excluded.descricao,
  periodicidade = excluded.periodicidade,
  ativo = excluded.ativo,
  mostra_pontuacao = excluded.mostra_pontuacao;

-- Apagar perguntas existentes desse questionário (idempotente na reinstalação)
delete from questionario_perguntas where questionario_id = 'c0000000-0000-0000-0000-000000000001';

-- Macro para eixo_id
-- E1 = Hidratação e alimentação
-- E2 = Sono e energia
-- E3 = Corpo e treino
-- E4 = Intestino
-- E5 = Humor
-- E6 = Tratamento

insert into questionario_perguntas (
  questionario_id, ordem, codigo, modulo, texto, tipo,
  obrigatoria, peso, invertida, cadencia,
  opcoes, pontos_opcoes,
  explicacao_opcoes, texto_ajuda,
  notas_por_faixa, regra_exibicao, alertas_opcoes,
  versoes, ativa, eixo_id
) values

-- -------------------------------------------------------------------------
-- MÓDULO BASE
-- -------------------------------------------------------------------------

-- B01: Peso corporal (métrica sem nota)
('c0000000-0000-0000-0000-000000000001', 1, 'B01', 'BASE',
 'Qual foi o seu último peso em jejum?',
 'metrica', false, 0, false, 'semanal',
 '[]'::jsonb, '[]'::jsonb,
 '[]'::jsonb, 'Em kg, com uma casa decimal. Ex.: 68,5',
 null, null, '[]'::jsonb,
 '["V1","V2","V3"]'::jsonb, true, null),

-- B02: Água (número com faixa)
('c0000000-0000-0000-0000-000000000001', 2, 'B02', 'BASE',
 'Quantos litros de água você está bebendo por dia em média?',
 'numero', true, 3, false, 'semanal',
 '[]'::jsonb, '[]'::jsonb,
 '[]'::jsonb, 'Em litros. Ex.: 1,5',
 '{"faixas":[{"min":null,"max":0.39,"nota":-2,"rotulo":"Menos de 40% da meta"},{"min":0.4,"max":0.59,"nota":-1,"rotulo":"40% a 59% da meta"},{"min":0.6,"max":0.79,"nota":0,"rotulo":"60% a 79% da meta"},{"min":0.8,"max":0.99,"nota":1,"rotulo":"80% a 99% da meta"},{"min":1.0,"max":null,"nota":2,"rotulo":"100% da meta ou mais"}],"metaIndividual":"hidratacao"}'::jsonb,
 null, '[]'::jsonb,
 '["V1","V2","V3"]'::jsonb, true,
 'a0000000-0000-0000-0000-000000000001'),

-- B03: Horas de sono (número com faixa)
('c0000000-0000-0000-0000-000000000001', 3, 'B03', 'BASE',
 'Quantas horas de sono você está dormindo por noite, em média?',
 'numero', true, 3, false, 'semanal',
 '[]'::jsonb, '[]'::jsonb,
 '[]'::jsonb, 'Em horas. Ex.: 7,5',
 '{"faixas":[{"min":null,"max":3.9,"nota":-2,"rotulo":"Menos de 4 horas"},{"min":4,"max":4.9,"nota":-1,"rotulo":"4 a menos de 5 horas"},{"min":5,"max":5.9,"nota":0,"rotulo":"5 a menos de 6 horas"},{"min":6,"max":6.9,"nota":1,"rotulo":"6 a menos de 7 horas"},{"min":7,"max":9,"nota":2,"rotulo":"7 a 9 horas"},{"min":9.1,"max":null,"nota":1,"rotulo":"Mais de 9 horas"}]}'::jsonb,
 null, '[]'::jsonb,
 '["V1","V2","V3"]'::jsonb, true,
 'a0000000-0000-0000-0000-000000000002'),

-- B04: Qualidade do sono (emoji 5 níveis)
('c0000000-0000-0000-0000-000000000001', 4, 'B04', 'BASE',
 'Como está a qualidade do seu sono nas últimas noites?',
 'emoji', true, 3, false, 'semanal',
 '["Ótimo","Bom","Neutro","Ruim","Terrível"]'::jsonb,
 '[2,1,0,-1,-2]'::jsonb,
 '[]'::jsonb, null, null, null, '[]'::jsonb,
 '["V1","V2","V3"]'::jsonb, true,
 'a0000000-0000-0000-0000-000000000002'),

-- B05: Disposição (emoji 5 níveis)
('c0000000-0000-0000-0000-000000000001', 5, 'B05', 'BASE',
 'Como está a sua disposição durante o dia?',
 'emoji', true, 3, false, 'semanal',
 '["Muito disposto(a)","Geralmente disposto(a)","Depende do dia","Geralmente indisposto(a)","Zero disposição"]'::jsonb,
 '[2,1,0,-1,-2]'::jsonb,
 '[]'::jsonb, null, null, null, '[]'::jsonb,
 '["V1","V2","V3"]'::jsonb, true,
 'a0000000-0000-0000-0000-000000000002'),

-- B06: Pular refeições (escolha)
('c0000000-0000-0000-0000-000000000001', 6, 'B06', 'BASE',
 'Você costuma pular alguma refeição rotineiramente?',
 'escolha', true, 3, false, 'semanal',
 '["Não costumo pular refeições","Às vezes acabo pulando uma ou outra refeição na semana.","Sempre acabo pulando uma ou mais refeições na semana"]'::jsonb,
 '[2,0,-2]'::jsonb,
 '["","","Qual refeição você mais pula e por quê?"]'::jsonb,
 null, null, null, '[]'::jsonb,
 '["V1","V2","V3"]'::jsonb, true,
 'a0000000-0000-0000-0000-000000000001'),

-- B07: Fome e apetite (escolha)
('c0000000-0000-0000-0000-000000000001', 7, 'B07', 'BASE',
 'Como você considera que está o seu nível de fome e apetite atualmente?',
 'escolha', true, 3, false, 'semanal',
 '["Baixo; não sinto muita fome, mas consigo comer tudo.","Médio; às vezes sinto fome, mas isso não me atrapalha.","Não sinto fome e tenho dificuldade para comer.","Alto; sinto bastante fome."]'::jsonb,
 '[1,2,-2,-1]'::jsonb,
 '["","","Conte mais sobre essa dificuldade.",""]'::jsonb,
 null, null, null,
 '[{"indice":2,"alerta":"A18","condicao":"versoes_inclui","valor":"V3"}]'::jsonb,
 '["V1","V2","V3"]'::jsonb, true,
 'a0000000-0000-0000-0000-000000000001'),

-- B08: Aderência ao plano (escolha)
('c0000000-0000-0000-0000-000000000001', 8, 'B08', 'BASE',
 'Como está sua aderência ao plano de refeições?',
 'escolha', true, 4, false, 'semanal',
 '["Estou conseguindo seguir tudo tranquilamente","Consigo fazer tudo, mas às vezes passo por alguma dificuldade","Não consigo realizar tudo","Não estou conseguindo realizar nada"]'::jsonb,
 '[2,1,-1,-2]'::jsonb,
 '["","","O que está mais difícil de cumprir?","O que está impedindo?"]'::jsonb,
 null, null, null, '[]'::jsonb,
 '["V1","V2","V3"]'::jsonb, true,
 'a0000000-0000-0000-0000-000000000001'),

-- B09: Porções de vegetais (escolha, quinzenal)
('c0000000-0000-0000-0000-000000000001', 9, 'B09', 'BASE',
 'Quantas porções de vegetais você consumiu por dia nos últimos dias?',
 'escolha', true, 2, false, 'quinzenal',
 '["Três ou mais porções","Uma a duas porções","Nenhuma porção"]'::jsonb,
 '[2,0,-2]'::jsonb,
 '[]'::jsonb, null, null, null, '[]'::jsonb,
 '["V1","V2","V3"]'::jsonb, true,
 'a0000000-0000-0000-0000-000000000001'),

-- B10: Álcool (número com faixa, quinzenal)
('c0000000-0000-0000-0000-000000000001', 10, 'B10', 'BASE',
 'Quantos dias na última semana você consumiu bebida alcoólica?',
 'numero', true, 2, false, 'quinzenal',
 '[]'::jsonb, '[]'::jsonb,
 '[]'::jsonb, 'De 0 a 7 dias.',
 '{"faixas":[{"min":0,"max":0,"nota":2,"rotulo":"0 dias"},{"min":1,"max":1,"nota":1,"rotulo":"1 dia"},{"min":2,"max":2,"nota":0,"rotulo":"2 dias"},{"min":3,"max":4,"nota":-1,"rotulo":"3 a 4 dias"},{"min":5,"max":7,"nota":-2,"rotulo":"5 a 7 dias"}]}'::jsonb,
 null, '[]'::jsonb,
 '["V1","V2","V3"]'::jsonb, true,
 'a0000000-0000-0000-0000-000000000001'),

-- B11: Estresse e humor (emoji 5 níveis)
('c0000000-0000-0000-0000-000000000001', 11, 'B11', 'BASE',
 'Como foram seu estresse e seu humor na maior parte da semana?',
 'emoji', true, 2, false, 'semanal',
 '["Muito bem, leve","Bem","Oscilando","Estressada / irritada","Muito mal"]'::jsonb,
 '[2,1,0,-1,-2]'::jsonb,
 '["","","","","Quer contar o que está pesando?"]'::jsonb,
 null, null, null, '[]'::jsonb,
 '["V1","V2","V3"]'::jsonb, true,
 'a0000000-0000-0000-0000-000000000005'),

-- B12: Ciclo menstrual (escolha, opcional, sem nota)
('c0000000-0000-0000-0000-000000000001', 12, 'B12', 'BASE',
 'Em que momento do ciclo menstrual você está?',
 'escolha', false, 0, false, 'semanal',
 '["Menstruada","Logo após a menstruação (fase folicular)","Período fértil / ovulação","Antes da menstruação (TPM / fase lútea)","Não menstruo (menopausa, método contraceptivo, outro motivo)","Prefiro não informar","Atraso menstrual ou possibilidade de gravidez"]'::jsonb,
 '[]'::jsonb,
 '[]'::jsonb, null, null, null,
 '[{"indice":6,"alerta":"A14","condicao":"versoes_inclui","valor":"V3"}]'::jsonb,
 '["V1","V2","V3"]'::jsonb, true, null),

-- B13: Alterações no cardápio (texto livre, opcional)
('c0000000-0000-0000-0000-000000000001', 13, 'B13', 'BASE',
 'Você gostaria de fazer alguma alteração no seu planejamento alimentar? Por exemplo, incluir um novo alimento, adicionar ou modificar uma refeição.',
 'texto', false, 0, false, 'semanal',
 '[]'::jsonb, '[]'::jsonb,
 '[]'::jsonb, null, null, null, '[]'::jsonb,
 '["V1","V2","V3"]'::jsonb, true, null),

-- B14: Feedback aberto (texto livre, opcional, sempre último)
('c0000000-0000-0000-0000-000000000001', 14, 'B14', 'BASE',
 'O que mais você gostaria de compartilhar sobre sua experiência?',
 'texto', false, 0, false, 'semanal',
 '[]'::jsonb, '[]'::jsonb,
 '[]'::jsonb, null, null, null, '[]'::jsonb,
 '["V1","V2","V3"]'::jsonb, true, null),

-- -------------------------------------------------------------------------
-- MÓDULO ESTÉTICA / EMAGRECIMENTO
-- -------------------------------------------------------------------------

-- E01: Exercícios (escolha)
('c0000000-0000-0000-0000-000000000001', 15, 'E01', 'ESTETICA',
 'Você sente que seu desempenho em exercícios físicos está melhorando?',
 'escolha', true, 3, false, 'semanal',
 '["Não treinei esta semana","Melhorou muito","Melhorou pouco","Não melhorou","Piorou","Piorou muito"]'::jsonb,
 '[null,2,1,0,-1,-2]'::jsonb,
 '[]'::jsonb, null, null, null, '[]'::jsonb,
 '["V1","V2","V3"]'::jsonb, true,
 'a0000000-0000-0000-0000-000000000003'),

-- E02: Evolução corporal (escolha)
('c0000000-0000-0000-0000-000000000001', 16, 'E02', 'ESTETICA',
 'Você consegue notar evolução corporal em direção ao seu objetivo?',
 'escolha', true, 3, false, 'semanal',
 '["Bastante evolução","Consigo notar evolução","Não noto evolução","Talvez esteja regredindo","Estou regredindo"]'::jsonb,
 '[2,1,0,-1,-2]'::jsonb,
 '[]'::jsonb, null, null, null, '[]'::jsonb,
 '["V1","V2","V3"]'::jsonb, true,
 'a0000000-0000-0000-0000-000000000003'),

-- E03: Dias de treino (número com faixa)
('c0000000-0000-0000-0000-000000000001', 17, 'E03', 'ESTETICA',
 'Em quantos dias você treinou esta semana?',
 'numero', true, 2, false, 'semanal',
 '[]'::jsonb, '[]'::jsonb,
 '[]'::jsonb, 'De 0 a 7 dias.',
 '{"faixas":[{"min":0,"max":0,"nota":-2,"rotulo":"0 dia"},{"min":1,"max":1,"nota":-1,"rotulo":"1 dia"},{"min":2,"max":2,"nota":0,"rotulo":"2 dias"},{"min":3,"max":3,"nota":1,"rotulo":"3 dias"},{"min":4,"max":7,"nota":2,"rotulo":"4 dias ou mais"}],"metaIndividual":"treino"}'::jsonb,
 null, '[]'::jsonb,
 '["V1","V2","V3"]'::jsonb, true,
 'a0000000-0000-0000-0000-000000000003'),

-- E04: Comer emocional (escolha)
('c0000000-0000-0000-0000-000000000001', 18, 'E04', 'ESTETICA',
 'Você teve vontade de comer por ansiedade, emoção ou fissura por doces?',
 'escolha', true, 3, false, 'semanal',
 '["Raramente ou nunca","Às vezes","Frequentemente"]'::jsonb,
 '[2,0,-2]'::jsonb,
 '["","","Em que momentos isso acontece mais?"]'::jsonb,
 null, null, null, '[]'::jsonb,
 '["V1","V2","V3"]'::jsonb, true,
 'a0000000-0000-0000-0000-000000000001'),

-- E05: Refeições fora do plano (escolha, quinzenal)
('c0000000-0000-0000-0000-000000000001', 19, 'E05', 'ESTETICA',
 'Quantas refeições fora do plano você fez nesta semana?',
 'escolha', true, 2, false, 'quinzenal',
 '["Nenhuma","1 a 2","3 a 5","Mais de 5"]'::jsonb,
 '[2,1,-1,-2]'::jsonb,
 '[]'::jsonb, null, null, null, '[]'::jsonb,
 '["V1","V2","V3"]'::jsonb, true,
 'a0000000-0000-0000-0000-000000000001'),

-- E06: Cintura (métrica, mensal, opcional)
('c0000000-0000-0000-0000-000000000001', 20, 'E06', 'ESTETICA',
 'Qual foi a medida da sua cintura hoje?',
 'metrica', false, 0, false, 'mensal',
 '[]'::jsonb, '[]'::jsonb,
 '[]'::jsonb, 'Em cm. Ex.: 78',
 null, null, '[]'::jsonb,
 '["V1","V2","V3"]'::jsonb, true, null),

-- -------------------------------------------------------------------------
-- MÓDULO INTESTINO
-- -------------------------------------------------------------------------

-- I01: Consistência das fezes — versão V1 (3 opções)
-- Nota: V2 e V3 usam a versão Bristol com 7 opções. Como compartilham o mesmo
-- código I01, vamos usar a versão Bristol (mais completa) como padrão.
-- O mapeamento V1→Bristol é feito no cliente via pontosOpcoes.
-- Para V1 com 3 opções, a paciente vê as 3 opções simplificadas.
-- Implementação: uma única pergunta I01 com as 7 opções de Bristol.
-- Em V1, o filtro de versões mostra as 3 opções originais via campo separado.
-- Decisão: usar as 7 opções de Bristol para todas as versões (o mapeamento
-- fica no cliente para comparativos). V1 mostra texto simplificado.
('c0000000-0000-0000-0000-000000000001', 21, 'I01', 'INTESTINO',
 'Pensando na escala de Bristol, qual tipo de fezes foi mais frequente nesta semana?',
 'escolha', true, 4, false, 'semanal',
 '["Tipo 1 — bolinhas duras e separadas (como castanhas)","Tipo 2 — alongada, encaroçada, em gomos","Tipo 3 — alongada com rachaduras na superfície","Tipo 4 — alongada, lisa e macia (como uma salsicha)","Tipo 5 — pedaços macios com bordas nítidas","Tipo 6 — pedaços moles e irregulares, quase pastosa","Tipo 7 — líquida, sem pedaços"]'::jsonb,
 '[-2,-1,1,2,1,-1,-2]'::jsonb,
 '[]'::jsonb,
 'A escala de Bristol classifica as fezes de 1 (muito ressecadas) a 7 (líquidas). Tipos 3 e 4 são considerados normais.',
 null, null, '[]'::jsonb,
 '["V1","V2","V3"]'::jsonb, true,
 'a0000000-0000-0000-0000-000000000004'),

-- I02: Frequência intestinal (escolha)
('c0000000-0000-0000-0000-000000000001', 22, 'I02', 'INTESTINO',
 'Você tem ido ao banheiro diariamente?',
 'escolha', true, 4, false, 'semanal',
 '["Meu intestino está regulado, todos os dias.","Às vezes, dia sim, dia não","É irregular, uma a três vezes por semana."]'::jsonb,
 '[2,0,-2]'::jsonb,
 '["","","Conte mais sobre o que acontece."]'::jsonb,
 null, null, null, '[]'::jsonb,
 '["V1","V2","V3"]'::jsonb, true,
 'a0000000-0000-0000-0000-000000000004'),

-- I03: Desconforto abdominal (escolha, filtro para I05-I08)
('c0000000-0000-0000-0000-000000000001', 23, 'I03', 'INTESTINO',
 'Você sentiu desconforto abdominal, como gases ou inchaço nos últimos dias?',
 'escolha', true, 3, false, 'semanal',
 '["Raramente ou nunca","Às vezes","Frequentemente"]'::jsonb,
 '[2,0,-2]'::jsonb,
 '[]'::jsonb, null, null, null, '[]'::jsonb,
 '["V1","V2","V3"]'::jsonb, true,
 'a0000000-0000-0000-0000-000000000004'),

-- I04: Esforço para evacuar (escolha, V2+V3)
('c0000000-0000-0000-0000-000000000001', 24, 'I04', 'INTESTINO',
 'Você precisou fazer muito esforço para evacuar, ou ficou com a sensação de que não esvaziou por completo?',
 'escolha', true, 3, false, 'semanal',
 '["Nunca ou raramente","Às vezes","Quase sempre"]'::jsonb,
 '[2,0,-2]'::jsonb,
 '[]'::jsonb, null, null, null, '[]'::jsonb,
 '["V2","V3"]'::jsonb, true,
 'a0000000-0000-0000-0000-000000000004'),

-- I05: Dor abdominal intensidade (escala 0-10, condicional I03)
('c0000000-0000-0000-0000-000000000001', 25, 'I05', 'INTESTINO',
 'De 0 a 10, qual foi a intensidade da pior dor abdominal desta semana?',
 'escala', true, 4, false, 'semanal',
 '[]'::jsonb, '[]'::jsonb,
 '[]'::jsonb, '0 = nenhuma dor, 10 = a pior dor possível.',
 '{"faixas":[{"min":0,"max":1,"nota":2,"rotulo":"0 a 1"},{"min":2,"max":3,"nota":1,"rotulo":"2 a 3"},{"min":4,"max":5,"nota":0,"rotulo":"4 a 5"},{"min":6,"max":7,"nota":-1,"rotulo":"6 a 7"},{"min":8,"max":10,"nota":-2,"rotulo":"8 a 10"}]}'::jsonb,
 '{"perguntaCodigo":"I03","operador":"diferente","valor":"Raramente ou nunca"}'::jsonb,
 '[{"indice":null,"alerta":"A16","condicao":"faixa_min","valor":"8"}]'::jsonb,
 '["V2","V3"]'::jsonb, true,
 'a0000000-0000-0000-0000-000000000004'),

-- I06: Dias de dor abdominal (número, condicional I03)
('c0000000-0000-0000-0000-000000000001', 26, 'I06', 'INTESTINO',
 'Em quantos dias desta semana você teve dor abdominal?',
 'numero', true, 3, false, 'semanal',
 '[]'::jsonb, '[]'::jsonb,
 '[]'::jsonb, 'De 0 a 7 dias.',
 '{"faixas":[{"min":0,"max":0,"nota":2,"rotulo":"0 dia"},{"min":1,"max":1,"nota":1,"rotulo":"1 dia"},{"min":2,"max":3,"nota":0,"rotulo":"2 a 3 dias"},{"min":4,"max":5,"nota":-1,"rotulo":"4 a 5 dias"},{"min":6,"max":7,"nota":-2,"rotulo":"6 a 7 dias"}]}'::jsonb,
 '{"perguntaCodigo":"I03","operador":"diferente","valor":"Raramente ou nunca"}'::jsonb,
 '[]'::jsonb,
 '["V2","V3"]'::jsonb, true,
 'a0000000-0000-0000-0000-000000000004'),

-- I07: Inchaço intensidade (escala 0-10, condicional I03)
('c0000000-0000-0000-0000-000000000001', 27, 'I07', 'INTESTINO',
 'De 0 a 10, qual foi a intensidade do inchaço (barriga distendida) na pior hora da semana?',
 'escala', true, 3, false, 'semanal',
 '[]'::jsonb, '[]'::jsonb,
 '[]'::jsonb, '0 = nenhum inchaço, 10 = o máximo.',
 '{"faixas":[{"min":0,"max":1,"nota":2,"rotulo":"0 a 1"},{"min":2,"max":3,"nota":1,"rotulo":"2 a 3"},{"min":4,"max":5,"nota":0,"rotulo":"4 a 5"},{"min":6,"max":7,"nota":-1,"rotulo":"6 a 7"},{"min":8,"max":10,"nota":-2,"rotulo":"8 a 10"}]}'::jsonb,
 '{"perguntaCodigo":"I03","operador":"diferente","valor":"Raramente ou nunca"}'::jsonb,
 '[]'::jsonb,
 '["V2","V3"]'::jsonb, true,
 'a0000000-0000-0000-0000-000000000004'),

-- I08: Gases e arrotos (escolha, condicional I03, só V2)
('c0000000-0000-0000-0000-000000000001', 28, 'I08', 'INTESTINO',
 'Como estiveram os gases e os arrotos?',
 'escolha', true, 2, false, 'semanal',
 '["Normais","Um pouco mais do que o habitual","Muito mais, e isso me incomoda ou me constrange"]'::jsonb,
 '[2,0,-2]'::jsonb,
 '[]'::jsonb, null, null,
 '{"perguntaCodigo":"I03","operador":"diferente","valor":"Raramente ou nunca"}'::jsonb,
 '[]'::jsonb,
 '["V2"]'::jsonb, true,
 'a0000000-0000-0000-0000-000000000004'),

-- I09: Urgência intestinal (escolha, V2+V3)
('c0000000-0000-0000-0000-000000000001', 29, 'I09', 'INTESTINO',
 'Você teve urgência para ir ao banheiro ou escape de fezes?',
 'escolha', true, 3, false, 'semanal',
 '["Nunca","1 a 2 vezes na semana","3 vezes ou mais, ou houve escape de fezes"]'::jsonb,
 '[2,-1,-2]'::jsonb,
 '["","","Conte mais sobre o que aconteceu."]'::jsonb,
 null, null, null, '[]'::jsonb,
 '["V2","V3"]'::jsonb, true,
 'a0000000-0000-0000-0000-000000000004'),

-- I10: Azia/refluxo (escolha, só V2)
('c0000000-0000-0000-0000-000000000001', 30, 'I10', 'INTESTINO',
 'Você sentiu azia, queimação, refluxo ou enjoo?',
 'escolha', true, 2, false, 'semanal',
 '["Nenhum","Leve e ocasional","Frequente (3 ou mais dias)","Todos os dias, ou me atrapalha para comer"]'::jsonb,
 '[2,1,-1,-2]'::jsonb,
 '["","","","Conte o que está sentindo."]'::jsonb,
 null, null, null, '[]'::jsonb,
 '["V2"]'::jsonb, true,
 'a0000000-0000-0000-0000-000000000004'),

-- I11: Sangue/muco nas fezes (escolha, V2+V3)
('c0000000-0000-0000-0000-000000000001', 31, 'I11', 'INTESTINO',
 'Você notou sangue ou muco nas fezes?',
 'escolha', true, 4, false, 'semanal',
 '["Não","Muco ocasional","Sangue vivo (vermelho), mesmo que pouco","Fezes pretas, como piche, ou muito sangue"]'::jsonb,
 '[2,-1,-2,-2]'::jsonb,
 '["","Conte mais.","Conte mais.",""]'::jsonb,
 null, null, null,
 '[{"indice":2,"alerta":"A07"},{"indice":3,"alerta":"A06"}]'::jsonb,
 '["V2","V3"]'::jsonb, true,
 'a0000000-0000-0000-0000-000000000004'),

-- I12: Reintrodução de alimentos (escolha, V2+V3)
('c0000000-0000-0000-0000-000000000001', 32, 'I12', 'INTESTINO',
 'Nesta semana você testou algum alimento do seu mapa de reintrodução?',
 'escolha', true, 3, false, 'semanal',
 '["Não testei nenhum","Testei e tolerei bem","Testei e tive sintomas leves","Testei e tive sintomas fortes"]'::jsonb,
 '[null,2,0,-1]'::jsonb,
 '["","Qual alimento e quantidade?","Qual alimento, quantidade e o que sentiu?","Qual alimento, quantidade e o que sentiu?"]'::jsonb,
 null, null, null, '[]'::jsonb,
 '["V2","V3"]'::jsonb, true,
 'a0000000-0000-0000-0000-000000000004'),

-- I13: Restrição alimentar (escolha, quinzenal, V2+V3)
('c0000000-0000-0000-0000-000000000001', 33, 'I13', 'INTESTINO',
 'Hoje, quantos alimentos você evita por medo de passar mal, além dos que combinamos?',
 'escolha', true, 3, false, 'quinzenal',
 '["Nenhum","1 a 3","4 a 7","8 ou mais"]'::jsonb,
 '[2,1,-1,-2]'::jsonb,
 '["","","Quais?","Quais?"]'::jsonb,
 null, null, null, '[]'::jsonb,
 '["V2","V3"]'::jsonb, true,
 'a0000000-0000-0000-0000-000000000004'),

-- I14: Impacto na rotina (escala 0-10, V2+V3)
('c0000000-0000-0000-0000-000000000001', 34, 'I14', 'INTESTINO',
 'De 0 a 10, o quanto os sintomas intestinais atrapalharam sua rotina (trabalho, vida social, treino, sono)?',
 'escala', true, 4, false, 'semanal',
 '[]'::jsonb, '[]'::jsonb,
 '[]'::jsonb, '0 = nada, 10 = muitíssimo.',
 '{"faixas":[{"min":0,"max":1,"nota":2,"rotulo":"0 a 1"},{"min":2,"max":3,"nota":1,"rotulo":"2 a 3"},{"min":4,"max":5,"nota":0,"rotulo":"4 a 5"},{"min":6,"max":7,"nota":-1,"rotulo":"6 a 7"},{"min":8,"max":10,"nota":-2,"rotulo":"8 a 10"}]}'::jsonb,
 null, '[]'::jsonb,
 '["V2","V3"]'::jsonb, true,
 'a0000000-0000-0000-0000-000000000004'),

-- I15: Suplementos prescritos (escolha, V2+V3)
('c0000000-0000-0000-0000-000000000001', 35, 'I15', 'INTESTINO',
 'Você tomou os suplementos, fitoterápicos ou probióticos prescritos?',
 'escolha', true, 3, false, 'semanal',
 '["Não tenho prescrição no momento","Tomei tudo como combinado","Esqueci algumas vezes","Tomei menos da metade","Não tomei"]'::jsonb,
 '[null,2,1,-1,-2]'::jsonb,
 '["","","","Conte o que aconteceu.","Conte o que aconteceu."]'::jsonb,
 null, null, null, '[]'::jsonb,
 '["V2","V3"]'::jsonb, true,
 'a0000000-0000-0000-0000-000000000006'),

-- I16: Efeito dos suplementos (escolha, condicional I15, só V2)
('c0000000-0000-0000-0000-000000000001', 36, 'I16', 'INTESTINO',
 'Você notou algum efeito incômodo desde que começou ou ajustou esses suplementos?',
 'escolha', true, 2, false, 'semanal',
 '["Nenhum","Leve","Forte"]'::jsonb,
 '[2,0,-2]'::jsonb,
 '["","Conte o que sentiu.","Conte o que sentiu."]'::jsonb,
 null, null,
 '{"perguntaCodigo":"I15","operador":"diferente","valor":"Não tenho prescrição no momento"}'::jsonb,
 '[]'::jsonb,
 '["V2"]'::jsonb, true,
 'a0000000-0000-0000-0000-000000000006'),

-- -------------------------------------------------------------------------
-- MÓDULO GLP-1 (somente V3)
-- -------------------------------------------------------------------------

-- G01: Aplicação da dose (escolha)
('c0000000-0000-0000-0000-000000000001', 37, 'G01', 'GLP1',
 'Você aplicou a dose desta semana do seu medicamento?',
 'escolha', true, 3, false, 'semanal',
 '["Sim, no dia combinado","Sim, com 1 a 2 dias de atraso","Pulei a dose","Medicação pausada ou suspensa por orientação médica","Estou há mais de 14 dias sem aplicar"]'::jsonb,
 '[2,1,-1,null,-2]'::jsonb,
 '["","","Por quê?","",""]'::jsonb,
 null, null, null,
 '[{"indice":4,"alerta":"A10"}]'::jsonb,
 '["V3"]'::jsonb, true,
 'a0000000-0000-0000-0000-000000000006'),

-- G02: Mudança de dose (escolha, sem nota)
('c0000000-0000-0000-0000-000000000001', 38, 'G02', 'GLP1',
 'Houve mudança de dose ou de medicamento nesta semana?',
 'escolha', true, 0, false, 'semanal',
 '["Não","Sim, aumentou a dose","Sim, reduziu a dose","Sim, troquei de medicamento"]'::jsonb,
 '[]'::jsonb,
 '["","Qual dose agora?","Qual dose agora?","Qual medicamento e dose?"]'::jsonb,
 null, null, null, '[]'::jsonb,
 '["V3"]'::jsonb, true, null),

-- G03: Checklist de efeitos colaterais (múltipla escolha)
('c0000000-0000-0000-0000-000000000001', 39, 'G03', 'GLP1',
 'Quais destes você sentiu nesta semana?',
 'multipla_escolha', true, 4, false, 'semanal',
 '["Náuseas","Vômitos","Azia, queimação ou refluxo","Arrotos frequentes (inclusive com cheiro forte)","Diarreia","Prisão de ventre","Barriga inchada ou muitos gases","Dor de cabeça","Tontura ou sensação de pressão baixa","Cansaço intenso","Queda de cabelo maior que o habitual","Boca seca ou gosto diferente na boca","Coração acelerado ou palpitação","Reação no local da aplicação (nódulo, vermelhidão, dor)","Nada disso"]'::jsonb,
 '[]'::jsonb,
 '[]'::jsonb,
 'Marque todos os que sentiu. Para cada um, indique se foi leve, moderado ou forte.',
 null, null,
 '[{"indice":null,"alerta":"A15","condicao":"gravidade_forte"}]'::jsonb,
 '["V3"]'::jsonb, true,
 'a0000000-0000-0000-0000-000000000006'),

-- G04: Quando náuseas pioram (escolha, condicional G03, sem nota)
('c0000000-0000-0000-0000-000000000001', 40, 'G04', 'GLP1',
 'Quando as náuseas costumam piorar?',
 'escolha', false, 0, false, 'semanal',
 '["Nas 48 horas depois da aplicação","Depois das refeições","O dia todo","Sem relação clara"]'::jsonb,
 '[]'::jsonb,
 '[]'::jsonb, null, null,
 '{"perguntaCodigo":"G03","operador":"inclui","valor":"Náuseas"}'::jsonb,
 '[]'::jsonb,
 '["V3"]'::jsonb, true, null),

-- G05: Vômitos (escolha)
('c0000000-0000-0000-0000-000000000001', 41, 'G05', 'GLP1',
 'Você vomitou nesta semana?',
 'escolha', true, 4, false, 'semanal',
 '["Não","1 vez","2 a 3 vezes","4 vezes ou mais","Vomitei várias vezes por mais de um dia, ou não consegui manter líquidos"]'::jsonb,
 '[2,0,-1,-2,-2]'::jsonb,
 '[]'::jsonb, null, null, null,
 '[{"indice":3,"alerta":"A15"},{"indice":4,"alerta":"A02"}]'::jsonb,
 '["V3"]'::jsonb, true,
 'a0000000-0000-0000-0000-000000000006'),

-- G06: Saciedade (escolha)
('c0000000-0000-0000-0000-000000000001', 42, 'G06', 'GLP1',
 'Como está a sua saciedade com as refeições?',
 'escolha', true, 3, false, 'semanal',
 '["Boa: fico satisfeita e consigo comer o que foi planejado","Muito precoce: paro de comer rápido e não consigo o planejado","Fico empachada por horas, como se a comida estivesse parada"]'::jsonb,
 '[2,-1,-2]'::jsonb,
 '["","Conte mais.",""]'::jsonb,
 null, null, null,
 '[{"indice":2,"alerta":"A17"}]'::jsonb,
 '["V3"]'::jsonb, true,
 'a0000000-0000-0000-0000-000000000006'),

-- G07: Dor forte na barriga (escolha)
('c0000000-0000-0000-0000-000000000001', 43, 'G07', 'GLP1',
 'Você teve dor forte e persistente na barriga, principalmente na parte de cima (podendo ir para as costas) ou do lado direito?',
 'escolha', true, 5, false, 'semanal',
 '["Não","Dor leve e passageira","Dor moderada, que veio e passou","Dor forte que não passa"]'::jsonb,
 '[2,1,-1,-2]'::jsonb,
 '["","","Conte mais sobre a dor.",""]'::jsonb,
 null, null, null,
 '[{"indice":3,"alerta":"A01"}]'::jsonb,
 '["V3"]'::jsonb, true,
 'a0000000-0000-0000-0000-000000000006'),

-- G08: Sinais de desidratação (múltipla escolha)
('c0000000-0000-0000-0000-000000000001', 44, 'G08', 'GLP1',
 'Você teve algum destes sinais de desidratação?',
 'multipla_escolha', true, 4, false, 'semanal',
 '["Sede intensa","Boca muito seca","Urina escura ou muito pouca","Tontura ao levantar","Fraqueza forte","Desmaio","Nenhum"]'::jsonb,
 '[]'::jsonb,
 '[]'::jsonb, null, null, null,
 '[{"indice":5,"alerta":"A03"}]'::jsonb,
 '["V3"]'::jsonb, true,
 'a0000000-0000-0000-0000-000000000006'),

-- G09: Dias sem evacuar (número, condicional I02)
('c0000000-0000-0000-0000-000000000001', 45, 'G09', 'GLP1',
 'Quantos dias seguidos você ficou sem evacuar?',
 'numero', true, 3, false, 'semanal',
 '[]'::jsonb, '[]'::jsonb,
 '[]'::jsonb, 'De 0 a 14 dias.',
 '{"faixas":[{"min":0,"max":1,"nota":2,"rotulo":"0 a 1 dia"},{"min":2,"max":3,"nota":0,"rotulo":"2 a 3 dias"},{"min":4,"max":6,"nota":-1,"rotulo":"4 a 6 dias"},{"min":7,"max":14,"nota":-2,"rotulo":"7 dias ou mais"}]}'::jsonb,
 '{"perguntaCodigo":"I02","operador":"diferente","valor":"Meu intestino está regulado, todos os dias."}'::jsonb,
 '[{"indice":null,"alerta":"A11","condicao":"faixa_min","valor":"4"},{"indice":null,"alerta":"A12","condicao":"faixa_min","valor":"7"}]'::jsonb,
 '["V3"]'::jsonb, true,
 'a0000000-0000-0000-0000-000000000006'),

-- G10: Meta de proteína (escolha)
('c0000000-0000-0000-0000-000000000001', 46, 'G10', 'GLP1',
 'Você conseguiu atingir a sua meta de proteína?',
 'escolha', true, 4, false, 'semanal',
 '["Todos os dias","Na maioria dos dias","Em poucos dias","Quase nunca"]'::jsonb,
 '[2,1,-1,-2]'::jsonb,
 '["","","O que dificultou?","O que dificultou?"]'::jsonb,
 null, null, null, '[]'::jsonb,
 '["V3"]'::jsonb, true,
 'a0000000-0000-0000-0000-000000000001'),

-- G11: Pensamentos sobre comida (escolha, quinzenal)
('c0000000-0000-0000-0000-000000000001', 47, 'G11', 'GLP1',
 'Como estão os seus pensamentos sobre comida desde que começou o medicamento?',
 'escolha', true, 2, false, 'quinzenal',
 '["Diminuíram bastante, mas eu lembro de comer","Diminuíram, e às vezes esqueço de comer","Continuam iguais","Aumentaram"]'::jsonb,
 '[2,1,0,-1]'::jsonb,
 '["","","","Conte mais."]'::jsonb,
 null, null, null, '[]'::jsonb,
 '["V3"]'::jsonb, true,
 'a0000000-0000-0000-0000-000000000001'),

-- G12: Perda de força/flacidez/cabelo (escolha, quinzenal)
('c0000000-0000-0000-0000-000000000001', 48, 'G12', 'GLP1',
 'Você percebeu perda de força, flacidez rápida ou queda de cabelo maior que o habitual?',
 'escolha', true, 3, false, 'quinzenal',
 '["Não notei nada","Sim, um pouco","Sim, bastante"]'::jsonb,
 '[2,0,-2]'::jsonb,
 '["","Conte mais.","Conte mais."]'::jsonb,
 null, null, null, '[]'::jsonb,
 '["V3"]'::jsonb, true,
 'a0000000-0000-0000-0000-000000000003'),

-- G13: Sinais de alarme (múltipla escolha)
('c0000000-0000-0000-0000-000000000001', 49, 'G13', 'GLP1',
 'Você teve algum destes sinais?',
 'multipla_escolha', true, 5, false, 'semanal',
 '["Inchaço no rosto, lábios ou língua, ou falta de ar","Mudança súbita na visão (embaçou ou perdeu a visão de um olho)","Tristeza profunda ou pensamentos de se machucar","Caroço no pescoço, rouquidão que não passa ou dificuldade para engolir","Coração acelerado mesmo em repouso","Tremor, suor frio, fraqueza súbita ou confusão","Nenhum desses"]'::jsonb,
 '[]'::jsonb,
 '[]'::jsonb, null, null, null,
 '[{"indice":0,"alerta":"A04"},{"indice":1,"alerta":"A04"},{"indice":2,"alerta":"A05"},{"indice":3,"alerta":"A08"},{"indice":4,"alerta":"A09"},{"indice":5,"alerta":"A09"}]'::jsonb,
 '["V3"]'::jsonb, true,
 'a0000000-0000-0000-0000-000000000006'),

-- G14: Procedimento com sedação (escolha, quinzenal, opcional)
('c0000000-0000-0000-0000-000000000001', 50, 'G14', 'GLP1',
 'Você tem cirurgia, endoscopia ou outro procedimento com sedação marcado?',
 'escolha', false, 0, false, 'quinzenal',
 '["Não","Sim"]'::jsonb,
 '[]'::jsonb,
 '["","Qual procedimento e quando?"]'::jsonb,
 null, null, null,
 '[{"indice":1,"alerta":"A13"}]'::jsonb,
 '["V3"]'::jsonb, true, null),

-- -------------------------------------------------------------------------
-- MÓDULO ACOMPANHAMENTO (mensal, sem nota)
-- -------------------------------------------------------------------------

-- P01: Avaliação do acompanhamento (estrelas, mensal)
('c0000000-0000-0000-0000-000000000001', 51, 'P01', 'ACOMPANHAMENTO',
 'Como você avalia o seu acompanhamento até agora?',
 'estrelas', false, 0, false, 'mensal',
 '[]'::jsonb, '[]'::jsonb,
 '[]'::jsonb, null, null, null, '[]'::jsonb,
 '["V1","V2","V3"]'::jsonb, true, null),

-- P02: NPS (escala 0-10, mensal)
('c0000000-0000-0000-0000-000000000001', 52, 'P02', 'ACOMPANHAMENTO',
 'De 0 a 10, qual a chance de você indicar o meu acompanhamento a uma amiga?',
 'escala', false, 0, false, 'mensal',
 '[]'::jsonb, '[]'::jsonb,
 '[]'::jsonb, null, null, null, '[]'::jsonb,
 '["V1","V2","V3"]'::jsonb, true, null);

-- =========================================================================
-- 3. Conferência das contagens por versão
-- =========================================================================
do $$
declare
  v_total_v1 integer;
  v_total_v2 integer;
  v_total_v3 integer;
begin
  select count(*) into v_total_v1
    from questionario_perguntas
   where questionario_id = 'c0000000-0000-0000-0000-000000000001'
     and ativa and versoes @> '"V1"'::jsonb;

  select count(*) into v_total_v2
    from questionario_perguntas
   where questionario_id = 'c0000000-0000-0000-0000-000000000001'
     and ativa and versoes @> '"V2"'::jsonb;

  select count(*) into v_total_v3
    from questionario_perguntas
   where questionario_id = 'c0000000-0000-0000-0000-000000000001'
     and ativa and versoes @> '"V3"'::jsonb;

  if v_total_v1 <> 25 then
    raise exception 'V1 deveria ter 25 perguntas, tem %', v_total_v1;
  end if;
  if v_total_v2 <> 38 then
    raise exception 'V2 deveria ter 38 perguntas, tem %', v_total_v2;
  end if;
  if v_total_v3 <> 49 then
    raise exception 'V3 deveria ter 49 perguntas, tem %', v_total_v3;
  end if;

  raise notice 'Contagem OK: V1=%, V2=%, V3=%', v_total_v1, v_total_v2, v_total_v3;
end $$;

commit;
