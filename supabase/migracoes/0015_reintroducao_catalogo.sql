-- =============================================================================
-- CENTRAL DO PACIENTE — 0015: o catálogo do Mapa de Reintrodução
--
-- Alimento por alimento do material dela, com a porção de referência que está
-- escrita no PDF. Nada foi acrescentado de fora: o que não está no documento
-- não está aqui.
--
-- `semana_sugerida` é a etapa em que o alimento aparece no material. É
-- sugestão de ordem, e o sistema não a faz valer: a nutricionista monta a
-- lista de cada paciente na ordem que quiser, e a paciente registra quando
-- acontecer.
--
-- A porção também é referência, não regra. O próprio material explica o
-- limiar de tolerância: testar a porção proposta, e se houver sintoma,
-- reduzir pela metade e observar de novo — o objetivo não é excluir o
-- alimento, é achar a quantidade que cabe.
-- =============================================================================

insert into reintroducao_alimentos
  (id, nome, categoria, semana_sugerida, porcao_referencia, observacao, ordem) values

-- ------------------------------------------------------------------ semana 1
  ('abacate',        'Abacate / avocado',        'gorduras',     1, '60g',   null, 101),
  ('pera',           'Pêra',                     'frutas',       1, '175g',  null, 102),
  ('pessego',        'Pêssego',                  'frutas',       1, '250g',  null, 103),
  ('manga',          'Manga',                    'frutas',       1, '160g',  null, 104),

-- ------------------------------------------------------------------ semana 2
  ('cara',           'Cará',                     'carboidratos', 2, '160g',  null, 201),
  ('inhame',         'Inhame',                   'carboidratos', 2, '90g',   null, 202),
  ('avela',          'Avelã',                    'gorduras',     2, '13g',   null, 203),
  ('azeitona',       'Azeitona',                 'gorduras',     2, '25g',   null, 204),
  ('chocolate-60',   'Chocolate 60% ou mais',    'gorduras',     2, '15g',   null, 205),
  ('nozes',          'Nozes',                    'gorduras',     2, '15g',   null, 206),
  ('cottage-vaca',   'Queijo cottage de vaca',   'proteinas',    2, '150g',
   'Prefira sem lactose.', 207),
  ('cottage-bufala', 'Queijo cottage de búfala', 'proteinas',    2, '150g',
   'Prefira sem lactose.', 208),
  ('acerola',        'Acerola',                  'frutas',       2, '310g',  null, 209),
  ('goiaba',         'Goiaba',                   'frutas',       2, '150g',  null, 210),
  ('jabuticaba',     'Jabuticaba',               'frutas',       2, '170g',  null, 211),
  ('lichia',         'Lichia',                   'frutas',       2, '140g',  null, 212),
  ('aspargos',       'Aspargos',                 'vegetais',     2, 'Livre',
   'Vegetais em quantidade livre, com porção mínima de 200g no almoço e no jantar.', 213),
  ('cogumelos',      'Cogumelos',                'vegetais',     2, 'Livre',
   'Vegetais em quantidade livre, com porção mínima de 200g no almoço e no jantar.', 214),
  ('ervilha-torta',  'Ervilha torta',            'vegetais',     2, 'Livre',
   'Vegetais em quantidade livre, com porção mínima de 200g no almoço e no jantar.', 215),
  ('nabo',           'Nabo',                     'vegetais',     2, 'Livre',
   'Vegetais em quantidade livre, com porção mínima de 200g no almoço e no jantar.', 216),
  ('vagem',          'Vagem',                    'vegetais',     2, 'Livre',
   'Vegetais em quantidade livre, com porção mínima de 200g no almoço e no jantar.', 217),

-- ------------------------------------------------------------------ semana 3
  ('mel',            'Mel',                      'carboidratos', 3, '30g',   null, 301),
  ('batata-doce',    'Batata doce',              'carboidratos', 3, '160g',  null, 302),
  ('manteiga',       'Manteiga',                 'gorduras',     3, '10g',   null, 303),
  ('manteiga-bufala','Manteiga de búfala',       'gorduras',     3, '10g',   null, 304),
  ('queijo-brie',    'Queijo brie',              'gorduras',     3, '25g',   null, 305),
  ('pistache',       'Pistache torrado',         'gorduras',     3, '15g',   null, 306),
  ('queijos-bufala', 'Queijos de búfala',        'gorduras',     3, '30g',   null, 307),
  ('carne-vermelha', 'Carne vermelha',           'proteinas',    3, '70g',   null, 308),
  ('carne-porco',    'Carne de porco',           'proteinas',    3, '70g',   null, 309),
  ('whey',           'Proteína em pó — whey',    'proteinas',    3, '40g',   null, 310),
  ('agua-de-coco',   'Água de coco',             'frutas',       3, '600ml',
   'Da fruta.', 311),
  ('banana-da-terra','Banana da terra',          'frutas',       3, '80g',   null, 312),
  ('melancia',       'Melancia',                 'frutas',       3, '330g',  null, 313),
  ('alho-poro',      'Alho poró',                'vegetais',     3, 'Livre',
   'Vegetais em quantidade livre, com porção mínima de 200g no almoço e no jantar.', 314),
  ('brocolis',       'Brócolis',                 'vegetais',     3, 'Livre',
   'Vegetais em quantidade livre, com porção mínima de 200g no almoço e no jantar.', 315),
  ('couve-flor',     'Couve-flor',               'vegetais',     3, 'Livre',
   'Vegetais em quantidade livre, com porção mínima de 200g no almoço e no jantar.', 316),
  ('couve-bruxelas', 'Couve-de-bruxelas',        'vegetais',     3, 'Livre',
   'Vegetais em quantidade livre, com porção mínima de 200g no almoço e no jantar.', 317),
  ('repolho',        'Repolho',                  'vegetais',     3, 'Livre',
   'Vegetais em quantidade livre, com porção mínima de 200g no almoço e no jantar.', 318),
  ('folhas-e-brotos','Todas as folhas e brotos', 'vegetais',     3, 'Livre',
   'Vegetais em quantidade livre, com porção mínima de 200g no almoço e no jantar.', 319),

-- ------------------------------------------------------------------ semana 4
  ('lentilha',       'Lentilha',                 'carboidratos', 4, '130g',  null, 401),
  ('quinoa',         'Quinoa',                   'carboidratos', 4, '100g',  null, 402),
  ('ervilha',        'Ervilha',                  'carboidratos', 4, '150g',  null, 403),
  ('feijao',         'Feijão cozido',            'carboidratos', 4, '160g',  null, 404),
  ('grao-de-bico',   'Grão-de-bico cozido',      'carboidratos', 4, '75g',   null, 405),
  ('alho',           'Alho',                     'vegetais',     4, 'Livre',
   'Vegetais em quantidade livre, com porção mínima de 200g no almoço e no jantar.', 406),
  ('cebola',         'Cebola',                   'vegetais',     4, 'Livre',
   'Vegetais em quantidade livre, com porção mínima de 200g no almoço e no jantar.', 407),
  ('amendoim',       'Amendoim',                 'gorduras',     4, '15g',   null, 408),
  ('iogurte-2-3',    'Iogurte de 2 ou 3 ingredientes', 'gorduras', 4, '165g',
   'Prefira sem lactose. Em industrializado, leia a tabela nutricional.', 409),
  ('coalhada',       'Coalhada',                 'gorduras',     4, '90g',
   'Prefira sem lactose.', 410),
  ('kefir-integral', 'Kefir integral',           'gorduras',     4, '135g',
   'Prefira sem lactose.', 411),
  ('iogurte-desnatado', 'Iogurte desnatado de 2 ingredientes ou 0% gordura',
   'proteinas', 4, '250g', 'Prefira sem lactose.', 412),
  ('kefir-desnatado','Kefir desnatado',          'proteinas',    4, '250g',
   'Prefira sem lactose.', 413),

  -- Os queijos de vaca do material vêm um a um, com a porção de cada: é assim
  -- que estão listados nas dicas extras, e é assim que dá para descobrir que
  -- um cai bem e outro não.
  ('queijo-coalho',  'Queijo coalho (normal ou light)', 'gorduras', 4, '25g',
   'Queijo de vaca. Prefira sem lactose.', 414),
  ('queijo-canastra','Queijo canastra',          'gorduras',     4, '20g',
   'Queijo de vaca. Prefira sem lactose.', 415),
  ('queijo-curado',  'Queijo curado',            'gorduras',     4, '20g',
   'Queijo de vaca. Prefira sem lactose.', 416),
  ('queijo-gorgonzola', 'Gorgonzola',            'gorduras',     4, '25g',
   'Queijo de vaca. Prefira sem lactose.', 417),
  ('queijo-meia-cura', 'Queijo meia cura',       'gorduras',     4, '25g',
   'Queijo de vaca. Prefira sem lactose.', 418),
  ('queijo-minas-frescal', 'Minas frescal',      'gorduras',     4, '35g',
   'Queijo de vaca. Prefira sem lactose.', 419),
  ('queijo-minas-padrao', 'Minas padrão',        'gorduras',     4, '30g',
   'Queijo de vaca. Prefira sem lactose.', 420),
  ('queijo-mucarela','Muçarela',                 'gorduras',     4, '30g',
   'Queijo de vaca. Prefira sem lactose.', 421),
  ('queijo-parmesao','Parmesão',                 'gorduras',     4, '20g',
   'Queijo de vaca. Prefira sem lactose.', 422),
  ('queijo-prato',   'Queijo prato',             'gorduras',     4, '20g',
   'Queijo de vaca. Prefira sem lactose.', 423),
  ('queijo-ricota',  'Ricota fresca',            'gorduras',     4, '60g',
   'Queijo de vaca. Prefira sem lactose.', 424)

on conflict (id) do update set
  nome = excluded.nome,
  categoria = excluded.categoria,
  semana_sugerida = excluded.semana_sugerida,
  porcao_referencia = excluded.porcao_referencia,
  observacao = excluded.observacao,
  ordem = excluded.ordem;

-- -----------------------------------------------------------------------------
-- O texto que abre a tela da paciente
--
-- Sai do material dela e do que ela pediu: linguagem que acolhe, sem prazo e
-- sem cobrança. Fica em `configuracoes` para ela reescrever sem publicar o
-- site de novo.
-- -----------------------------------------------------------------------------

insert into configuracoes (chave, valor, descricao) values
  ('reintroducao_orientacao',
   to_jsonb(
     'Você não precisa conseguir reintroduzir todos os alimentos de uma vez. '
     'Esse processo é individual e pode acontecer no seu ritmo, de acordo com '
     'a sua tolerância e com a orientação da sua nutricionista.'
     || chr(10) || chr(10) ||
     'Se você não conseguir testar todos os alimentos nesta semana, tudo bem. '
     'Podemos continuar na próxima.'
     || chr(10) || chr(10) ||
     'Você também não precisa testar alimentos que não fazem parte da sua '
     'alimentação ou que você não gosta. O objetivo é entender quais alimentos '
     'fazem sentido para você e como o seu corpo responde a eles.'
   ),
   'Texto de abertura da Rastreabilidade alimentar, na tela da paciente.')
on conflict (chave) do nothing;
