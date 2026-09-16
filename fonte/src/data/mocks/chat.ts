import type { Conversa, Mensagem } from "@/types";
import { NUTRICIONISTA_ID, PACIENTE_MARINA_ID } from "./ids";

export const CONVERSA_MARINA_ID = "conversa-marina";

export const CONVERSA_MARINA: Conversa = {
  id: CONVERSA_MARINA_ID,
  nutricionistaId: NUTRICIONISTA_ID,
  criadoEm: "2026-07-28T09:14:00.000Z",
  atualizadoEm: "2026-08-04T09:05:00.000Z",
  pacienteId: PACIENTE_MARINA_ID,
  naoLidasParaNutricionista: 0,
  naoLidasParaPaciente: 1,
};

/** Portado do protótipo (constante `CHAT_SEED`). */
export const MENSAGENS_MARINA: Mensagem[] = [
  {
    id: "msg-1", nutricionistaId: NUTRICIONISTA_ID, criadoEm: "2026-07-28T09:14:00.000Z", atualizadoEm: "2026-07-28T09:14:00.000Z",
    conversaId: CONVERSA_MARINA_ID, autor: "nutricionista",
    texto: "Marina, dei uma olhada nos seus últimos dez dias. Os check-ins estão bem consistentes — obrigada por isso, faz toda diferença aqui do meu lado.",
    enviadaEm: "2026-07-28T09:14:00.000Z", lidaEm: "2026-07-28T12:00:00.000Z", retractedEm: null,
  },
  {
    id: "msg-2", nutricionistaId: NUTRICIONISTA_ID, criadoEm: "2026-07-28T12:40:00.000Z", atualizadoEm: "2026-07-28T12:40:00.000Z",
    conversaId: CONVERSA_MARINA_ID, autor: "paciente",
    texto: "Que bom! Confesso que no começo achei que ia esquecer todo dia.",
    enviadaEm: "2026-07-28T12:40:00.000Z", lidaEm: "2026-07-28T13:00:00.000Z", retractedEm: null,
  },
  {
    id: "msg-3", nutricionistaId: NUTRICIONISTA_ID, criadoEm: "2026-07-28T18:02:00.000Z", atualizadoEm: "2026-07-28T18:02:00.000Z",
    conversaId: CONVERSA_MARINA_ID, autor: "nutricionista",
    texto: "Reparei que quinta e sexta vieram mais soltos. Foram dias diferentes de alguma forma? Trabalho, viagem, algo assim?",
    enviadaEm: "2026-07-28T18:02:00.000Z", lidaEm: "2026-07-29T08:31:00.000Z", retractedEm: null,
  },
  {
    id: "msg-4", nutricionistaId: NUTRICIONISTA_ID, criadoEm: "2026-07-29T08:31:00.000Z", atualizadoEm: "2026-07-29T08:31:00.000Z",
    conversaId: CONVERSA_MARINA_ID, autor: "paciente",
    texto: "Quinta eu tive uma reunião pesada e almocei fora, comi um pão que não era do plano.",
    enviadaEm: "2026-07-29T08:31:00.000Z", lidaEm: "2026-07-29T09:00:00.000Z", retractedEm: null,
  },
  {
    id: "msg-5", nutricionistaId: NUTRICIONISTA_ID, criadoEm: "2026-07-29T09:05:00.000Z", atualizadoEm: "2026-07-29T09:05:00.000Z",
    conversaId: CONVERSA_MARINA_ID, autor: "nutricionista",
    texto: "Anotado. Vamos observar mais uma semana antes de mexer em qualquer coisa — pode ter sido o pão, pode ter sido o estresse, e é justamente isso que os registros vão nos dizer.",
    enviadaEm: "2026-07-29T09:05:00.000Z", lidaEm: null, retractedEm: null,
  },
];
