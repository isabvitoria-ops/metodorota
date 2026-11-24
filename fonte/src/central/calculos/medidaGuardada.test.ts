import test from "node:test";
import assert from "node:assert/strict";
import { base, medidasComAGuardada, NOTA_GUARDADA } from "./tabela.ts";

// Um alimento de mentira na base: o tomate com as medidas de hoje.
base.medidasPadrao = { "taco:157": [{ n: "fatia média", g: 15, ref: "IBGE" }, { n: "unidade", g: 100, ref: "IBGE" }] };

test("medida guardada que saiu da tabela continua, com o peso de quando foi escolhida", () => {
  const lista = medidasComAGuardada("taco:157", { nome: "unidade grande", gramas: 182 });
  assert.deepEqual(lista.at(-1), { nome: "unidade grande", gramas: 182, ref: NOTA_GUARDADA });
});

test("medida que ainda está na tabela não duplica (e vale o peso de hoje)", () => {
  const lista = medidasComAGuardada("taco:157", { nome: "Unidade", gramas: 123 });
  assert.equal(lista.filter((m) => m.nome.toLowerCase() === "unidade").length, 1);
  assert.equal(lista.find((m) => m.nome === "unidade")!.gramas, 100);
});

test("sem medida guardada (ou sem peso), a lista é só a da tabela", () => {
  const n = medidasComAGuardada("taco:157", null).length;
  assert.equal(medidasComAGuardada("taco:157", { nome: "", gramas: 10 }).length, n);
  assert.equal(medidasComAGuardada("taco:157", { nome: "x", gramas: 0 }).length, n);
});
