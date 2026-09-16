import type { ID, ISODateString, RegistroDominio } from "./common";

export type TipoPergunta = "peso" | "escolha_unica" | "escolha_multipla" | "texto" | "escala";

export interface Pergunta {
  id: ID;
  tipo: TipoPergunta;
  texto: string;
  opcoes?: string[];
  /** Só para `tipo: "escala"`. */
  rotuloEsquerda?: string;
  rotuloDireita?: string;
  /** Escala invertida: valor alto = melhor (ex.: satisfação), então entra invertido na soma de carga de sintomas. */
  invertida?: boolean;
}

/**
 * Múltiplos templates com schema configurável (briefing §14 · Questionários),
 * generalizando o modelo fixo "Preparação para consulta" do protótipo.
 */
export interface QuestionarioTemplate extends RegistroDominio {
  titulo: string;
  introducao: string;
  versao: number;
  perguntas: Pergunta[];
  periodicidade: "mensal" | "avulso";
}

export interface RespostaQuestionario extends RegistroDominio {
  pacienteId: ID;
  templateId: ID;
  /** Cada resposta associada à versão do template respondida (briefing §14). */
  templateVersao: number;
  respondidoEm: ISODateString;
  respostas: Record<ID, string | number | string[]>;
  /** Alimenta o dashboard (briefing §15 · "Questionários respondidos aguardando leitura"). */
  lidaPelaNutricionistaEm: ISODateString | null;
}
