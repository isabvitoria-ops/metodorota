import type { SituacaoDesafio } from "@/central/types";
import { hojeSaoPaulo } from "./situacao";

/**
 * As contas de calendário do desafio, em TypeScript.
 *
 * Mesma história de `utils/situacao.ts`: a versão que vale é a do banco
 * (`situacao_desafio`, `semana_do_desafio`, `total_de_semanas` em
 * 0007_desafio_funcoes.sql). Estas existem para a área da nutricionista
 * montar a lista sem uma ida ao servidor por linha, e para o modo
 * demonstração funcionar sem banco nenhum.
 *
 * Se as duas discordarem, a do banco ganha: a tela pode errar um rótulo, mas
 * não consegue liberar ponto nenhum — quem lança é sempre o Postgres.
 */

export function situacaoDoDesafio(
  status: string,
  inicio: string,
  fim: string,
  hoje = hojeSaoPaulo(),
): SituacaoDesafio {
  if (status === "rascunho") return "rascunho";
  if (status === "encerrado") return "encerrado";
  if (hoje > fim) return "encerrado";
  if (hoje < inicio) return "agendado";
  return "ativo";
}

/** Em que semana do desafio cai uma data. `null` fora do período. */
export function semanaDoDesafio(inicio: string, fim: string, hoje = hojeSaoPaulo()): number | null {
  if (hoje < inicio || hoje > fim) return null;
  return Math.floor(dias(inicio, hoje) / 7) + 1;
}

export function totalDeSemanas(inicio: string, fim: string): number {
  return Math.floor(dias(inicio, fim) / 7) + 1;
}

/** Início e fim de uma semana, para a tela escrever "08/09 — 14/09". */
export function periodoDaSemana(
  inicio: string,
  fim: string,
  semana: number,
): { inicio: string; fim: string } {
  const comeco = somar(inicio, (semana - 1) * 7);
  const termino = somar(inicio, (semana - 1) * 7 + 6);
  return { inicio: comeco, fim: termino > fim ? fim : termino };
}

/**
 * Frase de acordo com o progresso (§35).
 *
 * Nenhuma delas compara uma paciente com outra, e nenhuma cobra. A regra que
 * ela escreveu é clara: nada de "você está perdendo" nem "fulana está na
 * frente".
 */
export function fraseDoProgresso(pontos: number, temAcaoPendente: boolean): string {
  if (pontos === 0 && !temAcaoPendente) return "Marque a primeira ação da semana. Cada uma conta.";
  if (pontos === 0) return "Recebi. Assim que eu conferir, os pontos entram.";
  if (pontos < 20) return "Você começou. Agora é continuar.";
  if (pontos < 50) return "Mais uma semana de constância.";
  if (pontos < 100) return "Você está construindo consistência.";
  return "Que mês. Continue do mesmo jeito.";
}

function dias(de: string, ate: string): number {
  const a = Date.parse(`${de}T00:00:00Z`);
  const b = Date.parse(`${ate}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

function somar(data: string, quantos: number): string {
  const base = Date.parse(`${data}T00:00:00Z`);
  if (Number.isNaN(base)) return data;
  return new Date(base + quantos * 86_400_000).toISOString().slice(0, 10);
}
