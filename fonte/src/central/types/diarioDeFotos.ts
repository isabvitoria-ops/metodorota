/**
 * Diário de fotos (migração 0057).
 *
 * A paciente fotografa a refeição, diz qual foi e, se quiser, escreve uma
 * legenda. A nutricionista vê e curte. Sem comentário e sem comparação com o
 * plano, de propósito.
 */
export type RefeicaoDoDiario =
  | "cafe"
  | "lanche_manha"
  | "almoco"
  | "lanche_tarde"
  | "jantar"
  | "ceia"
  | "outro";

export const REFEICOES_DO_DIARIO: { valor: RefeicaoDoDiario; rotulo: string }[] = [
  { valor: "cafe", rotulo: "Café da manhã" },
  { valor: "lanche_manha", rotulo: "Lanche da manhã" },
  { valor: "almoco", rotulo: "Almoço" },
  { valor: "lanche_tarde", rotulo: "Lanche da tarde" },
  { valor: "jantar", rotulo: "Jantar" },
  { valor: "ceia", rotulo: "Ceia" },
  { valor: "outro", rotulo: "Outro" },
];

export interface FotoDoDiario {
  id: string;
  /** O caminho da foto no balde privado. */
  caminho: string;
  refeicao: RefeicaoDoDiario;
  legenda: string | null;
  /** O dia da refeição, AAAA-MM-DD. */
  data: string;
  /** Só a nutricionista curte. */
  curtida: boolean;
  criadoEm: string;
}
