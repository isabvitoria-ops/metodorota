import type { ReactNode } from "react";
import type { DesenhoComerFora } from "@/central/utils/comerForaVisual";

/**
 * Os desenhos do Comer fora.
 *
 * Desenhados aqui, traço a traço, só com as cores da marca: azul profundo no
 * contorno, e areia, gelo, marfim, rosa, limão, cereja e folha no
 * preenchimento. Não são fotos de banco de imagens nem ícones de terceiros —
 * um hambúrguer fotografado por outra pessoa não é da marca dela, e o
 * desenho continua certo quando o cardápio muda.
 *
 * `aria-hidden`: o nome da categoria está escrito logo abaixo.
 */
const AZUL = "#38546c";
const AREIA = "#c9bcac";
const GELO = "#c8dae4";
const MARFIM = "#f7eee7";
const ROSA = "#f0b8c4";
const LIMAO = "#e9c94a";
const CEREJA = "#a82b3c";
const FOLHA = "#4f6f4a";

const traco = { stroke: AZUL, strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const DESENHOS: Record<DesenhoComerFora, ReactNode> = {
  hamburguer: (
    <>
      <path d="M24 34 Q24 15 48 15 Q72 15 72 34 Z" fill={AREIA} {...traco} />
      <path d="M38 23 h3 M47 20 h3 M56 24 h3" {...traco} stroke={MARFIM} />
      <path d="M21 38 q4.5 5 9 0 t9 0 t9 0 t9 0 t9 0 t9 0" fill="none" {...traco} stroke={FOLHA} strokeWidth={3} />
      <rect x="23" y="44" width="50" height="8" rx="4" fill={AZUL} {...traco} />
      <path d="M27 44 h44 l-9 6 l-5 -6 Z" fill={LIMAO} {...traco} />
      <rect x="24" y="54" width="48" height="9" rx="4.5" fill={AREIA} {...traco} />
    </>
  ),
  japonesa: (
    <>
      <path d="M52 12 L88 30 M58 9 L90 23" {...traco} stroke={AREIA} strokeWidth={3} />
      <circle cx="33" cy="42" r="16" fill={AZUL} {...traco} />
      <circle cx="33" cy="42" r="11" fill={MARFIM} {...traco} />
      <circle cx="33" cy="42" r="4.5" fill={ROSA} {...traco} />
      <circle cx="63" cy="47" r="13" fill={AZUL} {...traco} />
      <circle cx="63" cy="47" r="9" fill={MARFIM} {...traco} />
      <circle cx="63" cy="47" r="3.6" fill={FOLHA} {...traco} />
    </>
  ),
  massa: (
    <>
      <path d="M25 38 q5.5 -16 11 0 q5.5 -16 11 0 q5.5 -16 11 0 q5.5 -16 11 0" fill="none" {...traco} stroke={LIMAO} strokeWidth={3.4} />
      <path d="M30 38 q5.5 -10 11 0 q5.5 -10 11 0 q5.5 -10 11 0" fill="none" {...traco} stroke={AREIA} strokeWidth={3} />
      <path d="M17 38 H79 Q79 62 48 62 Q17 62 17 38 Z" fill={GELO} {...traco} />
      <path d="M38 62 h20" {...traco} />
      <circle cx="44" cy="30" r="3" fill={CEREJA} {...traco} strokeWidth={1.6} />
      <path d="M56 27 q3 -4 6 0" fill="none" {...traco} stroke={FOLHA} />
    </>
  ),
  pizza: (
    <>
      <path d="M48 64 L21 21 Q48 8 75 21 Z" fill={LIMAO} {...traco} />
      <path d="M21 21 Q48 8 75 21" fill="none" {...traco} stroke={AREIA} strokeWidth={7} />
      <path d="M21 21 Q48 8 75 21" fill="none" {...traco} />
      <circle cx="40" cy="30" r="4.2" fill={CEREJA} {...traco} strokeWidth={1.6} />
      <circle cx="57" cy="31" r="4.2" fill={CEREJA} {...traco} strokeWidth={1.6} />
      <circle cx="48" cy="46" r="4.2" fill={CEREJA} {...traco} strokeWidth={1.6} />
      <path d="M47 35 q2 -3 4 0 M41 41 q2 -3 4 0" fill="none" {...traco} stroke={FOLHA} strokeWidth={2} />
    </>
  ),
  acai: (
    <>
      <path d="M17 34 H79 Q79 62 48 62 Q17 62 17 34 Z" fill={MARFIM} {...traco} />
      <ellipse cx="48" cy="34" rx="31" ry="8" fill={AZUL} {...traco} />
      <circle cx="36" cy="32" r="4.5" fill={LIMAO} {...traco} strokeWidth={1.6} />
      <circle cx="47" cy="35" r="4.5" fill={LIMAO} {...traco} strokeWidth={1.6} />
      <circle cx="59" cy="32" r="4.5" fill={LIMAO} {...traco} strokeWidth={1.6} />
      <path d="M40 27 h2 M53 28 h2 M64 36 h2 M30 37 h2" {...traco} stroke={AREIA} strokeWidth={2.6} />
      <path d="M66 30 L80 12" {...traco} stroke={AREIA} strokeWidth={3} />
    </>
  ),
  doce: (
    <>
      <path d="M22 54 V36 L72 27 V54 Z" fill={MARFIM} {...traco} />
      <path d="M22 45 L72 40" {...traco} stroke={ROSA} strokeWidth={3} />
      <path d="M22 36 L72 27 V21 L22 30 Z" fill={ROSA} {...traco} />
      <circle cx="46" cy="19" r="4.5" fill={CEREJA} {...traco} strokeWidth={1.6} />
      <path d="M46 15 q2 -6 7 -7" fill="none" {...traco} stroke={FOLHA} strokeWidth={2} />
      <path d="M14 59 H82" {...traco} />
    </>
  ),
  bar: (
    <>
      <path d="M28 17 H68 L48 41 Z" fill={GELO} {...traco} />
      <path d="M48 41 V60 M37 60 H59" {...traco} />
      <path d="M57 13 L50 30" {...traco} stroke={AREIA} strokeWidth={2.4} />
      <circle cx="52" cy="26" r="4" fill={FOLHA} {...traco} strokeWidth={1.6} />
      <path d="M68 17 a8 8 0 0 1 8 -8 a8 8 0 0 1 0 16 Z" fill={LIMAO} {...traco} strokeWidth={1.8} />
    </>
  ),
  cinema: (
    <>
      <circle cx="37" cy="27" r="6.5" fill={MARFIM} {...traco} />
      <circle cx="59" cy="27" r="6.5" fill={MARFIM} {...traco} />
      <circle cx="48" cy="22" r="7.5" fill={LIMAO} {...traco} />
      <circle cx="43" cy="30" r="5.5" fill={LIMAO} {...traco} />
      <circle cx="54" cy="30" r="5.5" fill={MARFIM} {...traco} />
      <path d="M31 32 L35 63 H61 L65 32 Z" fill={MARFIM} {...traco} />
      <path d="M38 32 L40.5 63 H46 L44.5 32 Z M51.5 32 L50 63 H55.5 L58 32 Z" fill={CEREJA} />
      <path d="M31 32 L35 63 H61 L65 32 Z" fill="none" {...traco} />
    </>
  ),
  cafe: (
    <>
      <path d="M36 14 q-4 5 0 9 M48 12 q-4 5 0 9 M60 14 q-4 5 0 9" fill="none" {...traco} stroke={AREIA} />
      <path d="M26 30 H66 V44 Q66 58 46 58 Q26 58 26 44 Z" fill={MARFIM} {...traco} />
      <path d="M66 34 h5 a7 7 0 0 1 0 14 h-6" fill="none" {...traco} />
      <ellipse cx="46" cy="31" rx="18" ry="3.5" fill={AREIA} {...traco} strokeWidth={1.6} />
      <path d="M20 63 H74" {...traco} />
    </>
  ),
  salada: (
    <>
      <path d="M30 38 q-4 -16 12 -18 q2 10 -4 18 M46 38 q-2 -20 14 -22 q4 12 -6 22 M60 38 q4 -12 14 -10 q0 8 -8 10" fill={FOLHA} fillOpacity="0.35" {...traco} stroke={FOLHA} />
      <circle cx="40" cy="34" r="4.5" fill={CEREJA} {...traco} strokeWidth={1.6} />
      <path d="M17 38 H79 Q79 62 48 62 Q17 62 17 38 Z" fill={GELO} {...traco} />
      <path d="M38 62 h20" {...traco} />
    </>
  ),
  churrasco: (
    <>
      <path d="M14 58 L82 14" {...traco} stroke={AREIA} strokeWidth={3} />
      <rect x="27" y="35" width="15" height="13" rx="3" transform="rotate(-33 34 41)" fill={CEREJA} {...traco} />
      <rect x="43" y="25" width="13" height="12" rx="3" transform="rotate(-33 49 31)" fill={FOLHA} {...traco} />
      <rect x="57" y="15" width="15" height="13" rx="3" transform="rotate(-33 64 21)" fill={CEREJA} {...traco} />
    </>
  ),
  restaurante: (
    <>
      <circle cx="48" cy="20" r="3.5" fill={AREIA} {...traco} />
      <path d="M22 50 Q22 24 48 24 Q74 24 74 50 Z" fill={GELO} {...traco} />
      <path d="M32 40 q3 -9 12 -11" fill="none" {...traco} stroke={MARFIM} strokeWidth={2.6} />
      <path d="M14 52 H82" {...traco} />
      <path d="M22 58 H74" {...traco} stroke={AREIA} strokeWidth={3} />
    </>
  ),
  delivery: (
    <>
      <path d="M39 27 Q39 13 48 13 Q57 13 57 27" fill="none" {...traco} />
      <path d="M30 27 H66 L70 63 H26 Z" fill={AREIA} {...traco} />
      <path d="M30 27 H66 L67 35 H29 Z" fill={MARFIM} {...traco} />
      <path d="M48 53 q-9 -6 -5 -11 q3 -3 5 1 q2 -4 5 -1 q4 5 -5 11 Z" fill={CEREJA} {...traco} strokeWidth={1.6} />
    </>
  ),
  prato: (
    <>
      <circle cx="48" cy="38" r="20" fill={MARFIM} {...traco} />
      <circle cx="48" cy="38" r="12" fill={GELO} {...traco} />
      <path d="M17 18 V58 M13 18 V28 Q13 33 17 33 Q21 33 21 28 V18" fill="none" {...traco} />
      <path d="M79 58 V18 Q73 24 73 36 H79" fill="none" {...traco} />
    </>
  ),
};

export function IlustracaoComerFora({ desenho, tamanho = 96 }: { desenho: DesenhoComerFora; tamanho?: number }) {
  return (
    <svg
      className="c-cf-desenho"
      viewBox="0 0 96 72"
      width={tamanho}
      height={(tamanho * 72) / 96}
      aria-hidden="true"
      focusable="false"
    >
      {DESENHOS[desenho]}
    </svg>
  );
}
