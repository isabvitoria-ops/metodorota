import test from "node:test";
import assert from "node:assert/strict";
import { energiaEMacros, type EntradaDeEnergia } from "./calculoEnergia.ts";

const vazio: EntradaDeEnergia = {
  peso: null, tmb: null, fatorAtividade: null, ajusteEnergetico: null, vet: null,
  ptnGKg: null, lipGKg: null, ptnG: null, lipG: null, choG: null,
};

test("energia: GET = TMB × FA, VET = GET + ajuste, em kcal inteira", () => {
  const r = energiaEMacros({ ...vazio, tmb: 1389, fatorAtividade: 1.55, ajusteEnergetico: -300 });
  assert.equal(r.get, 2153); // 1389 × 1,55 = 2152,95
  assert.equal(r.vet, 1853);
  assert.equal(r.vetUsado, 1853);
});

test("energia: sem fator não há GET; sem ajuste não há VET", () => {
  assert.equal(energiaEMacros({ ...vazio, tmb: 1389 }).get, null);
  const semAjuste = energiaEMacros({ ...vazio, tmb: 1389, fatorAtividade: 1.2 });
  assert.equal(semAjuste.get, 1667);
  assert.equal(semAjuste.vet, null);
});

test("macros: gramas por quilo viram gramas por dia, e o carboidrato é o que sobra", () => {
  const r = energiaEMacros({ ...vazio, peso: 62.4, tmb: 1389, fatorAtividade: 1.55, ajusteEnergetico: -300, ptnGKg: 1.8, lipGKg: 0.8 });
  assert.equal(r.ptnG, 112.3); // 1,8 × 62,4 = 112,32
  assert.equal(r.lipG, 49.9); // 0,8 × 62,4 = 49,92
  assert.equal(r.choG, 238.7); // (1853 − 449,2 − 449,1) ÷ 4 = 238,675
  assert.deepEqual(
    r.macros.map((m) => [m.sigla, m.kcal, m.percentual]),
    [["PTN", 449, 24], ["LIP", 449, 24], ["CHO", 955, 52]],
  );
  assert.equal(r.estourou, false);
});

test("macros: o VET do campo manda sobre o da conta", () => {
  const r = energiaEMacros({ ...vazio, peso: 60, tmb: 1400, fatorAtividade: 1.5, ajusteEnergetico: 0, vet: 1800, ptnGKg: 2, lipGKg: 1 });
  assert.equal(r.vet, 2100);
  assert.equal(r.vetUsado, 1800);
  assert.equal(r.choG, 195); // (1800 − 480 − 540) ÷ 4
});

test("macros: sem g/kg, valem as gramas digitadas; proteína e gordura acima do VET acusam", () => {
  const digitado = energiaEMacros({ ...vazio, peso: 60, vet: 1500, ptnG: 100, lipG: 50, choG: 162.5 });
  assert.equal(digitado.choG, 162.5);
  const demais = energiaEMacros({ ...vazio, peso: 60, vet: 1000, ptnGKg: 3, lipGKg: 2 });
  assert.equal(demais.estourou, true);
  assert.deepEqual(demais.macros.map((m) => m.sigla), ["PTN", "LIP"]);
});

test("macros: sem VET não há divisão para mostrar", () => {
  assert.deepEqual(energiaEMacros({ ...vazio, peso: 60, ptnGKg: 2, lipGKg: 1 }).macros, []);
});
