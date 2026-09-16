import type { Consentimento, ConsentimentoRegistro, PreferenciasNotificacao } from "@/types";
import { atraso, db } from "./mockDb";

export async function buscarPreferencias(pacienteId: string): Promise<PreferenciasNotificacao | null> {
  await atraso();
  return db.preferencias[pacienteId] ?? null;
}

export async function salvarPreferencias(preferencias: PreferenciasNotificacao): Promise<PreferenciasNotificacao> {
  await atraso(200);
  db.preferencias[preferencias.pacienteId] = preferencias;
  return preferencias;
}

export async function listarConsentimentos(): Promise<Consentimento[]> {
  await atraso();
  return db.consentimentos;
}

const registrosConsentimento: ConsentimentoRegistro[] = [];

export async function registrarConsentimento(registro: ConsentimentoRegistro): Promise<void> {
  await atraso(150);
  registrosConsentimento.push(registro);
}
