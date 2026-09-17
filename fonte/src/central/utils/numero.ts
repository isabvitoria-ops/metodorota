/**
 * Número decimal escrito do jeito daqui — com vírgula.
 *
 * Mora fora do componente de campo porque é aqui que o erro seria caro: se
 * "10,9" virar nulo, um percentual de gordura some do prontuário sem
 * ninguém ver. Regra fora do .tsx é regra que dá para testar.
 */

/** "10,9" e "10.9" viram 10.9. O que não for número vira nulo — nunca zero. */
export function numeroDeTexto(texto: string): number | null {
  const limpo = texto.trim().replace(",", ".");
  if (limpo === "") return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

/** O caminho de volta: 10.9 vira "10,9", nulo vira campo vazio. */
export function textoDeNumero(valor: number | null | undefined): string {
  return valor === null || valor === undefined ? "" : String(valor).replace(".", ",");
}
