/** Quais passos do tour a paciente vê: os das áreas que ela tem ligadas. */
import type { PassoDoTour } from "@/central/types/tour";
import type { Acesso } from "@/central/types";
import { areaLigada, ehArea } from "@/central/utils/areas";

export function passosVisiveis(passos: PassoDoTour[], acesso: Pick<Acesso, "papel" | "areasDesligadas" | "rastreio">): PassoDoTour[] {
  return passos
    .filter((p) => p.ativo)
    .filter((p) => {
      if (!p.area) return true;
      if (p.area === "rastreio") return acesso.rastreio === true;
      return ehArea(p.area) ? areaLigada(acesso, p.area) : true;
    })
    .sort((a, b) => a.ordem - b.ordem);
}
