import { useSessao } from "@/central/autenticacao/SessaoContexto";
import { areaLigada, type ChaveArea } from "@/central/utils/areas";

/** A área está ligada para quem está usando? (ver utils/areas.ts) */
export function useArea(chave: ChaveArea): boolean {
  const { acesso } = useSessao();
  return areaLigada(acesso, chave);
}
