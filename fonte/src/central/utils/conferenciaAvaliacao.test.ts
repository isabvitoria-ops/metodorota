import test from "node:test";
import assert from "node:assert/strict";
import { AVALIACAO_VAZIA } from "@/central/types/protocolo";
import { conferirAvaliacao } from "./conferenciaAvaliacao";

const base = {
  ...AVALIACAO_VAZIA,
  peso: 64.5,
  altura: 165,
  imc: 23.69,
  percentualGordura: 24.25,
  massaGorda: 15.6,
  massaMagra: 48.9,
};

test("avaliação que fecha não gera aviso", () => {
  assert.deepEqual(conferirAvaliacao(base), []);
});

test("IMC que não bate com peso e altura é apontado, com o valor certo", () => {
  const r = conferirAvaliacao({ ...base, imc: 32.69 });
  assert.equal(r.length, 1);
  assert.equal(r[0]!.campo, "imc");
  assert.equal(r[0]!.sugestao, 23.69);
});

test("massa gorda digitada errada aparece nas duas conferências que ela toca", () => {
  // O caso da vistoria: 16 no lugar de 15,6.
  const r = conferirAvaliacao({ ...base, massaGorda: 16 });
  assert.deepEqual(r.map((x) => x.campo).sort(), ["massas", "percentual"]);
});

test("massa magra errada só mexe na soma", () => {
  const r = conferirAvaliacao({ ...base, massaMagra: 50 });
  assert.deepEqual(r.map((x) => x.campo), ["massas"]);
});

test("campo vazio não é conferido — nulo não é zero", () => {
  assert.deepEqual(conferirAvaliacao({ ...base, imc: null, massaMagra: null, percentualGordura: null }), []);
});
