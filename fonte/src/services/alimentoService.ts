import type { Alimento, GrupoAlimento } from "@/types";
import { alimentoRepository } from "@/repositories";
import { equivalenteNutriente, type ResultadoBusca } from "@/utils/buscaAlimento";
import { NUTRIENTE_BASE_POR_GRUPO } from "@/types";

/**
 * Uso exclusivo do painel (regra #2 — a base TACO nunca é exposta ao
 * paciente). Nenhuma tela/hook do app do paciente deve importar este
 * arquivo.
 */
export async function buscar(consulta: string, limite = 8, grupo: GrupoAlimento | null = null): Promise<ResultadoBusca[]> {
  return alimentoRepository.buscar(consulta, limite, grupo);
}

export async function listarPorGrupo(grupo: GrupoAlimento): Promise<Alimento[]> {
  return alimentoRepository.listarPorGrupo(grupo);
}

export async function contarTotal(): Promise<number> {
  return alimentoRepository.contarTotal();
}

export interface EquivalenciaCalculada {
  alimento: Alimento;
  gramasEquivalentes: number;
  deltaFibraGramas: number;
  deltaKcal: number;
}

/**
 * Calculadora de apoio (Anexo regra #3): só para a nutricionista decidir —
 * o app nunca usa isto para gerar uma troca sozinho. Porte literal de
 * `AbaEquivalencias` do protótipo.
 */
export function calcularEquivalencias(
  de: Alimento,
  gramasDe: number,
  candidatos: Alimento[],
  nutriente?: keyof Alimento,
): EquivalenciaCalculada[] {
  const chave = nutriente ?? NUTRIENTE_BASE_POR_GRUPO[de.grupo];
  return candidatos
    .filter((c) => c.codigoTaco !== de.codigoTaco && c.grupo === de.grupo)
    .map((alimento) => {
      const g = equivalenteNutriente(de, gramasDe, alimento, chave);
      if (g === null) return null;
      const deltaFibraGramas = (alimento.fibra * g) / 100 - (de.fibra * gramasDe) / 100;
      const deltaKcal = (alimento.kcal * g) / 100 - (de.kcal * gramasDe) / 100;
      return { alimento, gramasEquivalentes: g, deltaFibraGramas, deltaKcal };
    })
    .filter((x): x is EquivalenciaCalculada => x !== null);
}
