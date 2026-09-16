import type { FichaEducativaAlimento, ItemMontador } from "@/types";
import { fichaAlimentoRepository } from "@/repositories";

/**
 * Único ponto de acesso a conteúdo de alimento seguro para o paciente
 * (regra #1/#2) — hooks e telas do app do paciente importam este arquivo,
 * nunca `alimentoService`/`alimentoRepository`.
 */
export async function buscarFicha(codigo: number): Promise<FichaEducativaAlimento | null> {
  return fichaAlimentoRepository.buscarFicha(codigo);
}

export async function buscarPoolMontador(pacienteId: string): Promise<ItemMontador[]> {
  return fichaAlimentoRepository.buscarPoolMontador(pacienteId);
}
