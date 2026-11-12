/**
 * Abre a tela de imprimir / salvar em PDF do aparelho.
 *
 * É o `window.print()`, e SÓ ele. Um lugar só para todos os botões de PDF,
 * para que uma mudança aqui seja uma decisão e não oito.
 *
 * NÃO TROQUE POR `document.execCommand("print")`. Foi tentado: no iPhone o
 * comando responde "feito" e não abre tela nenhuma — o `window.print()` de
 * reserva nunca era chamado, e TODOS os PDFs pararam de sair no celular,
 * inclusive os de Meus documentos, que funcionavam.
 *
 * O caminho que funciona no iPhone é o de Meus documentos: montar o
 * documento, esperar dois quadros e chamar `window.print()`. As telas do
 * protocolo e da avaliação não imprimem sozinhas; mandam para lá (ver
 * `pedirPdf`, em Documentos).
 */
export function abrirImpressao(janela: Pick<Window, "print"> = window): void {
  janela.print();
}
