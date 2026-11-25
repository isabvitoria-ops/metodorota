import test from "node:test";
import assert from "node:assert/strict";
import { emBlocos, posicaoNoBiset } from "./bisetDoTreino.ts";

const junta = (a: { b: boolean }) => a.b;

test("o biset junta o exercício ao seguinte, e só em pares", () => {
  const exs = [
    { n: "Agachamento", b: false },
    { n: "Apoio no solo", b: true },
    { n: "Abdominal remador", b: true },
    { n: "Prancha", b: false },
  ];
  assert.deepEqual(emBlocos(exs, junta).map((bl) => bl.map((e) => e.n)), [
    ["Agachamento"],
    ["Apoio no solo", "Abdominal remador"],
    ["Prancha"],
  ]);
});

test("o último marcado como biset fica sozinho (não tem com quem fazer par)", () => {
  assert.deepEqual(emBlocos([{ b: false }, { b: true }], junta).map((bl) => bl.length), [1, 1]);
});

test("posição na montagem: 1 e 2 do par, 0 fora", () => {
  const marcas = [false, true, true, false, true];
  assert.deepEqual([0, 1, 2, 3, 4].map((i) => posicaoNoBiset(marcas, i)), [0, 1, 2, 0, 0]);
});
