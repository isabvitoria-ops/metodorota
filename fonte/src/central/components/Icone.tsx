import type { SVGProps } from "react";

/**
 * Ícones (§20: "pode usar ícones discretos", sem excesso de emoji).
 *
 * Traço de 1,5 px, 24×24, herdando a cor do texto — nada colorido, nada
 * ilustrativo demais. Um arquivo só, para que a tela nunca desenhe SVG
 * inline no meio do JSX. Para criar um ícone, some uma chave em `TRACOS`.
 */
const TRACOS: Record<string, string> = {
  inicio: "M3 10.2 12 3l9 7.2V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.8Z",
  troca: "M4 7h13m0 0-3.5-3.5M17 7l-3.5 3.5M20 17H7m0 0 3.5-3.5M7 17l3.5 3.5",
  comerFora: "M5 3v8a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3M7 13v8M15 3c-1.5 1.2-2 3-2 5s.6 3 2 3.2V21",
  guias: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Zm2 12h13",
  salvos:
    "M12 20s-7-4.4-7-9.3A4 4 0 0 1 12 8a4 4 0 0 1 7-.7c.6 1 .6 2.3 0 3.4C17.6 14 12 20 12 20Z",
  busca: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm10 2-4.35-4.35",
  seta: "m9 5 7 7-7 7",
  voltar: "m15 19-7-7 7-7",
  fechar: "m6 6 12 12M18 6 6 18",
  inverter: "M7 4v16m0 0-3-3m3 3 3-3M17 20V4m0 0-3 3m3-3 3 3",
  alerta: "M12 8v5m0 3h.01M10.3 3.9 2.5 17.5A1.6 1.6 0 0 0 3.9 20h16.2a1.6 1.6 0 0 0 1.4-2.5L13.7 3.9a1.6 1.6 0 0 0-2.8 0Z",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-5v-5m0-3h.01",
  lista: "M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01",
  folha: "M4 20c0-8 5-13 16-13 0 9-5 13-11 13H4Zm0 0 8-8",
  relogio: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v5l3 2",
  hamburguer: "M4 9c0-2.8 3.6-5 8-5s8 2.2 8 5M4 9h16M4 14h16M5 18h14",
  japonesa: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-12a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
  massas: "M4 8h16M4 8a8 8 0 0 0 16 0M6 8V4m4 4V4m4 4V4m4 4V4",
  doces: "M6 10h12l-1 9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2l-1-9Zm6 0V6a2 2 0 1 1 4 0",
  sanduiche: "M3 9.5 12 5l9 4.5M4 13h16M5 17h14",
  pizza: "M12 3 3 20l9-2 9 2L12 3Zm0 8h.01M9.5 16h.01m5-.5h.01",
  acai: "M5 10h14l-1.4 8.2a2 2 0 0 1-2 1.8H8.4a2 2 0 0 1-2-1.8L5 10Zm4-3a3 3 0 1 1 6 0",
  restaurante: "M4 6h16M4 6a8 8 0 0 0 8 8 8 8 0 0 0 8-8M12 14v6m-4 0h8",
  delivery: "M3 16V7h11v9M14 10h4l3 3v3M6.5 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm11 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  balanca: "M12 4v16M7 20h10M6 9h12l-2.5 5a3.5 3.5 0 0 1-7 0L6 9Z",
  taca: "M8 3h8l-1 6.5a3 3 0 0 1-6 0L8 3Zm4 9.5V20m-3.5 0h7",
  carrinho: "M3 4h2l2.4 10.4a2 2 0 0 0 2 1.6h7.2a2 2 0 0 0 2-1.6L21 8H6M9 20h.01M17 20h.01",
};

export type NomeIcone = keyof typeof TRACOS | string;

interface Props extends SVGProps<SVGSVGElement> {
  nome: NomeIcone;
  tamanho?: number;
}

export function Icone({ nome, tamanho = 20, ...rest }: Props) {
  const traco = TRACOS[nome] ?? TRACOS.info!;
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={traco} />
    </svg>
  );
}

/** Coração cheio — o único ícone com preenchimento, para o estado "salvo". */
export function IconeCoracaoCheio({ tamanho = 20, ...rest }: Omit<Props, "nome">) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...rest}>
      <path d="M12 20s-7-4.4-7-9.3A4 4 0 0 1 12 8a4 4 0 0 1 7-.7c.6 1 .6 2.3 0 3.4C17.6 14 12 20 12 20Z" />
    </svg>
  );
}
