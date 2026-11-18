/**
 * Hot Slim — a base única de alimentos do desafio.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * ---------------------------
 * Antes, cada tela do Hot Slim tinha a sua própria lista escrita à mão, e
 * elas se contradiziam (maçã no cardápio e na lista de compras; abobrinha na
 * lista base e na reintrodução; 6 dias numa tela e 7 em outra). Agora todo
 * alimento do desafio mora AQUI, uma vez só. Cardápio, lista de compras,
 * trocas e reintrodução são montados a partir desta base, e o teste
 * `conteudo.test.ts` falha se alguma tela usar um alimento fora da regra.
 *
 * AS REGRAS QUE O TESTE COBRA
 * ---------------------------
 * - `fodmapId` aponta para o Semáforo FODMAP do app (CATALOGO_FODMAP). Lá o
 *   alimento tem que estar VERDE. Assim o Hot Slim nunca diz uma coisa e o
 *   semáforo outra.
 * - Quando não há item no semáforo, `notaFodmap` explica por que o alimento
 *   é seguro (ex.: proteína animal, gordura pura). Sem nota, o teste falha.
 * - `limiteG` é a porção máxima por refeição que ainda é baixa em FODMAP.
 *   Nenhuma opção do cardápio pode passar dela. `null` = sem limite de FODMAP.
 * - `semana` diz quando o alimento entra: 1 (repouso digestivo, tudo
 *   cozido) ou 2 (entram crus, folhas e carne vermelha).
 * - `aviso` aparece junto do alimento em toda tela que o mostra.
 *
 * As calorias são por 100 g (ou 100 ml) e citam a tabela de origem. TACO e
 * USDA podem ser usadas aqui; a TBCA não (ver tbca/LEIA-ME.md).
 *
 * COMO ACRESCENTAR UM ALIMENTO
 * ----------------------------
 * Copie uma linha parecida, ajuste e rode `npm test`. Se o teste reclamar,
 * é porque o alimento contradiz alguma regra do desafio.
 */

export type GrupoHS =
  | "proteina"
  | "bebida"
  | "carboidrato"
  | "fruta"
  | "legume"
  | "gordura";

export type SecaoCompra =
  | "Proteínas"
  | "Bebidas vegetais"
  | "Carboidratos"
  | "Frutas"
  | "Legumes e verduras"
  | "Gorduras e sementes";

export interface AlimentoHS {
  id: string;
  nome: string;
  grupo: GrupoHS;
  /** Por 100 g (ou 100 ml), no estado em que é pesado: [kcal, proteína, carboidrato, gordura, fibra]. */
  por100: [kcal: number, proteina: number, carboidrato: number, gordura: number, fibra: number];
  /** De onde veio o número. */
  fonte: string;
  /** Id no Semáforo FODMAP do app. Tem que ser verde lá. */
  fodmapId: string | null;
  /** Obrigatória quando não há fodmapId: por que é seguro. */
  notaFodmap?: string;
  /** Porção máxima por refeição ainda baixa em FODMAP. null = livre. */
  limiteG: number | null;
  /** Semana em que entra no desafio. */
  semana: 1 | 2;
  /** Alerta que acompanha o alimento em toda tela (rótulo, maturação...). */
  aviso?: string;
  /** Medida caseira de apoio. */
  medida?: string;
  /** Seção da lista de compras. */
  secao: SecaoCompra;
}

export const ALIMENTOS: AlimentoHS[] = [
  // ── Proteínas ────────────────────────────────────────────────────────────
  { id: "frango-peito", nome: "Peito de frango grelhado", grupo: "proteina", por100: [159.2, 32.0, 0, 2.5, 0], fonte: "TACO 4ª ed., cód. 410", fodmapId: "frango", limiteG: null, semana: 1, medida: "1 filé médio ≈ 100 g", secao: "Proteínas" },
  { id: "frango-sobrecoxa", nome: "Sobrecoxa de frango sem pele assada", grupo: "proteina", por100: [232.9, 29.2, 0, 12.0, 0], fonte: "TACO 4ª ed., cód. 413", fodmapId: "frango", limiteG: null, semana: 1, secao: "Proteínas" },
  { id: "peixe-branco", nome: "Peixe branco assado (merluza, pescada, tilápia)", grupo: "proteina", por100: [121.9, 26.6, 0, 0.9, 0], fonte: "TACO 4ª ed., cód. 301 (merluza assada)", fodmapId: "peixe", limiteG: null, semana: 1, medida: "1 filé médio ≈ 120 g", secao: "Proteínas" },
  { id: "salmao", nome: "Salmão grelhado", grupo: "proteina", por100: [242.7, 26.1, 0, 14.5, 0], fonte: "TACO 4ª ed., cód. 317", fodmapId: "peixe", limiteG: null, semana: 1, secao: "Proteínas" },
  { id: "camarao", nome: "Camarão cozido", grupo: "proteina", por100: [90, 19, 0, 1, 0], fonte: "TACO 4ª ed., cód. 284", fodmapId: null, notaFodmap: "Proteína animal: não tem carboidrato fermentável.", limiteG: null, semana: 1, secao: "Proteínas" },
  { id: "ovo", nome: "Ovo", grupo: "proteina", por100: [143.1, 13.0, 1.6, 8.9, 0], fonte: "TACO 4ª ed., cód. 489", fodmapId: "ovos", limiteG: null, semana: 1, medida: "1 unidade ≈ 50 g", secao: "Proteínas" },
  { id: "colageno", nome: "Colágeno em pó sem sabor", grupo: "proteina", por100: [335, 85.6, 0, 0.1, 0], fonte: "USDA FDC 19177 (gelatina em pó sem açúcar)", fodmapId: null, notaFodmap: "Proteína pura. Só serve a versão sem eritritol, xilitol, maltitol ou sorbitol.", limiteG: null, semana: 1, medida: "1 colher de sopa ≈ 10 g", secao: "Proteínas" },
  { id: "patinho", nome: "Patinho grelhado", grupo: "proteina", por100: [219.3, 35.9, 0, 7.3, 0], fonte: "TACO 4ª ed., cód. 377", fodmapId: "carne-bovina", limiteG: null, semana: 2, secao: "Proteínas" },
  { id: "lombo", nome: "Lombo suíno assado", grupo: "proteina", por100: [210.2, 35.7, 0, 6.4, 0], fonte: "TACO 4ª ed., cód. 432", fodmapId: "carne-suina", limiteG: null, semana: 2, secao: "Proteínas" },


  // ── Bebidas vegetais (laticínios ficam fora do desafio) ─────────────────
  { id: "bebida-aveia", nome: "Bebida de aveia", grupo: "bebida", por100: [45, 1.0, 7.0, 1.5, 0.8], fonte: "Rótulo médio de bebidas de aveia sem açúcar", fodmapId: "leite-aveia", limiteG: 100, semana: 1, medida: "no máximo 100 ml por refeição", aviso: "Acima de 100 ml entram frutanos e GOS.", secao: "Bebidas vegetais" },

  // ── Carboidratos ─────────────────────────────────────────────────────────
  { id: "arroz", nome: "Arroz branco cozido", grupo: "carboidrato", por100: [128.3, 2.5, 28.1, 0.2, 1.6], fonte: "TACO 4ª ed., cód. 3", fodmapId: "arroz-branco", limiteG: null, semana: 1, medida: "1 colher de servir ≈ 50 g", secao: "Carboidratos" },
  { id: "batata", nome: "Batata inglesa cozida", grupo: "carboidrato", por100: [51.6, 1.2, 11.9, 0, 1.3], fonte: "TACO 4ª ed., cód. 91", fodmapId: "batata", limiteG: null, semana: 1, secao: "Carboidratos" },
  { id: "mandioca", nome: "Mandioca cozida", grupo: "carboidrato", por100: [125.4, 0.6, 30.1, 0.3, 1.6], fonte: "TACO 4ª ed., cód. 129", fodmapId: "mandioca", limiteG: 75, semana: 1, secao: "Carboidratos" },
  { id: "cabotia", nome: "Abóbora cabotiá cozida", grupo: "carboidrato", por100: [48, 1.4, 10.8, 0.7, 2.5], fonte: "TACO 4ª ed., cód. 64", fodmapId: "abobora", limiteG: null, semana: 1, secao: "Carboidratos" },
  { id: "batata-doce", nome: "Batata-doce cozida", grupo: "carboidrato", por100: [76.8, 0.6, 18.4, 0.1, 2.2], fonte: "TACO 4ª ed., cód. 88", fodmapId: "batata-doce", limiteG: 75, semana: 1, secao: "Carboidratos" },
  { id: "quinoa", nome: "Quinoa cozida", grupo: "carboidrato", por100: [120, 4.4, 21.3, 1.9, 2.8], fonte: "USDA FDC 20137", fodmapId: "quinoa", limiteG: 155, semana: 1, secao: "Carboidratos" },
  { id: "macarrao-arroz", nome: "Macarrão de arroz cozido", grupo: "carboidrato", por100: [108, 1.8, 24.0, 0.2, 1.0], fonte: "USDA FDC 20134", fodmapId: "macarrao-sem-gluten", limiteG: 145, semana: 1, medida: "Só farinha de arroz nos ingredientes", secao: "Carboidratos" },
  { id: "tapioca", nome: "Tapioca (goma)", grupo: "carboidrato", por100: [330.9, 0.5, 81.1, 0.3, 0.6], fonte: "TACO 4ª ed., cód. 124 (fécula de mandioca)", fodmapId: "tapioca", limiteG: null, semana: 1, medida: "1 colher de sopa ≈ 10 g", secao: "Carboidratos" },
  { id: "flocao", nome: "Flocão de milho (cuscuz)", grupo: "carboidrato", por100: [363.3, 6.9, 80.4, 1.2, 1.8], fonte: "TACO 4ª ed., cód. 22", fodmapId: "milho-farinha", limiteG: null, semana: 1, medida: "peso cru", secao: "Carboidratos" },
  { id: "aveia", nome: "Aveia em flocos", grupo: "carboidrato", por100: [393.8, 13.9, 66.6, 8.5, 9.1], fonte: "TACO 4ª ed., cód. 7", fodmapId: "aveia", limiteG: 52, semana: 1, medida: "1 colher de sopa ≈ 10 g", secao: "Carboidratos" },
  { id: "biscoito-arroz", nome: "Biscoito de arroz", grupo: "carboidrato", por100: [392, 7.1, 81.1, 4.3, 4.2], fonte: "USDA FDC 42204", fodmapId: null, notaFodmap: "Bolacha de arroz simples é baixa em FODMAP em 2 unidades (Monash). Sem sabor e sem outras farinhas.", limiteG: 18, semana: 1, medida: "1 unidade ≈ 9 g", secao: "Carboidratos" },
  { id: "pipoca", nome: "Milho de pipoca", grupo: "carboidrato", por100: [387, 12.9, 77.8, 4.5, 14.5], fonte: "USDA FDC 19034", fodmapId: "pipoca", limiteG: null, semana: 1, medida: "peso do grão; estoure sem óleo", secao: "Carboidratos" },

  // ── Frutas (as porções são o limite seguro do Semáforo FODMAP) ──────────
  { id: "banana", nome: "Banana firme (não muito madura)", grupo: "fruta", por100: [98.2, 1.3, 26.0, 0.1, 2.0], fonte: "TACO 4ª ed., cód. 182", fodmapId: "banana-verde", limiteG: 100, semana: 1, medida: "1 unidade ≈ 100 g", aviso: "Firme, casca amarela sem pintas. Madura (com pintas) só é baixa em FODMAP em ⅓ da fruta.", secao: "Frutas" },
  { id: "mamao", nome: "Mamão papaia", grupo: "fruta", por100: [40.2, 0.5, 10.4, 0.1, 1.0], fonte: "TACO 4ª ed., cód. 226", fodmapId: "mamao", limiteG: 140, semana: 1, secao: "Frutas" },
  { id: "morango", nome: "Morango", grupo: "fruta", por100: [30.1, 0.9, 6.8, 0.3, 1.7], fonte: "TACO 4ª ed., cód. 239", fodmapId: "morango", limiteG: 65, semana: 1, medida: "5 unidades médias ≈ 65 g", secao: "Frutas" },
  { id: "kiwi", nome: "Kiwi", grupo: "fruta", por100: [51.1, 1.3, 11.5, 0.6, 2.7], fonte: "TACO 4ª ed., cód. 207", fodmapId: "kiwi", limiteG: 150, semana: 1, medida: "1 unidade ≈ 75 g", secao: "Frutas" },
  { id: "uva", nome: "Uva", grupo: "fruta", por100: [52.9, 0.7, 13.6, 0.2, 0.9], fonte: "TACO 4ª ed., cód. 256", fodmapId: "uva", limiteG: 32, semana: 1, medida: "6 uvas ≈ 32 g", secao: "Frutas" },
  { id: "abacaxi", nome: "Abacaxi", grupo: "fruta", por100: [48.3, 0.9, 12.3, 0.1, 1.0], fonte: "TACO 4ª ed., cód. 164", fodmapId: "abacaxi", limiteG: 140, semana: 1, medida: "1 fatia ≈ 140 g", secao: "Frutas" },
  { id: "laranja", nome: "Laranja", grupo: "fruta", por100: [36.8, 1.0, 8.9, 0.1, 0.8], fonte: "TACO 4ª ed., cód. 214", fodmapId: "laranja", limiteG: 130, semana: 1, medida: "1 unidade ≈ 130 g", secao: "Frutas" },
  { id: "tangerina", nome: "Tangerina (mexerica)", grupo: "fruta", por100: [36.9, 0.7, 9.3, 0.1, 2.7], fonte: "TACO 4ª ed., cód. 238", fodmapId: "tangerina", limiteG: 90, semana: 1, medida: "1 unidade pequena ≈ 90 g", secao: "Frutas" },
  { id: "melao", nome: "Melão", grupo: "fruta", por100: [29.4, 0.7, 7.5, 0, 0.2], fonte: "TACO 4ª ed., cód. 236", fodmapId: "melao", limiteG: 120, semana: 1, medida: "1 fatia ≈ 120 g", secao: "Frutas" },
  { id: "mirtilo", nome: "Mirtilo (blueberry)", grupo: "fruta", por100: [57, 0.7, 14.5, 0.3, 2.4], fonte: "USDA FDC 9050", fodmapId: "mirtilo", limiteG: 125, medida: "1 xícara ≈ 125 g", semana: 1, secao: "Frutas" },
  { id: "framboesa", nome: "Framboesa", grupo: "fruta", por100: [52, 1.2, 11.9, 0.7, 6.5], fonte: "USDA FDC 9302", fodmapId: "framboesa", limiteG: 58, semana: 1, secao: "Frutas" },

  // ── Legumes e verduras ───────────────────────────────────────────────────
  { id: "abobrinha", nome: "Abobrinha", grupo: "legume", por100: [15, 1.1, 3.0, 0.2, 1.6], fonte: "TACO 4ª ed., cód. 70", fodmapId: "abobrinha", limiteG: 65, semana: 1, secao: "Legumes e verduras" },
  { id: "cenoura", nome: "Cenoura", grupo: "legume", por100: [29.9, 0.8, 6.7, 0.2, 2.6], fonte: "TACO 4ª ed., cód. 109", fodmapId: "cenoura", limiteG: null, semana: 1, secao: "Legumes e verduras" },
  { id: "berinjela", nome: "Berinjela", grupo: "legume", por100: [18.8, 0.7, 4.5, 0.1, 2.5], fonte: "TACO 4ª ed., cód. 95", fodmapId: "berinjela", limiteG: 70, semana: 1, secao: "Legumes e verduras" },
  { id: "chuchu", nome: "Chuchu", grupo: "legume", por100: [18.5, 0.4, 4.8, 0, 1.0], fonte: "TACO 4ª ed., cód. 112", fodmapId: "chuchu", limiteG: null, semana: 1, secao: "Legumes e verduras" },
  { id: "vagem", nome: "Vagem", grupo: "legume", por100: [24.9, 1.8, 5.3, 0.2, 2.4], fonte: "TACO 4ª ed., cód. 162", fodmapId: "vagem", limiteG: 75, semana: 1, secao: "Legumes e verduras" },
  { id: "pimentao", nome: "Pimentão vermelho", grupo: "legume", por100: [23.3, 1.0, 5.5, 0.1, 1.6], fonte: "TACO 4ª ed., cód. 145", fodmapId: "pimentao", limiteG: null, semana: 1, secao: "Legumes e verduras" },
  { id: "couve", nome: "Couve-manteiga", grupo: "legume", por100: [27.1, 2.9, 4.3, 0.5, 3.1], fonte: "TACO 4ª ed., cód. 115", fodmapId: "couve", limiteG: null, semana: 1, secao: "Legumes e verduras" },
  { id: "espinafre", nome: "Espinafre", grupo: "legume", por100: [16.1, 2.0, 2.6, 0.2, 2.1], fonte: "TACO 4ª ed., cód. 119", fodmapId: "espinafre", limiteG: null, semana: 1, secao: "Legumes e verduras" },
  { id: "tomate", nome: "Tomate", grupo: "legume", por100: [15.3, 1.1, 3.1, 0.2, 1.2], fonte: "TACO 4ª ed., cód. 157", fodmapId: "tomate", limiteG: 65, semana: 1, medida: "1 unidade pequena ≈ 65 g", secao: "Legumes e verduras" },
  { id: "alface", nome: "Alface", grupo: "legume", por100: [10.7, 1.3, 1.7, 0.2, 1.8], fonte: "TACO 4ª ed., cód. 78", fodmapId: "alface", limiteG: null, semana: 2, secao: "Legumes e verduras" },
  { id: "rucula", nome: "Rúcula", grupo: "legume", por100: [13.1, 1.8, 2.2, 0.1, 1.7], fonte: "TACO 4ª ed., cód. 152", fodmapId: "rucula", limiteG: null, semana: 2, secao: "Legumes e verduras" },
  { id: "pepino", nome: "Pepino", grupo: "legume", por100: [9.5, 0.9, 2.0, 0, 1.1], fonte: "TACO 4ª ed., cód. 142", fodmapId: "pepino", limiteG: null, semana: 2, secao: "Legumes e verduras" },

  // ── Gorduras e sementes ──────────────────────────────────────────────────
  { id: "azeite", nome: "Azeite de oliva extravirgem", grupo: "gordura", por100: [884, 0, 0, 100, 0], fonte: "TACO 4ª ed., cód. 260", fodmapId: "azeite", limiteG: null, semana: 1, medida: "1 colher de sopa ≈ 8 g", secao: "Gorduras e sementes" },
  { id: "pasta-amendoim", nome: "Pasta de amendoim (só amendoim)", grupo: "gordura", por100: [598, 22.2, 22.3, 51.4, 5.0], fonte: "USDA FDC 16398", fodmapId: "amendoim", limiteG: 28, semana: 1, medida: "1 colher de sopa ≈ 15 g", secao: "Gorduras e sementes" },
  { id: "chia", nome: "Chia", grupo: "gordura", por100: [486, 16.5, 42.1, 30.7, 34.4], fonte: "USDA FDC 12006", fodmapId: "chia", limiteG: 24, semana: 1, medida: "1 colher de sopa ≈ 12 g", secao: "Gorduras e sementes" },
  { id: "cacau", nome: "Cacau 100% em pó", grupo: "gordura", por100: [228, 19.6, 57.9, 13.7, 37.0], fonte: "USDA FDC 19165", fodmapId: null, notaFodmap: "Cacau em pó é baixo em FODMAP até 2 colheres de chá (Monash).", limiteG: 8, semana: 1, medida: "1 colher de chá ≈ 4 g", secao: "Gorduras e sementes" },
  { id: "leite-amendoa", nome: "Bebida de amêndoas sem açúcar", grupo: "bebida", por100: [15, 0.6, 0.3, 1.2, 0], fonte: "USDA FDC 14091", fodmapId: "leite-amendoa", limiteG: 240, semana: 1, medida: "1 copo ≈ 200 ml", aviso: "Sem inulina, chicória ou açúcar nos ingredientes.", secao: "Bebidas vegetais" },
];

const POR_ID = new Map(ALIMENTOS.map((a) => [a.id, a]));

export function alimento(id: string): AlimentoHS {
  const a = POR_ID.get(id);
  if (!a) throw new Error(`Hot Slim: alimento "${id}" não existe na base.`);
  return a;
}
