/**
 * Agenda da nutricionista (0097). Só ela vê.
 *
 * Dois tipos de item no mesmo dia: os compromissos que ela marca aqui
 * (`EventoAgenda`) e as consultas que já estão nos prontuários
 * (`ConsultaNaAgenda`, só leitura — quem muda consulta é o prontuário).
 */
export type TipoDeEvento = "consulta" | "visita" | "pessoal" | "outro";

export const TIPOS_DE_EVENTO: { valor: TipoDeEvento; rotulo: string }[] = [
  { valor: "consulta", rotulo: "Consulta" },
  { valor: "visita", rotulo: "Visita" },
  { valor: "pessoal", rotulo: "Pessoal" },
  { valor: "outro", rotulo: "Outro" },
];

export interface EventoAgenda {
  id: string;
  titulo: string;
  tipo: TipoDeEvento;
  /** "2026-11-18" */
  data: string;
  /** "14:30", ou nulo quando é o dia inteiro. */
  horaInicio: string | null;
  horaFim: string | null;
  local: string | null;
  observacao: string | null;
  pacienteId: string | null;
  /** Repetição (0099). "nao" = só aquele dia. */
  repete: Repeticao;
  /** 0 = domingo … 6 = sábado. Só vale em "semanal"; vazio = o dia da semana da data. */
  diasSemana: number[];
  /** Último dia em que repete. Nulo = sem fim. */
  repeteAte: string | null;
  /** Dias em que ela apagou só aquele. */
  excecoes: string[];
}

export type Repeticao = "nao" | "semanal" | "quinzenal" | "mensal";

export const REPETICOES: { valor: Repeticao; rotulo: string }[] = [
  { valor: "nao", rotulo: "Não" },
  { valor: "semanal", rotulo: "Toda semana" },
  { valor: "quinzenal", rotulo: "A cada 15 dias" },
  { valor: "mensal", rotulo: "Todo mês" },
];

/** Um dia do compromisso na grade. `origem` é a data em que ele foi criado. */
export interface OcorrenciaDaAgenda extends EventoAgenda {
  origem: string;
}

export type EventoParaSalvar = Omit<EventoAgenda, "id"> & { id: string | null };

export interface ConsultaNaAgenda {
  id: string;
  pacienteId: string;
  pacienteNome: string;
  data: string;
  hora: string | null;
  tipo: "primeira" | "retorno";
  status: "agendada" | "concluida" | "faltou" | "cancelada";
}

export interface AgendaDoPeriodo {
  eventos: EventoAgenda[];
  consultas: ConsultaNaAgenda[];
}
