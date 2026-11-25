import test from "node:test";
import assert from "node:assert/strict";
import { colinhaPorUtensilio, utensilioDaMedida } from "./colinhaPorUtensilio.ts";

test("reconhece os utensílios brasileiros e deixa de fora o que não é utensílio", () => {
  assert.equal(utensilioDaMedida("colher de sopa cheia")?.nome, "Colher de sopa");
  assert.equal(utensilioDaMedida("Escumadeira média cheia")?.nome, "Escumadeira");
  assert.equal(utensilioDaMedida("xícara de chá")?.nome, "Xícara de chá");
  assert.equal(utensilioDaMedida("xícara de café")?.nome, "Xícara de café");
  assert.equal(utensilioDaMedida("copo americano")?.nome, "Copo americano");
  assert.equal(utensilioDaMedida("unidade média"), null);
  assert.equal(utensilioDaMedida("fatia"), null);
  assert.equal(utensilioDaMedida("g"), null);
});

test("medidas do USDA vão para o grupo dos EUA, e as com número na frente ficam de fora", () => {
  assert.equal(utensilioDaMedida("tbsp")?.eua, true);
  assert.equal(utensilioDaMedida("cup, chopped")?.nome, "Xícara dos EUA (cup)");
  assert.equal(utensilioDaMedida("2 tbsp"), null);
  assert.equal(utensilioDaMedida("0.5 cup"), null);
});

test("agrupa por utensílio com o peso e a origem de cada alimento, sem inventar número", () => {
  const grupos = colinhaPorUtensilio([
    { id: "a", nome: "Feijão", medidas: [{ nome: "g", gramas: 1 }, { nome: "concha média cheia", gramas: 140, ref: "IBGE" }] },
    { id: "b", nome: "Arroz", medidas: [{ nome: "colher de sopa cheia", gramas: 25, ref: "planilha" }, { nome: "concha média cheia", gramas: 100, ref: "planilha" }] },
    { id: "c", nome: "Aveia", medidas: [{ nome: "colher de sopa", gramas: 15 }, { nome: "unidade", gramas: 30 }] },
  ]);
  assert.deepEqual(grupos.map((g) => g.nome), ["Colher de sopa", "Concha"]);
  assert.deepEqual(grupos[1]!.linhas.map((l) => [l.alimento, l.gramas, l.origem]), [["Arroz", 100, "planilha"], ["Feijão", 140, "IBGE"]]);
  assert.equal(grupos[0]!.linhas.find((l) => l.alimento === "Aveia")!.origem, "Medida criada por você em Cálculos");
});
