import type { BristolTipo } from "@/types";

export interface EscalaBristolItem {
  n: BristolTipo;
  label: string;
  hint: string;
  cor: string;
}

/** Escala de Bristol ilustrada — texto e cores portados literalmente do protótipo. */
export const ESCALA_BRISTOL: EscalaBristolItem[] = [
  { n: 1, label: "Bolinhas duras", hint: "difícil de sair", cor: "#7A4B3A" },
  { n: 2, label: "Formato de salsicha", hint: "com bolinhas grudadas", cor: "#9A6B47" },
  { n: 3, label: "Salsicha com fendas", hint: "rachadinha por fora", cor: "#7E9163" },
  { n: 4, label: "Salsicha lisa", hint: "macia e contínua", cor: "#6E8168" },
  { n: 5, label: "Pedaços macios", hint: "com bordas definidas", cor: "#A99640" },
  { n: 6, label: "Massa fofa", hint: "bordas irregulares", cor: "#C08540" },
  { n: 7, label: "Totalmente líquida", hint: "sem pedaços sólidos", cor: "#B0503C" },
];

export function corBristol(n: BristolTipo | null | undefined): string {
  return ESCALA_BRISTOL.find((b) => b.n === n)?.cor ?? "#D9D5CE";
}
