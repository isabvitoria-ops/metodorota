import test from "node:test";
import assert from "node:assert/strict";
import { AREAS, areaLigada, ehArea } from "./areas.ts";

test("tudo nasce ligado, inclusive para quem ainda não tem a lista", () => {
  assert.equal(areaLigada({ papel: "paciente", areasDesligadas: undefined }, "trocas"), true);
  assert.equal(areaLigada({ papel: "paciente", areasDesligadas: [] }, "cozinha"), true);
});

test("desligada só a que ela desligou", () => {
  const a = { papel: "paciente" as const, areasDesligadas: ["trocas"] };
  assert.equal(areaLigada(a, "trocas"), false);
  assert.equal(areaLigada(a, "comer_fora"), true);
});

test("a nutricionista vê tudo", () => {
  assert.equal(areaLigada({ papel: "admin", areasDesligadas: ["trocas"] }, "trocas"), true);
});

test("protocolo não é área desligável", () => {
  assert.equal(ehArea("protocolo"), false);
  assert.ok(AREAS.every((a) => a.chave !== ("protocolo" as string)));
});

test("cada endereço sabe a área dele", async () => {
  const { areaDaRota } = await import("./areas.ts");
  assert.equal(areaDaRota("/trocas?de=taco:1"), "trocas");
  assert.equal(areaDaRota("/comer-fora/japones/sushi"), "comer_fora");
  assert.equal(areaDaRota("/protocolo"), null);
  assert.equal(areaDaRota("/cozinhas"), null);
});
