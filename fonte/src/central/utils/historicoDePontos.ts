import type { MesDaMinhaEvolucao, MesDoHistorico } from "@/central/types/desafio";

/**
 * As contas do histórico mensal de pontos, fora da tela para poderem ser
 * testadas. O que vale é sempre a do banco (migração 0059); aqui é só texto e
 * proporção.
 */

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

function partes(data: string): { ano: number; mes: number } {
  const [ano, mes] = data.split("-").map(Number);
  return { ano: ano ?? 0, mes: mes ?? 1 };
}

/** "2026-09-01" → "Setembro de 2026". */
export function nomeDoMes(mes: string): string {
  const { ano, mes: m } = partes(mes);
  return `${maiuscula(MESES[m - 1] ?? "")} de ${ano}`;
}

/** "2026-09-01" → "Set" (para o eixo do gráfico). */
export function nomeCurtoDoMes(mes: string): string {
  const { mes: m } = partes(mes);
  return maiuscula((MESES[m - 1] ?? "").slice(0, 3));
}

/** O placar para copiar e colar (WhatsApp, anotação). */
export function placarComoTexto(mes: MesDoHistorico): string {
  if (mes.ranking.length === 0) return `${nomeDoMes(mes.mes)}: ninguém pontuou.`;
  const linhas = mes.ranking.map((l, i) => {
    const extras = [
      l.resgatou > 0 ? `resgatou ${l.resgatou}` : null,
      `saldo ${l.saldo}`,
      l.recompensa ? `alcançou: ${l.recompensa}` : null,
    ].filter(Boolean);
    return `${i + 1}. ${l.nome} — ${l.pontos} ${l.pontos === 1 ? "ponto" : "pontos"} (${extras.join(" · ")})`;
  });
  return [`Placar de ${nomeDoMes(mes.mes)} — ${mes.total} pontos no total`, ...linhas].join("\n");
}

/**
 * A altura de cada barra da evolução, em % da maior. Mês com ponto nunca fica
 * invisível (mínimo 6%), e mês sem ponto fica em zero — o contrário seria
 * mentir que ela fez alguma coisa.
 */
export function alturasDasBarras(meses: MesDaMinhaEvolucao[]): number[] {
  const maior = Math.max(0, ...meses.map((m) => m.pontos));
  if (maior === 0) return meses.map(() => 0);
  return meses.map((m) => (m.pontos <= 0 ? 0 : Math.max(6, Math.round((m.pontos / maior) * 100))));
}

/** "Desafio de Outubro", para o mês de `hoje`. */
export function nomeDoDesafioDoMes(hoje: string): string {
  return `Desafio de ${maiuscula(MESES[partes(hoje).mes - 1] ?? "")}`;
}

/** O primeiro e o último dia do mês de `hoje`. */
export function periodoDoMes(hoje: string): { inicio: string; fim: string } {
  const { ano, mes } = partes(hoje);
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const dois = (n: number) => String(n).padStart(2, "0");
  return { inicio: `${ano}-${dois(mes)}-01`, fim: `${ano}-${dois(mes)}-${dois(ultimo)}` };
}

interface DesafioResumido {
  id: string;
  situacao: string;
}

/** Sem nenhum desafio no ar nem agendado, não há de onde dar ponto novo. */
export function precisaCriarDesafio(desafios: DesafioResumido[]): boolean {
  return !desafios.some((d) => d.situacao === "ativo" || d.situacao === "agendado");
}

/**
 * Qual desafio a tela abre: o que está no ar; senão o mais recente que não seja
 * rascunho (o rascunho vazio atrapalhava: era o que abria, sem ação nenhuma);
 * senão o primeiro. A lista chega do mais novo para o mais antigo.
 */
export function escolherDesafioPadrao(lista: DesafioResumido[]): string | null {
  return (
    lista.find((d) => d.situacao === "ativo")?.id ??
    lista.find((d) => d.situacao !== "rascunho")?.id ??
    lista[0]?.id ??
    null
  );
}

// ------------------------------------------------------------ placar publicável

/**
 * "Eduarda Martins Souza" → "Eduarda S." — o mesmo tratamento que o ranking da
 * paciente usa (`nome_para_ranking`, modo padrão). O placar vai para um grupo
 * de WhatsApp, e nome completo de paciente num grupo é decisão dela, não padrão.
 */
export function nomeAbreviado(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 1) return partes[0] ?? nome;
  return `${partes[0]} ${(partes[partes.length - 1] ?? "").charAt(0).toUpperCase()}.`;
}

/** 1º lugar coroa, 2º prata, 3º bronze. Do 4º em diante, sem enfeite. */
export function medalhaDaPosicao(posicao: number): string {
  if (posicao === 1) return "👑";
  if (posicao === 2) return "🥈";
  if (posicao === 3) return "🥉";
  return "";
}

/**
 * A posição de cada linha, na ordem em que vieram (já do maior para o menor).
 * Empate divide o lugar e o seguinte pula: 100, 100, 80 → 1º, 1º, 3º — a mesma
 * regra do ranking do desafio (`rank()`), para o PDF nunca discordar da tela.
 */
export function posicoesDoPlacar(pontos: number[]): number[] {
  return pontos.map((p) => 1 + pontos.filter((outro) => outro > p).length);
}

export interface OpcoesDoPlacar {
  /** Nome inteiro em vez de "Ana M.". */
  nomeCompleto?: boolean;
  /** Quantas aparecem; nulo = todas. */
  limite?: number | null;
}

export interface LinhaPublicavel {
  posicao: number;
  medalha: string;
  nome: string;
  pontos: number;
}

export interface PlacarPublicavel {
  /** "Setembro de 2026". */
  titulo: string;
  linhas: LinhaPublicavel[];
  /** Quantas pontuaram no mês (inclusive as que não cabem no limite). */
  participantes: number;
  /** Quantas ficaram de fora por causa do limite. */
  ocultas: number;
  total: number;
}

/** O que vai para o PDF e para o WhatsApp: só nome e pontos, nunca saldo nem prêmio. */
export function placarPublicavel(mes: MesDoHistorico, opcoes: OpcoesDoPlacar = {}): PlacarPublicavel {
  // Quem fechou o mês no zero (ou negativo) não entra: um placar de comunidade
  // é para quem fez ponto.
  const quem = mes.ranking.filter((l) => l.pontos > 0);
  const posicoes = posicoesDoPlacar(quem.map((l) => l.pontos));
  const limite = opcoes.limite ?? null;
  const todas: LinhaPublicavel[] = quem.map((l, i) => ({
    posicao: posicoes[i] ?? i + 1,
    medalha: medalhaDaPosicao(posicoes[i] ?? i + 1),
    nome: opcoes.nomeCompleto ? l.nome : nomeAbreviado(l.nome),
    pontos: l.pontos,
  }));
  // O limite nunca corta no meio de um empate: ficar de fora por um critério
  // de desempate que não existe seria injusto.
  let linhas = todas;
  if (limite !== null && todas.length > limite) {
    const corte = todas[limite - 1]?.posicao ?? 0;
    linhas = todas.filter((l, i) => i < limite || l.posicao === corte);
  }
  return {
    titulo: nomeDoMes(mes.mes),
    linhas,
    participantes: quem.length,
    ocultas: todas.length - linhas.length,
    total: quem.reduce((soma, l) => soma + l.pontos, 0),
  };
}

/** O placar pronto para colar no WhatsApp (negrito com asteriscos). */
export function placarParaWhatsApp(
  mes: MesDoHistorico,
  opcoes: OpcoesDoPlacar = {},
  mensagem = "",
): string {
  const p = placarPublicavel(mes, opcoes);
  if (p.linhas.length === 0) return `Placar de ${p.titulo}: ninguém pontuou.`;
  const linhas = p.linhas.map((l) => {
    const marca = l.medalha || "▫️";
    return `${marca} ${l.posicao}º ${l.nome} — ${l.pontos} ${l.pontos === 1 ? "ponto" : "pontos"}`;
  });
  return [
    `🏆 *Placar de ${p.titulo}*`,
    "",
    ...linhas,
    ...(p.ocultas > 0 ? ["", p.ocultas === 1 ? "…e mais 1 pessoa que pontuou!" : `…e mais ${p.ocultas} pessoas que pontuaram!`] : []),
    ...(mensagem.trim() ? ["", mensagem.trim()] : []),
  ].join("\n");
}

// ---------------------------------------------------------- lançar o mês passado

/** Quantos dias depois do fim do mês ainda dá para lançar sem aviso. */
export const DIAS_DE_RETROATIVO = 7;

const DIA = 86_400_000;
const aoMeioDia = (iso: string) => Date.parse(`${iso}T12:00:00Z`);

export function somarDias(iso: string, dias: number): string {
  return new Date(aoMeioDia(iso) + dias * DIA).toISOString().slice(0, 10);
}

export function diasEntre(de: string, ate: string): number {
  return Math.round((aoMeioDia(ate) - aoMeioDia(de)) / DIA);
}

export type PrazoDoLancamento =
  | { tipo: "atual" }
  | { tipo: "futuro" }
  /** O mês acabou, mas ainda está na janela: lançar é o esperado. */
  | { tipo: "retroativo"; ultimoDia: string; diasRestantes: number }
  /** Passou da janela: o mês já foi fechado e os presentes, entregues. */
  | { tipo: "fechado"; ultimoDia: string; diasDeAtraso: number };

/**
 * Em que pé está lançar ponto num desafio, olhando a data de hoje. A janela é
 * de uma semana depois do último dia — "pontuou ontem e eu ainda não lancei".
 * Depois dela NÃO é proibido: a tela só pede uma confirmação, porque mexer num
 * mês cujos presentes já saíram muda o placar que alguém já viu.
 */
export function prazoDoLancamento(
  desafio: { dataInicio: string; dataFim: string },
  hoje: string,
  dias = DIAS_DE_RETROATIVO,
): PrazoDoLancamento {
  if (hoje < desafio.dataInicio) return { tipo: "futuro" };
  if (hoje <= desafio.dataFim) return { tipo: "atual" };
  const ultimoDia = somarDias(desafio.dataFim, dias);
  if (hoje <= ultimoDia) {
    return { tipo: "retroativo", ultimoDia, diasRestantes: diasEntre(hoje, ultimoDia) };
  }
  return { tipo: "fechado", ultimoDia, diasDeAtraso: diasEntre(ultimoDia, hoje) };
}

/** A semana (1, 2, …) do desafio a que um dia pertence; mesma conta do banco. */
export function semanaDoDia(desafio: { dataInicio: string; dataFim: string }, dia: string): number {
  const limitado = dia < desafio.dataInicio ? desafio.dataInicio : dia > desafio.dataFim ? desafio.dataFim : dia;
  return Math.floor(diasEntre(desafio.dataInicio, limitado) / 7) + 1;
}

const curta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** "Semana 5 · 29/09 a 30/09". */
export function rotuloDaSemana(desafio: { dataInicio: string; dataFim: string }, n: number): string {
  const inicio = somarDias(desafio.dataInicio, (n - 1) * 7);
  const fimBruto = somarDias(inicio, 6);
  const fim = fimBruto > desafio.dataFim ? desafio.dataFim : fimBruto;
  return `Semana ${n} · ${curta(inicio)} a ${curta(fim)}`;
}

/** "Em setembro você fez 120 pontos e ficou em 1º lugar entre 8 participantes." */
export function fraseDoMes(m: { mes: string; pontos: number; posicao: number | null; participantes: number }): string | null {
  if (m.pontos <= 0) return null;
  const mes = nomeDoMes(m.mes).split(" de ")[0]?.toLowerCase() ?? "";
  const pontos = `${m.pontos} ${m.pontos === 1 ? "ponto" : "pontos"}`;
  if (m.posicao === null || m.participantes <= 1) return `Em ${mes} você fez ${pontos}.`;
  return `Em ${mes} você fez ${pontos} e ficou em ${m.posicao}º lugar entre ${m.participantes} participantes.`;
}
