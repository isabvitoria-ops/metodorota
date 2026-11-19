/**
 * Notificações da nutricionista e feed de fotos (0098).
 *
 * As notificações não são gravadas uma a uma: o banco lê o que já está nas
 * tabelas de cada coisa (rastreio, diário, check-in, treino…) e devolve numa
 * lista só. `nova` = aconteceu depois da última vez que ela abriu a tela.
 */
import type { FotoDoDiario } from "@/central/types/diarioDeFotos";

export type TipoDeNotificacao =
  | "rastreio"
  | "foto"
  | "checkin"
  | "treino"
  | "cardio"
  | "meta"
  | "mensagem"
  | "desafio"
  | "exame"
  | "viagem";

export interface Notificacao {
  tipo: TipoDeNotificacao;
  pacienteId: string;
  pacienteNome: string;
  /** ISO, com hora. */
  quando: string;
  /** O alimento, a refeição, o nome do treino, o título do check-in… */
  detalhe: string | null;
  nova: boolean;
}

/** Uma foto do diário, com de quem é (feed de todas). */
export interface FotoDoFeed extends FotoDoDiario {
  pacienteId: string;
  pacienteNome: string;
}
