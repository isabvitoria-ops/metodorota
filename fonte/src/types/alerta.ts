import type { ID, ISODateString, RegistroDominio } from "./common";

export type OrigemAlerta = "sangue_nas_fezes" | "dor_alta_sequencial" | "sem_checkin_prolongado";

/**
 * Regra §22 (fronteira de IA): alertas clínicos são regra determinística
 * (if/then auditável), nunca geração de linguagem natural, e sempre dirigidos
 * à nutricionista — nunca ao paciente com uma interpretação.
 */
export interface AlertaClinico extends RegistroDominio {
  pacienteId: ID;
  origem: OrigemAlerta;
  origemRegistroId: ID;
  geradoEm: ISODateString;
  lidoPelaNutricionistaEm: ISODateString | null;
}

/**
 * Placeholder de arquitetura para as saídas de IA descritas no briefing §22
 * (resumo de evolução, resumo pré-consulta, resumo de sintomas). Nenhuma
 * dessas é implementada nesta fase — o tipo existe para o dashboard e o
 * services/aiSummaryService (stub) já terem um contrato estável.
 *
 * Regra §22: toda saída de IA é dirigida exclusivamente à nutricionista para
 * revisão. Nunca fala com o paciente, nunca sugere conduta, nunca prescreve.
 */
export interface ResumoIA extends RegistroDominio {
  pacienteId: ID;
  tipo: "evolucao" | "pre_consulta" | "sintomas";
  geradoEm: ISODateString;
  revisadoPelaNutricionistaEm: ISODateString | null;
  conteudo: string;
}
