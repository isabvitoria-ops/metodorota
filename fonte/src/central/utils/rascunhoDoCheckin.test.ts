import test from "node:test";
import assert from "node:assert/strict";
import { chaveDoRascunho, lerRascunho } from "./rascunhoDoCheckin.ts";

test("rascunho: volta com respostas, explicações e a pergunta em que parou", () => {
  const guardado = JSON.stringify({ valores: { p1: "3", p2: "" }, explicacoes: { p1: "depois do almoço" }, indice: 2 });
  assert.deepEqual(lerRascunho(guardado), {
    valores: { p1: "3", p2: "" },
    explicacoes: { p1: "depois do almoço" },
    indice: 2,
  });
});

test("rascunho: lixo, vazio ou sem nada respondido vira nulo", () => {
  for (const lixo of [null, "", "{", "[]", "3", JSON.stringify({ valores: {} }), JSON.stringify({ valores: { p1: "  " } })]) {
    assert.equal(lerRascunho(lixo), null);
  }
});

test("rascunho: índice torto recomeça da primeira; valor que não é texto sai", () => {
  const r = lerRascunho(JSON.stringify({ valores: { p1: "sim", p2: 7 }, indice: -4 }));
  assert.deepEqual(r, { valores: { p1: "sim" }, explicacoes: {}, indice: 0 });
});

test("rascunho: a chave separa pessoa, questionário e período", () => {
  assert.notEqual(chaveDoRascunho("a", "q1", "2026-11-09"), chaveDoRascunho("a", "q1", "2026-11-16"));
  assert.notEqual(chaveDoRascunho("a", "q1", "2026-11-09"), chaveDoRascunho("b", "q1", "2026-11-09"));
});
