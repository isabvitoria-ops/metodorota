/**
 * "Abra Meus documentos e já gere este PDF."
 *
 * As telas do protocolo e da avaliação têm um botão "Baixar em PDF", mas não
 * geram o PDF elas mesmas: no iPhone a tela de salvar só abre a partir de
 * Meus documentos. O botão navega para lá levando este pedido no estado da
 * navegação, e Meus documentos o cumpre uma vez.
 *
 * Fica no estado da navegação, e não no endereço: um link copiado ou a tela
 * recarregada não devem abrir a tela de imprimir sozinhos.
 */
export type DocumentoEmPdf = "protocolo" | "avaliacao" | "rastreio";

const DOCUMENTOS: DocumentoEmPdf[] = ["protocolo", "avaliacao", "rastreio"];

export function pedirPdf(qual: DocumentoEmPdf): { gerarPdf: DocumentoEmPdf } {
  return { gerarPdf: qual };
}

/** Lê o pedido do estado da navegação; qualquer coisa estranha é "sem pedido". */
export function pedidoDePdf(estado: unknown): DocumentoEmPdf | null {
  if (typeof estado !== "object" || estado === null) return null;
  const qual = (estado as { gerarPdf?: unknown }).gerarPdf;
  return DOCUMENTOS.includes(qual as DocumentoEmPdf) ? (qual as DocumentoEmPdf) : null;
}
