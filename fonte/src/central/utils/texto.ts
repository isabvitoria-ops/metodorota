/** Remove acentos e caixa — a busca precisa achar "abóbora" digitando "abobora". */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Quebra em palavras pesquisáveis, descartando ruído de pontuação. */
export function palavras(texto: string): string[] {
  return normalizar(texto)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

const FORMATADOR = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/** 72 → "72"; 71.5 → "71,5". Vírgula decimal, como se escreve em português. */
export function numero(valor: number): string {
  return FORMATADOR.format(valor);
}
