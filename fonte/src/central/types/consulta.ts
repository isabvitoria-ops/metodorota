/**
 * A consulta: quando foi, o que ficou combinado, e o que ela anotou.
 *
 * `observacoes` é a anotação CLÍNICA — o que ela pensou, não o que
 * combinou. Não sai para a paciente por caminho nenhum: a tabela não tem
 * política de leitura para ela, e `minhas_consultas()` devolve só data,
 * hora, tipo e situação.
 *
 * Por isso este tipo é o da PROFISSIONAL. O da paciente é `ConsultaDaPaciente`,
 * logo abaixo, e é propositalmente menor.
 */
export type TipoDeConsulta = "primeira" | "retorno";

export type StatusDaConsulta = "agendada" | "concluida" | "faltou" | "cancelada";

export interface Consulta {
  id: string;
  data: string;
  /** Nula quando ela só marcou o dia. Nula não é meia-noite. */
  hora: string | null;
  tipo: TipoDeConsulta;
  status: StatusDaConsulta;
  /** Uma linha do que aconteceu. É o que aparece na linha do tempo. */
  resumo: string | null;
  /** Anotação clínica. Só a profissional. */
  observacoes: string | null;
}

/** O que a paciente vê da própria consulta. Sem resumo e sem anotação. */
export interface ConsultaDaPaciente {
  id: string;
  data: string;
  hora: string | null;
  tipo: TipoDeConsulta;
  status: StatusDaConsulta;
}

export interface ConsultaParaSalvar {
  data: string;
  hora: string;
  tipo: TipoDeConsulta;
  status: StatusDaConsulta;
  resumo: string;
  observacoes: string;
}
