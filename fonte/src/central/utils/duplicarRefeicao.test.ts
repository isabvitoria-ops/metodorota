import test from "node:test";
import assert from "node:assert/strict";
import { duplicarRefeicao } from "./duplicarRefeicao.ts";
import { inserirRecolhida } from "./recolherRefeicoes.ts";
import { CONTEUDO_VAZIO, type ConteudoProtocolo } from "../types/protocolo.ts";

const conteudo: ConteudoProtocolo = {
  ...CONTEUDO_VAZIO,
  refeicoes: [
    { nome: "Café da manhã", horario: "08:00", opcoes: [{ rotulo: "", itens: [{ alimento: "Pão", quantidade: "2 fatias", substituicoes: ["Tapioca"] }], notas: ["chá"], receitas: ["r1"] }] },
    { nome: "Lanche da manhã", horario: "10:00", opcoes: [{ rotulo: "Opção 1", itens: [{ alimento: "Fruta", quantidade: "1 unidade", substituicoes: [] }], notas: [] }] },
    { nome: "Almoço", opcoes: [{ rotulo: "", itens: [], notas: [] }] },
  ],
};

test("a cópia entra logo abaixo, com tudo igual, nome marcado e sem horário", () => {
  const novo = duplicarRefeicao(conteudo, 1);
  assert.deepEqual(novo.refeicoes.map((r) => r.nome), ["Café da manhã", "Lanche da manhã", "Lanche da manhã (cópia)", "Almoço"]);
  assert.deepEqual(novo.refeicoes[2]!.opcoes, conteudo.refeicoes[1]!.opcoes);
  assert.equal(novo.refeicoes[2]!.horario, undefined);
  assert.equal(novo.refeicoes[1]!.horario, "10:00");
});

test("mexer na cópia não muda a original", () => {
  const novo = duplicarRefeicao(conteudo, 0);
  novo.refeicoes[1]!.opcoes[0]!.itens[0]!.substituicoes.push("Cuscuz");
  novo.refeicoes[1]!.opcoes[0]!.notas[0] = "outra";
  assert.deepEqual(conteudo.refeicoes[0]!.opcoes[0]!.itens[0]!.substituicoes, ["Tapioca"]);
  assert.deepEqual(conteudo.refeicoes[0]!.opcoes[0]!.notas, ["chá"]);
  assert.equal(conteudo.refeicoes.length, 3);
});

test("índice fora da lista não muda nada", () => {
  assert.equal(duplicarRefeicao(conteudo, 9), conteudo);
});

test("as refeições fechadas depois da cópia continuam fechadas", () => {
  assert.deepEqual([...inserirRecolhida(new Set([0, 2]), 2)].sort(), [0, 3]);
});
