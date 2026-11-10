/**
 * Os dados pessoais da ficha de saúde do Rota Viagem.
 *
 * Vêm do banco, só para a própria paciente: nome completo, nascimento e
 * diagnóstico não podem morar no código, que é baixado por qualquer visitante.
 */
export interface FichaDeViagem {
  nome: string | null;
  nascimento: string | null;
  diagnosticos: string | null;
}

/** Os campos de um dia do diário, como a paciente digita. */
export interface CamposDoDiario {
  onde: string;
  inchaco: string;
  dor: string;
  azia: string;
  evacuacoes: string;
  bristol: string;
  observacoes: string;
}

/** Um dia do diário como está gravado no banco. */
export interface DiaDoDiarioDeViagem {
  /** AAAA-MM-DD */
  dia: string;
  onde: string | null;
  inchaco: number | null;
  dor: number | null;
  azia: number | null;
  evacuacoes: number | null;
  bristol: number | null;
  observacoes: string | null;
  atualizadoEm: string | null;
}

/** O que a nutricionista vê do Rota Viagem de uma paciente. */
export interface ViagemDoPaciente {
  liberado: boolean;
  ficha: FichaDeViagem | null;
  diario: DiaDoDiarioDeViagem[];
}
