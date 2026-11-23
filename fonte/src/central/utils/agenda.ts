/**
 * Contas da Agenda: o mês em semanas, o que cai em cada dia e a conferência
 * antes de salvar. Puras, para dar para testar sem banco.
 *
 * As datas são texto "AAAA-MM-DD" do começo ao fim. Conta de calendário com
 * Date local erra um dia no horário de verão; aqui tudo é UTC.
 */
import type { AgendaDoPeriodo, ConsultaNaAgenda, EventoAgenda, EventoParaSalvar, OcorrenciaDaAgenda, TipoDeEvento } from "@/central/types/agenda";
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
  | { tipo: "evento"; hora: string | null; evento: EventoAgenda & { origem?: string } }
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
  if (e.repete !== "nao" && e.repeteAte && e.repeteAte < e.data) p.push("O \"até\" está antes do primeiro dia.");
  return p;
}

/** Primeiro e último dia que a grade do mês mostra (para buscar de uma vez). */
export function periodoDaGrade(ano: number, mes: number): { de: string; ate: string } {
  const s = semanasDoMes(ano, mes);
  return { de: s[0]![0]!, ate: s[s.length - 1]![6]! };
}

const somar = (dataIso: string, dias: number) => {
  const d = utc(dataIso);
  d.setUTCDate(d.getUTCDate() + dias);
  return iso(d);
};

/**
 * Os dias em que cada compromisso cai, entre `de` e `ate` (inclusive).
 *
 * A repetição é uma regra guardada no compromisso (0099), e a grade desenha
 * os dias. Semanal: nos dias da semana marcados (ou no dia da semana da data,
 * se nenhum). Quinzenal: a cada 14 dias a partir da data. Mensal: no mesmo
 * dia do mês — num mês sem aquele dia (31 em abril), não cai, em vez de
 * escorregar para outro dia sem ninguém pedir.
 */
export function ocorrenciasNoPeriodo(eventos: EventoAgenda[], de: string, ate: string): OcorrenciaDaAgenda[] {
  const saida: OcorrenciaDaAgenda[] = [];
  for (const e of eventos) {
    const fim = e.repete !== "nao" && e.repeteAte && e.repeteAte < ate ? e.repeteAte : ate;
    const pular = new Set(e.excecoes);
    const por = (d: string) => {
      if (d >= de && d <= fim && d >= e.data && !pular.has(d)) saida.push({ ...e, data: d, origem: e.data });
    };
    if (e.repete === "nao") {
      if (e.data >= de && e.data <= ate) saida.push({ ...e, origem: e.data });
      continue;
    }
    if (e.repete === "semanal") {
      const dias = e.diasSemana.length ? e.diasSemana : [utc(e.data).getUTCDay()];
      for (let d = e.data > de ? e.data : de; d <= fim; d = somar(d, 1)) if (dias.includes(utc(d).getUTCDay())) por(d);
    } else if (e.repete === "quinzenal") {
      for (let d = e.data; d <= fim; d = somar(d, 14)) por(d);
    } else {
      const dia = Number(e.data.slice(8, 10));
      let ano = Number(e.data.slice(0, 4));
      let mes = Number(e.data.slice(5, 7)) - 1;
      for (;;) {
        const d = new Date(Date.UTC(ano, mes, dia, 12));
        if (iso(d) > fim) break;
        if (d.getUTCMonth() === mes) por(iso(d));
        mes += 1;
        if (mes === 12) { mes = 0; ano += 1; }
      }
    }
  }
  return saida;
}

const SEMANA_CURTA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** "toda semana (seg, qua, sex)", "a cada 15 dias", "todo mês, até 20/12" */
export function rotuloDaRepeticao(e: Pick<EventoAgenda, "repete" | "diasSemana" | "repeteAte" | "data">): string | null {
  if (e.repete === "nao") return null;
  const ate = e.repeteAte ? `, até ${e.repeteAte.slice(8, 10)}/${e.repeteAte.slice(5, 7)}` : "";
  if (e.repete === "semanal") {
    const dias = (e.diasSemana.length ? e.diasSemana : [utc(e.data).getUTCDay()]).slice().sort();
    return `toda semana (${dias.map((d) => SEMANA_CURTA[d]).join(", ")})${ate}`;
  }
  return `${e.repete === "quinzenal" ? "a cada 15 dias" : "todo mês"}${ate}`;
}
