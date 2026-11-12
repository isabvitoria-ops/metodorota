import html2canvas from "html2canvas";
import logoUrl from "@/central/marca/isabela-marcal.svg";
import { cortesDePagina, type FatiaDePagina } from "./cortesDePagina";
import { escreverPdf, type PaginaDoPdf } from "./escreverPdf";

/**
 * Transforma o documento que está montado na página (`.folha-documento`) num
 * arquivo PDF de verdade.
 *
 * COMO: o documento é copiado para uma moldura fora da tela, com as regras
 * de impressão valendo como regras normais; mede-se onde cortar as folhas;
 * cada folha é desenhada numa imagem (com a logo no alto e o rodapé) e as
 * imagens viram as páginas do PDF.
 *
 * As medidas são as da folha impressa (`@page` em documentos-marca.css):
 * A4, 15 mm nas laterais, 26 mm em cima (15 mm na capa) e 27 mm embaixo.
 * No iPhone a impressão nunca desenhou a logo e o rodapé da margem; aqui
 * eles saem em todo aparelho, porque quem desenha é o aplicativo.
 */
const MM = 96 / 25.4; // pixels por milímetro
const FOLHA = { largura: 210 * MM, altura: 297 * MM };
const MARGEM = { lateral: 15 * MM, topo: 26 * MM, topoDaCapa: 15 * MM, base: 27 * MM };
const FUNDO = "#f7eee7";
const TINTA = "#38546c";
/** Dois pixels de imagem por pixel de tela: texto nítido sem arquivo gigante. */
const ESCALA = 2;

export interface PedidoDePdf {
  /** O elemento `.folha-documento` já montado. */
  folha: HTMLElement;
  /** "Protocolo Alimentar — Ana": vai no centro do rodapé e no título do arquivo. */
  titulo: string;
  /** As duas linhas do canto esquerdo do rodapé. */
  assinatura: string[];
  aoAvancar?: (pagina: number, total: number) => void;
}

/**
 * As regras de CSS da página, com as de impressão valendo sempre.
 *
 * O documento só existe "no papel": na tela ele é `display: none`, e todo o
 * desenho dele mora dentro de `@media print`. Para desenhá-lo sem a tela de
 * imprimir, essas regras saem de dentro do `@media` e viram regras comuns
 * (só dentro da moldura, que não tem mais nada).
 */
function regrasComImpressao(doc: Document): string {
  const partes: string[] = [];
  for (const folha of Array.from(doc.styleSheets)) {
    let regras: CSSRuleList;
    try {
      regras = folha.cssRules;
    } catch {
      continue; // folha de outro site: não dá para ler, e não é nossa
    }
    for (const regra of Array.from(regras)) {
      if (regra instanceof CSSMediaRule) {
        const midia = regra.conditionText ?? regra.media.mediaText;
        if (/\bprint\b/.test(midia)) {
          for (const interna of Array.from(regra.cssRules)) partes.push(interna.cssText);
        } else {
          partes.push(regra.cssText);
        }
      } else if (regra.constructor.name === "CSSPageRule") {
        continue; // a folha quem desenha é este arquivo
      } else {
        partes.push(regra.cssText);
      }
    }
  }
  return partes.join("\n");
}

function esperarImagens(doc: Document, prazoMs = 8000): Promise<void> {
  const pendentes = Array.from(doc.images).filter((i) => !i.complete);
  if (pendentes.length === 0) return Promise.resolve();
  return new Promise((resolver) => {
    let faltam = pendentes.length;
    const pronto = () => {
      faltam -= 1;
      if (faltam <= 0) resolver();
    };
    for (const imagem of pendentes) {
      imagem.addEventListener("load", pronto, { once: true });
      imagem.addEventListener("error", pronto, { once: true });
    }
    // Foto que não chega não segura o documento: ele sai sem ela.
    window.setTimeout(resolver, prazoMs);
  });
}

function carregarImagem(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolver) => {
    const imagem = new Image();
    imagem.onload = () => resolver(imagem);
    imagem.onerror = () => resolver(null);
    imagem.src = url;
  });
}

/**
 * Troca as imagens em SVG (a logo da capa) por uma cópia em PNG.
 *
 * Quem desenha as folhas recorta o SVG pelo tamanho original do arquivo, e
 * não pelo tamanho em que ele aparece: a logo da capa saía em pedaços. Em
 * PNG, já no tamanho certo, ela sai inteira. O arquivo da logo não muda —
 * é só a cópia que vai para o papel.
 */
async function svgParaPng(doc: Document): Promise<void> {
  const imagens = Array.from(doc.images).filter(
    (i) => /^data:image\/svg|\.svg(\?|#|$)/i.test(i.currentSrc || i.src) && i.naturalWidth > 0,
  );
  await Promise.all(
    imagens.map(async (imagem) => {
      const caixa = imagem.getBoundingClientRect();
      if (caixa.width === 0 || caixa.height === 0) return;
      const tela = doc.createElement("canvas");
      tela.width = Math.round(caixa.width * 4);
      tela.height = Math.round(caixa.height * 4);
      try {
        tela.getContext("2d")!.drawImage(imagem, 0, 0, tela.width, tela.height);
        const png = tela.toDataURL("image/png");
        // Fixar o tamanho antes de trocar: o PNG é quatro vezes maior.
        imagem.style.width = `${caixa.width}px`;
        imagem.style.height = `${caixa.height}px`;
        await new Promise<void>((pronto) => {
          imagem.addEventListener("load", () => pronto(), { once: true });
          imagem.addEventListener("error", () => pronto(), { once: true });
          imagem.src = png;
        });
      } catch {
        /* não deu para copiar: fica o SVG, como estava */
      }
    }),
  );
}

/** O que não pode ser partido entre duas folhas, e onde a folha tem de virar. */
function medir(corpo: HTMLElement): { inteiros: [number, number][]; quebrasForcadas: number[] } {
  const origem = corpo.getBoundingClientRect().top;
  const inteiros: [number, number][] = [];
  const quebrasForcadas: number[] = [];
  const visao = corpo.ownerDocument.defaultView!;

  for (const el of Array.from(corpo.querySelectorAll<HTMLElement>("*"))) {
    const caixa = el.getBoundingClientRect();
    if (caixa.height === 0) continue;
    const topo = caixa.top - origem;
    const base = caixa.bottom - origem;
    const estilo = visao.getComputedStyle(el);

    if (estilo.breakAfter === "page" || estilo.breakAfter === "always") quebrasForcadas.push(base);
    if (estilo.breakBefore === "page" || estilo.breakBefore === "always") quebrasForcadas.push(topo);

    const marca = el.tagName;
    const semFilhos = el.children.length === 0 && (el.textContent ?? "").trim() !== "";
    const linhaOuFigura = /^(TR|LI|P|H[1-6]|DT|DD|IMG|SVG|FIGURE|THEAD)$/i.test(marca);
    if (estilo.breakInside === "avoid" || linhaOuFigura || semFilhos) inteiros.push([topo, base]);

    // Título não fica sozinho no pé da folha: anda junto do começo do que vem depois.
    if (estilo.breakAfter === "avoid" || /^H[1-6]$/.test(marca)) {
      const seguinte = el.nextElementSibling?.getBoundingClientRect();
      if (seguinte && seguinte.height > 0) {
        inteiros.push([topo, seguinte.top - origem + Math.min(seguinte.height, 70)]);
      }
    }
  }
  return { inteiros, quebrasForcadas };
}

function paraJpeg(tela: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolver, rejeitar) => {
    tela.toBlob(
      (blob) => {
        if (!blob) return rejeitar(new Error("O aparelho não conseguiu desenhar a página."));
        void blob.arrayBuffer().then((b) => resolver(new Uint8Array(b)), rejeitar);
      },
      "image/jpeg",
      0.9,
    );
  });
}

/** A folha inteira: fundo, logo no alto (menos na capa), o trecho do documento e o rodapé. */
function comporFolha(
  trecho: HTMLCanvasElement,
  fatia: FatiaDePagina,
  numero: number,
  total: number,
  pedido: PedidoDePdf,
  logo: HTMLImageElement | null,
): HTMLCanvasElement {
  const tela = document.createElement("canvas");
  tela.width = Math.round(FOLHA.largura * ESCALA);
  tela.height = Math.round(FOLHA.altura * ESCALA);
  const c = tela.getContext("2d")!;
  c.fillStyle = FUNDO;
  c.fillRect(0, 0, tela.width, tela.height);
  c.scale(ESCALA, ESCALA);

  const capa = numero === 1;
  const topo = capa ? MARGEM.topoDaCapa : MARGEM.topo;
  c.drawImage(trecho, MARGEM.lateral, topo, FOLHA.largura - 2 * MARGEM.lateral, fatia.fim - fatia.inicio);

  if (!capa && logo && logo.naturalHeight > 0) {
    const altura = 9 * MM;
    const largura = (logo.naturalWidth / logo.naturalHeight) * altura;
    c.drawImage(logo, (FOLHA.largura - largura) / 2, 10 * MM, largura, altura);
  }

  // O rodapé das caixas de margem: 8 pt, 7 mm abaixo do fim do texto.
  const linha = (8 * 96) / 72;
  const y = FOLHA.altura - MARGEM.base + 7 * MM;
  c.fillStyle = TINTA;
  c.font = `${linha}px "Lato", system-ui, sans-serif`;
  c.textBaseline = "top";
  c.textAlign = "left";
  pedido.assinatura.forEach((texto, i) => c.fillText(texto, MARGEM.lateral, y + i * linha * 1.4));
  c.textAlign = "center";
  c.fillText(pedido.titulo, FOLHA.largura / 2, y, FOLHA.largura - 2 * MARGEM.lateral - 250);
  c.textAlign = "right";
  c.fillText(`Página ${numero} de ${total}`, FOLHA.largura - MARGEM.lateral, y);
  return tela;
}

export async function gerarPdfDoDocumento(pedido: PedidoDePdf): Promise<Blob> {
  const larguraUtil = FOLHA.largura - 2 * MARGEM.lateral;

  // A moldura: fora da vista, mas desenhada de verdade (com `display: none`
  // nada teria tamanho para medir).
  const moldura = document.createElement("iframe");
  moldura.setAttribute("aria-hidden", "true");
  moldura.tabIndex = -1;
  moldura.style.cssText = `position:fixed;left:-10000px;top:0;width:${larguraUtil}px;height:${FOLHA.altura}px;border:0;opacity:0;pointer-events:none;`;
  document.body.appendChild(moldura);

  try {
    const doc = moldura.contentDocument;
    if (!doc) throw new Error("Não consegui preparar o documento.");
    doc.open();
    doc.write('<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"></head><body></body></html>');
    doc.close();

    const estilo = doc.createElement("style");
    estilo.textContent =
      regrasComImpressao(document) +
      // Por último, para ganhar de tudo: a moldura é só a folha.
      `\nhtml, body { margin: 0 !important; padding: 0 !important; width: ${larguraUtil}px !important;` +
      ` min-height: 0 !important; height: auto !important; overflow: visible !important; background: ${FUNDO} !important; }` +
      `\n.folha-documento { display: block !important; }`;
    doc.head.appendChild(estilo);
    doc.body.appendChild(doc.importNode(pedido.folha, true));

    await Promise.all([doc.fonts?.ready ?? Promise.resolve(), esperarImagens(doc)]);
    await svgParaPng(doc);
    // Um quadro para o desenho assentar depois das fontes e das imagens.
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    const corpo = doc.body;
    const altura = Math.ceil(corpo.scrollHeight);
    const fatias = cortesDePagina({
      altura,
      alturaDaPrimeira: FOLHA.altura - MARGEM.topoDaCapa - MARGEM.base,
      alturaDasDemais: FOLHA.altura - MARGEM.topo - MARGEM.base,
      ...medir(corpo),
    });

    const logo = await carregarImagem(logoUrl);
    const paginas: PaginaDoPdf[] = [];
    for (let i = 0; i < fatias.length; i += 1) {
      const fatia = fatias[i]!;
      pedido.aoAvancar?.(i + 1, fatias.length);
      // Uma folha por vez: um desenho só, do documento inteiro, passa do
      // tamanho máximo de imagem do iPhone num protocolo comprido.
      const trecho = await html2canvas(corpo, {
        x: 0,
        y: fatia.inicio,
        width: larguraUtil,
        height: fatia.fim - fatia.inicio,
        windowWidth: larguraUtil,
        windowHeight: altura,
        scale: ESCALA,
        backgroundColor: FUNDO,
        useCORS: true,
        logging: false,
      });
      const folha = comporFolha(trecho, fatia, i + 1, fatias.length, pedido, logo);
      paginas.push({ jpeg: await paraJpeg(folha), largura: folha.width, altura: folha.height });
      // Devolve a memória já: no celular, cinco folhas guardadas pesam.
      trecho.width = trecho.height = 0;
      folha.width = folha.height = 0;
    }

    const bytes = escreverPdf(paginas, pedido.titulo);
    return new Blob([bytes as BlobPart], { type: "application/pdf" });
  } finally {
    moldura.remove();
  }
}
