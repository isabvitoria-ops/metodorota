import type { ID, ISODateString, RegistroDominio } from "./common";

export type BristolTipo = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type SintomaId =
  | "gases" | "distensao" | "dor" | "azia" | "refluxo" | "nausea" | "coceira" | "urgencia";

/** Intensidade 0–3, onde 0 significa "não registrado" (briefing §14 · Check-in). */
export type Intensidade = 0 | 1 | 2 | 3;

export type RegistroSintoma = Partial<Record<SintomaId, Intensidade>>;

export type FlagEvacuacao = "muco" | "sangue" | "urgencia" | "esforco" | "incompleto";

/** As 9 regiões abdominais nomeadas do mapa corporal. */
export type RegiaoAbdominal =
  | "hipocondrio_d" | "epigastrio" | "hipocondrio_e"
  | "flanco_d" | "mesogastrio" | "flanco_e"
  | "fossa_d" | "hipogastrio" | "fossa_e";

export type MapaDor = Partial<Record<RegiaoAbdominal, Intensidade>>;

export type FaixaSono = "menos de 5 h" | "5 a 6 h" | "7 a 8 h" | "mais de 8 h";
export type NivelMovimento = "Não" | "Uma caminhada" | "Treino";
export type Humor = 1 | 2 | 3 | 4 | 5;

/**
 * Um check-in por paciente por dia. Fluxo em passos condicionais — a
 * condicionalidade (bristol/detalhes só se evacuou; mapa só se dor ou
 * coceira) é regra de negócio e vive em hooks/useCheckin, não aqui.
 */
export interface CheckIn extends RegistroDominio {
  pacienteId: ID;
  data: ISODateString;
  evacuou: boolean | null;
  bristol: BristolTipo | null;
  flags: FlagEvacuacao[];
  sintomas: RegistroSintoma;
  mapaDor: MapaDor;
  sono: FaixaSono | null;
  movimento: NivelMovimento | null;
  humor: Humor | null;
  /**
   * Regra determinística (briefing §22): sangue nas fezes vira alerta
   * clínico dirigido só à nutricionista. Nunca gerado por IA, nunca visível
   * ao paciente como "interpretação".
   */
  gerouAlertaClinico: boolean;
}

/** Chave idempotente gerada no cliente (briefing §10) — evita duplicar ao sincronizar depois de ficar offline. */
export type CheckInRascunho = Omit<CheckIn, keyof RegistroDominio | "gerouAlertaClinico"> & {
  chaveIdempotente: string;
};
