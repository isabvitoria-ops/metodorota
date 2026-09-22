import type { Meta } from "@/central/types/meta";
import type { SituacaoPaciente } from "@/central/types";

/**
 * O panorama de uma paciente — tudo que a lista da profissional mostra.
 *
 * Vem do banco com DATAS E NÚMEROS, nunca com uma palavra já decidida. Quem
 * traduz "último registro há 9 dias" em "sem registro recente" é
 * `utils/panoramaPacientes.ts`, onde a régua tem teste e pode mudar sem
 * migração. Gravando "sem_registro" no banco, mudar de 7 para 10 dias
 * viraria uma migração — e o histórico ficaria com a régua antiga.
 */
export interface PanoramaDoPaciente {
  id: string;
  nome: string;
  email: string;
  /** Nula nas pacientes cadastradas antes do campo existir. */
  condicao: string | null;
  /** A fase atual do método. Nula quando ela ainda não foi colocada em uma. */
  fase: string | null;
  faseDesde: string | null;
  situacao: SituacaoPaciente;
  dataInicio: string | null;
  dataFim: string | null;
  diasRestantes: number | null;

  proximaConsulta: { data: string; hora: string | null; tipo: string } | null;
  ultimaConsulta: { data: string; tipo: string; resumo: string | null } | null;

  /** O dia mais recente em que ela registrou qualquer coisa. Nulo: nunca. */
  ultimoRegistro: string | null;

  pesoInicial: number | null;
  pesoAtual: number | null;

  /** Só as ativas, com os registros do período. A adesão é contada delas. */
  metas: Meta[];
}

/**
 * O que a etiqueta ao lado do nome diz.
 *
 * Só existe status que sai de dado REAL. "Check-in pendente" e "pagamento
 * atrasado" estão na lista dela e ainda não têm de onde sair — inventar a
 * etiqueta antes do módulo faria a lista mentir com confiança.
 */
export type StatusDoPaciente =
  | "retorno_hoje"
  | "retorno_proximo"
  | "sem_registro"
  | "sem_acesso"
  | "em_dia";
