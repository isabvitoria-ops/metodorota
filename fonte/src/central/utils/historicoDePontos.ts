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
