/** O resumo pré-retorno (0100): desde a última consulta concluída. Só para a nutricionista. */
export interface ResumoPreRetorno {
  temMarco: boolean;
  /** Dia da última consulta concluída. */
  desde: string | null;
  dias: number | null;
  /** O resumo (ou a anotação) da última consulta. */
  combinado: string | null;
  proximaConsulta: { data: string; hora: string | null; tipo: string } | null;
  /** Tipo de Bristol → quantas vezes. */
  bristol: Record<string, number>;
  registrosComBristol: number;
  /** Código do sintoma → quantas vezes. */
  sintomas: Record<string, number>;
  reintroducao: { nome: string; status: string }[];
  restricoesNovas: { tipo: string; alimento: string }[];
  metas: { titulo: string; frequencia: string; diasMarcados: number }[];
  diasComRegistro: string[];
}
