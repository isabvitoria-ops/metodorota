/**
 * Dados de contato que saem no rodapé de todo PDF.
 *
 * Vêm dos PDFs que a própria Isabela já distribui (a Rota da Regulação
 * Intestinal): CRN-9 37597, @belamarcall e (31) 99450-3318. Não foram
 * inventados aqui. O nome vem da configuração do aplicativo.
 */
export const CRN_DA_NUTRICIONISTA = "CRN-9 37597";
export const INSTAGRAM_DA_MARCA = "@belamarcall";
export const TELEFONE_DA_MARCA = "(31) 99450-3318";

/** Texto para dentro de `content: "..."` do CSS: aspas, barra e quebra de linha escapadas. */
export function paraConteudoCss(texto: string): string {
  return texto.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\A ");
}
