/**
 * "Para cada um, indique se foi leve, moderado ou forte" (0111, pedido dela
 * em 25/11/2026). Vale para a pergunta de marcar que pede a intensidade —
 * hoje a de sintomas do GLP-1 (G03), cuja regra de alerta é
 * "gravidade_forte".
 *
 * A resposta continua com o texto de sempre (um sintoma por linha), e ganha
 * um json com o que o alerta e a nutricionista leem:
 *     {"marcados": [0, 4], "gravidade": {"0": "forte", "4": "leve"}}
 */
export type Gravidade = "leve" | "moderado" | "forte";
export const GRAVIDADES: { valor: Gravidade; rotulo: string }[] = [
  { valor: "leve", rotulo: "Leve" },
  { valor: "moderado", rotulo: "Moderado" },
  { valor: "forte", rotulo: "Forte" },
];

interface PerguntaComGravidade {
  tipo: string;
  textoAjuda?: string | null;
  alertasOpcoes?: unknown[];
}

/** A pergunta pede a intensidade de cada item marcado? */
export function pedeGravidade(p: PerguntaComGravidade): boolean {
  if (p.tipo !== "multipla_escolha") return false;
  const porAlerta = (p.alertasOpcoes ?? []).some(
    (a) => !!a && typeof a === "object" && (a as { condicao?: unknown }).condicao === "gravidade_forte",
  );
  return porAlerta || /leve, moderado ou forte/i.test(p.textoAjuda ?? "");
}

/** "Nada disso", "Nenhum": marcar desmarca os outros, e vice-versa. */
export const ehNenhum = (opcao: string) => /^(nada|nenhum|nenhuma)\b/i.test(opcao.trim());

/** Marca ou desmarca uma opção, respeitando o "Nada disso". */
export function alternarOpcao(marcados: string[], opcao: string): string[] {
  if (marcados.includes(opcao)) return marcados.filter((m) => m !== opcao);
  if (ehNenhum(opcao)) return [opcao];
  return [...marcados.filter((m) => !ehNenhum(m)), opcao];
}

/** Os marcados que precisam de intensidade e ainda estão sem. */
export function semGravidade(marcados: string[], gravidades: Record<string, Gravidade | undefined>): string[] {
  return marcados.filter((m) => !ehNenhum(m) && !gravidades[m]);
}

/** O json da resposta: índices marcados e a intensidade de cada um. */
export function jsonDaMultipla(
  opcoes: string[],
  marcados: string[],
  gravidades: Record<string, Gravidade | undefined>,
): { marcados: number[]; gravidade?: Record<string, Gravidade> } {
  const indices = marcados.map((m) => opcoes.indexOf(m)).filter((i) => i >= 0).sort((a, b) => a - b);
  const gravidade: Record<string, Gravidade> = {};
  for (const i of indices) {
    const g = gravidades[opcoes[i]!];
    if (g && !ehNenhum(opcoes[i]!)) gravidade[String(i)] = g;
  }
  return Object.keys(gravidade).length > 0 ? { marcados: indices, gravidade } : { marcados: indices };
}

/** De volta: as intensidades por nome da opção, a partir do json guardado. */
export function gravidadesDoJson(opcoes: string[], json: unknown): Record<string, Gravidade> {
  const saida: Record<string, Gravidade> = {};
  const g = (json as { gravidade?: unknown } | null)?.gravidade;
  if (!g || typeof g !== "object") return saida;
  for (const [i, v] of Object.entries(g as Record<string, unknown>)) {
    const opcao = opcoes[Number(i)];
    if (opcao && (v === "leve" || v === "moderado" || v === "forte")) saida[opcao] = v;
  }
  return saida;
}

/** Para a nutricionista: "Náuseas (forte)" em vez de só "Náuseas". */
export function textoComGravidade(texto: string | null, opcoes: string[], json: unknown): string | null {
  if (!texto) return texto;
  const g = gravidadesDoJson(opcoes, json);
  if (Object.keys(g).length === 0) return texto;
  return texto
    .split("\n")
    .map((linha) => (g[linha] ? `${linha} (${g[linha]})` : linha))
    .join("\n");
}
