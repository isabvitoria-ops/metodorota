/**
 * As restrições da paciente na Troca inteligente (0105, aprovado em
 * 23/11/2026). Puras e testadas.
 *   alergia: some da lista; intolerância e sensibilidade: aviso;
 *   preferência: vai para o fim.
 */
import type { AlimentoRestrito } from "@/central/types/restricao";

const PESO = { alergia: 3, intolerancia: 2, sensibilidade: 2, preferencia: 1 } as const;

/** A restrição mais forte de cada alimento (alergia ganha de tudo). */
export function restricaoPorAlimento(restritos: AlimentoRestrito[]): Map<string, AlimentoRestrito> {
  const mapa = new Map<string, AlimentoRestrito>();
  for (const r of restritos) {
    const atual = mapa.get(r.alimentoId);
    if (!atual || PESO[r.tipo] > PESO[atual.tipo] || (PESO[r.tipo] === PESO[atual.tipo] && r.origem === "rastreio"))
      mapa.set(r.alimentoId, r);
  }
  return mapa;
}

/**
 * Tira o que é alergia e põe a preferência no fim, mantendo a ordem do resto.
 * Devolve também quantos ficaram escondidos (para a frase da tela).
 */
export function aplicarRestricoes<T extends { id: string }>(
  lista: T[],
  porAlimento: Map<string, AlimentoRestrito>,
): { lista: T[]; escondidas: number } {
  const semAlergia = lista.filter((a) => porAlimento.get(a.id)?.tipo !== "alergia");
  const preferencia = (a: T) => porAlimento.get(a.id)?.tipo === "preferencia";
  return {
    lista: [...semAlergia.filter((a) => !preferencia(a)), ...semAlergia.filter(preferencia)],
    escondidas: lista.length - semAlergia.length,
  };
}

/** O aviso ao lado do alimento. Nulo: sem aviso. */
export function avisoDaRestricao(r: AlimentoRestrito | undefined): string | null {
  if (!r || r.tipo === "alergia" || r.tipo === "preferencia") return null;
  if (r.origem === "rastreio") return "Você não se sentiu bem no teste";
  return r.tipo === "intolerancia" ? "Intolerância" : "Sensibilidade";
}

export function fraseDasEscondidas(n: number): string | null {
  if (n <= 0) return null;
  return n === 1
    ? "1 opção escondida porque você tem alergia cadastrada."
    : `${n} opções escondidas porque você tem alergia cadastrada.`;
}
