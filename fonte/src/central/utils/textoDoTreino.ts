import type { ExercicioPlanejado } from "@/central/types/treino";

/**
 * Séries e repetições em texto: "Working 3×6–8", "3 séries · 8–10 rep.".
 * A tela do treino e o PDF do treino escrevem igual (vieram de
 * EvolucaoTreino.tsx, sem mudança).
 */
export function faixaUnicaEmTexto(f: {
  series: number;
  repMin: number | null;
  repMax: number | null;
  tipo?: string;
  metodo?: string | null;
}): string {
  const partes: string[] = [];
  if (f.tipo) partes.push(f.tipo);
  const rep =
    f.repMin && f.repMax ? `${f.repMin}–${f.repMax}`
    : f.repMax ? `até ${f.repMax}`
    : f.repMin ? `${f.repMin}+`
    : null;
  partes.push(rep ? `${f.series}×${rep}` : `${f.series} séries`);
  if (f.metodo) partes.push(f.metodo);
  return partes.join(" ");
}

export function faixaEmTexto(e: ExercicioPlanejado): string {
  if (e.faixas && e.faixas.length > 0) {
    return e.faixas.map(faixaUnicaEmTexto).join(", ");
  }
  const partes: string[] = [];
  if (e.seriesPlanejadas) partes.push(`${e.seriesPlanejadas} séries`);
  if (e.repeticoesMin && e.repeticoesMax) partes.push(`${e.repeticoesMin}–${e.repeticoesMax} rep.`);
  else if (e.repeticoesMax) partes.push(`até ${e.repeticoesMax} rep.`);
  else if (e.repeticoesMin) partes.push(`${e.repeticoesMin}+ rep.`);
  return partes.join(" · ");
}

/**
 * O endereço do vídeo como link que abre. Ela às vezes cola sem o
 * "https://" ("youtu.be/abc"); sem ele, o link no PDF não abriria nada.
 * Só vai endereço da web.
 */
export function linkDoVideo(url: string | null | undefined): string | null {
  const limpo = (url ?? "").trim();
  if (!limpo) return null;
  const comEsquema = /^[a-z][a-z0-9+.-]*:/i.test(limpo) ? limpo : `https://${limpo.replace(/^\/+/, "")}`;
  try {
    const endereco = new URL(comEsquema);
    return endereco.protocol === "http:" || endereco.protocol === "https:" ? endereco.href : null;
  } catch {
    return null;
  }
}
