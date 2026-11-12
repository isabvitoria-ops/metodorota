import assert from "node:assert/strict";
import test from "node:test";
import { cortesDePagina } from "./cortesDePagina.ts";

const base = { alturaDaPrimeira: 1000, alturaDasDemais: 900, inteiros: [] as [number, number][], quebrasForcadas: [] as number[] };

test("cortes: documento que cabe numa folha é uma fatia só", () => {
  assert.deepEqual(cortesDePagina({ ...base, altura: 800 }), [{ inicio: 0, fim: 800 }]);
});

test("cortes: a primeira folha tem altura própria, as demais outra", () => {
  assert.deepEqual(cortesDePagina({ ...base, altura: 2500 }), [
    { inicio: 0, fim: 1000 },
    { inicio: 1000, fim: 1900 },
    { inicio: 1900, fim: 2500 },
  ]);
});

test("cortes: o corte sobe para não partir uma linha ao meio", () => {
  const fatias = cortesDePagina({ ...base, altura: 1500, inteiros: [[960, 1040]] });
  assert.deepEqual(fatias, [
    { inicio: 0, fim: 960 },
    { inicio: 960, fim: 1500 },
  ]);
});

test("cortes: subir pode esbarrar em outro bloco, e aí sobe de novo", () => {
  // O bloco de fora (uma refeição inteira) começa em 900; dentro dele há uma linha em 880–930?
  // Aqui: um bloco 950–1050 e, encostado, outro 930–955.
  const fatias = cortesDePagina({ ...base, altura: 1500, inteiros: [[950, 1050], [930, 955]] });
  assert.equal(fatias[0]?.fim, 930);
});

test("cortes: bloco mais alto que a folha é cortado onde a folha acaba", () => {
  const fatias = cortesDePagina({ ...base, altura: 3000, inteiros: [[0, 3000]] });
  assert.deepEqual(fatias.map((f) => f.fim), [1000, 1900, 2800, 3000]);
});

test("cortes: quebra forçada vira a folha ali, mesmo sobrando espaço (a capa)", () => {
  const fatias = cortesDePagina({ ...base, altura: 2000, quebrasForcadas: [945] });
  assert.deepEqual(fatias, [
    { inicio: 0, fim: 945 },
    { inicio: 945, fim: 1845 },
    { inicio: 1845, fim: 2000 },
  ]);
});

test("cortes: as fatias cobrem o documento inteiro, sem buraco e sem repetir", () => {
  const fatias = cortesDePagina({
    ...base,
    altura: 5123,
    inteiros: [[990, 1010], [1880, 1930], [2700, 2790], [3600, 3700]],
    quebrasForcadas: [400],
  });
  assert.equal(fatias[0]?.inicio, 0);
  assert.equal(fatias.at(-1)?.fim, 5123);
  for (let i = 1; i < fatias.length; i += 1) assert.equal(fatias[i]?.inicio, fatias[i - 1]?.fim);
  for (const f of fatias) assert.ok(f.fim > f.inicio);
});
