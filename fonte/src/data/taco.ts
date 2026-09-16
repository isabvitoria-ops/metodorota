import type { Alimento, GrupoAlimento } from "@/types";
import { TACO_RAW } from "./tacoRaw";

const GRUPOS_VALIDOS = new Set<GrupoAlimento>([
  "carb", "prot", "laticinio", "legum", "fruta", "vegetal", "gordura", "outros",
]);

function paraGrupo(g: string): GrupoAlimento {
  if (GRUPOS_VALIDOS.has(g as GrupoAlimento)) return g as GrupoAlimento;
  throw new Error(`Grupo TACO desconhecido: "${g}"`);
}

/** Base TACO tipada — computada uma vez no load do módulo a partir de `tacoRaw.ts`. */
export const TACO: Alimento[] = TACO_RAW.map(
  ([codigoTaco, nome, grupo, kcal, proteina, lipideos, carboidrato, fibra, calcio, ferro, sodio]) => ({
    codigoTaco,
    nome,
    grupo: paraGrupo(grupo),
    kcal,
    proteina,
    lipideos,
    carboidrato,
    fibra,
    calcio,
    ferro,
    sodio,
  }),
);

const POR_CODIGO = new Map(TACO.map((a) => [a.codigoTaco, a]));

export function alimentoPorCodigo(codigo: number | null | undefined): Alimento | undefined {
  if (codigo == null) return undefined;
  return POR_CODIGO.get(codigo);
}
