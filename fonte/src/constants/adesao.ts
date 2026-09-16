import type { AdesaoId } from "@/types";

export const OPCOES_ADESAO: { id: AdesaoId; label: string; cor: string }[] = [
  { id: "segui", label: "Segui o plano", cor: "#6E8168" },
  { id: "troquei", label: "Troquei algo", cor: "#7E9163" },
  { id: "menos", label: "Comi menos", cor: "#B98B2E" },
  { id: "fora", label: "Comi fora do plano", cor: "#C08540" },
  { id: "pulei", label: "Pulei", cor: "#B0503C" },
];

export function adesaoPorId(id: AdesaoId) {
  return OPCOES_ADESAO.find((a) => a.id === id)!;
}
