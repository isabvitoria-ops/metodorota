/**
 * Escreve um arquivo PDF a partir de páginas já desenhadas (uma imagem JPEG
 * por página).
 *
 * POR QUE ISTO EXISTE. O "Salvar em PDF" do aplicativo dependia da tela de
 * imprimir do aparelho (`window.print()`). No iPhone, com o app instalado na
 * tela inicial, essa tela não existe: o toque não fazia nada, em tela
 * nenhuma. A saída é o aplicativo montar o arquivo ele mesmo e entregá-lo
 * pela tela de compartilhar do aparelho.
 *
 * POR QUE À MÃO, E NÃO UMA BIBLIOTECA DE PDF. Um PDF de páginas-imagem é um
 * formato pequeno: catálogo, lista de páginas e, para cada uma, a imagem e
 * uma linha mandando desenhá-la na folha inteira. Uma biblioteca traria
 * centenas de kilobytes para escrever estas sessenta linhas.
 *
 * O PDF guarda o JPEG como ele é (`/DCTDecode`): nada é recomprimido.
 */
export interface PaginaDoPdf {
  /** Os bytes do JPEG. */
  jpeg: Uint8Array;
  /** Tamanho da imagem, em pixels. */
  largura: number;
  altura: number;
}

/** A4 em pontos (1 pt = 1/72 pol). */
export const A4_PT = { largura: 595.28, altura: 841.89 };

const codificador = new TextEncoder();

/**
 * Texto do PDF com acento: em UTF-16, escrito em hexadecimal.
 *
 * É a forma que o formato tem de guardar "Avaliação Física — Ana" sem
 * trocar letra nenhuma; o `FEFF` da frente avisa o leitor da codificação.
 */
function textoPdf(texto: string): string {
  let hex = "FEFF";
  for (let i = 0; i < texto.length; i += 1) hex += texto.charCodeAt(i).toString(16).toUpperCase().padStart(4, "0");
  return `<${hex}>`;
}

export function escreverPdf(paginas: PaginaDoPdf[], titulo: string): Uint8Array {
  if (paginas.length === 0) throw new Error("PDF sem páginas.");

  const pedacos: Uint8Array[] = [];
  const inicioDe: number[] = []; // deslocamento de cada objeto, pelo número
  let tamanho = 0;
  const escrever = (dado: string | Uint8Array) => {
    const bytes = typeof dado === "string" ? codificador.encode(dado) : dado;
    pedacos.push(bytes);
    tamanho += bytes.length;
  };
  const abrir = (numero: number) => {
    inicioDe[numero] = tamanho;
    escrever(`${numero} 0 obj\n`);
  };

  // Numeração: 1 catálogo, 2 páginas, 3 informações; depois três por página
  // (a página, o conteúdo dela, a imagem).
  const numeroDaPagina = (i: number) => 4 + i * 3;
  const total = 3 + paginas.length * 3;

  // O comentário binário avisa aos leitores que o arquivo tem bytes "altos".
  escrever("%PDF-1.4\n");
  escrever(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  abrir(1);
  escrever("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  abrir(2);
  escrever(
    `<< /Type /Pages /Count ${paginas.length} /Kids [${paginas.map((_, i) => `${numeroDaPagina(i)} 0 R`).join(" ")}] >>\nendobj\n`,
  );

  abrir(3);
  escrever(`<< /Title ${textoPdf(titulo)} /Producer (Central do Paciente) >>\nendobj\n`);

  paginas.forEach((pagina, i) => {
    const n = numeroDaPagina(i);
    const desenho = `q ${A4_PT.largura} 0 0 ${A4_PT.altura} 0 0 cm /Im0 Do Q\n`;

    abrir(n);
    escrever(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_PT.largura} ${A4_PT.altura}] ` +
        `/Resources << /XObject << /Im0 ${n + 2} 0 R >> >> /Contents ${n + 1} 0 R >>\nendobj\n`,
    );

    abrir(n + 1);
    escrever(`<< /Length ${desenho.length} >>\nstream\n${desenho}endstream\nendobj\n`);

    abrir(n + 2);
    escrever(
      `<< /Type /XObject /Subtype /Image /Width ${pagina.largura} /Height ${pagina.altura} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${pagina.jpeg.length} >>\nstream\n`,
    );
    escrever(pagina.jpeg);
    escrever("\nendstream\nendobj\n");
  });

  // A tabela de endereços: cada linha tem exatamente 20 bytes.
  const inicioDaTabela = tamanho;
  escrever(`xref\n0 ${total + 1}\n0000000000 65535 f \n`);
  for (let numero = 1; numero <= total; numero += 1) {
    escrever(`${String(inicioDe[numero]).padStart(10, "0")} 00000 n \n`);
  }
  escrever(`trailer\n<< /Size ${total + 1} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${inicioDaTabela}\n%%EOF\n`);

  const arquivo = new Uint8Array(tamanho);
  let posicao = 0;
  for (const pedaco of pedacos) {
    arquivo.set(pedaco, posicao);
    posicao += pedaco.length;
  }
  return arquivo;
}
