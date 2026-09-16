import type { FichaEducativaAlimento, ItemMontador } from "@/types";
import { atraso, db } from "./mockDb";

/**
 * Conteúdo seguro para o paciente: nome, tags, texto educativo, dicas de
 * preparo — nunca um valor nutricional numérico (regra #1). Nunca importa
 * `@/data/taco`, ao contrário de `alimentoRepository.ts` (uso exclusivo da
 * nutricionista, regra #2).
 */
export async function buscarFicha(codigo: number): Promise<FichaEducativaAlimento | null> {
  await atraso();
  return db.fichasAlimento.find((f) => f.alimentoCodigoTaco === codigo) ?? null;
}

export async function buscarPoolMontador(pacienteId: string): Promise<ItemMontador[]> {
  await atraso();
  return db.montadorPools[pacienteId] ?? [];
}
