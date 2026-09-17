import test from "node:test";
import assert from "node:assert/strict";
import { numeroDeTexto, textoDeNumero } from "./numero";

test("a vírgula brasileira vira número", () => {
  assert.equal(numeroDeTexto("10,9"), 10.9);
  assert.equal(numeroDeTexto("47,8"), 47.8);
});

test("o ponto também, para quem colar de outro lugar", () => {
  assert.equal(numeroDeTexto("10.9"), 10.9);
});

test("inteiro continua inteiro", () => {
  assert.equal(numeroDeTexto("22"), 22);
});

test("espaço em volta não atrapalha", () => {
  assert.equal(numeroDeTexto("  18,9  "), 18.9);
});

test("campo vazio é nulo, não zero — zero seria uma medida que ela não fez", () => {
  assert.equal(numeroDeTexto(""), null);
  assert.equal(numeroDeTexto("   "), null);
});

test("texto que não é número vira nulo", () => {
  assert.equal(numeroDeTexto("abc"), null);
  assert.equal(numeroDeTexto("10,9 kg"), null);
});

test("estados no meio da digitação não viram zero", () => {
  // Ela digitou "47," e ainda não terminou. Virar 0 aqui gravaria um peso
  // zero no instante em que ela tirasse o dedo do teclado.
  assert.equal(numeroDeTexto("47,"), 47);
  assert.equal(numeroDeTexto("-"), null);
  assert.equal(numeroDeTexto(","), null);
});

test("número negativo continua negativo", () => {
  assert.equal(numeroDeTexto("-1,5"), -1.5);
});

test("a volta devolve vírgula", () => {
  assert.equal(textoDeNumero(10.9), "10,9");
  assert.equal(textoDeNumero(22), "22");
});

test("nulo e indefinido viram campo vazio", () => {
  assert.equal(textoDeNumero(null), "");
  assert.equal(textoDeNumero(undefined), "");
});

test("ida e volta não estraga o número", () => {
  for (const n of [0, 1, 10.9, 47.8, 33.2, -1.5, 158.5]) {
    assert.equal(numeroDeTexto(textoDeNumero(n)), n);
  }
});
