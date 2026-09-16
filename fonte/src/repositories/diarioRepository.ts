import type { AdesaoId, RegistroDiario } from "@/types";
import { agoraISO, atraso, db, gerarId } from "./mockDb";

export async function listarRegistrosDoDia(pacienteId: string, data: string): Promise<RegistroDiario[]> {
  await atraso();
  return db.registrosDiario.filter((r) => r.pacienteId === pacienteId && r.data === data);
}

export async function salvarRegistro(
  nutricionistaId: string,
  pacienteId: string,
  refeicaoId: string,
  data: string,
  adesao: AdesaoId,
  nota: string | undefined,
  fotoUrl: string | undefined,
): Promise<RegistroDiario> {
  await atraso(280);
  const idx = db.registrosDiario.findIndex(
    (r) => r.pacienteId === pacienteId && r.refeicaoId === refeicaoId && r.data === data,
  );
  const registro: RegistroDiario = {
    id: idx >= 0 ? db.registrosDiario[idx]!.id : gerarId("diario"),
    nutricionistaId,
    criadoEm: idx >= 0 ? db.registrosDiario[idx]!.criadoEm : agoraISO(),
    atualizadoEm: agoraISO(),
    pacienteId,
    refeicaoId,
    data,
    adesao,
    nota,
    fotoUrl,
  };
  if (idx >= 0) db.registrosDiario[idx] = registro;
  else db.registrosDiario.push(registro);
  return registro;
}
