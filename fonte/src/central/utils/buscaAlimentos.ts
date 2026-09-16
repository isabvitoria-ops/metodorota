import type { Alimento } from "@/central/types";
import { normalizar, palavras } from "./texto";

/**
 * Autocomplete dos campos de alimento da calculadora.
 *
 * Regras: acha sem acento, acha por pedaço de palavra ("maca" → macarrão) e
 * também pelas `tags` do cadastro ("massa" → macarrão). Casar no começo do
 * nome vale mais que casar no meio, e nome curto desempata na frente, para
 * que "arroz" não devolva primeiro um item que só menciona arroz de passagem.
 */
export function buscarAlimentos(base: Alimento[], consulta: string, limite = 8): Alimento[] {
  const termos = palavras(consulta);
  if (termos.length === 0) return base.slice(0, limite);

  const pontuados = base
    .map((alimento) => {
      const nome = normalizar(alimento.nome);
      const tags = alimento.tags.map(normalizar);
      let pontos = 0;
      for (const termo of termos) {
        if (nome.startsWith(termo)) pontos += 4;
        else if (nome.includes(termo)) pontos += 2;
        else if (tags.some((t) => t.startsWith(termo))) pontos += 2;
        else if (tags.some((t) => t.includes(termo))) pontos += 1;
        else return null;
      }
      return { alimento, pontos: pontos - alimento.nome.length * 0.01 };
    })
    .filter((x): x is { alimento: Alimento; pontos: number } => x !== null);

  return pontuados
    .sort((a, b) => b.pontos - a.pontos || a.alimento.nome.localeCompare(b.alimento.nome, "pt-BR"))
    .slice(0, limite)
    .map((x) => x.alimento);
}
