import test from "node:test";
import assert from "node:assert/strict";
import { medidaDoTexto } from "./medidaDoTexto.ts";

test("reconhece o utensílio do jeito que ela escreve", () => {
  assert.deepEqual(medidaDoTexto("1 colher sopa"), { utensilio: "colher_sopa", texto: "1 colher sopa" });
  assert.deepEqual(medidaDoTexto("2 colheres servir cheia"), { utensilio: "colher_servir", texto: "2 colheres servir", nivel: "cheia" });
  assert.deepEqual(medidaDoTexto("1 concha rasa"), { utensilio: "concha", texto: "1 concha", nivel: "rasa" });
  assert.equal(medidaDoTexto("1 colher de chá")?.utensilio, "colher_cha");
  assert.equal(medidaDoTexto("1 xícara de chá")?.utensilio, "xicara");
  assert.equal(medidaDoTexto("1 colher de café")?.utensilio, "colher_cafe");
  assert.equal(medidaDoTexto("2 pegadores")?.utensilio, "pegador");
  assert.equal(medidaDoTexto("1 copo americano")?.utensilio, "copo_americano");
  assert.equal(medidaDoTexto("3 colheres de sopa - 45g")?.utensilio, "colher_sopa");
});

test("o que não é utensílio continua texto", () => {
  for (const t of ["2 unidades", "1 fatia", "150g", "1 filé médio", "1 pote", "", null]) {
    assert.equal(medidaDoTexto(t), null, String(t));
  }
});
