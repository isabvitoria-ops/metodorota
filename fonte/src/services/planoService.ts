import type { ItemPlano, Opcao, Plano, PlanoRascunhoItem, Refeicao, VersaoPlanoResumo } from "@/types";
import { planoRepository } from "@/repositories";

export async function buscarPlanoAtivo(pacienteId: string): Promise<Plano | null> {
  return planoRepository.buscarPlanoAtivo(pacienteId);
}

export async function listarHistoricoVersoes(pacienteId: string): Promise<VersaoPlanoResumo[]> {
  return planoRepository.listarHistoricoVersoes(pacienteId);
}

function todosOsItens(refeicoes: Refeicao[]): { item: ItemPlano; opcao: Opcao }[] {
  return refeicoes.flatMap((r) => r.opcoes.flatMap((opcao) => opcao.itens.map((item) => ({ item, opcao }))));
}

/**
 * Regra #9: publicação fica bloqueada enquanto houver item sem
 * `alimentoCodigoTaco` vinculado — **incluindo as substituições**. Uma troca
 * não vinculada é um alimento que o paciente pode escolher e que a ficha
 * educativa não sabe abrir; contava como "0 pendências" e ia pro ar.
 */
export function contarPendenciasDeVinculo(refeicoes: Refeicao[]): number {
  return todosOsItens(refeicoes)
    .flatMap(({ item }) => [item, ...item.substituicoes])
    .filter((i) => i.alimentoCodigoTaco === null).length;
}

export async function publicarNovaVersao(
  pacienteId: string,
  nutricionistaId: string,
  refeicoes: Refeicao[],
  notaVersao?: string,
  faseRotulo?: string,
): Promise<Plano> {
  const pendencias = contarPendenciasDeVinculo(refeicoes);
  if (pendencias > 0) {
    throw new Error(
      `Faltam ${pendencias} ${pendencias === 1 ? "item" : "itens"} para vincular à base antes de publicar.`,
    );
  }
  return planoRepository.publicarNovaVersao(pacienteId, nutricionistaId, refeicoes, notaVersao, faseRotulo);
}

/**
 * Converte itens ainda não vinculados (`PlanoRascunhoItem`) do parser de
 * texto colado, vinculando manualmente pelo código escolhido pela
 * nutricionista — nunca calculado (regra #3), sempre uma escolha explícita
 * dela dentre as sugestões.
 */
export function vincularRascunho(rascunho: PlanoRascunhoItem, alimentoCodigoTaco: number): PlanoRascunhoItem {
  return { ...rascunho, alimentoCodigoTaco };
}
