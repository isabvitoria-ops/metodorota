import { mfaRepository } from "@/repositories";
import { atraso } from "@/repositories/mockDb";

export async function precisaMfa(deviceId: string): Promise<boolean> {
  const confiavel = await mfaRepository.dispositivoEhConfiavel(deviceId);
  return !confiavel;
}

/**
 * Verificação de código — em produção isto chama Supabase Auth MFA
 * (TOTP/SMS). Mock: aceita qualquer código de 6 dígitos, só para validar o
 * fluxo de tela (passo obrigatório, "confiar neste dispositivo" opcional).
 */
export async function verificarCodigo(codigo: string): Promise<boolean> {
  await atraso(400);
  return /^\d{6}$/.test(codigo);
}

export async function confiarDispositivo(deviceId: string): Promise<void> {
  return mfaRepository.confiarDispositivo(deviceId);
}
