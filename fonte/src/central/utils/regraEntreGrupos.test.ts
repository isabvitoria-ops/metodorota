import assert from "node:assert/strict";
import test from "node:test";
import type { GrupoAlimentar } from "@/central/types";
import { fraseDeMaoUnica } from "./regraEntreGrupos";
import { GRUPOS } from "@/central/dados/sementes/grupos";

function grupo(id: string, nome: string, trocaParaGrupos: string[] = []): GrupoAlimentar {
  return {
    id,
    nome,
    descricao: null,
    ordem: 1,
    regra: { tipo: "porcoes" },
    trocaPorPorcao: true,
    trocaParaGrupos,
    tags: [],
  };
}

const CARBO = grupo("carbo", "Carboidratos", ["fruta"]);
const FRUTA = grupo("fruta", "Frutas");
const PROTE = grupo("proteina", "Proteínas");
const TODOS = [CARBO, FRUTA, PROTE];

test("o grupo de origem diz o que ele vira", () => {
  const frase = fraseDeMaoUnica(CARBO, TODOS);
  assert.match(frase ?? "", /carboidratos pode virar uma porção de frutas/i);
  assert.match(frase ?? "", /nunca o contrário/i);
});

test("o grupo de destino ouve a mesma regra, do lado dele", () => {
  const frase = fraseDeMaoUnica(FRUTA, TODOS);
  assert.match(frase ?? "", /carboidratos pode virar uma porção de frutas/i);
  assert.match(frase ?? "", /nunca o contrário/i);
});

test("grupo sem relação de mão única não ganha frase nenhuma", () => {
  assert.equal(fraseDeMaoUnica(PROTE, TODOS), null);
});

/**
 * O ponto da frase ser derivada: ela não pode dizer uma coisa enquanto o
 * motor faz outra. Este teste roda sobre os grupos de verdade.
 */
test("nos grupos reais, quem tem a frase é carboidratos e frutas — e mais ninguém", () => {
  const comFrase = GRUPOS.filter((g) => fraseDeMaoUnica(g, GRUPOS) !== null).map((g) => g.id);
  assert.deepEqual(comFrase.sort(), ["carboidratos", "frutas"]);
});

test("a frase real nomeia o sentido certo", () => {
  const carboidratos = GRUPOS.find((g) => g.id === "carboidratos")!;
  const frase = fraseDeMaoUnica(carboidratos, GRUPOS)!;
  assert.equal(
    frase,
    "Sabia? Uma porção de carboidratos pode virar uma porção de frutas — mas nunca o contrário.",
  );
});
