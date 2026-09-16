import type { ItemIndice, ResultadoBusca, SecaoResultados, TipoResultado } from "@/central/types";
import { normalizar, palavras } from "./texto";

/**
 * Busca global (§18) — uma consulta, resultados de todas as áreas.
 *
 * O índice é montado em `data/indiceBusca.ts` a partir dos mesmos cadastros
 * que alimentam as telas; nada é indexado à mão. Toda entrada nova de
 * alimento, categoria ou guia entra na busca sozinha.
 */

const ROTULOS: Record<TipoResultado, string> = {
  ferramenta: "Ferramentas",
  alimento: "Troca inteligente",
  grupo: "Substituições",
  categoria: "Comer fora",
  opcao: "Opções",
  guia: "Guias",
  troca: "Trocas",
};

const ORDEM: TipoResultado[] = ["ferramenta", "alimento", "grupo", "categoria", "opcao", "guia", "troca"];

function pontuar(item: ItemIndice, termos: string[]): number | null {
  const titulo = normalizar(item.titulo);
  const subtitulo = normalizar(item.subtitulo ?? "");
  const chaves = item.palavras.map(normalizar);
  let total = 0;
  for (const termo of termos) {
    if (titulo === termo) total += 10;
    else if (titulo.startsWith(termo)) total += 6;
    else if (titulo.includes(termo)) total += 4;
    else if (chaves.some((p) => p.startsWith(termo))) total += 3;
    else if (chaves.some((p) => p.includes(termo))) total += 2;
    else if (subtitulo.includes(termo)) total += 1;
    else return null; // todo termo digitado precisa aparecer em algum lugar
  }
  return total;
}

export function buscar(indice: ItemIndice[], consulta: string, limitePorSecao = 6): SecaoResultados[] {
  const termos = palavras(consulta);
  if (termos.length === 0) return [];

  const encontrados: ResultadoBusca[] = [];
  for (const item of indice) {
    const pontos = pontuar(item, termos);
    if (pontos !== null) encontrados.push({ ...item, pontos });
  }

  return ORDEM.map((tipo) => ({
    tipo,
    rotulo: ROTULOS[tipo],
    itens: encontrados
      .filter((r) => r.tipo === tipo)
      .sort((a, b) => b.pontos - a.pontos || a.titulo.localeCompare(b.titulo, "pt-BR"))
      .slice(0, limitePorSecao),
  })).filter((secao) => secao.itens.length > 0);
}

export function totalDeResultados(secoes: SecaoResultados[]): number {
  return secoes.reduce((soma, s) => soma + s.itens.length, 0);
}
