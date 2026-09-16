import type { PoseFoto, SiteMedida } from "@/types";

export const POSES_FOTO: { id: PoseFoto; label: string }[] = [
  { id: "frente", label: "Frente" },
  { id: "lado", label: "Perfil" },
  { id: "costas", label: "Costas" },
  { id: "abdomen", label: "Abdômen" },
];

export const SITES_MEDIDA: [SiteMedida, string][] = [
  ["cintura", "Cintura"],
  ["abdomen", "Abdômen"],
  ["quadril", "Quadril"],
];
