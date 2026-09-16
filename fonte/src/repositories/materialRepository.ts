import type { Material } from "@/types";
import { atraso, db } from "./mockDb";

export async function listarMateriais(): Promise<Material[]> {
  await atraso();
  return db.materiais;
}

export async function listarLiberadosParaPaciente(materiaisLiberadosId: string[]): Promise<Material[]> {
  await atraso();
  const liberados = new Set(materiaisLiberadosId);
  return db.materiais.filter((m) => liberados.has(m.id));
}

export async function alternarLiberacao(pacienteMateriaisId: string[], materialId: string): Promise<string[]> {
  await atraso(150);
  return pacienteMateriaisId.includes(materialId)
    ? pacienteMateriaisId.filter((id) => id !== materialId)
    : [...pacienteMateriaisId, materialId];
}
