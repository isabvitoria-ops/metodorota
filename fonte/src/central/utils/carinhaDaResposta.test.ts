import assert from "node:assert/strict";
import { test } from "node:test";

import { carinhaDe, setaDaVariacao } from "./carinhaDaResposta";

test("a escala inteira tem carinha, sem buraco", () => {
  for (let n = 0; n <= 10; n++) {
    assert.ok(carinhaDe(n), `${n} ficou sem carinha`);
  }
});

test("os extremos são opostos", () => {
  assert.equal(carinhaDe(0)?.nivel, "muito-baixo");
  assert.equal(carinhaDe(10)?.nivel, "muito-alto");
});

test("a carinha sobe junto com o valor, sem voltar atrás", () => {
  const ordem = ["muito-baixo", "baixo", "medio", "alto", "muito-alto"];
  let anterior = -1;
  for (let n = 0; n <= 10; n++) {
    const atual = ordem.indexOf(carinhaDe(n)?.nivel ?? "");
    assert.ok(atual >= anterior, `a carinha piorou de ${n - 1} para ${n}`);
    anterior = atual;
  }
});

test("NÃO RESPONDEU não é carinha triste — é ausência", () => {
  assert.equal(carinhaDe(null), null);
});

test("valor fora da escala não quebra a tabela", () => {
  assert.equal(carinhaDe(99)?.nivel, "muito-alto");
  assert.equal(carinhaDe(-5)?.nivel, "muito-baixo");
});

test("toda carinha tem descrição, para quem usa leitor de tela", () => {
  for (let n = 0; n <= 10; n++) {
    assert.ok((carinhaDe(n)?.descricao ?? "").length > 0);
  }
});

test("a seta mostra o sinal, e igual vira '='", () => {
  assert.equal(setaDaVariacao(25), "+25");
  assert.equal(setaDaVariacao(-25), "−25");
  assert.equal(setaDaVariacao(0), "=");
});

test("sem comparação, a seta é vazia e não '0'", () => {
  assert.equal(setaDaVariacao(null), "");
});
