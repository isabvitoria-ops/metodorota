import type { ID, ISODateString, RegistroDominio } from "./common";

export type AdesaoId = "segui" | "troquei" | "menos" | "fora" | "pulei";

/**
 * Regra #5 (inegociável): trocar entre alimentos liberados pela nutricionista
 * nunca conta como desvio. Por isso "troquei" existe como estado próprio,
 * visualmente e semanticamente distinto de "fora" — nunca deve ser tratado
 * como sinônimo de desvio em nenhuma tela ou agregação (dashboard, gráficos).
 */
export const ADESAO_E_DESVIO: Record<AdesaoId, boolean> = {
  segui: false,
  troquei: false,
  menos: true,
  fora: true,
  pulei: true,
};

export interface RegistroDiario extends RegistroDominio {
  pacienteId: ID;
  refeicaoId: ID;
  data: ISODateString;
  adesao: AdesaoId;
  nota?: string;
  fotoUrl?: string;
}
