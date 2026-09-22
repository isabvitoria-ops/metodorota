import assert from "node:assert/strict";
import { test } from "node:test";

import {
  alternar,
  todas,
  moverRecolhidas,
  removerRecolhida,
  resumoDaRefeicao,
} from "./recolherRefeicoes";
import type { RefeicaoProtocolo } from "@/central/types/protocolo";

function refeicao(opcoes: number[][]): RefeicaoProtocolo {
  return {
    nome: "Almoço",
    opcoes: opcoes.map((itens, i) => ({
      rotulo: `Opção ${i + 1}`,
      notas: [],
      itens: itens.map((n) => ({
        alimento: `item ${n}`,
        quantidade: "1 unidade",
        substituicoes: [],
      })),
    })),
  };
}

test("alternar fecha e reabre a mesma refeição", () => {
  let s = alternar(new Set<number>(), 2);
  assert.deepEqual([...s], [2]);
  s = alternar(s, 2);
  assert.deepEqual([...s], []);
});

test("alternar não mexe no conjunto que recebeu", () => {
  const original = new Set([1]);
  alternar(original, 3);
  assert.deepEqual([...original], [1], "o conjunto de entrada foi alterado");
});

test("todas fecha exatamente as que existem", () => {
  assert.deepEqual([...todas(3)].sort(), [0, 1, 2]);
  assert.deepEqual([...todas(0)], []);
});

test("mover leva o estado junto: a fechada continua fechada no novo lugar", () => {
  // 1 fechada; ela sobe para 0. Depois da troca, a fechada é a 0.
  const depois = moverRecolhidas(new Set([1]), 1, 0);
  assert.deepEqual([...depois], [0]);
});

test("mover uma aberta para o lugar de uma fechada troca as duas", () => {
  const depois = moverRecolhidas(new Set([2]), 3, 2);
  assert.deepEqual([...depois], [3]);
});

test("mover duas fechadas entre si deixa as duas fechadas", () => {
  const depois = moverRecolhidas(new Set([0, 1]), 0, 1);
  assert.deepEqual([...depois].sort(), [0, 1]);
});

test("remover uma refeição desloca as de baixo — apagar a primeira não fecha a seguinte", () => {
  // 1 e 3 fechadas. Apago a 0. Devem virar 0 e 2.
  const depois = removerRecolhida(new Set([1, 3]), 0);
  assert.deepEqual([...depois].sort(), [0, 2]);
});

test("remover uma que estava fechada tira ela da conta", () => {
  const depois = removerRecolhida(new Set([1, 2]), 1);
  assert.deepEqual([...depois].sort(), [1]);
});

test("o resumo conta os itens de todas as opções", () => {
  assert.equal(resumoDaRefeicao(refeicao([[1, 2, 3], [4, 5]])), "2 opções · 5 itens");
});

test("com uma opção só, o resumo não fala em opções", () => {
  assert.equal(resumoDaRefeicao(refeicao([[1, 2]])), "2 itens");
});

test("um item só é 'item', não 'itens'", () => {
  assert.equal(resumoDaRefeicao(refeicao([[1]])), "1 item");
});

test("refeição sem itens diz 'vazia', e não '0 itens'", () => {
  assert.equal(resumoDaRefeicao(refeicao([[]])), "vazia");
  assert.equal(resumoDaRefeicao(refeicao([])), "vazia");
});
