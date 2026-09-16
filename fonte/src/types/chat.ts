import type { ID, ISODateString, RegistroDominio } from "./common";

export type AutorMensagem = "paciente" | "nutricionista";

/**
 * Regra #12: chat é assíncrono, nunca respondido por IA no lugar da
 * nutricionista, sempre com aviso de que não serve para emergência.
 * Mensagens são append-only: retração marca `retractedEm` preservando o
 * texto original — nunca editar/apagar `texto`.
 */
export interface Mensagem extends RegistroDominio {
  conversaId: ID;
  autor: AutorMensagem;
  texto: string;
  enviadaEm: ISODateString;
  lidaEm: ISODateString | null;
  retractedEm: ISODateString | null;
}

export interface Conversa extends RegistroDominio {
  pacienteId: ID;
  naoLidasParaNutricionista: number;
  naoLidasParaPaciente: number;
}
