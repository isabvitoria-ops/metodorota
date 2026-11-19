/**
 * O texto e o destino de cada notificação. Puras, testadas em
 * notificacoes.test.ts.
 */
import type { Notificacao, TipoDeNotificacao } from "@/central/types/notificacao";
import { rotuloDaRefeicao } from "@/central/utils/diarioDeFotos";
import type { RefeicaoDoDiario } from "@/central/types/diarioDeFotos";
import { rotas } from "@/central/rotas";

/** Nome curto: até dois nomes; com mais, o primeiro e o último. */
export function nomeCurto(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return partes.length <= 2 ? partes.join(" ") : `${partes[0]} ${partes[partes.length - 1]}`;
}

/** "Ana Rita registrou Banana na rastreabilidade". */
export function frase(n: Notificacao): string {
  const quem = nomeCurto(n.pacienteNome);
  const d = n.detalhe?.trim() || "";
  switch (n.tipo) {
    case "rastreio":
      return `${quem} registrou ${d || "um alimento"} na rastreabilidade`;
    case "foto":
      return `${quem} mandou foto ${d ? `do ${rotuloDaRefeicao(d as RefeicaoDoDiario).toLowerCase()}` : "de uma refeição"}`;
    case "checkin":
      return `${quem} respondeu ${d ? `o ${d}` : "o check-in"}`;
    case "treino":
      return `${quem} registrou um treino${d && d !== "treino" ? `: ${d}` : ""}`;
    case "cardio":
      return `${quem} registrou cardio${d ? `: ${d}` : ""}`;
    case "meta":
      return `${quem} marcou a meta ${d ? `“${d}”` : ""}`.trim();
    case "mensagem":
      return `${quem} mandou mensagem${d ? ` no ${d.toLowerCase()}` : ""}`;
    case "desafio":
      return `${quem} enviou ${d ? `“${d}”` : "uma ação"} no desafio`;
    case "exame":
      return `${quem} guardou um exame${d ? `: ${d}` : ""}`;
    case "viagem":
      return `${quem} preencheu o diário da viagem${d ? ` (${d})` : ""}`;
  }
}

/** Onde tocar leva: a ficha na aba certa, ou a tela própria. */
export function destino(n: Notificacao): string {
  const id = n.pacienteId;
  const ficha = (aba: string) => `${rotas.adminProntuario(id)}?aba=${aba}`;
  const destinos: Record<TipoDeNotificacao, string> = {
    rastreio: rotas.adminRastreabilidadeDe(id),
    foto: ficha("diario"),
    checkin: ficha("checkin"),
    treino: rotas.adminTreino(id),
    cardio: rotas.adminTreino(id),
    meta: rotas.adminMetasDe(id),
    mensagem: ficha("conversas"),
    desafio: rotas.adminDesafios,
    exame: ficha("exames"),
    viagem: ficha("viagem"),
  };
  return destinos[n.tipo];
}

export const ICONE_DO_TIPO: Record<TipoDeNotificacao, string> = {
  rastreio: "lista",
  foto: "camera",
  checkin: "documentos",
  treino: "treino",
  cardio: "treino",
  meta: "feito",
  mensagem: "conversa",
  desafio: "evolucao",
  exame: "documentos",
  viagem: "guias",
};

/** "agora", "há 12 min", "há 3 h", "ontem 14:20", "12/11 09:05". */
export function quandoCurto(iso: string, agora: Date = new Date()): string {
  const t = new Date(iso);
  const min = Math.floor((agora.getTime() - t.getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  if (min < 12 * 60) return `há ${Math.floor(min / 60)} h`;
  const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", ...o });
  const dia = fmt(t, { day: "2-digit", month: "2-digit" });
  const hora = fmt(t, { hour: "2-digit", minute: "2-digit" });
  const ontem = fmt(new Date(agora.getTime() - 86400000), { day: "2-digit", month: "2-digit" });
  const hoje = fmt(agora, { day: "2-digit", month: "2-digit" });
  if (dia === hoje) return `hoje ${hora}`;
  if (dia === ontem) return `ontem ${hora}`;
  return `${dia} ${hora}`;
}
