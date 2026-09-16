import type { Pergunta, QuestionarioTemplate, RespostaQuestionario } from "@/types";
import { questionarioRepository } from "@/repositories";

export async function buscarTemplateMensal(): Promise<QuestionarioTemplate | null> {
  return questionarioRepository.buscarTemplateAtivo("mensal");
}

export async function pendenteEsteMs(pacienteId: string, template: QuestionarioTemplate): Promise<boolean> {
  const jaRespondeu = await questionarioRepository.jaRespondeuNoMesAtual(pacienteId, template.id);
  return !jaRespondeu;
}

export async function enviarResposta(
  nutricionistaId: string,
  pacienteId: string,
  template: QuestionarioTemplate,
  respostas: RespostaQuestionario["respostas"],
): Promise<RespostaQuestionario> {
  return questionarioRepository.salvarResposta(nutricionistaId, pacienteId, template.id, template.versao, respostas);
}

/** Uma resposta já casada com as perguntas do template, pronta para a tela. */
export interface RespostaLegivel {
  respondidoEm: string;
  itens: { pergunta: string; resposta: string }[];
}

/**
 * Última resposta do questionário deste paciente, com o texto das perguntas
 * resolvido. Alimenta o bloco "Preparação de consulta" da ficha, que antes
 * mostrava respostas fixas escritas no código como se fossem dela.
 */
export async function buscarUltimaRespostaLegivel(pacienteId: string): Promise<RespostaLegivel | null> {
  const [respostas, template] = await Promise.all([
    questionarioRepository.listarRespostas(pacienteId),
    questionarioRepository.buscarTemplateAtivo("mensal"),
  ]);
  const ultima = [...respostas].sort((a, b) => b.respondidoEm.localeCompare(a.respondidoEm))[0];
  if (!ultima || !template) return null;

  const itens = template.perguntas
    .map((p) => {
      const bruta = ultima.respostas[p.id];
      if (bruta === undefined || bruta === "" || (Array.isArray(bruta) && bruta.length === 0)) return null;
      return { pergunta: p.texto, resposta: Array.isArray(bruta) ? bruta.join(", ") : String(bruta) };
    })
    .filter((i): i is { pergunta: string; resposta: string } => i !== null);

  return { respondidoEm: ultima.respondidoEm, itens };
}

export type FaixaIncomodo = { nome: "leve" | "moderada" | "intensa"; corId: "sage" | "gold" | "clay" };

/**
 * Faixa de incômodo — porte literal do cálculo do protótipo (`Questionario`,
 * variável `faixa`). Soma as perguntas de escala (invertendo as marcadas
 * `invertida`) e divide pela quantidade de perguntas de escala.
 */
export function calcularFaixaIncomodo(perguntas: Pergunta[], respostas: Record<string, string | number | string[]>): FaixaIncomodo {
  const escalas = perguntas.filter((p) => p.tipo === "escala");
  const soma = escalas.reduce((s, p) => {
    const v = Number(respostas[p.id] ?? 0);
    return s + (p.invertida ? 10 - v : v);
  }, 0);
  const media = escalas.length ? soma / escalas.length : 0;
  if (media <= 3) return { nome: "leve", corId: "sage" };
  if (media <= 6) return { nome: "moderada", corId: "gold" };
  return { nome: "intensa", corId: "clay" };
}
