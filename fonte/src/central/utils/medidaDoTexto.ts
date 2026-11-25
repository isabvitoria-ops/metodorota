/**
 * O desenho do utensílio a partir do que ela ESCREVEU na quantidade.
 *
 * O plano pode ter a medida escolhida no seletor (com o desenho) ou só
 * escrita: "1 colher sopa", "2 colheres servir cheia", "1 concha rasa".
 * Escrita, a paciente ficava sem o desenho — e saber qual é a colher é o
 * ponto todo da medida caseira (pedido dela, 25/11/2026). Aqui o texto é
 * lido e, se nomeia um utensílio, o desenho aparece com o texto dela,
 * intacto. Não muda número nenhum.
 *
 * Só utensílios de verdade (colheres, concha, escumadeira, pegador, copo,
 * xícara). "2 unidades", "1 fatia" e gramas continuam como texto.
 */
import type { MedidaCaseira, Utensilio } from "@/central/types/protocolo";

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// A ordem importa: "xícara de chá" antes de "chá"; "colher de café" antes de "café".
const PADROES: [RegExp, Utensilio][] = [
  [/\bxicaras?\b/, "xicara"],
  [/\bcopos?\s+(de\s+)?americanos?\b/, "copo_americano"],
  [/\bcolher(es)?\s+(de\s+)?cafe\b/, "colher_cafe"],
  [/\bcolher(es)?\s+(de\s+)?cha\b/, "colher_cha"],
  [/\bcolher(es)?\s+(de\s+)?sobremesa\b/, "colher_sobremesa"],
  [/\bcolher(es)?\s+(de\s+)?sopa\b/, "colher_sopa"],
  [/\bcolher(es)?\s+(de\s+)?(servir|arroz)\b/, "colher_servir"],
  [/\bescumadeiras?\b/, "escumadeira"],
  [/\bconchas?\b/, "concha"],
  [/\bpegador(es)?\b/, "pegador"],
];

export function medidaDoTexto(quantidade: string | null | undefined): MedidaCaseira | null {
  const original = String(quantidade ?? "").trim();
  if (!original) return null;
  const t = semAcento(original);
  const achado = PADROES.find(([re]) => re.test(t));
  if (!achado) return null;
  const nivel = /\brasas?\b/.test(t) ? "rasa" : /\bcheias?\b/.test(t) ? "cheia" : undefined;
  // O nível sai do texto porque a linha da medida escreve ele de novo.
  const texto = nivel
    ? original.replace(/\s*\b(rasas?|cheias?)\b/i, "").replace(/\s{2,}/g, " ").trim()
    : original;
  return nivel ? { utensilio: achado[1], texto, nivel } : { utensilio: achado[1], texto };
}
