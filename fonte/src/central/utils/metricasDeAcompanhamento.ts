import type { MetricasDeAcompanhamento } from "@/central/types/financeiro";

/**
 * As mesmas contas de `metricas_acompanhamento()` (migração 0056), para a
 * demonstração funcionar sem banco. Se as duas discordarem, vale a do banco:
 * a bateria 25 fixa os números de um cenário, e o teste deste arquivo usa o
 * mesmo cenário.
 */
export interface PacienteParaMetricas {
  situacao: string;
  dataInicio: string;
  dataFim: string;
  valorMensal: number | null;
}

export interface RecebimentoParaMetricas {
  pacienteId: string | null;
  valor: number;
}

const TEM_ACESSO = ["ativo", "proximo_do_vencimento"];
const arredondar = (n: number, casas: number) => Math.round(n * 10 ** casas) / 10 ** casas;
const media = (l: number[]) => l.reduce((a, b) => a + b, 0) / l.length;
const diasEntre = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

export function calcularMetricas(
  pacientes: PacienteParaMetricas[],
  recebimentos: RecebimentoParaMetricas[],
): MetricasDeAcompanhamento {
  const ativas = pacientes.filter((p) => TEM_ACESSO.includes(p.situacao));
  const encerradas = pacientes.filter((p) => p.situacao === "expirado");

  const porPaciente = new Map<string, number>();
  for (const r of recebimentos) {
    if (r.pacienteId === null) continue;
    porPaciente.set(r.pacienteId, (porPaciente.get(r.pacienteId) ?? 0) + r.valor);
  }
  const totalRecebido = [...porPaciente.values()].reduce((a, b) => a + b, 0);
  const comValor = ativas.flatMap((p) => (p.valorMensal === null ? [] : [p.valorMensal]));

  return {
    ativas: ativas.length,
    encerradas: encerradas.length,
    permanenciaMediaDias:
      encerradas.length === 0
        ? null
        : arredondar(media(encerradas.map((p) => diasEntre(p.dataInicio, p.dataFim))), 1),
    pacientesQuePagaram: porPaciente.size,
    totalRecebido,
    ticketMedio: porPaciente.size === 0 ? null : arredondar(totalRecebido / porPaciente.size, 2),
    valorMensalMedioAtivas: comValor.length === 0 ? null : arredondar(media(comValor), 2),
  };
}

/** "3 meses e 5 dias" — mais fácil de ler que "95 dias" ou "3,1 meses". */
export function textoDaPermanencia(dias: number | null): string {
  if (dias === null) return "—";
  const inteiros = Math.round(dias);
  if (inteiros < 30) return inteiros === 1 ? "1 dia" : `${inteiros} dias`;
  const meses = Math.floor(inteiros / 30);
  const resto = inteiros - meses * 30;
  const m = meses === 1 ? "1 mês" : `${meses} meses`;
  if (resto === 0) return m;
  return `${m} e ${resto} ${resto === 1 ? "dia" : "dias"}`;
}
