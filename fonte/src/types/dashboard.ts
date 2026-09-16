import type { ID } from "./common";
import type { AlertaClinico } from "./alerta";

/** Agregado servido por services/dashboardService — nunca calculado na tela (briefing §15). */
export interface DashboardResumo {
  pacientesAtivos: number;
  consultasSemana: { pacienteId: ID; nome: string; quando: string }[];
  mensagensPendentes: { pacienteId: ID; nome: string; ultimaMensagem: string; quando: string }[];
  checkinsPendentes: { pacienteId: ID; nome: string; ultimoCheckin: string }[];
  questionariosAguardandoLeitura: { pacienteId: ID; nome: string; templateTitulo: string }[];
  alertasClinicos: (AlertaClinico & { pacienteNome: string })[];
  ultimosAtualizados: { pacienteId: ID; nome: string; quando: string }[];
}
