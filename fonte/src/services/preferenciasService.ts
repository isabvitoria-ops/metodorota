import type { Consentimento, ConsentimentoRegistro, PreferenciasNotificacao } from "@/types";
import { preferenciasRepository } from "@/repositories";

export async function buscarPreferencias(pacienteId: string): Promise<PreferenciasNotificacao | null> {
  return preferenciasRepository.buscarPreferencias(pacienteId);
}

export async function salvarPreferencias(preferencias: PreferenciasNotificacao): Promise<PreferenciasNotificacao> {
  return preferenciasRepository.salvarPreferencias(preferencias);
}

export async function listarConsentimentos(): Promise<Consentimento[]> {
  return preferenciasRepository.listarConsentimentos();
}

export async function registrarConsentimento(registro: ConsentimentoRegistro): Promise<void> {
  return preferenciasRepository.registrarConsentimento(registro);
}
