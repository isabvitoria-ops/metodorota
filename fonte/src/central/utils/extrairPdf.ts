/**
 * Extração de texto de PDF, feita no NAVEGADOR.
 *
 * O PDF vai para o balde já para leitura futura, e o texto extraído
 * segue junto pela função `registrar_fonte` — assim o banco tem os dois:
 * o arquivo original e o conteúdo pesquisável. Fazer isso do lado do
 * cliente evita rodar pdfjs num edge function (caro e lento), e mantém a
 * privacidade: o PDF não passa por um serviço nosso, ele viaja direto do
 * navegador dela para o balde.
 *
 * pdfjs-dist é carregado sob demanda para não pesar no bundle inicial da
 * Área da nutri.
 */

/**
 * Extrai o texto de um PDF. Se o PDF for escaneado (só imagem), o
 * retorno é uma string vazia — sem OCR, e a tela avisa.
 */
export async function extrairTextoDoPdf(arquivo: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // pdfjs precisa de um worker separado. O `.mjs` é o formato ESM.
  const url = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  pdfjs.GlobalWorkerOptions.workerSrc = url;

  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const doc = await pdfjs.getDocument({ data: bytes }).promise;

  const paginas: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const p = await doc.getPage(i);
    const conteudo = await p.getTextContent();
    // `str` em cada item é a linha. Separo por espaço e deixo a
    // higienização (juntar hífen-quebrado, colapsar espaço) para a
    // função de trechos, para não duplicar regra em dois lugares.
    const texto = conteudo.items
      .map((item: unknown) => (typeof item === "object" && item && "str" in item
        ? String((item as { str: unknown }).str)
        : ""))
      .join(" ");
    paginas.push(texto);
  }

  // Separa páginas com formfeed — a função `normalizarTexto` do módulo
  // dos trechos entende essa quebra como fronteira dura.
  return paginas.join("\f");
}
