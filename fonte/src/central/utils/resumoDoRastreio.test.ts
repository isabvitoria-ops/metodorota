import test from "node:test";
import assert from "node:assert/strict";
import type { RegistroDeReintroducao } from "@/central/types";
import { frequenciaDeSintomas, numerosDoRastreio, resumoPorAlimento } from "./resumoDoRastreio";

function reg(id: string, itemId: string, data: string, sintomas: string[], intensidade: number | null = null): RegistroDeReintroducao {
  return {
    id, itemId, itemNome: itemId, data, horario: null, semana: 1, quantidade: null, preparo: null,
    sintomas, intensidade, bristol: null, observacao: null, marcacao: [],
  } as unknown as RegistroDeReintroducao;
}

const itens = [
  { id: "pera", nome: "Pêra", status: "em_teste" as const },
  { id: "abacate", nome: "Abacate", status: "bem_tolerado" as const },
  { id: "manga", nome: "Manga", status: "nao_iniciado" as const },
];

const registros = [
  reg("1", "abacate", "2026-11-03", ["nenhum"], 0),
  reg("2", "abacate", "2026-11-03", ["nenhum"], 0),
  reg("3", "pera", "2026-11-04", ["gases", "diarreia"], 7),
  reg("4", "pera", "2026-11-08", ["gases"]),
  reg("5", "pera", "2026-11-10", ["nenhum"], 0),
];

test("por alimento: testes, dias, sintomas, intensidade máxima e a escada", () => {
  const [pera, abacate, ...resto] = resumoPorAlimento(itens, registros);
  assert.equal(resto.length, 0, "alimento sem registro não entra");
  assert.deepEqual(
    { nome: pera?.nome, testes: pera?.testes, dias: pera?.dias, comSintoma: pera?.comSintoma, max: pera?.intensidadeMaxima, ultimo: pera?.ultimo },
    { nome: "Pêra", testes: 3, dias: 3, comSintoma: 2, max: 7, ultimo: "2026-11-10" },
  );
  assert.deepEqual(pera?.sintomas.map((s) => [s.rotulo, s.vezes]), [["Gases", 2], ["Diarreia", 1]]);
  // gases (1) + diarreia (2) = 3 pontos: a mesma conta que a paciente vê.
  assert.equal(pera?.escada.rotulo, "Não tolerado");
  assert.equal(pera?.escada.pontos, 3);
  // O último sintoma foi no dia 8; depois dele veio um teste tranquilo. É fato
  // para a nutricionista reler — a escada continua "Não tolerado".
  assert.deepEqual(
    { ultimo: pera?.ultimoComSintoma, depois: pera?.semSintomaDepois },
    { ultimo: "2026-11-08", depois: 1 },
  );
  assert.deepEqual(
    { ultimo: abacate?.ultimoComSintoma, depois: abacate?.semSintomaDepois },
    { ultimo: null, depois: 0 },
  );
  // Dois registros no mesmo dia são uma exposição só.
  assert.deepEqual({ testes: abacate?.testes, dias: abacate?.dias, max: abacate?.intensidadeMaxima }, { testes: 2, dias: 1, max: null });
  assert.equal(abacate?.status, "bem_tolerado");
});

test("sintomas mais relatados: registros e alimentos, sem contar o “nenhum”", () => {
  assert.deepEqual(frequenciaDeSintomas(registros), [
    { chave: "gases", rotulo: "Gases", registros: 2, alimentos: 1 },
    { chave: "diarreia", rotulo: "Diarreia", registros: 1, alimentos: 1 },
  ]);
  assert.deepEqual(frequenciaDeSintomas([]), []);
});

test("números do alto: registros, com sintoma, alimentos e dias", () => {
  assert.deepEqual(numerosDoRastreio(registros), { registros: 5, comSintoma: 2, alimentos: 2, dias: 4 });
});
