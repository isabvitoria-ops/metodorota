/**
 * O rascunho do check-in, guardado no aparelho.
 *
 * Ela começa a responder, o telefone toca, o aplicativo fecha — e ao voltar
 * estava tudo em branco. O rascunho guarda as respostas e a pergunta em que
 * ela parou, só neste aparelho, até o envio. Enviou, apaga.
 *
 * Vale para UM questionário e UM período: o rascunho da semana passada não
 * pode aparecer preenchendo o check-in desta.
 */
export interface RascunhoDoCheckin {
  valores: Record<string, string>;
  explicacoes: Record<string, string>;
  indice: number;
  /** Leve, moderado ou forte de cada item marcado, por pergunta (0111). */
  gravidades?: Record<string, Record<string, string>>;
}

export const PREFIXO_DO_RASCUNHO = "central:checkin-rascunho:v1:";

export function chaveDoRascunho(perfilId: string | null, questionarioId: string, periodo: string): string {
  return `${PREFIXO_DO_RASCUNHO}${perfilId ?? "anonimo"}:${questionarioId}:${periodo}`;
}

function textos(bruto: unknown): Record<string, string> {
  const saida: Record<string, string> = {};
  if (bruto === null || typeof bruto !== "object" || Array.isArray(bruto)) return saida;
  for (const [chave, valor] of Object.entries(bruto as Record<string, unknown>)) {
    if (typeof valor === "string") saida[chave] = valor;
  }
  return saida;
}

/** Lê um rascunho guardado. Lixo, ou rascunho sem nada respondido, vira nulo. */
export function lerRascunho(bruto: string | null): RascunhoDoCheckin | null {
  if (!bruto) return null;
  try {
    const dados: unknown = JSON.parse(bruto);
    if (dados === null || typeof dados !== "object" || Array.isArray(dados)) return null;
    const d = dados as Record<string, unknown>;
    const valores = textos(d.valores);
    const explicacoes = textos(d.explicacoes);
    if (!Object.values(valores).some((v) => v.trim() !== "")) return null;
    const indice = typeof d.indice === "number" && Number.isInteger(d.indice) && d.indice >= 0 ? d.indice : 0;
    const gravidades: Record<string, Record<string, string>> = {};
    if (d.gravidades && typeof d.gravidades === "object" && !Array.isArray(d.gravidades)) {
      for (const [pergunta, mapa] of Object.entries(d.gravidades as Record<string, unknown>)) {
        const t = textos(mapa);
        if (Object.keys(t).length > 0) gravidades[pergunta] = t;
      }
    }
    return Object.keys(gravidades).length > 0 ? { valores, explicacoes, indice, gravidades } : { valores, explicacoes, indice };
  } catch {
    return null;
  }
}
