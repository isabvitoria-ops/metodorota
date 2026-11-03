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
  agua: "M12 2C8 8 4 12.5 4 16a8 8 0 0 0 16 0c0-3.5-4-8-8-14Z",
  balanca: "M12 4v16M7 20h10M6 9h12l-2.5 5a3.5 3.5 0 0 1-7 0L6 9Z",
  taca: "M8 3h8l-1 6.5a3 3 0 0 1-6 0L8 3Zm4 9.5V20m-3.5 0h7",
  carrinho: "M3 4h2l2.4 10.4a2 2 0 0 0 2 1.6h7.2a2 2 0 0 0 2-1.6L21 8H6M9 20h.01M17 20h.01",
  // Uma linha que sobe, no traço dos outros. Nada de halter: a área é de
  // acompanhamento nutricional, não de academia.
  evolucao: "M4 19h16M6 16l4-5 3.5 3L19 7",
  // Uma folha com dobra no canto, no traço dos outros.
  documentos: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Zm0 0v5h5M9 13h6M9 17h4",
  // Câmera do diário de fotos.
  camera: "M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Zm8 9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  // Balão de conversa (chat por refeição).
  conversa: "M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12Z",
  // Um "feito": o traço de confirmação. O coração (salvos) não serve para isso —
  // dava a entender que "Marcar como feito" era um favoritar.
  feito: "m5 12.5 4.5 4.5L19 7.5",
  // Coração só de contorno (a curtida).
  coracao: "M12 20.5s-7.5-4.5-9.3-9.3A5.2 5.2 0 0 1 12 6.6a5.2 5.2 0 0 1 9.3 4.6C19.5 16 12 20.5 12 20.5Z",
  link: "M10 14a3.5 3.5 0 0 0 5 0l3-3a3.54 3.54 0 0 0-5-5l-.5.5M14 10a3.5 3.5 0 0 0-5 0l-3 3a3.54 3.54 0 0 0 5 5l.5-.5",
};

/**
 * Ícones de linha da marca, desenhados em 64×64 com traço único. Quando o nome
 * existe aqui, vale sobre `TRACOS` (por isso `agua` e `restaurante` mudam em
 * todo o app de uma vez).
 */
const TRACOS_MARCA: Record<string, string> = {
  cafe: "M14 26H42V38a10 10 0 0 1-10 10H24a10 10 0 0 1-10-10ZM42 29h3a5 5 0 0 1 0 10h-3M10 54H46M22 8c-3 4 3 6 0 10M32 8c-3 4 3 6 0 10",
  almoco:
    "M19 32a13 13 0 1 0 26 0a13 13 0 1 0-26 0M25 32a7 7 0 1 0 14 0a7 7 0 1 0-14 0M8 12v12q0 4 4 4t4-4V12M12 12v38M56 12q-7 6-7 18h7M56 12v38",
  jantar: "M10 34H50c0 11-9 18-20 18S10 45 10 34ZM20 14c-3 4 3 6 0 10M30 14c-3 4 3 6 0 10M50 8a9 9 0 1 0 6 14 7 7 0 0 1-6-14Z",
  lanche:
    "M32 20c-6-5-18-2-18 12 0 12 8 20 14 20 3 0 3-1 4-1s1 1 4 1c6 0 14-8 14-20 0-14-12-17-18-12ZM32 20c0-5 2-9 6-11M38 9c4-2 8 0 8 4-4 2-8 0-8-4",
  agua: "M32 8S16 28 16 38a16 16 0 0 0 32 0C48 28 32 8 32 8ZM24 40a8 8 0 0 0 6 8",
  mercado: "M8 26H56L50 52H14ZM20 26l8-14M44 26l-8-14M24 34v10M32 34v10M40 34v10",
  receita: "M14 8H46a4 4 0 0 1 4 4V52a4 4 0 0 1-4 4H14ZM20 8V56M27 20H42M27 28H42M27 36H36",
  congelar: "M32 8V56M11 20L53 44M11 44L53 20M26 13l6 6 6-6M26 51l6-6 6 6M10 29l8 2-2 8M54 29l-8 2 2 8",
  airfryer:
    "M12 20a8 8 0 0 1 8-8H44a8 8 0 0 1 8 8V46a8 8 0 0 1-8 8H20a8 8 0 0 1-8-8ZM12 30H52M19 21a3 3 0 1 0 6 0a3 3 0 1 0-6 0M34 21H46M22 42H42",
  restaurante: "M14 44a18 18 0 0 1 36 0M8 50H56M14 44H50M29 17a3 3 0 1 0 6 0a3 3 0 1 0-6 0",
  treino: "M20 32H44M14 22V42M20 18V46M44 18V46M50 22V42M8 28v8M56 28v8",
  sono: "M30 10a20 20 0 1 0 22 30 16 16 0 0 1-22-30ZM42 12h8l-8 9h8M52 26h5l-5 6h5",
};

export type NomeIcone = keyof typeof TRACOS | keyof typeof TRACOS_MARCA | string;

interface Props extends SVGProps<SVGSVGElement> {
  nome: NomeIcone;
  tamanho?: number;
}

export function Icone({ nome, tamanho = 20, ...rest }: Props) {
  const daMarca = TRACOS_MARCA[nome];
  const traco = daMarca ?? TRACOS[nome] ?? TRACOS.info!;
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox={daMarca ? "0 0 64 64" : "0 0 24 24"}
      fill="none"
      stroke="currentColor"
      strokeWidth={daMarca ? 3.6 : 1.5}
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
