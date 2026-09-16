/**
 * Alimento — uma linha da base TACO (4ª edição, NEPA/UNICAMP, 591 itens).
 * Valores nutricionais são por 100 g de parte comestível.
 *
 * REGRA INEGOCIÁVEL (briefing, Anexo #1 e #2): este tipo e os campos
 * numéricos que carrega são uso INTERNO da nutricionista. Nenhuma tela do
 * paciente pode importar `Alimento` para exibir kcal/proteína/lipídeos/
 * carboidrato — o paciente só vê `nome` e a quantidade escrita no plano.
 */
export type GrupoAlimento =
  | "carb"
  | "prot"
  | "laticinio"
  | "legum"
  | "fruta"
  | "vegetal"
  | "gordura"
  | "outros";

export interface Alimento {
  codigoTaco: number;
  nome: string;
  grupo: GrupoAlimento;
  /** Todos por 100 g de parte comestível. */
  kcal: number;
  proteina: number;
  lipideos: number;
  carboidrato: number;
  fibra: number;
  calcio: number;
  ferro: number;
  sodio: number;
}

export const NUTRIENTE_BASE_POR_GRUPO: Record<GrupoAlimento, keyof Alimento> = {
  carb: "carboidrato",
  prot: "proteina",
  laticinio: "proteina",
  legum: "proteina",
  fruta: "carboidrato",
  vegetal: "carboidrato",
  gordura: "lipideos",
  outros: "kcal",
};

/**
 * Conteúdo educativo curto exibido ao paciente ao tocar num alimento do
 * plano ("Ficha" no protótipo). Nunca contém valor nutricional numérico
 * (regra #1) — só explicação em linguagem simples e dicas de preparo.
 */
export interface FichaEducativaAlimento {
  alimentoCodigoTaco: number;
  tags: string[];
  titulo: string;
  corpo: string;
  dicas: string[];
}
