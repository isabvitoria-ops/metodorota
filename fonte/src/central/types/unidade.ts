/**
 * Unidades de medida — cadastro aberto (§5 do briefing).
 *
 * As unidades vivem em dado, não em tipo: para acrescentar "xícara" ou
 * "concha" basta somar uma linha em `data/unidades.ts`. Nenhuma tela
 * assume que o mundo é feito só de gramas.
 */
export interface Unidade {
  id: string;
  /** Nome por extenso, usado no seletor: "Gramas". */
  rotulo: string;
  /** Forma curta usada no resultado: "g". */
  abreviacao: string;
  /** Singular para quando a quantidade for 1 ou menos: "colher de sopa". */
  singular: string;
  /**
   * Contínua (g, ml) aceita qualquer fração; discreta (unidade, fatia) é
   * arredondada para meios, porque meia fatia existe e 0,37 fatia não.
   */
  continua: boolean;
}

/** Uma quantidade concreta: 90 g, 2 colheres de sopa, 1 fatia. */
export interface Medida {
  quantidade: number;
  unidadeId: string;
}

/**
 * Medida caseira cadastrada **para um alimento específico**.
 *
 * É isto que faz o seletor de unidade mostrar "colher de sopa" só onde a
 * nutricionista cadastrou colher de sopa (§5). `equivalenteNaBase` é o peso
 * de UMA dessas medidas na unidade base do alimento — 1 colher de sopa de
 * arroz = 25 g, por exemplo. `null` significa "ainda não medido": a unidade
 * fica cadastrada, mas não é oferecida para cálculo.
 */
export interface MedidaDoAlimento {
  unidadeId: string;
  equivalenteNaBase: number | null;
  /** Texto opcional de apoio: "cheia, rasa, de servir". */
  rotulo?: string | null;
}
