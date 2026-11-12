import assert from "node:assert/strict";
import test from "node:test";
import { calcularTudo } from "./calculosAntropometricos.ts";

const base = {
  sexo: "feminino" as const,
  peso: 47.8,
  altura: 159,
  idade: 30,
  circunferencias: [],
  diametros: [],
};

const dobra = (nome: string, valor: string) => ({ nome, valor });

// A conta que a paciente de demonstração vê: 33,2 mm pelo Faulkner.
test("Faulkner: soma × 0,153 + 5,783, e a massa gorda sai do peso", () => {
  const r = calcularTudo({
    ...base,
    protocoloId: "faulkner",
    dobras: [dobra("Tríceps", "9,6"), dobra("Subescapular", "8,0"), dobra("Supra-ilíaca", "7,4"), dobra("Abdominal", "8,2")],
  });
  assert.equal(r.somaDobras, 33.2);
  assert.equal(r.percentualGordura, 10.86);
  assert.equal(r.massaGorda, 5.2);
  assert.equal(r.massaMagra, 42.6);
  assert.deepEqual(r.avisos, []);
});

test("Pollock 3 feminino: densidade de Jackson, Pollock e Ward, convertida por Siri", () => {
  const r = calcularTudo({
    ...base,
    protocoloId: "pollock3",
    dobras: [dobra("Tríceps", "15"), dobra("Supra-ilíaca", "12"), dobra("Coxa", "20")],
  });
  // D = 1,0994921 − 0,0009929×47 + 0,0000023×47² − 0,0001392×30 = 1,0537304
  // %G = (4,95 / D − 4,5) × 100 = 19,76
  assert.equal(r.percentualGordura, 19.76);
});

test("protocolo que precisa de idade avisa quando ela falta", () => {
  const r = calcularTudo({
    ...base,
    idade: null,
    protocoloId: "pollock3",
    dobras: [dobra("Tríceps", "15"), dobra("Supra-ilíaca", "12"), dobra("Coxa", "20")],
  });
  assert.equal(r.percentualGordura, null);
  assert.match(r.avisos.join(" "), /Preencha a idade/);
});

test("Durnin & Womersley abaixo de 17 anos: sem número, e com o motivo escrito", () => {
  const r = calcularTudo({
    ...base,
    idade: 15,
    protocoloId: "durnin",
    dobras: [dobra("Bíceps", "6"), dobra("Tríceps", "12"), dobra("Subescapular", "10"), dobra("Supra-ilíaca", "11")],
  });
  assert.equal(r.percentualGordura, null);
  assert.match(r.avisos.join(" "), /não tem equação publicada para esta idade/);
});

test("resultado zero ou negativo não vira número na tela", () => {
  // Slaughter com soma minúscula: 1,33×1 − 0,013×1 − 2,5 = −1,18
  const r = calcularTudo({
    ...base,
    protocoloId: "slaughter",
    dobras: [dobra("Tríceps", "0,5"), dobra("Subescapular", "0,5")],
  });
  assert.equal(r.percentualGordura, null);
  assert.equal(r.massaGorda, null);
  assert.match(r.avisos.join(" "), /zero ou negativo/);
});
