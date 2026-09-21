import test from "node:test";
import assert from "node:assert/strict";
import {
  CIRCUNFERENCIAS,
  DOBRAS,
  medidasPreenchidas,
  numeroDaMedida,
  valorComUnidade,
  valoresDeMedidas,
} from "./medidasCorporais";

test("as listas têm os mesmos nomes da ferramenta de cálculo", () => {
  // Nomes diferentes nos dois lugares partiriam o histórico da paciente ao
  // meio: "Axilar média" e "Axilar" virariam medidas distintas.
  assert.deepEqual(
    DOBRAS.map((d) => d.nome),
    ["Bíceps", "Tríceps", "Peitoral / tórax", "Subescapular", "Axilar média",
     "Supra-ilíaca", "Abdominal", "Coxa", "Panturrilha"],
  );
  assert.equal(CIRCUNFERENCIAS.length, 10);
  assert.ok(DOBRAS.every((d) => d.unidade === "mm"));
  assert.ok(CIRCUNFERENCIAS.every((c) => c.unidade === "cm"));
});

test("o que ela não mediu não vira linha nenhuma", () => {
  const medidas = medidasPreenchidas(DOBRAS, { "Tríceps": "9,6", "Abdominal": "8,2" });
  assert.deepEqual(medidas, [
    { nome: "Tríceps", valor: "9,6 mm" },
    { nome: "Abdominal", valor: "8,2 mm" },
  ]);
});

test("campo em branco e campo só com espaço somem igual", () => {
  assert.deepEqual(medidasPreenchidas(DOBRAS, { "Tríceps": "", "Coxa": "   " }), []);
});

test("a ordem é a da lista, não a de digitação", () => {
  const medidas = medidasPreenchidas(DOBRAS, { "Coxa": "12", "Bíceps": "5" });
  assert.deepEqual(medidas.map((m) => m.nome), ["Bíceps", "Coxa"]);
});

test("circunferência sai em cm", () => {
  assert.deepEqual(
    medidasPreenchidas(CIRCUNFERENCIAS, { "Cintura": "61" }),
    [{ nome: "Cintura", valor: "61 cm" }],
  );
});

test("avaliação antiga, com a unidade dentro do valor, ainda abre para editar", () => {
  const valores = valoresDeMedidas([
    { nome: "Tríceps", valor: "9,6 mm" },
    { nome: "Cintura", valor: "61 cm" },
  ]);
  assert.equal(valores["Tríceps"], "9,6");
  assert.equal(valores["Cintura"], "61");
});

test("numeroDaMedida aceita as formas que já existem guardadas", () => {
  assert.equal(numeroDaMedida("9,6 mm"), "9,6");
  assert.equal(numeroDaMedida("9.6"), "9,6");
  assert.equal(numeroDaMedida("61"), "61");
  assert.equal(numeroDaMedida("  8,0 mm  "), "8,0");
  assert.equal(numeroDaMedida(""), "");
  assert.equal(numeroDaMedida(undefined), "");
  assert.equal(numeroDaMedida("sem número"), "");
});

test("valorComUnidade não inventa medida a partir do vazio", () => {
  assert.equal(valorComUnidade("", "mm"), "");
  assert.equal(valorComUnidade("   ", "mm"), "");
  assert.equal(valorComUnidade("9,6", "mm"), "9,6 mm");
});

test("ida e volta não perde nem inventa medida", () => {
  const originais = { "Tríceps": "9,6", "Subescapular": "8", "Abdominal": "8,2" };
  const guardadas = medidasPreenchidas(DOBRAS, originais);
  const devolta = valoresDeMedidas(guardadas);
  assert.equal(devolta["Tríceps"], "9,6");
  assert.equal(devolta["Subescapular"], "8");
  assert.equal(devolta["Abdominal"], "8,2");
  assert.equal(devolta["Coxa"], undefined, "o que não foi medido não volta");
});
