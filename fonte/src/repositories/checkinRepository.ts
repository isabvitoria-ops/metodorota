import type { CheckIn, CheckInRascunho } from "@/types";
import { agoraISO, atraso, db, gerarId } from "./mockDb";

export async function buscarCheckinDoDia(pacienteId: string, data: string): Promise<CheckIn | null> {
  await atraso();
  return db.checkins.find((c) => c.pacienteId === pacienteId && c.data === data) ?? null;
}

export async function listarHistorico(pacienteId: string, dias: number): Promise<CheckIn[]> {
  await atraso();
  return db.checkins
    .filter((c) => c.pacienteId === pacienteId)
    .sort((a, b) => a.data.localeCompare(b.data))
    .slice(-dias);
}

/**
 * Grava local-first (briefing §10): quem chama isto é `services/checkinService`,
 * que já escreveu no IndexedDB antes de tentar a rede. Aqui só existe o
 * "commit" remoto — a chave idempotente evita duplicar se a sincronização
 * rodar duas vezes para o mesmo rascunho.
 */
export async function salvarCheckin(
  nutricionistaId: string,
  rascunho: CheckInRascunho,
  gerouAlertaClinico: boolean,
): Promise<CheckIn> {
  await atraso(350);
  const existenteIdx = db.checkins.findIndex(
    (c) => c.pacienteId === rascunho.pacienteId && c.data === rascunho.data,
  );
  const registro: CheckIn = {
    id: existenteIdx >= 0 ? db.checkins[existenteIdx]!.id : gerarId("checkin"),
    nutricionistaId,
    criadoEm: existenteIdx >= 0 ? db.checkins[existenteIdx]!.criadoEm : agoraISO(),
    atualizadoEm: agoraISO(),
    pacienteId: rascunho.pacienteId,
    data: rascunho.data,
    evacuou: rascunho.evacuou,
    bristol: rascunho.bristol,
    flags: rascunho.flags,
    sintomas: rascunho.sintomas,
    mapaDor: rascunho.mapaDor,
    sono: rascunho.sono,
    movimento: rascunho.movimento,
    humor: rascunho.humor,
    gerouAlertaClinico,
  };
  if (existenteIdx >= 0) db.checkins[existenteIdx] = registro;
  else db.checkins.push(registro);
  return registro;
}
