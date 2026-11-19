/**
 * Contas da Agenda: o mês em semanas, o que cai em cada dia e a conferência
 * antes de salvar. Puras, para dar para testar sem banco.
 *
 * As datas são texto "AAAA-MM-DD" do começo ao fim. Conta de calendário com
 * Date local erra um dia no horário de verão; aqui tudo é UTC.
 */
import type { AgendaDoPeriodo, ConsultaNaAgenda, EventoAgenda, EventoParaSalvar, TipoDeEvento } from "@/central/types/agenda";
import { TIPOS_DE_EVENTO } from "@/central/types/agenda";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SEMANA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (dataIso: string) => new Date(`${dataIso}T12:00:00Z`);

/** O mês em semanas de domingo a sábado, com os dias de fora para fechar a grade. */
export function semanasDoMes(ano: number, mes: number): string[][] {
  const primeiro = new Date(Date.UTC(ano, mes, 1, 12));
  const inicio = new Date(primeiro);
  inicio.setUTCDate(1 - primeiro.getUTCDay());
  const ultimo = new Date(Date.UTC(ano, mes + 1, 0, 12));
  const semanas: string[][] = [];
  const d = new Date(inicio);
  while (d <= ultimo || semanas.length === 0 || semanas[semanas.length - 1]!.length < 7) {
    if (!semanas.length || semanas[semanas.length - 1]!.length === 7) {
      if (d > ultimo) break;
      semanas.push([]);
    }
    semanas[semanas.length - 1]!.push(iso(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return semanas;
}

const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export function nomeDoMes(ano: number, mes: number): string {
  return maiuscula(`${MESES[mes]} de ${ano}`);
}

/** "quarta, 18 de novembro" */
export function diaPorExtenso(dataIso: string): string {
  const d = utc(dataIso);
  return maiuscula(`${SEMANA[d.getUTCDay()]}, ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`);
}

export function rotuloDoTipo(tipo: TipoDeEvento): string {
  return TIPOS_DE_EVENTO.find((t) => t.valor === tipo)?.rotulo ?? "Outro";
}

export type ItemDoDia =
  | { tipo: "evento"; hora: string | null; evento: EventoAgenda }
  | { tipo: "consulta"; hora: string | null; consulta: ConsultaNaAgenda };

/** Tudo do dia, o dia inteiro primeiro e depois pela hora. Consulta cancelada não entra. */
export function itensDoDia(agenda: AgendaDoPeriodo, dataIso: string): ItemDoDia[] {
  const itens: ItemDoDia[] = [
    ...agenda.eventos.filter((e) => e.data === dataIso).map((e) => ({ tipo: "evento" as const, hora: e.horaInicio, evento: e })),
    ...agenda.consultas
      .filter((c) => c.data === dataIso && c.status !== "cancelada")
      .map((c) => ({ tipo: "consulta" as const, hora: c.hora, consulta: c })),
  ];
  return itens.sort((a, b) => (a.hora ?? "").localeCompare(b.hora ?? ""));
}

/** O que falta para salvar. Vazia = pode salvar. */
export function problemasDoEvento(e: EventoParaSalvar): string[] {
  const p: string[] = [];
  if (!e.titulo.trim()) p.push("Dê um nome ao compromisso.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.data)) p.push("Escolha o dia.");
  if (e.horaFim && !e.horaInicio) p.push("Coloque a hora de início.");
  if (e.horaInicio && e.horaFim && e.horaFim < e.horaInicio) p.push("O fim está antes do início.");
  return p;
}

/** Primeiro e último dia que a grade do mês mostra (para buscar de uma vez). */
export function periodoDaGrade(ano: number, mes: number): { de: string; ate: string } {
  const s = semanasDoMes(ano, mes);
  return { de: s[0]![0]!, ate: s[s.length - 1]![6]! };
}
