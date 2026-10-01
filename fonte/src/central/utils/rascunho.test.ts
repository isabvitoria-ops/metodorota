import test from "node:test";
import assert from "node:assert/strict";
import { apagarRascunho, chaveDoRascunho, guardarRascunho, lerRascunho, type Guarda } from "./rascunho.ts";

function guardaDeMemoria(): Guarda & { dados: Map<string, string> } {
  const dados = new Map<string, string>();
  return {
    dados,
    getItem: (k) => dados.get(k) ?? null,
    setItem: (k, v) => void dados.set(k, v),
    removeItem: (k) => void dados.delete(k),
  };
}

test("rascunho: guarda, devolve e apaga", () => {
  const g = guardaDeMemoria();
  const k = chaveDoRascunho("consulta", "p1");
  assert.equal(lerRascunho(g, k), "");
  guardarRascunho(g, k, "queixa de inchaço");
  assert.equal(lerRascunho(g, k), "queixa de inchaço");
  apagarRascunho(g, k);
  assert.equal(lerRascunho(g, k), "");
});

test("rascunho: texto vazio ou só espaços apaga em vez de guardar", () => {
  const g = guardaDeMemoria();
  const k = chaveDoRascunho("consulta", "p1");
  guardarRascunho(g, k, "algo");
  guardarRascunho(g, k, "   \n ");
  assert.equal(g.dados.size, 0);
});

test("rascunho: cada paciente tem o seu", () => {
  assert.notEqual(chaveDoRascunho("consulta", "a"), chaveDoRascunho("consulta", "b"));
});

test("rascunho: storage bloqueado não derruba nada", () => {
  const quebrado: Guarda = {
    getItem: () => { throw new Error("bloqueado"); },
    setItem: () => { throw new Error("bloqueado"); },
    removeItem: () => { throw new Error("bloqueado"); },
  };
  assert.equal(lerRascunho(quebrado, "x"), "");
  assert.doesNotThrow(() => guardarRascunho(quebrado, "x", "texto"));
  assert.doesNotThrow(() => apagarRascunho(quebrado, "x"));
  assert.equal(lerRascunho(null, "x"), "");
});
