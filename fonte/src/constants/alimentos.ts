import type { GrupoAlimento } from "@/types";

export const NOME_GRUPO: Record<GrupoAlimento, string> = {
  carb: "Carboidratos",
  prot: "Proteínas",
  laticinio: "Leite e derivados",
  legum: "Leguminosas",
  fruta: "Frutas",
  vegetal: "Verduras",
  gordura: "Gorduras",
  outros: "Outros",
};

/** Rótulo curto usado no montador de refeições do paciente (POOL do protótipo). */
export const NOME_GRUPO_CURTO: Partial<Record<GrupoAlimento, string>> = {
  carb: "Energia",
  prot: "Proteína",
  legum: "Leguminosa",
  fruta: "Fruta",
  vegetal: "Vegetais",
  gordura: "Gordura",
};

export const NUTRIENTES_EQUIVALENCIA: [keyof import("@/types").Alimento, string][] = [
  ["carboidrato", "Carboidrato"],
  ["proteina", "Proteína"],
  ["lipideos", "Gordura"],
  ["kcal", "Energia"],
];
