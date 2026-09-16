import type { Alimento } from "@/central/types";

/**
 * Cadastro de alimentos — a lista de substituição da nutricionista.
 *
 * REGRA DO BRIEFING (§8 e §29): nenhum valor aqui foi estimado. Cada número
 * é a porção que o material dela declara. Alimento sem porção cadastrada
 * fica com `porcao: null`: aparece na lista marcado como pendente e **não**
 * é oferecido na calculadora, em vez de ganhar um valor plausível inventado.
 *
 * Quantidade livre é outra coisa, e tem campo próprio (`LIVRE`): é decisão
 * do material, não dado faltando. O limão está nas frutas assim.
 *
 * COMO ACRESCENTAR UM ALIMENTO
 * ----------------------------
 * Some uma linha à lista do grupo. O formato é
 * `[id, nome, porção, unidade?, observação?]`:
 *
 *   ["batata-doce-cozida", "Batata doce cozida", 160, "g", FERMENTA],
 *   ["clara-de-ovo", "Clara de ovo", 9, "unidade"],
 *   ["limao", "Limão", LIVRE],
 *
 * A unidade sai "g" quando omitida. Feito isso, o alimento entra na busca
 * global, na lista do grupo e em todas as trocas do grupo, sem escrever
 * nenhuma equivalência par a par: o motor usa a razão entre as porções.
 */

/** Observações que se repetem em dezenas de itens — escritas uma vez só. */
const FERMENTA = "Pode fermentar e causar desconforto gástrico.";
const MIN_INGREDIENTES = "Prefira a versão com o mínimo de ingredientes possível.";
const SEM_ACUCAR = "Mínimo de ingredientes possível e sem açúcar.";
const ADOCANTES =
  "Mínimo de ingredientes possível, sem açúcar e sem sabor. Adoçantes naturais: stevia, taumatina, " +
  "eritritol. Evitar sucralose, acessulfame K, aspartame, acessulfame de potássio, ciclamato e xilitol.";
const SECA = `${SEM_ACUCAR} ${FERMENTA}`;
const ACAI =
  "Únicos ingredientes: polpa de açaí e água. Sem açúcar e sem sabor. Adoçantes naturais: stevia, " +
  "taumatina, eritritol. Evitar sucralose, acessulfame K, aspartame, acessulfame de potássio, " +
  "ciclamato e xilitol.";

/** Marca de quantidade livre no lugar do número da porção. */
const LIVRE = "livre" as const;

/** `[id, nome, porção (ou LIVRE), unidade (padrão "g"), observação]` */
type Linha = [
  id: string,
  nome: string,
  porcao: number | typeof LIVRE,
  unidadeId?: string,
  observacao?: string,
];

function montar(linhas: Linha[], grupoId: string): Alimento[] {
  return linhas.map(([id, nome, porcao, unidadeId = "g", observacao]) => {
    const livre = porcao === LIVRE;
    return {
      id,
      nome,
      grupoId,
      unidadeBaseId: unidadeId,
      porcao: livre ? null : { quantidade: porcao, unidadeId },
      quantidadeLivre: livre,
      medidas: [],
      // `null` não é "contém": é "a nutricionista ainda não informou". Vários
      // itens da lista existem nas duas versões ("com ou sem glúten"), então
      // marcar qualquer coisa aqui seria inventar.
      atributos: { semGluten: null, semLactose: null },
      tags: [],
      imagem: null,
      observacao: observacao ?? null,
      ativo: true,
    };
  });
}

/** CARBOIDRATOS — 67 itens da lista de substituição. */
const CARBOIDRATOS: Linha[] = [
  ["achocolatado-em-po", "Achocolatado em pó", 30],
  ["achocolatado-em-po-light-ou-com-maior-teor-de", "Achocolatado em pó light ou com maior teor de cacau", 35],
  ["abobora-crua", "Abóbora crua", 320],
  ["abobora-cozida", "Abóbora cozida", 260],
  ["amaranto", "Amaranto", 120],
  ["arroz-cozido", "Arroz integral ou branco cozido", 100],
  ["arroz-integral-ou-branco-cru", "Arroz integral ou branco cru", 35],
  ["aveia-em-flocos", "Aveia em flocos", 30, "g", FERMENTA],
  ["aveia-em-farelo-ou-farinha", "Aveia em farelo ou farinha", 50, "g", FERMENTA],
  ["batata-baroa-ou-mandioquinha-cozida", "Batata baroa ou mandioquinha cozida", 150],
  ["batata-doce-crua", "Batata doce crua", 105, "g", FERMENTA],
  ["batata-doce-cozida", "Batata doce cozida", 160, "g", FERMENTA],
  ["batata-cozida", "Batata inglesa cozida ou crua", 145],
  ["biscoito-de-arroz", "Biscoito de arroz", 30],
  ["biscoito-de-maizena", "Biscoito de maizena", 25],
  ["biscoito-de-polvilho", "Biscoito de polvilho", 30],
  ["bolo-ou-broa", "Bolo ou broa", 50, "g", "Sem calda e sem recheio."],
  ["cara-cozido", "Cará cozido", 160],
  ["caldo-de-cana", "Caldo de cana", 160],
  ["cereal-matinal", "Cereal matinal", 30],
  ["chocolate-ao-leite", "Chocolate ao leite", 20],
  ["chocolate-branco", "Chocolate branco", 20],
  ["creme-de-arroz-em-po", "Creme de arroz em pó", 30],
  ["cuscuz-cru", "Cuscuz cru", 35, "g", "Mesmo valor do floco de milho."],
  ["cuscuz-marroquino", "Cuscuz marroquino", 35, "g", "Mesmo valor da semolina."],
  ["doce-de-leite", "Doce de leite", 35, "g", MIN_INGREDIENTES],
  ["edamame", "Edamame", 100, "g", FERMENTA],
  ["ervilha-cozida", "Ervilha cozida", 150],
  ["farinha-de-arroz", "Farinha de arroz", 30, "g", FERMENTA],
  ["farinha-de-batata-doce", "Farinha de batata doce", 40, "g", FERMENTA],
  ["farinha-de-grao-de-bico", "Farinha de grão-de-bico", 50, "g", FERMENTA],
  ["farinha-de-mandioca", "Farinha de mandioca", 35],
  ["farinha-de-milho", "Farinha de milho", 35],
  ["farinha-panko", "Farinha panko", 40],
  ["farinha-de-teff", "Farinha de teff", 35],
  ["feijao-cozido", "Feijão cozido", 160, "g", FERMENTA],
  ["flocos-de-arroz", "Flocos de arroz", 35],
  ["folha-ou-papel-de-arroz", "Folha ou papel de arroz", 35],
  ["fuba", "Fubá", 35],
  ["grao-de-bico-cozido", "Grão-de-bico cozido", 75, "g", FERMENTA],
  ["goiabada-ou-qualquer-outro-doce-de-fruta", "Goiabada ou qualquer outro doce de fruta", 50, "g", MIN_INGREDIENTES],
  ["granola-sem-acucar", "Granola sem açúcar", 30],
  ["inhame-cozido", "Inhame cozido", 90],
  ["lentilha-cozida", "Lentilha cozida", 130, "g", FERMENTA],
  ["leite-condensado", "Leite condensado", 40],
  ["leite-condensado-light", "Leite condensado light", 45],
  ["leite-de-arroz", "Leite de arroz", 260, "g", SEM_ACUCAR],
  ["leite-de-aveia", "Leite de aveia", 300, "g", SEM_ACUCAR],
  ["leite-de-soja", "Leite de soja", 230],
  ["mandioca-cozida", "Mandioca cozida", 100],
  ["macarrao-bifun", "Macarrão bifun", 35],
  ["macarrao-cozido", "Macarrão com ou sem glúten cozido", 80],
  ["mel", "Mel", 30],
  ["melado", "Melado", 30],
  ["milho-cozido", "Milho cozido", 100],
  ["milho-cru", "Milho cru", 90],
  ["nutella", "Nutella", 20],
  ["nescau-60-menos-acucar", "Nescau 60% menos açúcar", 40],
  ["pao", "Pão com ou sem glúten", 50, "g", MIN_INGREDIENTES],
  ["pudim", "Pudim", 55],
  ["puff-de-trigo", "Puff de trigo", 35],
  ["polvilho-azedo-ou-doce", "Polvilho azedo ou doce", 35],
  ["wrap-com-ou-sem-gluten", "Wrap com ou sem glúten", 50, "g", MIN_INGREDIENTES],
  ["suco-integral-sem-acucar", "Suco integral sem açúcar", 260, "g", SEM_ACUCAR],
  ["soja-em-graos-cozida", "Soja em grãos cozida", 70, "g", FERMENTA],
  ["quinoa-cozida", "Quinoa cozida", 100, "g", FERMENTA],
  ["tapioca", "Tapioca", 45],
];

/** PROTEÍNAS — 44 itens da lista de substituição. */
const PROTEINAS: Linha[] = [
  ["acem", "Acém", 70],
  ["atum-cozido-em-lata-ou-grelhado", "Atum cozido em lata ou grelhado", 110],
  ["atum-cru", "Atum cru", 100],
  ["camarao-e-outros-frutos-do-mar", "Camarão e outros frutos do mar", 160],
  ["clara-de-ovo", "Clara de ovo", 9, "unidade"],
  ["clara-de-ovo-de-codorna", "Clara de ovo de codorna", 27, "unidade"],
  ["claras-pasteurizadas", "Claras pasteurizadas", 330, "g", MIN_INGREDIENTES],
  ["creme-de-ricota-light-com-ou-sem-lactose", "Creme de ricota light com ou sem lactose", 100, "g", MIN_INGREDIENTES],
  ["coalhada-desnatada-com-ou-sem-lactose", "Coalhada desnatada com ou sem lactose", 250, "g", ADOCANTES],
  ["coracao-de-galinha", "Coração de galinha", 90],
  ["coxao-duro", "Coxão duro", 70],
  ["cupim", "Cupim", 70],
  ["frango-coxa-e-sobrecoxa-desossada", "Frango coxa e sobrecoxa desossada", 60],
  ["frango-peito", "Frango peito", 100],
  ["fraldinha", "Fraldinha", 60],
  ["figado", "Fígado", 75],
  ["file-mignon", "Filé mignon", 70],
  ["iogurte-desnatado-de-2-ingredientes-ou-0-de", "Iogurte desnatado de 2 ingredientes ou 0% de gordura com ou sem lactose", 250, "g", ADOCANTES],
  ["kefir-desnatado-com-ou-sem-lactose", "Kefir desnatado com ou sem lactose", 430, "g", ADOCANTES],
  ["musculo-bovino", "Músculo bovino", 80],
  ["patinho", "Patinho", 70],
  ["peixe-branco", "Peixe branco", 140],
  ["peru", "Peru", 100],
  ["picanha", "Picanha", 70],
  ["proteina-texturizada-da-soja-organica-pts", "Proteína texturizada da soja orgânica (PTS) crua ou hidratada", 60],
  ["proteina-em-po-albumina-beef-protein-clara-de", "Proteína em pó (albumina, beef protein, clara de ovo em pó, colágeno, proteína vegetal, whey)", 40, "g", ADOCANTES],
  ["polenghi-light-com-ou-sem-lactose", "Polenghi light com ou sem lactose", 90],
  ["polenghi-frescatino-ultrafiltrado-com-ou-sem", "Polenghi Frescatino ultrafiltrado com ou sem lactose", 70],
  ["polenghi-frescatino-ultrafiltrado-light-com", "Polenghi Frescatino ultrafiltrado light com ou sem lactose", 100],
  ["polenghi-queijo-frescal-ultrafiltrado-light", "Polenghi queijo frescal ultrafiltrado light com ou sem lactose", 100],
  ["queijo-cottage-de-vaca-ou-de-bufala-com-ou", "Queijo cottage de vaca ou de búfala com ou sem lactose", 150],
  ["queijo-ricota-fresca-com-12-de-gordura-ou", "Queijo ricota fresca com 12% de gordura ou menos com ou sem lactose", 100],
  ["queijo-minas-frescal-light-com-ou-sem-lactose", "Queijo minas frescal light com ou sem lactose", 85],
  ["queijo-parmesao-light-com-ou-sem-lactose", "Queijo parmesão light com ou sem lactose", 50],
  ["queijo-de-soro-de-leite-com-ou-sem-lactose", "Queijo de soro de leite com ou sem lactose", 75],
  ["queijo-quark-light-com-ou-sem-lactose", "Queijo quark light com ou sem lactose", 95],
  ["salmao", "Salmão", 60],
  ["salmao-cru", "Salmão cru", 85],
  ["sardinha-em-lata", "Sardinha em lata", 80],
  ["suino-lombo", "Suíno lombo", 70],
  ["suino-file-mignon", "Suíno filé mignon", 100],
  ["suino-pernil", "Suíno pernil", 55],
  ["tempeh-organico", "Tempeh orgânico", 75],
  ["tofu-organico", "Tofu orgânico", 200],
];

/** GORDURAS — 62 itens da lista de substituição. */
const GORDURAS: Linha[] = [
  ["abacate-ou-avocado", "Abacate ou avocado", 60, "g", FERMENTA],
  ["amendoas", "Amêndoas", 15],
  ["amendoim-cru", "Amendoim cru", 15, "g", FERMENTA],
  ["avela", "Avelã", 13],
  ["azeite", "Azeite", 10],
  ["azeitona", "Azeitona", 75],
  ["cafes-termogenicos", "Cafés termogênicos", 20],
  ["castanhas", "Castanhas", 15],
  ["chocolate-60-ou-mais", "Chocolate 60% ou mais", 15],
  ["coalhada-com-ou-sem-lactose", "Coalhada com ou sem lactose", 90, "g", ADOCANTES],
  ["coco-em-lascas-ou-desidratado", "Coco em lascas ou desidratado", 15],
  ["coco-em-pedacos", "Coco em pedaços", 25, "g", "O da casca marrom."],
  ["creme-de-castanha-de-caju", "Creme de castanha de caju", 30, "g", MIN_INGREDIENTES],
  ["creme-de-leite-com-ou-sem-lactose", "Creme de leite com ou sem lactose", 30, "g", "Melhor opção: o fresco, em garrafinha ou latinha."],
  ["creme-de-ricota-original-com-ou-sem-lactose", "Creme de ricota original com ou sem lactose", 45, "g", MIN_INGREDIENTES],
  ["creme-de-queijo-minas-frescal-com-ou-sem", "Creme de queijo minas frescal com ou sem lactose", 30, "g", MIN_INGREDIENTES],
  ["creme-de-queijo-minas-frescal-light-com-ou", "Creme de queijo minas frescal light com ou sem lactose", 45, "g", MIN_INGREDIENTES],
  ["cream-cheese-com-ou-sem-lactose", "Cream cheese com ou sem lactose", 30, "g", MIN_INGREDIENTES],
  ["cream-cheese-light-com-ou-sem-lactose", "Cream cheese light com ou sem lactose", 40, "g", MIN_INGREDIENTES],
  ["farinha-de-amendoas", "Farinha de amêndoas", 15],
  ["farinha-de-coco", "Farinha de coco", 15],
  ["farinha-de-linhaca", "Farinha de linhaça", 15],
  ["gema-ou-ovo-inteiro", "Gema ou ovo inteiro", 1, "unidade"],
  ["iogurte-de-2-ou-3-ingredientes-com-ou-sem", "Iogurte de 2 ou 3 ingredientes com ou sem lactose", 140, "g", ADOCANTES],
  ["kefir-integral-com-ou-sem-lactose", "Kefir integral com ou sem lactose", 135, "g", ADOCANTES],
  ["leite-integral-com-ou-sem-lactose", "Leite integral com ou sem lactose", 130, "ml"],
  ["leite-desnatado-ou-semidesnatado-com-ou-sem", "Leite desnatado ou semidesnatado com ou sem lactose", 260, "ml"],
  ["leite-em-po-com-ou-sem-lactose-ou-leite-de", "Leite em pó com ou sem lactose ou leite de coco em pó", 15, "g", SEM_ACUCAR],
  ["leite-em-po-desnatado-com-ou-sem-lactose", "Leite em pó desnatado com ou sem lactose", 25, "g", SEM_ACUCAR],
  ["leite-vegetal-amendoas-coco-castanha-de-caju", "Leite vegetal (amêndoas, coco, castanha de caju e outros)", 300, "ml", SEM_ACUCAR],
  ["macadamia", "Macadâmia", 10],
  ["manteiga", "Manteiga", 10],
  ["manteiga-de-bufala", "Manteiga de búfala", 10],
  ["manteiga-de-coco", "Manteiga de coco", 10],
  ["manteiga-ghee", "Manteiga ghee", 10],
  ["manteiga-vegana", "Manteiga vegana", 10],
  ["mct-ou-tcm", "MCT ou TCM", 10],
  ["nozes", "Nozes", 15],
  ["oleo-de-coco", "Óleo de coco", 10],
  ["ovo-de-codorna-inteiro", "Ovo de codorna inteiro", 5, "unidade"],
  ["pasta-de-amendoim-avela-amendoas-castanha-de", "Pasta de amendoim, avelã, amêndoas, castanha de caju, macadâmia e outras", 15, "g", ADOCANTES],
  ["pacoca", "Paçoca", 15],
  ["pistache-torrado", "Pistache torrado", 15],
  ["polenguinho", "Polenguinho", 35],
  ["queijo-brie-ou-queijo-de-cabra-com-ou-sem", "Queijo brie ou queijo de cabra com ou sem lactose", 25],
  ["queijo-burrata-com-ou-sem-lactose", "Queijo burrata com ou sem lactose", 30],
  ["queijo-coalho-normal-ou-light-com-ou-sem", "Queijo coalho, normal ou light, com ou sem lactose", 25],
  ["queijo-canastra-com-ou-sem-lactose", "Queijo canastra com ou sem lactose", 20],
  ["queijo-curado-com-ou-sem-lactose", "Queijo curado com ou sem lactose", 20],
  ["queijo-gorgonzola-com-ou-sem-lactose", "Queijo gorgonzola com ou sem lactose", 25],
  ["queijo-meia-cura-com-ou-sem-lactose", "Queijo meia cura com ou sem lactose", 25],
  ["queijo-minas-frescal-com-ou-sem-lactose", "Queijo minas frescal com ou sem lactose", 35],
  ["queijo-minas-padrao-com-ou-sem-lactose", "Queijo minas padrão com ou sem lactose", 30],
  ["queijo-mussarela-ou-de-bufala-normal-ou-light", "Queijo mussarela ou de búfala, normal ou light, com ou sem lactose", 30],
  ["queijo-parmesao-com-ou-sem-lactose", "Queijo parmesão com ou sem lactose", 20],
  ["queijo-prato-com-ou-sem-lactose", "Queijo prato com ou sem lactose", 20],
  ["queijo-ricota-fresca-com-mais-de-12-de", "Queijo ricota fresca com mais de 12% de gordura com ou sem lactose", 60],
  ["requeijao-com-ou-sem-lactose", "Requeijão com ou sem lactose", 35, "g", MIN_INGREDIENTES],
  ["requeijao-light-com-ou-sem-lactose", "Requeijão light com ou sem lactose", 50, "g", MIN_INGREDIENTES],
  ["requeijao-vegano", "Requeijão vegano", 30, "g", MIN_INGREDIENTES],
  ["sementes", "Sementes", 15, "g", "Inclui chia e todos os tipos, sem exceção."],
  ["tahine", "Tahine", 10, "g", MIN_INGREDIENTES],
];

/** FRUTAS — 54 itens da lista de substituição. */
const FRUTAS: Linha[] = [
  ["abacaxi", "Abacaxi", 200],
  ["acai-polpa-pura-sem-acucar", "Açaí polpa pura sem açúcar", 175, "g", ACAI],
  ["acerola", "Acerola", 310],
  ["agua-de-coco-in-natura", "Água de coco in natura", 500, "ml", FERMENTA],
  ["ameixa", "Ameixa", 210],
  ["ameixa-seca", "Ameixa seca", 40, "g", SECA],
  ["amora", "Amora", 230],
  ["atemoia", "Atemóia", 100],
  ["banana-da-terra", "Banana da terra", 80],
  ["banana", "Banana", 90],
  ["banana-chips", "Banana chips", 20, "g", SEM_ACUCAR],
  ["blueberry-ou-mirtilo", "Blueberry ou mirtilo", 175],
  ["caja-manga", "Cajá-manga", 220],
  ["caju", "Caju", 230],
  ["caqui", "Caqui", 80],
  ["carambola", "Carambola", 320],
  ["cereja", "Cereja", 200],
  ["ciriguela", "Ciriguela", 125],
  ["cranberry", "Cranberry", 30],
  ["cupuacu", "Cupuaçu", 200],
  ["damasco-seco", "Damasco seco", 40, "g", SECA],
  ["figo", "Figo", 135],
  ["figo-seco", "Figo seco", 40, "g", SECA],
  ["framboesa", "Framboesa", 180],
  ["geleia-100-fruta", "Geleia 100% fruta", 55, "g", ADOCANTES],
  ["goiaba", "Goiaba", 150],
  ["graviola", "Graviola", 150],
  ["jabuticaba", "Jabuticaba", 170],
  ["jaca", "Jaca", 105],
  ["jambo", "Jambo", 200],
  ["kiwi", "Kiwi", 160],
  ["laranja", "Laranja", 210],
  ["lichia", "Lichia", 140],
  ["limao", "Limão", LIVRE],
  ["maca", "Maçã", 190],
  ["mamao", "Mamão", 230],
  ["manga", "Manga", 160],
  ["maracuja", "Maracujá", 140],
  ["melancia", "Melancia", 330],
  ["melao", "Melão", 340],
  ["mexerica-ou-tangerina", "Mexerica ou tangerina", 200],
  ["morango", "Morango", 300],
  ["nespera", "Nêspera", 210],
  ["pera", "Pêra", 175],
  ["pessego", "Pêssego", 250],
  ["pinha-ou-fruta-do-conde", "Pinha ou fruta do conde", 125],
  ["pitanga", "Pitanga", 300],
  ["pitaya", "Pitaya", 165],
  ["roma", "Romã", 200],
  ["tamarindo", "Tamarindo", 30],
  ["tamara-seca", "Tâmara seca", 35, "g", SECA],
  ["tucuma", "Tucumã", 35],
  ["uva-verde-ou-roxa-sem-caroco", "Uva verde ou roxa sem caroço", 180],
  ["uva-passas", "Uva passas", 30, "g", SECA],
];

/**
 * VEGETAIS LIVRES — §12. Quantidade livre, então nenhum tem porção; a regra
 * do grupo (mínimo de 150 g no almoço e no jantar) vive em `grupos.ts`.
 */
const VEGETAIS_LIVRES: Linha[] = [
  ["abobrinha", "Abobrinha", LIVRE],
  ["aspargos", "Aspargos", LIVRE],
  ["alho", "Alho", LIVRE],
  ["alho-poro", "Alho-poró", LIVRE],
  ["berinjela", "Berinjela", LIVRE],
  ["beterraba", "Beterraba", LIVRE],
  ["brocolis", "Brócolis", LIVRE],
  ["cebola", "Cebola", LIVRE],
  ["cenoura", "Cenoura", LIVRE],
  ["chuchu", "Chuchu", LIVRE],
  ["cogumelos", "Cogumelos", LIVRE],
  ["couve-flor", "Couve-flor", LIVRE],
  ["couve-de-bruxelas", "Couve-de-bruxelas", LIVRE],
  ["ervilha-torta", "Ervilha-torta", LIVRE],
  ["jilo", "Jiló", LIVRE],
  ["maxixe", "Maxixe", LIVRE],
  ["nabo", "Nabo", LIVRE],
  ["palmito", "Palmito", LIVRE],
  ["pimentao", "Pimentão", LIVRE],
  ["pepino", "Pepino", LIVRE],
  ["repolho", "Repolho", LIVRE],
  ["quiabo", "Quiabo", LIVRE],
  ["rabanete", "Rabanete", LIVRE],
  ["tomate", "Tomate", LIVRE],
  ["tomatinho", "Tomatinho", LIVRE],
  ["vagem", "Vagem", LIVRE],
  ["folhas-e-brotos", "Folhas e brotos", LIVRE],
];

export const ALIMENTOS: Alimento[] = [
  ...montar(CARBOIDRATOS, "carboidratos"),
  ...montar(PROTEINAS, "proteinas"),
  ...montar(GORDURAS, "gorduras"),
  ...montar(FRUTAS, "frutas"),
  ...montar(VEGETAIS_LIVRES, "vegetais-livres"),
];

export const ALIMENTO_POR_ID: ReadonlyMap<string, Alimento> = new Map(ALIMENTOS.map((a) => [a.id, a]));
