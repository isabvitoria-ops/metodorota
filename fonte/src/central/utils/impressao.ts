/**
 * Abre a tela de imprimir / salvar em PDF do aparelho.
 *
 * POR QUE NÃO É SÓ `window.print()`: no Safari (iPhone, iPad e Mac), o
 * `window.print()` chamado enquanto a página ainda está baixando QUALQUER
 * coisa — uma foto de alimento, uma consulta ao banco — não abre nada. O
 * navegador guarda o pedido "para quando terminar de carregar", e esse
 * momento não chega de novo depois que a página já abriu. O toque some sem
 * erro e sem aviso.
 *
 * Foi o defeito do "Baixar em PDF" na tela do protocolo: ela tem as fotos
 * dos alimentos carregando, e a tela de Documentos não tem — por isso lá
 * funcionava e aqui não, com o mesmo documento.
 *
 * O comando de edição "print" pede a mesma tela por outro caminho, que não
 * tem essa espera. Onde ele não existe (Firefox), devolve `false` e o
 * `window.print()` de sempre assume.
 */
export function abrirImpressao(
  alvo: { documento: Pick<Document, "execCommand">; janela: Pick<Window, "print"> } = {
    documento: document,
    janela: window,
  },
): void {
  let abriu = false;
  try {
    abriu = alvo.documento.execCommand("print", false) === true;
  } catch {
    abriu = false;
  }
  if (!abriu) alvo.janela.print();
}
