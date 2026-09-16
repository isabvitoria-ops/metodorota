import type { ArtigoBiblioteca, Material, SintomaId } from "@/types";
import { bibliotecaRepository, materialRepository } from "@/repositories";

export async function listarMateriais(): Promise<Material[]> {
  return materialRepository.listarMateriais();
}

export async function listarLiberadosParaPaciente(materiaisLiberadosId: string[]): Promise<Material[]> {
  return materialRepository.listarLiberadosParaPaciente(materiaisLiberadosId);
}

export async function alternarLiberacao(materiaisLiberadosId: string[], materialId: string): Promise<string[]> {
  return materialRepository.alternarLiberacao(materiaisLiberadosId, materialId);
}

export async function listarArtigos(): Promise<ArtigoBiblioteca[]> {
  return bibliotecaRepository.listarArtigos();
}

/** "Por causa do que você registrou hoje" (briefing §14 · Biblioteca) — artigos ligados a sintomas do check-in do dia. */
export function artigosSugeridosPorSintomas(artigos: ArtigoBiblioteca[], sintomasRegistrados: SintomaId[]): ArtigoBiblioteca[] {
  if (sintomasRegistrados.length === 0) return [];
  return artigos.filter((a) => a.ligadoASintomas.some((s) => sintomasRegistrados.includes(s)));
}
