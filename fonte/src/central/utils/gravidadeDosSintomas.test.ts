import test from "node:test";
import assert from "node:assert/strict";
import {
  alternarOpcao,
  gravidadesDoJson,
  jsonDaMultipla,
  pedeGravidade,
  semGravidade,
  textoComGravidade,
} from "./gravidadeDosSintomas.ts";

const OPCOES = ["Náuseas", "Vômitos", "Diarreia", "Nada disso"];

test("só a pergunta de marcar que pede intensidade", () => {
  assert.equal(pedeGravidade({ tipo: "multipla_escolha", alertasOpcoes: [{ indice: null, alerta: "A15", condicao: "gravidade_forte" }] }), true);
  assert.equal(pedeGravidade({ tipo: "multipla_escolha", textoAjuda: "Para cada um, indique se foi leve, moderado ou forte." }), true);
  assert.equal(pedeGravidade({ tipo: "multipla_escolha", alertasOpcoes: [{ indice: 3, alerta: "A15" }] }), false);
  assert.equal(pedeGravidade({ tipo: "escolha", textoAjuda: "leve, moderado ou forte" }), false);
});

test("'Nada disso' desmarca os outros, e marcar um sintoma tira o 'Nada disso'", () => {
  assert.deepEqual(alternarOpcao(["Náuseas", "Diarreia"], "Nada disso"), ["Nada disso"]);
  assert.deepEqual(alternarOpcao(["Nada disso"], "Náuseas"), ["Náuseas"]);
  assert.deepEqual(alternarOpcao(["Náuseas"], "Náuseas"), []);
});

test("cobra a intensidade de cada sintoma marcado, menos do 'Nada disso'", () => {
  assert.deepEqual(semGravidade(["Náuseas", "Diarreia"], { Náuseas: "leve" }), ["Diarreia"]);
  assert.deepEqual(semGravidade(["Nada disso"], {}), []);
});

test("o json leva os índices e a intensidade, e volta igual", () => {
  const json = jsonDaMultipla(OPCOES, ["Diarreia", "Náuseas"], { Náuseas: "forte", Diarreia: "leve", Vômitos: "moderado" });
  assert.deepEqual(json, { marcados: [0, 2], gravidade: { "0": "forte", "2": "leve" } });
  assert.deepEqual(gravidadesDoJson(OPCOES, json), { Náuseas: "forte", Diarreia: "leve" });
  assert.deepEqual(jsonDaMultipla(OPCOES, ["Nada disso"], {}), { marcados: [3] });
});

test("a nutricionista lê a intensidade ao lado do sintoma", () => {
  assert.equal(
    textoComGravidade("Náuseas\nDiarreia", OPCOES, { marcados: [0, 2], gravidade: { "0": "forte", "2": "leve" } }),
    "Náuseas (forte)\nDiarreia (leve)",
  );
  assert.equal(textoComGravidade("Náuseas", OPCOES, null), "Náuseas");
});
