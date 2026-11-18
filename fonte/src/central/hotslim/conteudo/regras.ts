/**
 * Hot Slim — as regras do desafio, num lugar só.
 *
 * Toda tela que fala de regra (Protocolo, Cardápio, FAQ, Metas) lê daqui.
 * Mudou um número? Muda aqui e ele muda em todas as telas de uma vez.
 */

/** Conduta-base da Isabela para o desafio. */
export const META_KCAL = 1600;
/** Hidratação: 50 ml por kg de peso. */
export const AGUA_ML_POR_KG = 50;
/** Limite diário de cafeína durante o desafio (≈ 1 xícara de café coado). */
export const CAFEINA_MAX_MG = 100;
/** Último café do dia. */
export const CAFE_ATE = "16h";
/** Jejum noturno (jejum metabólico), da última refeição até a primeira do dia seguinte. */
export const JEJUM_NOTURNO_H = { de: 10, ate: 12 } as const;
/** Duração total. */
export const TOTAL_DIAS = 21;

/**
 * Metas de cada refeição. A soma tem que dar META_KCAL (o teste confere).
 * Cada opção do cardápio fica a no máximo ±5% da meta da refeição, então
 * qualquer combinação de 4 opções fica perto de 1.600 kcal.
 *
 * Proteína e fibra mínimas por refeição: pensadas para preservar massa magra
 * em déficit com treino (proteína distribuída em ≥ 3 refeições de 20 a 40 g,
 * ISSN 2017) e para chegar perto das 25–30 g de fibra/dia recomendadas também
 * no low FODMAP (Monash).
 */
export interface MetaRefeicao {
  id: "cafe" | "almoco" | "lanche" | "jantar";
  nome: string;
  horario: string;
  kcal: number;
  proteinaMinG: number;
  fibraMinG: number;
}

export const REFEICOES: MetaRefeicao[] = [
  { id: "cafe", nome: "Café da manhã", horario: "7h às 9h", kcal: 400, proteinaMinG: 18, fibraMinG: 4 },
  { id: "almoco", nome: "Almoço", horario: "12h às 14h", kcal: 500, proteinaMinG: 30, fibraMinG: 5 },
  { id: "lanche", nome: "Lanche da tarde", horario: "15h às 17h", kcal: 250, proteinaMinG: 10, fibraMinG: 2.5 },
  { id: "jantar", nome: "Jantar", horario: "até as 20h", kcal: 450, proteinaMinG: 30, fibraMinG: 4.5 },
];

/** Tolerância de cada opção em relação à meta da refeição. */
export const TOLERANCIA_KCAL = 0.05;

export interface Etapa {
  numero: 1 | 2 | 3;
  nome: string;
  dias: { de: number; ate: number };
  resumo: string;
  /** Pronta para o app? As etapas 2 e 3 ainda estão em revisão. */
  revisada: boolean;
}

export const ETAPAS: Etapa[] = [
  { numero: 1, nome: "Repouso digestivo", dias: { de: 1, ate: 7 }, resumo: "Tudo cozido, low FODMAP, sem glúten e sem laticínios. O intestino trabalha menos para você sentir a diferença.", revisada: true },
  { numero: 2, nome: "Ampliação", dias: { de: 8, ate: 14 }, resumo: "Entram crus, folhas e carne vermelha, ainda low FODMAP.", revisada: false },
  { numero: 3, nome: "Reintrodução", dias: { de: 15, ate: 21 }, resumo: "Teste guiado de um grupo FODMAP por vez, para descobrir os seus liberados.", revisada: false },
];

export function etapaDoDia(dia: number): Etapa {
  return ETAPAS.find((e) => dia >= e.dias.de && dia <= e.dias.ate) ?? ETAPAS[ETAPAS.length - 1]!;
}

/** Regras da Etapa 1, na ordem em que aparecem no Protocolo. */
export const REGRAS_ETAPA_1: { titulo: string; texto: string }[] = [
  { titulo: "4 refeições por dia", texto: "Café, almoço, lanche e jantar, nos horários do cardápio. Entre elas, nada que tenha caloria: só água e os chás liberados." },
  { titulo: "Só o que está no cardápio", texto: "Cada opção já soma as calorias certas para você chegar perto de 1.600 kcal. Troque só pelas trocas da própria tela." },
  { titulo: "Tudo cozido", texto: "Legumes cozidos, assados ou refogados. Folhas e legumes crus ficam para a Etapa 2. Frutas podem ser cruas, sempre na porção indicada." },
  { titulo: "Sem carne vermelha", texto: "Frango, peixe, camarão e ovos. Carne bovina e suína voltam na Etapa 2." },
  { titulo: "Sem glúten e sem laticínios", texto: "Nada de trigo, centeio, cevada e malte. Nada de leite, iogurte, queijo, manteiga ou ghee, nem na versão sem lactose. Os dois voltam, testados, nas próximas etapas." },
  { titulo: "Sem açúcar", texto: "Para adoçar, só stevia ou taumatina, e na versão pura: sem eritritol, xilitol, maltitol ou sorbitol na fórmula." },
  { titulo: "Cafeína até 100 mg por dia", texto: "É mais ou menos 1 xícara de café coado. O último café é até as 16h. Chá verde e chá preto também contam." },
  { titulo: "Jejum noturno de 10 a 12 horas", texto: "Da última refeição do dia até o café da manhã. É o seu sono mais o tempo depois do jantar, não é jejum intermitente." },
  { titulo: "Água: 50 ml por kg", texto: "Ao longo do dia, longe das grandes refeições se você sente estufar." },
  { titulo: "Movimento todo dia", texto: "Treino ou caminhada de 20 a 30 minutos. Movimento acelera o trânsito intestinal." },
];

/**
 * Adoçantes. O teste procura qualquer outro adoçante citado nos textos do
 * Hot Slim e falha, para que nenhuma tela libere o que a conduta não libera.
 */
export const ADOCANTES_LIBERADOS = ["stevia", "taumatina"] as const;
export const ADOCANTES_PROIBIDOS = ["eritritol", "xilitol", "maltitol", "sorbitol", "manitol", "isomalte", "sucralose", "aspartame", "ciclamato", "sacarina", "acessulfame"];

/** Fora durante toda a Etapa 1 (com o motivo, que aparece na tela). */
export const FORA_ETAPA_1: { item: string; motivo: string }[] = [
  { item: "Trigo, centeio, cevada e malte", motivo: "Glúten e frutanos" },
  { item: "Leite, iogurte, queijos, manteiga e ghee", motivo: "Laticínios, inclusive os sem lactose. A lactose é testada na reintrodução." },
  { item: "Açúcar, mel, melado, açúcar de coco, tâmara e xarope de agave", motivo: "Açúcar e excesso de frutose" },
  { item: "Maçã, pera, manga, melancia, ameixa (fresca ou seca) e damasco", motivo: "Frutose e polióis (sorbitol)" },
  { item: "Alho, cebola, alho-poró e cebolinha (parte branca)", motivo: "Frutanos" },
  { item: "Feijão, grão-de-bico, lentilha e soja", motivo: "GOS" },
  { item: "Couve-flor, cogumelos, aspargos e beterraba", motivo: "Manitol, frutanos e GOS" },
  { item: "Castanha de caju e pistache", motivo: "GOS e frutanos" },
  { item: "Carne bovina e suína", motivo: "Voltam na Etapa 2" },
  { item: "Folhas e legumes crus", motivo: "Voltam na Etapa 2" },
  { item: "Whey e proteína vegetal em pó", motivo: "Fora do desafio. O colágeno pode." },
  { item: "Chá de camomila e de erva-doce", motivo: "Frutanos" },
  { item: "Bebida alcoólica, refrigerante e água com gás", motivo: "Irritam e distendem" },
  { item: "Ultraprocessados e embutidos", motivo: "Costumam esconder alho, cebola, açúcar e polióis" },
];

/** Avisos de rótulo: o produto pode entrar, mas só lendo os ingredientes. */
export const AVISOS_DE_ROTULO: { item: string; aviso: string }[] = [
  { item: "Curry e temperos prontos", aviso: "Muitos têm alho ou cebola em pó. Só use se não estiverem nos ingredientes." },
  { item: "Granola", aviso: "Costuma ter castanha de caju, mel ou adoçantes polióis (eritritol, xilitol, maltitol). Com qualquer um deles, não entra." },
  { item: "Banana", aviso: "Só firme, casca amarela sem pintas. A madura tem mais frutanos." },
  { item: "Bebida de aveia", aviso: "No máximo 100 ml por refeição." },
  { item: "Bebidas vegetais", aviso: "Sem inulina, chicória, polidextrose ou açúcar." },
  { item: "Adoçante", aviso: "Stevia ou taumatina puras. Muitas misturas de stevia levam eritritol." },
  { item: "Colágeno", aviso: "Sem sabor, ou adoçado só com stevia ou taumatina." },
];

/** Temperos liberados na Etapa 1 (todos baixos em FODMAP). */
export const TEMPEROS_ETAPA_1 = [
  "Sal", "Pimenta-do-reino", "Cúrcuma", "Gengibre", "Páprica", "Cominho",
  "Orégano", "Manjericão", "Alecrim", "Tomilho", "Louro", "Salsinha",
  "Coentro", "Cebolinha (só a parte verde)", "Canela", "Limão", "Azeite com alho (aquecido e sem os pedaços)",
];

/**
 * Chás liberados. A lista definitiva vem do material de chás da Isabela
 * (pendente). Por enquanto, só os que já estão VERDES no Semáforo FODMAP.
 */
export const CHAS_ETAPA_1: { nome: string; fodmapId: string; obs?: string }[] = [
  { nome: "Hortelã", fodmapId: "cha-hortelan" },
  { nome: "Gengibre", fodmapId: "cha-gengibre" },
  { nome: "Chá verde", fodmapId: "cha-verde", obs: "Tem cafeína: conta nos 100 mg." },
];
