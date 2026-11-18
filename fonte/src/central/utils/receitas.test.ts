import test from "node:test";
import assert from "node:assert/strict";
import { calcularNumeros, categoriaDaRefeicao, porPorcao, receitaCombina } from "./receitas.ts";
import type { IngredienteReceita, Receita } from "../types/receita.ts";

// Valores por 100 g da TACO 4ª ed. (conferidos em taco.json):
// 409 Frango, peito, sem pele, cru: 119,2 kcal; 21,53 g ptn; 0 cho; 3,02 lip
// 71 Abobrinha, italiana, crua: 19,3 kcal; 1,14 ptn; 4,29 cho; 0,14 lip; 1,35 fibra
const TABELA: Record<string, Record<string, number | null>> = {
  "taco:409": { energia_kcal: 119.2, proteina: 21.53, carboidrato: 0, lipideos: 3.02, fibra_alimentar: null },
  "taco:71": { energia_kcal: 19.3, proteina: 1.14, carboidrato: 4.29, lipideos: 0.14, fibra_alimentar: 1.35 },
};
const valor = (id: string, chave: string) => TABELA[id]?.[chave] ?? null;

const ing = (texto: string, alimentoId: string | null, gramas: number | null): IngredienteReceita => ({
  texto,
  alimentoId,
  alimentoNome: alimentoId,
  fonte: alimentoId ? "taco" : null,
  gramas,
});

test("soma os gramas de cada ingrediente pela tabela", () => {
  const n = calcularNumeros([ing("frango", "taco:409", 240), ing("abobrinha", "taco:71", 200)], valor)!;
  assert.ok(Math.abs((n.total.energia_kcal as number) - (286.08 + 38.6)) < 1e-9);
  assert.ok(Math.abs((n.total.proteina as number) - (51.672 + 2.28)) < 1e-9);
  assert.deepEqual(n.fontes, ["taco"]);
});

test("ausência não vira zero: fibra do frango fica de fora e é avisada", () => {
  const n = calcularNumeros([ing("frango", "taco:409", 240), ing("abobrinha", "taco:71", 200)], valor)!;
  assert.ok(Math.abs((n.total.fibra_alimentar as number) - 2.7) < 1e-9);
  assert.deepEqual(n.faltando.fibra_alimentar, ["taco:409"]);
});

test("ingrediente a gosto (sem alimento ou sem gramas) não entra na conta", () => {
  const n = calcularNumeros([ing("canela a gosto", null, null), ing("abobrinha", "taco:71", 100)], valor)!;
  assert.equal(n.total.energia_kcal, 19.3);
  assert.equal(calcularNumeros([ing("sal a gosto", null, null)], valor), null);
});

test("por porção divide pelo rendimento", () => {
  assert.equal(porPorcao(468, 2), 234);
  assert.equal(porPorcao(null, 2), null);
  assert.equal(porPorcao(100, 0), null);
});

test("a refeição do plano escolhe a categoria", () => {
  assert.equal(categoriaDaRefeicao("Café da manhã"), "cafe");
  assert.equal(categoriaDaRefeicao("Almoço"), "almoco_jantar");
  assert.equal(categoriaDaRefeicao("Jantar"), "almoco_jantar");
  assert.equal(categoriaDaRefeicao("Lanche da tarde"), "lanche");
  assert.equal(categoriaDaRefeicao("Pré-treino"), null);
});

test("busca por nome ou ingrediente, sem acento", () => {
  const r = {
    titulo: "Omelete de espinafre",
    ingredientes: [ing("2 ovos", "taco:489", 100)],
  } as unknown as Receita;
  assert.ok(receitaCombina(r, "omelete"));
  assert.ok(receitaCombina(r, "ovos"));
  assert.ok(receitaCombina(r, "ESPINAFRE ovo"));
  assert.ok(!receitaCombina(r, "frango"));
});

test("números digitados valem por porção e mostram a origem", async () => {
  const { numerosParaMostrar } = await import("./receitas.ts");
  const porcao = { energia_kcal: 313, proteina: 41, carboidrato: 29.6, lipideos: 10.4, fibra_alimentar: null };
  const m = numerosParaMostrar({
    porcoes: 2,
    numeros: { total: { energia_kcal: null, proteina: null, carboidrato: null, lipideos: null, fibra_alimentar: null }, faltando: {}, fontes: [], calculadoEm: "", manual: { porcao, origem: "rótulo" } },
  })!;
  assert.equal(m.manual, true);
  assert.equal(m.total, null);
  assert.equal(m.porcao?.energia_kcal, 313);
  assert.equal(m.origem, "rótulo");
  const c = numerosParaMostrar({ porcoes: 2, numeros: calcularNumeros([ing("abobrinha", "taco:71", 200)], valor) })!;
  assert.equal(c.manual, false);
  assert.ok(Math.abs((c.porcao?.energia_kcal as number) - 19.3) < 1e-9);
  assert.ok(Math.abs((c.total?.energia_kcal as number) - 38.6) < 1e-9);
});
