import test from "node:test";
import assert from "node:assert/strict";
import { MODELOS_ANAMNESE } from "./anamnese.ts";

test("anamnese: existem 3 modelos", () => {
  assert.equal(MODELOS_ANAMNESE.length, 3);
});

test("anamnese: cada modelo tem id único", () => {
  const ids = MODELOS_ANAMNESE.map((m) => m.id);
  assert.equal(ids.length, new Set(ids).size);
});

test("anamnese: cada modelo tem título e descrição", () => {
  for (const m of MODELOS_ANAMNESE) {
    assert.ok(m.titulo.length > 0, `modelo ${m.id} sem título`);
    assert.ok(m.descricao.length > 0, `modelo ${m.id} sem descrição`);
  }
});

test("anamnese: cada modelo tem pelo menos 15 perguntas", () => {
  for (const m of MODELOS_ANAMNESE) {
    assert.ok(m.perguntas.length >= 15, `modelo ${m.id} tem só ${m.perguntas.length} perguntas`);
  }
});

test("anamnese: perguntas de escolha têm pelo menos 2 opções", () => {
  for (const m of MODELOS_ANAMNESE) {
    for (const p of m.perguntas) {
      if (p.tipo === "escolha") {
        assert.ok(
          p.opcoes.length >= 2,
          `"${p.texto}" no modelo ${m.id} é escolha com ${p.opcoes.length} opções`,
        );
      }
    }
  }
});

test("anamnese: perguntas que não são escolha não têm opções", () => {
  for (const m of MODELOS_ANAMNESE) {
    for (const p of m.perguntas) {
      if (p.tipo !== "escolha") {
        assert.equal(
          p.opcoes.length,
          0,
          `"${p.texto}" no modelo ${m.id} é ${p.tipo} mas tem opções`,
        );
      }
    }
  }
});

test("anamnese: tipos válidos em todas as perguntas", () => {
  const validos = new Set(["escala", "sim_nao", "numero", "texto", "escolha"]);
  for (const m of MODELOS_ANAMNESE) {
    for (const p of m.perguntas) {
      assert.ok(validos.has(p.tipo), `"${p.texto}" no modelo ${m.id} tem tipo inválido: ${p.tipo}`);
    }
  }
});

test("anamnese: modelo gastrointestinal tem perguntas invertidas", () => {
  const gi = MODELOS_ANAMNESE.find((m) => m.id === "gastrointestinal");
  assert.ok(gi);
  const invertidas = gi.perguntas.filter((p) => p.invertida);
  assert.ok(invertidas.length >= 3, "anamnese GI deveria ter perguntas de escala invertida para sintomas");
});

test("anamnese: modelo esportivo tem perguntas de escala não invertidas", () => {
  const esp = MODELOS_ANAMNESE.find((m) => m.id === "esportiva");
  assert.ok(esp);
  const escalas = esp.perguntas.filter((p) => p.tipo === "escala" && !p.invertida);
  assert.ok(escalas.length >= 2, "anamnese esportiva deveria ter escalas positivas (energia, recuperação)");
});
