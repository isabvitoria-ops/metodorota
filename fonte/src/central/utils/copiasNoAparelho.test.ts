import test from "node:test";
import assert from "node:assert/strict";
import { chavesParaApagarAoSair } from "./copiasNoAparelho.ts";

const dia = (pendente: boolean) =>
  JSON.stringify({ "2026-11-11": { onde: "Roma", inchaco: "3", dor: "", azia: "", evacuacoes: "", bristol: "", observacoes: "", pendente } });

test("sair: as cópias do protocolo e do guia saem do aparelho", () => {
  const apagar = chavesParaApagarAoSair({
    "central:protocolo:v1:abc": "{}",
    "central:viagem-guia:v1:abc": "{}",
    "central:protocolo-opcoes:v1:abc": "{}",
    "central:favoritos": "[]",
  });
  assert.deepEqual(apagar.sort(), ["central:protocolo:v1:abc", "central:viagem-guia:v1:abc"]);
});

test("sair: diário que já subiu sai; o que ainda não subiu fica", () => {
  assert.deepEqual(chavesParaApagarAoSair({ "central:viagem-diario:v2:abc": dia(false) }), ["central:viagem-diario:v2:abc"]);
  assert.deepEqual(chavesParaApagarAoSair({ "central:viagem-diario:v2:abc": dia(true) }), []);
});

test("sair: diário no formato antigo só sai se já passou para o novo", () => {
  assert.deepEqual(chavesParaApagarAoSair({ "central:viagem-diario:v1:abc": "{}" }), []);
  assert.deepEqual(
    chavesParaApagarAoSair({ "central:viagem-diario:v1:abc": "{}", "central:viagem-diario:v2:abc": dia(true) }),
    ["central:viagem-diario:v1:abc"],
  );
});
