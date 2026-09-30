import type { RefeicaoProtocolo } from "@/central/types/protocolo";
import type { SintomaReintroducao } from "@/central/types/reintroducao";
import type { ResumoDaConversa } from "@/central/types/conversaDaRefeicao";
import { rotas } from "@/central/rotas";
import { normalizar } from "./texto";

/**
 * As contas da conversa por refeição, fora da tela para poderem ser testadas.
 */

/** A chave da conversa: o nome da refeição, sem diferenciar maiúscula e espaço. */
export function chaveDaRefeicao(nome: string): string {
  return nome.trim().toLowerCase();
}

export function mesmaRefeicao(a: string, b: string): boolean {
  return chaveDaRefeicao(a) === chaveDaRefeicao(b);
}

/**
 * Sintomas que a paciente MENCIONOU no texto, na linguagem dela.
 *
 * É só uma pista para oferecer o atalho "registrar na Rastreabilidade": quem
 * decide o que vale é ela, no formulário. Por isso erra para o lado de não
 * oferecer — uma palavra solta como "dor" (de cabeça?) não basta; precisa ser
 * de barriga/estômago.
 */
const PISTAS: { sintoma: SintomaReintroducao; padroes: RegExp[] }[] = [
  { sintoma: "distensao", padroes: [/\binch/, /distens/, /barriga (estufada|dura|grande)/, /estufad/] },
  { sintoma: "gases", padroes: [/\bgas(es)?\b/, /flatul/, /\bgasosa\b/] },
  {
    sintoma: "dor_abdominal",
    padroes: [/dor (de|na|no|abdominal)\b.*(barriga|estomago|abdom)|dor (abdominal|de barriga|na barriga|no estomago)/, /(barriga|estomago) (doeu|doendo|dolorida)/],
  },
  { sintoma: "colica", padroes: [/colica/] },
  { sintoma: "diarreia", padroes: [/diarreia/, /intestino solto/, /soltou (o )?intestino/] },
  { sintoma: "constipacao", padroes: [/constipa/, /prisao de ventre/, /intestino preso/] },
  { sintoma: "urgencia", padroes: [/urgencia/, /corri (pro|para o) banheiro/] },
  { sintoma: "nausea", padroes: [/nausea/, /enjo/] },
  { sintoma: "refluxo", padroes: [/refluxo/, /\bazia\b/, /queimacao/] },
  { sintoma: "manchas_pele", padroes: [/manchas? (na|de) pele/, /coceira/, /vermelhid/, /urticaria/] },
];

export function sintomasMencionados(texto: string): SintomaReintroducao[] {
  const t = normalizar(texto);
  return PISTAS.filter((p) => p.padroes.some((r) => r.test(t))).map((p) => p.sintoma);
}

/** Os alimentos da refeição (todas as opções), sem repetir, na ordem em que aparecem. */
export function alimentosDaRefeicao(refeicao: RefeicaoProtocolo): string[] {
  const vistos = new Set<string>();
  const nomes: string[] = [];
  for (const opcao of refeicao.opcoes) {
    for (const item of opcao.itens) {
      const nome = item.alimento.trim();
      const chave = nome.toLowerCase();
      if (nome && !vistos.has(chave)) {
        vistos.add(chave);
        nomes.push(nome);
      }
    }
  }
  return nomes;
}

export interface PreenchimentoDaRastreabilidade {
  alimento: string;
  sintomas: SintomaReintroducao[];
  observacao: string;
  refeicao: string;
}

/** O endereço da Rastreabilidade já com o alimento, o sintoma e o texto da conversa. */
export function enderecoDaRastreabilidade(p: PreenchimentoDaRastreabilidade): string {
  const q = new URLSearchParams();
  q.set("alimento", p.alimento);
  if (p.sintomas.length > 0) q.set("sintomas", p.sintomas.join(","));
  if (p.observacao) q.set("obs", p.observacao.slice(0, 300));
  if (p.refeicao) q.set("refeicao", p.refeicao);
  return `${rotas.rastreabilidade}?${q.toString()}`;
}

const SINTOMAS_VALIDOS: SintomaReintroducao[] = [
  "distensao", "gases", "dor_abdominal", "colica", "alteracao_evacuacao", "diarreia",
  "constipacao", "urgencia", "nausea", "refluxo", "manchas_pele", "outros",
];

/** O caminho de volta: o que a Rastreabilidade lê do endereço. Nunca confia no que vem. */
export function lerPreenchimento(busca: URLSearchParams): PreenchimentoDaRastreabilidade | null {
  const alimento = (busca.get("alimento") ?? "").trim().slice(0, 120);
  if (!alimento) return null;
  const sintomas = (busca.get("sintomas") ?? "")
    .split(",")
    .filter((s): s is SintomaReintroducao => (SINTOMAS_VALIDOS as string[]).includes(s));
  return {
    alimento,
    sintomas,
    observacao: (busca.get("obs") ?? "").trim().slice(0, 300),
    refeicao: (busca.get("refeicao") ?? "").trim().slice(0, 80),
  };
}

/** Total de mensagens ainda não lidas, para a bolinha do menu. */
export function totalNaoLidas(resumo: ResumoDaConversa[]): number {
  return resumo.reduce((t, r) => t + r.naoLidas, 0);
}

/** Quantas não lidas tem a conversa de uma refeição. */
export function naoLidasDaRefeicao(resumo: ResumoDaConversa[], nome: string): number {
  return resumo.find((r) => mesmaRefeicao(r.refeicao, nome))?.naoLidas ?? 0;
}
