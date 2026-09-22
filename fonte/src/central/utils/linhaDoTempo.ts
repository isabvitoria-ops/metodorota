import type { AvaliacaoFisica } from "@/central/types/protocolo";
import type { Consulta } from "@/central/types/consulta";
import type { Meta } from "@/central/types/meta";

/**
 * A linha do tempo do acompanhamento.
 *
 * "Consulta → criação/alteração de meta → check-in semanal → retorno →
 * ajuste realizado → novo check-in → evolução."
 *
 * TUDO AQUI SAI DE DADO QUE JÁ EXISTE. Nenhum evento é gravado numa tabela
 * de eventos: a consulta já está em `consultas`, a meta em `metas`, a
 * avaliação em `avaliacoes_fisicas`. Uma tabela de eventos paralela teria de
 * ser alimentada por gatilho em cada escrita, e o dia em que um gatilho
 * falhasse a linha do tempo ficaria com um buraco silencioso — enquanto as
 * tabelas de verdade continuariam certas.
 *
 * O custo disso é que só entra na linha o que as tabelas sabem datar. Check-in
 * e pagamento ainda não existem; quando existirem, entram aqui, e não em
 * lugar nenhum novo.
 */
export type TipoDeEvento =
  | "consulta"
  | "consulta_agendada"
  | "meta_criada"
  | "meta_encerrada"
  | "avaliacao";

export interface EventoDaLinha {
  id: string;
  data: string;
  tipo: TipoDeEvento;
  titulo: string;
  /** A linha de apoio. Nula quando não há o que dizer além do título. */
  detalhe: string | null;
  /** O que aparece à direita: "concluído", "amanhã", "faltou". */
  marca: string | null;
}

function dataDe(iso: string): string {
  return iso.slice(0, 10);
}

function tituloDaConsulta(c: Consulta, ordem: number | null): string {
  const nome = c.tipo === "primeira" ? "Primeira consulta" : "Retorno";
  // "Retorno — 3ª consulta" em vez de "semana 8": a semana depende de quando
  // o acompanhamento começou e de quantas ela remarcou, e sairia errada em
  // toda paciente que faltou uma vez. A contagem de consultas é contável.
  return ordem === null ? nome : `${nome} — ${ordem}ª consulta`;
}

const MARCA_DA_CONSULTA: Record<Consulta["status"], string | null> = {
  concluida: "concluído",
  agendada: null,
  faltou: "faltou",
  cancelada: "cancelada",
};

/**
 * Junta tudo numa linha só, do mais recente para o mais antigo.
 *
 * `hojeIso` serve só para escrever "hoje" e "amanhã" em vez da data seca no
 * que está por vir — é o que a profissional lê primeiro quando abre a ficha.
 */
export function montarLinhaDoTempo(
  consultas: Consulta[],
  metas: Meta[],
  avaliacoes: AvaliacaoFisica[],
  hojeIso: string,
): EventoDaLinha[] {
  const eventos: EventoDaLinha[] = [];

  // A ordem da consulta conta só as que ACONTECERAM, da mais antiga para a
  // mais nova. Contar as canceladas faria a terceira consulta virar a quinta.
  const aconteceram = consultas
    .filter((c) => c.status === "concluida" || c.status === "faltou")
    .sort((a, b) => a.data.localeCompare(b.data));
  const ordemPorId = new Map(aconteceram.map((c, i) => [c.id, i + 1]));

  for (const c of consultas) {
    if (c.status === "cancelada") continue;

    const agendada = c.status === "agendada";
    eventos.push({
      id: `consulta:${c.id}`,
      data: dataDe(c.data),
      tipo: agendada ? "consulta_agendada" : "consulta",
      titulo: tituloDaConsulta(c, ordemPorId.get(c.id) ?? null),
      detalhe: c.resumo,
      marca: agendada ? quando(c.data, hojeIso) : MARCA_DA_CONSULTA[c.status],
    });
  }

  for (const m of metas) {
    eventos.push({
      id: `meta:${m.id}`,
      data: dataDe(m.inicio),
      tipo: "meta_criada",
      titulo: `Meta: ${m.titulo}`,
      detalhe: alvoEmTexto(m),
      marca: m.status === "ativa" ? null : rotuloDoStatus(m.status),
    });
  }

  for (const a of avaliacoes) {
    // Avaliação não publicada é rascunho dela: não é um acontecimento do
    // acompanhamento até ela decidir que é.
    if (!a.publicada) continue;
    eventos.push({
      id: `avaliacao:${a.id}`,
      data: dataDe(a.data),
      tipo: "avaliacao",
      titulo: "Avaliação física",
      detalhe: a.dados.peso === null
        ? null
        : `${a.dados.peso.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg`,
      marca: null,
    });
  }

  // Do mais recente para o mais antigo; empatados no dia, a ordem é a do
  // tipo, para a consulta do dia aparecer acima da meta criada nela.
  const peso: Record<TipoDeEvento, number> = {
    consulta_agendada: 0,
    consulta: 1,
    avaliacao: 2,
    meta_criada: 3,
    meta_encerrada: 4,
  };
  return eventos.sort((a, b) => {
    if (a.data !== b.data) return b.data.localeCompare(a.data);
    return peso[a.tipo] - peso[b.tipo];
  });
}

function rotuloDoStatus(status: Meta["status"]): string {
  if (status === "pausada") return "pausada";
  if (status === "concluida") return "concluída";
  return "encerrada";
}

function alvoEmTexto(m: Meta): string | null {
  if (m.alvo === null) return m.frequencia === "semanal" ? "toda semana" : "todo dia";
  const n = m.alvo.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  const periodo = m.frequencia === "semanal" ? "por semana" : "por dia";
  return `${n}${m.unidade ? ` ${m.unidade}` : ""} ${periodo}`;
}

/** "hoje", "amanhã", "em 5 dias" — ou a data, quando está longe. */
export function quando(dataIso: string, hojeIso: string): string {
  // `T12:00:00Z` pelo motivo de sempre: com meia-noite o fuso derruba a
  // conta um dia, e é justamente na véspera do retorno que ela importa.
  const a = new Date(`${dataIso.slice(0, 10)}T12:00:00Z`).getTime();
  const b = new Date(`${hojeIso.slice(0, 10)}T12:00:00Z`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return "";
  const dias = Math.round((a - b) / 86_400_000);

  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  if (dias === -1) return "ontem";
  if (dias > 1 && dias <= 14) return `em ${dias} dias`;
  if (dias < -1 && dias >= -14) return `há ${Math.abs(dias)} dias`;
  return dataIso.slice(0, 10).split("-").reverse().join("/");
}

/** Há quantas semanas o acompanhamento começou. Nulo sem data de início. */
export function semanasDeAcompanhamento(
  inicioIso: string | null,
  hojeIso: string,
): number | null {
  if (!inicioIso) return null;
  const a = new Date(`${inicioIso.slice(0, 10)}T12:00:00Z`).getTime();
  const b = new Date(`${hojeIso.slice(0, 10)}T12:00:00Z`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  const dias = Math.round((b - a) / 86_400_000);
  if (dias < 0) return null;
  return Math.floor(dias / 7);
}

/** A série de peso para o gráfico, da mais antiga para a mais nova. */
export function seriePeso(avaliacoes: AvaliacaoFisica[]): { data: string; valor: number }[] {
  return avaliacoes
    .filter((a) => a.publicada && a.dados.peso !== null)
    .map((a) => ({ data: dataDe(a.data), valor: a.dados.peso as number }))
    .sort((x, y) => x.data.localeCompare(y.data));
}
