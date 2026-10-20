export type PoseEvolucao = "frente" | "lado" | "costas" | "abdomen";

export interface FotoEvolucao {
  id: string;
  data: string;
  pose: PoseEvolucao;
  caminho: string;
  criadoEm: string;
}

export interface SessaoEvolucao {
  data: string;
  fotos: FotoEvolucao[];
}

export const POSES: { id: PoseEvolucao; rotulo: string }[] = [
  { id: "frente", rotulo: "Frente" },
  { id: "lado", rotulo: "Perfil" },
  { id: "costas", rotulo: "Costas" },
  { id: "abdomen", rotulo: "Abdômen" },
];
