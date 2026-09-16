import type { CheckIn, CheckInRascunho } from "@/types";
import { checkinRepository } from "@/repositories";
import { salvarComFilaOffline } from "./checkinSyncService";

export async function buscarCheckinDoDia(pacienteId: string, data: string): Promise<CheckIn | null> {
  return checkinRepository.buscarCheckinDoDia(pacienteId, data);
}

export async function buscarHistorico(pacienteId: string, dias = 14): Promise<CheckIn[]> {
  return checkinRepository.listarHistorico(pacienteId, dias);
}

/**
 * Ponto único de gravação de check-in — grava local primeiro (briefing
 * §10) e tenta sincronizar na hora. `pendente: true` significa "salvo no
 * aparelho, ainda não confirmado no servidor" — a tela nunca deve tratar
 * isso como erro, só como "conexão vai resolver sozinha depois".
 */
export async function salvarCheckin(
  nutricionistaId: string,
  rascunho: CheckInRascunho,
): Promise<{ checkin: CheckIn | null; pendente: boolean; avisoSangue: boolean }> {
  return salvarComFilaOffline(nutricionistaId, rascunho);
}
