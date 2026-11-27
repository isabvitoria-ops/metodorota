import type { FatiaDePagina } from "./cortesDePagina";
import { A4_PT, type LinkDoPdf } from "./escreverPdf";

/**
 * Onde cada link do documento cai em cada folha do PDF.
 *
 * O documento é medido inteiro, de cima a baixo; as folhas são fatias
 * dele. Um link vai para a folha onde está, deslocado pela margem, e sai
 * em pontos do PDF (que conta de baixo para cima). Link partido entre duas
 * folhas vira um pedaço em cada uma.
 */
export interface CaixaDeLink {
  /** Em pixels, a partir do canto de cima à esquerda do documento. */
  esquerda: number;
  topo: number;
  largura: number;
  altura: number;
  url: string;
}

export interface MedidasDaFolha {
  /** Em pixels: a folha inteira e as margens. */
  largura: number;
  altura: number;
  lateral: number;
  topo: number;
  topoDaCapa: number;
}

export function linksDasFolhas(caixas: CaixaDeLink[], fatias: FatiaDePagina[], folha: MedidasDaFolha): LinkDoPdf[][] {
  const ex = A4_PT.largura / folha.largura;
  const ey = A4_PT.altura / folha.altura;
  return fatias.map((fatia, i) => {
    const topoDaFolha = i === 0 ? folha.topoDaCapa : folha.topo;
    const links: LinkDoPdf[] = [];
    for (const c of caixas) {
      const de = Math.max(c.topo, fatia.inicio);
      const ate = Math.min(c.topo + c.altura, fatia.fim);
      if (ate - de < 1 || c.largura < 1) continue;
      const yTopo = topoDaFolha + (de - fatia.inicio);
      links.push({
        x: (folha.lateral + c.esquerda) * ex,
        y: A4_PT.altura - (yTopo + (ate - de)) * ey,
        largura: c.largura * ex,
        altura: (ate - de) * ey,
        url: c.url,
      });
    }
    return links;
  });
}
