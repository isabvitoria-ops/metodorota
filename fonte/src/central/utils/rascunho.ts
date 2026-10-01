/**
 * Rascunho guardado no aparelho, para a anotação não se perder se a aba
 * fechar, o celular travar ou ela navegar sem querer. Fica só neste navegador
 * (não vai para o banco) e é apagado quando ela salva de verdade.
 *
 * Recebe o "storage" por parâmetro, para poder ser testado sem navegador, e
 * engole os erros: navegação privada e storage bloqueado não podem derrubar a tela.
 */
export interface Guarda {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
  removeItem(chave: string): void;
}

export const chaveDoRascunho = (escopo: string, id: string) => `central:rascunho:${escopo}:${id}:v1`;

export function lerRascunho(guarda: Guarda | null, chave: string): string {
  try {
    return guarda?.getItem(chave) ?? "";
  } catch {
    return "";
  }
}

/** Texto vazio apaga o rascunho: não sobra um "recuperado" de nada. */
export function guardarRascunho(guarda: Guarda | null, chave: string, texto: string): void {
  try {
    if (!guarda) return;
    if (texto.trim()) guarda.setItem(chave, texto);
    else guarda.removeItem(chave);
  } catch {
    /* cota cheia: o rascunho desta vez se perde, a tela não */
  }
}

export function apagarRascunho(guarda: Guarda | null, chave: string): void {
  try {
    guarda?.removeItem(chave);
  } catch {
    /* nada a fazer */
  }
}
