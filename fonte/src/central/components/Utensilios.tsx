/**
 * Os desenhos dos utensílios das medidas caseiras.
 *
 * Desenho simples, nas cores da marca, para a paciente reconhecer QUAL colher
 * é: a de chá desenhada menor que a de sopa, a escumadeira com furinhos, a
 * concha funda. Os tamanhos são de comparação entre eles, não tamanho real
 * (a tela de cada celular é de um tamanho, e um "tamanho real" seria mentira).
 */
import type { Utensilio } from "@/central/types/protocolo";

const AZ = "#38546C";
const GELO = "#C8DAE4";
const MARFIM = "#F7EEE7";
const AREIA = "#C9BCAC";
const LIMAO = "#E9C94A";

// Concha (rx, ry) de cada colher, no desenho quadrado.
const CONCHA: Partial<Record<Utensilio, [number, number]>> = {
  colher_cafe: [4, 2.8],
  colher_cha: [5, 3.4],
  colher_sobremesa: [6, 4.1],
  colher_sopa: [7, 4.8],
  colher_servir: [8.6, 5.6],
  escumadeira: [9, 9],
  concha: [9, 9],
};

function svgQuadrado(u: Utensilio): string {
  if (u === "copo_americano")
    return `<path d="M10 6h20l-2.4 28a2 2 0 0 1-2 1.8H14.4a2 2 0 0 1-2-1.8Z" fill="${GELO}" stroke="${AZ}" stroke-width="1.8" stroke-linejoin="round"/><path d="M15 8l1.2 26M20 8v26M25 8l-1.2 26" stroke="${AZ}" stroke-width="1" opacity=".55"/><path d="M11 13h18" stroke="${AZ}" stroke-width="1.2"/>`;
  if (u === "xicara")
    return `<path d="M8 13h20v10a8 8 0 0 1-8 8h-4a8 8 0 0 1-8-8Z" fill="${GELO}" stroke="${AZ}" stroke-width="1.8"/><path d="M28 16h2.5a4 4 0 0 1 0 8H28" fill="none" stroke="${AZ}" stroke-width="1.8"/><path d="M5 34h26" stroke="${AZ}" stroke-width="1.8" stroke-linecap="round"/>`;
  if (u === "fatia")
    return `<path d="M9 34V17a9 9 0 0 1 4-15h14a9 9 0 0 1 4 15v17Z" fill="${MARFIM}" stroke="${AZ}" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 31V18" stroke="${AREIA}" stroke-width="1.2"/>`;
  if (u === "unidade")
    return `<ellipse cx="20" cy="22" rx="11" ry="9" fill="${GELO}" stroke="${AZ}" stroke-width="1.8"/><path d="M20 13c0-3 2-5 5-6" stroke="${AZ}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
  if (u === "file")
    return `<path d="M6 24c0-8 8-14 18-13 7 .6 10 5 9 9-1 6-9 10-17 10-6 0-10-2-10-6Z" fill="${MARFIM}" stroke="${AZ}" stroke-width="1.8"/><path d="M13 22c4-3 9-4 14-3M14 26c4-2 8-2.5 12-2" stroke="${AREIA}" stroke-width="1.2" fill="none" stroke-linecap="round"/>`;
  if (u === "pedaco")
    return `<path d="M8 28 L14 10 L32 14 L30 30 Z" fill="${MARFIM}" stroke="${AZ}" stroke-width="1.8" stroke-linejoin="round"/>`;
  if (u === "pegador")
    return `<path d="M8 33 L30 7 M14 35 L33 12" stroke="${AZ}" stroke-width="2.6" stroke-linecap="round"/><path d="M30 7 L33 12" stroke="${AZ}" stroke-width="2.6" stroke-linecap="round"/><path d="M6 29 l4 6 M11 32 l4 5" stroke="${AZ}" stroke-width="1.6" stroke-linecap="round"/>`;
  const [rx, ry] = CONCHA[u] ?? [7, 4.8];
  const cx = 6 + rx * 0.75;
  const cy = 34 - rx * 0.75;
  let extra = "";
  if (u === "escumadeira")
    for (const [dx, dy] of [[0, 0], [-3.4, 0], [3.4, 0], [0, -3.4], [0, 3.4], [-2.4, -2.4], [2.4, 2.4], [-2.4, 2.4], [2.4, -2.4]])
      extra += `<circle cx="${cx + dx!}" cy="${cy + dy!}" r="0.9" fill="${AZ}"/>`;
  if (u === "concha") extra = `<ellipse cx="${cx}" cy="${cy}" rx="${rx * 0.6}" ry="${ry * 0.6}" fill="none" stroke="${AZ}" stroke-width="1" opacity=".6"/>`;
  const giro = u === "escumadeira" || u === "concha" ? 0 : -45;
  return `<path d="M${cx + rx * 0.6} ${cy - rx * 0.6} L35 5" stroke="${AZ}" stroke-width="3.2" stroke-linecap="round"/><path d="M${cx + rx * 0.6} ${cy - rx * 0.6} L35 5" stroke="${GELO}" stroke-width="1.4" stroke-linecap="round"/><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${giro} ${cx} ${cy})" fill="${GELO}" stroke="${AZ}" stroke-width="1.8"/>${extra}`;
}

export function IconeUtensilio({ utensilio, tamanho = 44 }: { utensilio: Utensilio; tamanho?: number }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 40 40"
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: svgQuadrado(utensilio) }}
    />
  );
}

// Comprimento de cada colher deitada (para a fila de comparação).
const COMPRIMENTO: Partial<Record<Utensilio, [number, number, number]>> = {
  colher_cafe: [48, 6, 4.2],
  colher_cha: [62, 7.5, 5.2],
  colher_sobremesa: [76, 9, 6.2],
  colher_sopa: [88, 10.5, 7.2],
  colher_servir: [112, 13, 8.8],
};

/** A colher deitada, com o comprimento relativo às outras. */
export function ColherDeitada({ utensilio, largura }: { utensilio: Utensilio; largura: number }) {
  const [comp, rx, ry] = COMPRIMENTO[utensilio] ?? [88, 10.5, 7.2];
  const cy = 20;
  const cx = rx + 3;
  const svg =
    `<path d="M${cx + rx - 2} ${cy - 2.2} L${comp - 4} ${cy - 3.2} Q${comp} ${cy} ${comp - 4} ${cy + 3.2} L${cx + rx - 2} ${cy + 2.2} Z" fill="${GELO}" stroke="${AZ}" stroke-width="1.6" stroke-linejoin="round"/>` +
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${GELO}" stroke="${AZ}" stroke-width="1.8"/>`;
  const w = (largura * comp) / 112;
  return (
    <svg width={w} height={(w * 40) / comp} viewBox={`0 0 ${comp} 40`} aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: svg }} />
  );
}

/** A colher vista de lado: rasa (alisada) ou cheia (com montinho). */
export function NivelDaColher({ nivel }: { nivel: "rasa" | "cheia" }) {
  const conteudo =
    nivel === "rasa"
      ? `<path d="M14 30h52" stroke="${AZ}" stroke-width="1.4"/><path d="M14 30a26 14 0 0 0 52 0Z" fill="${LIMAO}" opacity=".85"/>`
      : `<path d="M14 30 Q40 6 66 30Z" fill="${LIMAO}" opacity=".85"/><path d="M14 30a26 14 0 0 0 52 0Z" fill="${LIMAO}" opacity=".85"/>`;
  const svg = `${conteudo}<path d="M12 30a28 16 0 0 0 56 0" fill="none" stroke="${AZ}" stroke-width="2.2"/><path d="M68 30 L104 26" stroke="${AZ}" stroke-width="2.6" stroke-linecap="round"/>`;
  return <svg width={110} height={56} viewBox="0 0 110 56" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: svg }} />;
}
