import type { Alimento, Medida } from "@/central/types";
import { daBase, paraBase } from "./medidas";

/**
 * Lógica de porções (§8).
 *
 * É a espinha do material de substituição: cada alimento tem uma porção de
 * referência e o plano fala em número de porções. 2 porções de arroz são
 * 200 g; 1,6 porção são 160 g. Como a conta é uma razão, ela também resolve
 * a troca entre dois alimentos do mesmo grupo sem nenhuma linha de
 * equivalência escrita à mão.
 */

/** Quantas porções esta medida representa. `null` se faltar porção ou unidade cadastrada. */
export function emPorcoes(alimento: Alimento, medida: Medida): number | null {
  if (!alimento.porcao) return null;
  const base = paraBase(alimento, medida);
  const porcaoBase = paraBase(alimento, alimento.porcao);
  if (base === null || porcaoBase === null || porcaoBase === 0) return null;
  return base / porcaoBase;
}

/**
 * Caminho inverso: quanto dar de um alimento para chegar a N porções.
 * Aceita fração — 1,6 porção de arroz devolve 160 g.
 */
export function medidaDePorcoes(alimento: Alimento, porcoes: number, unidadeId?: string): Medida | null {
  if (!alimento.porcao) return null;
  const porcaoBase = paraBase(alimento, alimento.porcao);
  if (porcaoBase === null) return null;
  const alvo = unidadeId ?? alimento.unidadeBaseId;
  const quantidade = daBase(alimento, porcaoBase * porcoes, alvo);
  if (quantidade === null) return null;
  return { quantidade, unidadeId: alvo };
}

export interface ParteCombinada {
  alimento: Alimento;
  /** Fração da porção destinada a este alimento (0,5 + 0,5 = 1 porção). */
  fracao: number;
}

export interface ItemCombinacao {
  alimento: Alimento;
  fracao: number;
  medida: Medida | null;
}

/**
 * Combinação de alimentos em frações de porção (§8): "0,5 porção de arroz
 * + 0,5 porção de abóbora". Devolve a medida de cada parte; a que não tiver
 * porção cadastrada volta com `medida: null` em vez de ser estimada.
 *
 * A calculadora da V1 ainda não expõe isso na tela — a função existe porque
 * o briefing pede que a arquitetura já comporte a combinação, e é ela que a
 * próxima tela vai chamar.
 */
export function combinarPorcoes(partes: ParteCombinada[], porcoesTotais = 1): ItemCombinacao[] {
  return partes.map((parte) => ({
    alimento: parte.alimento,
    fracao: parte.fracao,
    medida: medidaDePorcoes(parte.alimento, parte.fracao * porcoesTotais),
  }));
}
