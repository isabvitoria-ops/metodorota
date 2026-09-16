import type { Paciente, ResumoAdesaoPaciente } from "@/types";
import { pacienteRepository } from "@/repositories";

export interface PacienteComResumo {
  paciente: Paciente;
  resumo: ResumoAdesaoPaciente | null;
}

export async function listarPacientesComResumo(): Promise<PacienteComResumo[]> {
  const [pacientes, resumos] = await Promise.all([
    pacienteRepository.listarPacientes(),
    pacienteRepository.listarResumosAdesao(),
  ]);
  const resumoPorId = new Map(resumos.map((r) => [r.pacienteId, r]));
  return pacientes.map((paciente) => ({ paciente, resumo: resumoPorId.get(paciente.id) ?? null }));
}

export async function buscarPacientePorId(id: string): Promise<Paciente | null> {
  return pacienteRepository.buscarPacientePorId(id);
}

export async function atualizarPaciente(paciente: Paciente): Promise<Paciente> {
  return pacienteRepository.atualizarPaciente(paciente);
}

/** Regra #8: reversível a qualquer momento, nunca apaga dado. */
export async function definirAcessoAtivo(pacienteId: string, ativo: boolean): Promise<Paciente> {
  return pacienteRepository.definirAcessoAtivo(pacienteId, ativo);
}

export function filtrarPacientes(
  itens: PacienteComResumo[],
  busca: string,
  incluirInativos: boolean,
): PacienteComResumo[] {
  const buscaLower = busca.trim().toLowerCase();
  return itens
    .filter(({ paciente }) => incluirInativos || paciente.ativo)
    .filter(({ paciente }) => paciente.nome.toLowerCase().includes(buscaLower));
}
