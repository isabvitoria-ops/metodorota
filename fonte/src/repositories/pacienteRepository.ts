import type { Paciente, ResumoAdesaoPaciente } from "@/types";
import { agoraISO, atraso, db } from "./mockDb";

/**
 * Uma função por operação, como pede o briefing §8. Hoje lê/escreve em
 * `mockDb`; trocar por Supabase significa reescrever só o corpo destas
 * funções — a assinatura e o retorno (Promise) já são os mesmos.
 */
export async function listarPacientes(): Promise<Paciente[]> {
  await atraso();
  return db.pacientes;
}

export async function buscarPacientePorId(id: string): Promise<Paciente | null> {
  await atraso();
  return db.pacientes.find((p) => p.id === id) ?? null;
}

export async function listarResumosAdesao(): Promise<ResumoAdesaoPaciente[]> {
  await atraso();
  return db.resumosAdesao;
}

export async function atualizarPaciente(paciente: Paciente): Promise<Paciente> {
  await atraso();
  const i = db.pacientes.findIndex((p) => p.id === paciente.id);
  if (i === -1) throw new Error(`Paciente ${paciente.id} não encontrado`);
  const atualizado = { ...paciente, atualizadoEm: agoraISO() };
  db.pacientes[i] = atualizado;
  return atualizado;
}

/** Regra #8: encerrar acesso nunca apaga dado — só alterna `ativo`, reversível a qualquer momento. */
export async function definirAcessoAtivo(pacienteId: string, ativo: boolean): Promise<Paciente> {
  const paciente = await buscarPacientePorId(pacienteId);
  if (!paciente) throw new Error(`Paciente ${pacienteId} não encontrado`);
  return atualizarPaciente({ ...paciente, ativo });
}
