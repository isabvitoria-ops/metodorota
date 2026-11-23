/** Lixeira de 30 dias (0102). Só a nutricionista vê. */
export type TipoNaLixeira = "paciente" | "receita" | "exame" | "grupo_protocolo";

export interface ItemDaLixeira {
  id: string;
  tipo: TipoNaLixeira;
  titulo: string;
  detalhe: string | null;
  apagadoEm: string;
  diasRestantes: number;
}
