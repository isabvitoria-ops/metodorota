import type { Alimento, GrupoAlimento } from "@/types";
import { TACO, alimentoPorCodigo } from "@/data/taco";
import { buscarAlimentos, type ResultadoBusca } from "@/utils/buscaAlimento";
import { atraso } from "./mockDb";

/**
 * A base TACO inteira é uso interno (regra #2) — este repository só deve
 * ser importado por código do painel da nutricionista (`alimentoService`).
 * Conteúdo seguro para o paciente (ficha educativa, pool do montador) vive
 * em `fichaAlimentoRepository.ts`, que não importa `@/data/taco`.
 */
export async function buscar(consulta: string, limite = 8, grupo: GrupoAlimento | null = null): Promise<ResultadoBusca[]> {
  await atraso(120);
  return buscarAlimentos(TACO, consulta, limite, grupo);
}

export async function listarPorGrupo(grupo: GrupoAlimento, limite = 200): Promise<Alimento[]> {
  await atraso();
  return TACO.filter((a) => a.grupo === grupo).slice(0, limite);
}

export async function porCodigo(codigo: number): Promise<Alimento | null> {
  await atraso();
  return alimentoPorCodigo(codigo) ?? null;
}

export async function contarTotal(): Promise<number> {
  return TACO.length;
}
