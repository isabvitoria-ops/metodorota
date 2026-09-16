/**
 * Regra #6 (inegociável): cada refeição tem cor fixa; opções da mesma
 * refeição compartilham a cor; refeições diferentes têm cores diferentes.
 * A paleta é a mesma usada no Feed do protótipo original para diferenciar
 * autores/posts — reaproveitada aqui como o conjunto de acentos do produto.
 */
export const PALETA_ACENTOS = [
  { id: "plum", valor: "var(--plum)" },
  { id: "sage", valor: "var(--sage)" },
  { id: "gold", valor: "var(--gold)" },
  { id: "clay", valor: "var(--clay)" },
  { id: "plum-2", valor: "var(--plum-2)" },
] as const;

export type CorAcentoId = (typeof PALETA_ACENTOS)[number]["id"];

export function corPorId(id: string): string {
  return PALETA_ACENTOS.find((c) => c.id === id)?.valor ?? "var(--ink-3)";
}

/** Atribui cor fixa por posição da refeição no dia — determinístico, nunca recalculado por conteúdo. */
export function corRefeicaoPorOrdem(ordem: number): CorAcentoId {
  const paleta = PALETA_ACENTOS;
  return paleta[ordem % paleta.length]!.id;
}
