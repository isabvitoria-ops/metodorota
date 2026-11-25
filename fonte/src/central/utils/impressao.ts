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
  margemDentroDaFolha();
  janela.print();
}

/**
 * A margem dos lados mora DENTRO do documento na hora de imprimir.
 *
 * O Chrome guarda a última escolha de "Margens" da tela de imprimir. Com
 * "Nenhuma", ele ignora a margem do `@page` e o plano alimentar saía colado
 * na borda do papel, com o nome da paciente e a coluna da direita cortados.
 * Com os 15 mm dos lados como recuo da própria folha, o documento sai igual
 * em "Padrão" e em "Nenhuma".
 *
 * Só vale enquanto a tela de imprimir está aberta e só quando há um
 * documento (`.folha-documento`): o "Baixar em PDF" desenha a folha com as
 * próprias medidas (gerarPdfDoDocumento) e não pode ganhar margem dobrada.
 */
const ID_DA_MARGEM = "margem-dentro-da-folha";

function margemDentroDaFolha(): void {
  if (typeof document === "undefined" || !document.querySelector(".folha-documento")) return;
  if (document.getElementById(ID_DA_MARGEM)) return;
  const estilo = document.createElement("style");
  estilo.id = ID_DA_MARGEM;
  estilo.textContent = `@page {
    margin-left: 0;
    margin-right: 0;
    @bottom-left { padding-left: 15mm; }
    @bottom-right { padding-right: 15mm; }
  }
  @media print {
    .folha-documento { box-sizing: border-box; padding-left: 15mm !important; padding-right: 15mm !important; }
  }`;
  document.head.appendChild(estilo);
  let prazo = 0;
  const tirar = () => {
    window.removeEventListener("afterprint", tirar);
    window.clearTimeout(prazo);
    estilo.remove();
  };
  window.addEventListener("afterprint", tirar);
  prazo = window.setTimeout(tirar, 60_000);
}
