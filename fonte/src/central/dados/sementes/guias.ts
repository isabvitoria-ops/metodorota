import type { Guia, SecaoGuia } from "@/central/types";

/**
 * Guias.
 *
 * O que está escrito aqui veio dos materiais da nutricionista — o e-book de
 * marmitas, o guia de supermercado e o de refeição livre. Os temas que ela
 * ainda não escreveu continuam reservados e vazios: a tela mostra "em breve"
 * em vez de texto de enchimento.
 *
 * COMO PUBLICAR UM GUIA
 * ---------------------
 * Pela tela: área da nutricionista → Conteúdos → Guias → Novo guia.
 * Por aqui: some um objeto e rode `npm run seed && npm run instalador`.
 */

interface Entrada {
  id: string;
  titulo: string;
  tema: string;
  ordem: number;
  tags: string[];
  resumo?: string | null;
  secoes?: SecaoGuia[];
}

function guia(e: Entrada): Guia {
  const secoes = e.secoes ?? [];
  return {
    id: e.id,
    titulo: e.titulo,
    tema: e.tema,
    resumo: e.resumo ?? null,
    ordem: e.ordem,
    status: secoes.length > 0 ? "publicado" : "em-preparacao",
    secoes,
    tags: e.tags,
  };
}

function secao(id: string, titulo: string | null, paragrafos: string[], itens: string[] = []): SecaoGuia {
  return { id, titulo, paragrafos, itens };
}

export const GUIAS: Guia[] = [
  // ============================================================== compras
  guia({
    id: "rotulos",
    titulo: "Como ler um rótulo",
    tema: "Compras",
    ordem: 1,
    resumo: "A regra de ouro da lista de ingredientes.",
    tags: ["rotulo", "ingredientes", "industrializado", "supermercado", "embalagem"],
    secoes: [
      secao(
        "regra-de-ouro",
        "Regra de ouro dos ingredientes",
        ["Quanto menos ingredientes, melhor."],
        [
          "Até 5 ingredientes: geralmente tudo certo.",
          "De 6 a 10 ingredientes: vale olhar com atenção.",
          "Lista longa e cheia de nomes estranhos: melhor evitar.",
        ],
      ),
    ],
  }),

  guia({
    id: "marcas-mercado",
    titulo: "Marcas sugeridas no mercado",
    tema: "Compras",
    ordem: 2,
    resumo: "O que procurar na prateleira, por categoria.",
    tags: ["marcas", "supermercado", "iogurte", "pao", "geleia", "congelados", "compras"],
    secoes: [
      secao(
        "iogurte",
        "Iogurte",
        [],
        [
          "Vigor Viv Simples e Vigor Viv Natural",
          "Vigor Natural consistência firme",
          "Nestlé Natural Desnatado e Nestlé Natural Integral (2 ingredientes)",
          "Itambé Integral e Itambé Natural Milk",
          "Fazenda Bela Vista Natural",
          "Verde Campo LacFree",
          "Verde Campo Natural Whey",
          "Ati Latte natural",
          "Batavo Naturais Integral",
          "Yorgus Grego",
        ],
      ),
      secao(
        "pao-de-forma",
        "Pão de forma",
        [],
        [
          "Seven Boys Benefice e Benefice Light 7 Grãos",
          "Seven Boys Integral, 12 Grãos e Castanha & Nozes",
          "Wickbold 100% Integral (Girassol & Castanha, + Fibras, Pão Integral, Pão Forno)",
          "Nutrella 14 Grãos, 7 Grãos e 100% Integral",
          "Pullman Integral e Pullman 100% Integral 12 Grãos",
          "Visconti Pão Integral",
        ],
      ),
      secao(
        "geleia",
        "Geleia",
        [],
        [
          "St. Dalfour (100% fruta)",
          "Queensberry Wellness (100% fruta)",
          "Casa Madeira frutas vermelhas, sem adição de açúcar",
          "Ritter Geleia com Pedaços, 100% fruta",
        ],
      ),
      secao("frutas-congeladas", "Frutas congeladas", [], ["Original Food"]),
      secao("vegetais-congelados", "Vegetais congelados", [], ["De Marchi", "Grano"]),
      secao(
        "praticos",
        "Prontos que ajudam na correria",
        ["Nas opções prontas, escolha sempre a de menos ingredientes."],
        [
          "Frango desfiado congelado: Nat Pronto Já, peito de frango cozido desfiado",
          "Lanche proteico: Verde Campo Natural Whey",
        ],
      ),
    ],
  }),

  guia({
    id: "proteinas-em-casa",
    titulo: "Proteínas para ter em casa",
    tema: "Compras",
    ordem: 3,
    resumo: "Os cortes e itens que resolvem a semana.",
    tags: ["proteina", "carne", "frango", "peixe", "ovo", "compras"],
    secoes: [
      secao(
        "lista",
        null,
        [],
        [
          "Tilápia",
          "Atum",
          "Peito de frango",
          "Sobrecoxa de frango",
          "Ovos",
          "Filé mignon suíno",
          "Camarão",
          "Alcatra",
          "Patinho",
          "Peito de peru",
          "Frango desfiado pronto — escolhendo sempre a opção com menos ingredientes",
        ],
      ),
    ],
  }),

  // ============================================================== marmitas
  guia({
    id: "marmitas-comecar",
    titulo: "Marmitas: por onde começar",
    tema: "Marmitas",
    ordem: 4,
    resumo: "Higienizar, armazenar e deixar pronto para a semana.",
    tags: ["marmita", "higienizar", "armazenar", "fruta", "legume", "preparo", "semana"],
    secoes: [
      secao(
        "higienizar",
        "Como higienizar frutas e legumes",
        [
          "A higienização correta elimina bactérias, parasitas e resíduos.",
          "Fruta organizada é fruta consumida: deixar já lavada, cortada e visível aumenta muito o consumo ao longo do dia.",
        ],
        [
          "Lave em água corrente, esfregando fruta por fruta e legume por legume com as mãos.",
          "Prepare a solução: 1 colher de sopa de água sanitária para 1 litro de água.",
          "Deixe de molho por 15 minutos.",
          "Enxágue novamente em água corrente.",
          "Seque bem, ou deixe escorrer, antes de guardar.",
          "Nunca misture água sanitária com vinagre.",
        ],
      ),
      secao(
        "mamao",
        "Mamão",
        ["Dura até 3 dias na geladeira e 30 dias no congelador."],
        [
          "Descasque, corte ao meio e retire as sementes.",
          "Pique em cubos.",
          "Armazene em pote fechado na geladeira.",
        ],
      ),
      secao(
        "morango",
        "Morango",
        ["Lave apenas na hora de consumir. Dura até 3 dias na geladeira e 30 dias no congelador."],
        [
          "Retire os morangos estragados.",
          "Não lave antes de guardar.",
          "Guarde os morangos secos em um pote com papel-toalha no fundo.",
          "Tampe, mas sem vedar totalmente.",
        ],
      ),
      secao(
        "manga",
        "Manga",
        ["Dura até 3 dias na geladeira e 30 dias no congelador."],
        ["Descasque e pique.", "Armazene em pote fechado."],
      ),
      secao(
        "abacaxi",
        "Abacaxi",
        ["Dura até 3 dias na geladeira e 30 dias no congelador."],
        ["Descasque e retire o miolo duro.", "Corte em cubos ou rodelas.", "Armazene em pote bem fechado."],
      ),
      secao("basico", "O básico bem feito", [
        "Não precisa inventar moda. Uma base bem feita, repetida ao longo da semana, gera constância e resultado.",
      ]),
    ],
  }),

  guia({
    id: "marmitas-receitas",
    titulo: "Receitas para a semana",
    tema: "Marmitas",
    ordem: 5,
    resumo: "As bases que rendem várias marmitas.",
    tags: ["receita", "frango", "pure", "estrogonofe", "marmita", "airfryer", "batata palha"],
    secoes: [
      secao(
        "frango-desfiado",
        "Frango desfiado bem temperado",
        ["Fica soltinho, suculento e super versátil."],
        [
          "1 kg de frango sassami",
          "Tomate em bastante quantidade — quanto mais, mais molhadinho",
          "1 cebola, alho a gosto",
          "Sal, pimenta-do-reino, colorau, chimichurri e páprica defumada",
          "Refogue o alho, a cebola e o tomate; acrescente o frango e tempere",
          "Coloque água até um dedo antes de cobrir",
          "Cozinhe na pressão: 20 minutos depois de pegar pressão",
          "Abra, desfie e ajuste o sal",
        ],
      ),
      secao(
        "sobrecoxa",
        "Sobrecoxa sem osso com cenoura",
        ["Mesmo processo do frango sassami, trocando o sassami por sobrecoxa sem osso e acrescentando cenoura em rodelas. Carne mais palatável e muito saborosa."],
      ),
      secao(
        "pures",
        "Purês fáceis",
        [],
        [
          "Batata: cozinhe, descarte a água (ajuda a reduzir o amido) e bata no liquidificador com leite desnatado, sal e um pouco de manteiga.",
          "Mandioquinha: cozinhe por 20 a 25 minutos e bata no processador com sal e um pouco de manteiga.",
          "Abóbora: cozinhe por 20 a 25 minutos e bata no processador com sal e um pouco de manteiga.",
        ],
      ),
      secao(
        "creme-de-milho",
        "Creme de milho fit",
        ["Para colocar por cima do frango em cubos. Bata tudo e aqueça até engrossar."],
        ["1 lata de milho", "100 ml de leite desnatado", "1 colher de creme de ricota light", "Sal"],
      ),
      secao(
        "legumes",
        "Legumes rápidos e saborosos",
        [],
        [
          "Cozinhe no vapor, ou",
          "Refogue rapidamente, por 5 minutos, com alho, sal e um fio de azeite — só para pegar sabor, sem perder a textura.",
        ],
      ),
      secao(
        "estrogonofe",
        "Estrogonofe fit com batata palha crocante",
        ["Quanto mais seca a batata antes de ir para a airfryer, mais crocante ela fica."],
        [
          "Estrogonofe: frango em cubos, os temperos do frango sassami, creme de ricota light e um pouco de leite desnatado.",
          "Batata palha: descasque e rale na lâmina julienne, a que deixa a batata bem fininha.",
          "Deixe a batata ralada em água fria por 2 minutos para tirar o excesso de amido.",
          "Escorra e seque muito bem, pode usar papel-toalha.",
          "Tempere com sal e curry.",
          "Airfryer por cerca de 15 minutos, mexendo durante o processo para dourar por igual.",
        ],
      ),
      secao(
        "frango-agridoce",
        "Frango agridoce simples",
        ["Doce na medida certa, sem exageros."],
        ["Frango", "Alho", "Um fio de mel", "Páprica", "Suco de laranja"],
      ),
      secao(
        "rap10",
        "Rap10 ou pão sírio recheado, para congelar",
        ["Misture tudo cru, espalhe no rap10 ou no pão sírio, congele em saquinhos e leve direto à frigideira na hora de comer."],
        [
          "Carne moída (patinho ou acém)",
          "Cebola bem picada",
          "Sal, azeite, páprica defumada",
          "Cheiro-verde ou cebolinha",
        ],
      ),
      secao(
        "shake",
        "Shake ou smoothie proteico",
        ["É só bater tudo no liquidificador."],
        ["150 g da fruta congelada da sua preferência", "1 scoop de whey", "Um pouco de água"],
      ),
    ],
  }),

  guia({
    id: "sem-tempo",
    titulo: "Sem tempo: o que fazer",
    tema: "Marmitas",
    ordem: 6,
    resumo: "Atalhos que mantêm a alimentação de pé numa semana corrida.",
    tags: ["sem tempo", "correria", "congelado", "pratico", "atalho", "potes", "balanca"],
    secoes: [
      secao(
        "congelados",
        "Congelados que resolvem",
        ["Nas opções prontas, escolha sempre a de menos ingredientes."],
        [
          "Vegetais congelados: De Marchi, Grano",
          "Frutas congeladas: Original Food",
          "Frango desfiado congelado: Nat Pronto Já",
          "Lanche proteico: Verde Campo Natural Whey",
        ],
      ),
      secao(
        "links",
        "Links úteis",
        ["Potes e sacos de plástico também são fáceis de achar em atacados como Atacadão, Assaí e Mineirão."],
        [
          "Saco hermético para armazenar comida, dá para reutilizar 3 ou 4 vezes: https://br.shp.ee/UhjNXte",
          "Saco mais barato, sem zip lock — tem que dar um nó: https://br.shp.ee/xZNjQNe",
          "Potes herméticos: https://a.co/d/04xz4d14",
          "Balança: https://br.shp.ee/eva5PxT",
          "Potes de vidro para marmita, 600 ml: https://br.shp.ee/dNXK3vQ",
          "Potes de plástico: https://br.shp.ee/powmiJJ",
        ],
      ),
    ],
  }),

  guia({
    id: "variar-em-casa",
    titulo: "Variar em casa",
    tema: "Marmitas",
    ordem: 7,
    resumo: "Ideias para fugir da repetição sem sair do plano.",
    tags: ["variar", "sexta", "ideias", "receita", "rotina"],
  }),

  // ============================================================== digestão
  guia({ id: "constipacao", titulo: "Constipação", tema: "Digestão", ordem: 13, tags: ["constipacao", "intestino preso", "fibra"] }),
  guia({ id: "gases", titulo: "Gases", tema: "Digestão", ordem: 14, tags: ["gases", "flatulencia"] }),
  guia({ id: "distensao-abdominal", titulo: "Distensão abdominal", tema: "Digestão", ordem: 15, tags: ["distensao", "inchaco", "barriga"] }),
  guia({ id: "diarreia", titulo: "Diarreia", tema: "Digestão", ordem: 16, tags: ["diarreia", "intestino solto"] }),

  // ============================================================== restrições
  guia({ id: "lactose", titulo: "Lactose", tema: "Restrições", ordem: 17, tags: ["lactose", "leite", "laticinio"] }),
  guia({ id: "fodmap", titulo: "FODMAP", tema: "Restrições", ordem: 18, tags: ["fodmap", "sii", "intestino irritavel"] }),
];

export const GUIA_POR_ID: ReadonlyMap<string, Guia> = new Map(GUIAS.map((g) => [g.id, g]));

/** Ordem em que os blocos de tema aparecem na listagem. */
export const TEMAS_GUIAS = ["Compras", "Marmitas", "No dia a dia", "Digestão", "Restrições"] as const;
