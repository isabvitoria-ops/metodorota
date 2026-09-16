import type { Material } from "@/types";
import { NUTRICIONISTA_ID } from "./ids";

const agora = "2026-06-01T09:00:00.000Z";

/** Portado do protótipo (constante `MATERIAIS`). */
export const MATERIAIS: Material[] = [
  ["m1", "Guia de Constipação", "Guias"],
  ["m2", "Guia de Marmitas", "Guias"],
  ["m3", "Guia de Supermercado", "Guias"],
  ["m4", "Guia de Refeição Livre", "Guias"],
  ["m5", "Guia de Comida Japonesa", "Guias"],
  ["m6", "Guia do Hambúrguer", "Guias"],
  ["m7", "Receitas do dia a dia", "Receitas"],
  ["m8", "Como aumentar fibras", "Orientações"],
  ["m9", "Suplementação", "Orientações"],
].map(([id, titulo, categoria]) => ({
  id: id!,
  nutricionistaId: NUTRICIONISTA_ID,
  criadoEm: agora,
  atualizadoEm: agora,
  titulo: titulo!,
  categoria: categoria!,
  storagePath: null,
  recomendadoParaPacienteId: [],
}));
