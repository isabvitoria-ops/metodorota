import type { ID, ISODateString, RegistroDominio } from "./common";

export type TipoPost = "Aviso" | "Dica rápida" | "Receita" | "Novidade" | "Vídeo" | "Conquista" | "Foto";

/** Segmentação de destino — tabela de associação post↔destinatário (briefing §13). */
export type DestinoPost =
  | { tipo: "todos" }
  | { tipo: "objetivo"; objetivo: string }
  | { tipo: "selecionados"; pacientesId: ID[] };

/** Regra §13: só a nutricionista publica; paciente só visualiza e curte. */
export interface PostFeed extends RegistroDominio {
  autorTipo: "nutricionista" | "paciente";
  /** Preenchido só quando `autorTipo === "paciente"` — nunca nome/foto de rosto (regra #consentimento feed). */
  autorApelido?: string;
  tipo: TipoPost;
  titulo: string;
  texto: string;
  destino: DestinoPost;
  corId: string;
  publicadoEm: ISODateString;
}

export interface CurtidaFeed {
  postId: ID;
  pacienteId: ID;
  criadoEm: ISODateString;
}
