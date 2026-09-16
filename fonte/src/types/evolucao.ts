import type { ID, ISODateString, RegistroDominio } from "./common";

/** Regra #13: "modo cego" — paciente registra, mas o valor só é exibido para a nutricionista. */
export interface RegistroPeso extends RegistroDominio {
  pacienteId: ID;
  data: ISODateString;
  quilos: number;
}

export type SiteMedida = "cintura" | "abdomen" | "quadril";

export interface RegistroMedida extends RegistroDominio {
  pacienteId: ID;
  data: ISODateString;
  site: SiteMedida;
  centimetros: number;
}

export type PoseFoto = "frente" | "lado" | "costas" | "abdomen";

/**
 * Regra #11: nunca em CDN pública, sem EXIF, acesso restrito a
 * paciente + nutricionista, exclusão real ao pedido do paciente.
 * `storagePathPorPose` guarda paths de um bucket privado — a UI sempre
 * resolve para URL assinada de vida curta na hora de exibir, nunca guarda
 * URL pronta.
 */
export interface SessaoFoto extends RegistroDominio {
  pacienteId: ID;
  data: ISODateString;
  storagePathPorPose: Partial<Record<PoseFoto, string>>;
}
