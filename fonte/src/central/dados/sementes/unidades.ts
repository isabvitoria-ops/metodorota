import type { Unidade } from "@/central/types";

/**
 * Vocabulário de unidades (§5).
 *
 * Estar nesta lista só significa que a unidade **existe** no sistema — ela
 * não aparece no seletor de nenhum alimento enquanto a nutricionista não
 * cadastrar, naquele alimento, quanto ela vale (ver `medidas` em
 * `data/alimentos.ts`). Para criar uma unidade nova, some uma linha aqui.
 */
export const UNIDADES: Unidade[] = [
  { id: "g", rotulo: "Gramas", abreviacao: "g", singular: "g", continua: true },
  { id: "ml", rotulo: "Mililitros", abreviacao: "ml", singular: "ml", continua: true },
  { id: "unidade", rotulo: "Unidades", abreviacao: "un", singular: "unidade", continua: false },
  { id: "fatia", rotulo: "Fatias", abreviacao: "fatias", singular: "fatia", continua: false },
  { id: "colher-sopa", rotulo: "Colheres de sopa", abreviacao: "col. sopa", singular: "colher de sopa", continua: false },
  { id: "colher-cha", rotulo: "Colheres de chá", abreviacao: "col. chá", singular: "colher de chá", continua: false },
  { id: "xicara", rotulo: "Xícaras", abreviacao: "xíc.", singular: "xícara", continua: false },
  { id: "concha", rotulo: "Conchas", abreviacao: "conchas", singular: "concha", continua: false },
];

export const UNIDADE_POR_ID: ReadonlyMap<string, Unidade> = new Map(UNIDADES.map((u) => [u.id, u]));
