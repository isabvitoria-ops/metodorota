import test from "node:test";
import assert from "node:assert/strict";
import type { AlimentoRestrito } from "@/central/types/restricao";
import { aplicarRestricoes, avisoDaRestricao, fraseDasEscondidas, restricaoPorAlimento } from "./restricoesNaTroca.ts";

const r = (alimentoId: string, tipo: AlimentoRestrito["tipo"], origem: AlimentoRestrito["origem"] = "consulta"): AlimentoRestrito => ({ alimentoId, tipo, origem });
const lista = ["tapioca", "pao-frances", "amendoim", "jilo", "cuscuz"].map((id) => ({ id }));

test("alergia some, preferência vai para o fim, o resto fica na ordem", () => {
  const mapa = restricaoPorAlimento([r("amendoim", "alergia"), r("jilo", "preferencia"), r("pao-frances", "intolerancia", "rastreio")]);
  const { lista: final, escondidas } = aplicarRestricoes(lista, mapa);
  assert.deepEqual(final.map((a) => a.id), ["tapioca", "pao-frances", "cuscuz", "jilo"]);
  assert.equal(escondidas, 1);
});

test("a restrição mais forte ganha", () => {
  const mapa = restricaoPorAlimento([r("amendoim", "preferencia"), r("amendoim", "alergia")]);
  assert.equal(mapa.get("amendoim")?.tipo, "alergia");
});

test("o aviso: teste, intolerância, sensibilidade; alergia e preferência sem aviso", () => {
  assert.equal(avisoDaRestricao(r("x", "intolerancia", "rastreio")), "Você não se sentiu bem no teste");
  assert.equal(avisoDaRestricao(r("x", "sensibilidade", "rastreio")), "Você não se sentiu bem no teste");
  assert.equal(avisoDaRestricao(r("x", "intolerancia")), "Intolerância");
  assert.equal(avisoDaRestricao(r("x", "sensibilidade")), "Sensibilidade");
  assert.equal(avisoDaRestricao(r("x", "preferencia")), null);
  assert.equal(avisoDaRestricao(undefined), null);
});

test("a frase das escondidas", () => {
  assert.equal(fraseDasEscondidas(0), null);
  assert.equal(fraseDasEscondidas(1), "1 opção escondida porque você tem alergia cadastrada.");
  assert.equal(fraseDasEscondidas(2), "2 opções escondidas porque você tem alergia cadastrada.");
});
