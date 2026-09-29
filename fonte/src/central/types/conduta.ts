/**
 * Condutas em Kanban (0055_condutas_kanban.sql).
 *
 * Um MODELO é o roteiro que ela repete ("Protocolo SIBO": pedir teste no
 * dia 0, iniciar dieta no dia 7, reavaliar no dia 14). Aplicar um modelo numa
 * paciente vira TAREFAS com data de verdade — e a partir daí cada tarefa é
 * independente: mudar ou apagar o modelo depois não mexe no que já foi
 * aplicado (o nome do modelo fica gravado na tarefa).
 *
 * Tudo aqui é só da nutricionista. A paciente não vê.
 */

export type StatusDaConduta = "a_fazer" | "andamento" | "concluida";

export const COLUNAS_DO_KANBAN: { status: StatusDaConduta; titulo: string }[] = [
  { status: "a_fazer", titulo: "A fazer" },
  { status: "andamento", titulo: "Em andamento" },
  { status: "concluida", titulo: "Concluída" },
];

export interface EtapaDoModelo {
  id?: string;
  titulo: string;
  descricao: string | null;
  /** Quantos dias depois do dia em que o modelo é aplicado. */
  dias: number;
}

export interface ModeloDeConduta {
  id: string;
  nome: string;
  descricao: string | null;
  etapas: EtapaDoModelo[];
}

export interface Conduta {
  id: string;
  pacienteId: string;
  titulo: string;
  descricao: string | null;
  /** AAAA-MM-DD, ou null quando não tem prazo. */
  prazo: string | null;
  status: StatusDaConduta;
  /** O nome do modelo NO DIA em que foi aplicado. */
  modeloNome: string | null;
  criadoEm: string;
  concluidaEm: string | null;
}

/** Na visão geral, a tarefa vem com o nome de quem é. */
export interface CondutaPendente extends Conduta {
  pacienteNome: string;
}

/** Uma linha do "aplicar modelo", já com a data confirmada na tela. */
export interface TarefaParaAplicar {
  titulo: string;
  descricao: string | null;
  prazo: string | null;
}
