import assert from "node:assert/strict";
import test from "node:test";
import type { RegistroDeReintroducao, SintomaReintroducao } from "@/central/types";
import { classificar, fraseDo } from "./rastreio";

/**
 * A escada de tolerância do Rastreio Alimentar.
 *
 * Isto é regra clínica dela, não detalhe de tela: é o que decide se a
 * paciente vê verde, amarelo ou vermelho ao lado de um alimento. Os dois
 * exemplos que ela deu por voz viraram teste, e os cinco sintomas de peso
 * dobrado também — se alguém mexer nesses pesos sem querer, quebra aqui e
 * não na frente de uma paciente.
 */
function registro(sintomas: SintomaReintroducao[]): RegistroDeReintroducao {
  return {
    id: Math.random().toString(36).slice(2),
    itemId: "i1",
    itemNome: "Abacate",
    data: "2026-09-17",
    horario: null,
    quantidade: "1 unidade",
    preparo: null,
    sintomas,
    intensidade: null,
    bristol: null,
    observacao: null,
    semana: 1,
    marcacao: [],
    criadoEm: "2026-09-17T10:00:00Z",
  };
}

test("sem sintoma nenhum é verde", () => {
  assert.deepEqual(classificar([registro(["nenhum"])]), {
    tom: "bom",
    rotulo: "Bem tolerado",
  });
});

test("exemplo dela: abacate só com gases fica amarelo", () => {
  const r = classificar([registro(["gases"])]);
  assert.equal(r.tom, "atencao");
  assert.equal(r.rotulo, "Comer com atenção");
});

test("dois sintomas leves ainda são amarelo", () => {
  assert.equal(classificar([registro(["gases", "distensao"])]).tom, "atencao");
});

test("exemplo dela: gases, distensão e diarreia fica vermelho", () => {
  // 1 + 1 + 2 = 4 pontos.
  const r = classificar([registro(["gases", "distensao", "diarreia"])]);
  assert.equal(r.tom, "grave");
  assert.equal(r.rotulo, "Pouco tolerado");
});

test("três sintomas leves também chegam a vermelho", () => {
  assert.equal(classificar([registro(["gases", "distensao", "colica"])]).tom, "grave");
});

test("os cinco sintomas pesados valem dois pontos cada", () => {
  for (const pesado of ["diarreia", "urgencia", "nausea", "refluxo", "manchas_pele"] as const) {
    // Sozinho: 2 pontos, amarelo.
    assert.equal(classificar([registro([pesado])]).tom, "atencao", pesado);
    // Com qualquer leve junto: 3 pontos, vermelho.
    assert.equal(classificar([registro([pesado, "gases"])]).tom, "grave", pesado);
  }
});

test("dois sintomas pesados juntos são vermelho", () => {
  assert.equal(classificar([registro(["diarreia", "refluxo"])]).tom, "grave");
});

test("o mesmo sintoma repetido em vários testes conta uma vez só", () => {
  const tres = [registro(["gases"]), registro(["gases"]), registro(["gases"])];
  assert.equal(classificar(tres).tom, "atencao");
});

test("sintomas diferentes em testes diferentes somam", () => {
  const dois = [registro(["gases"]), registro(["diarreia"])];
  assert.equal(classificar(dois).tom, "grave");
});

test("a frase nomeia só o que foi registrado, sem diagnosticar", () => {
  assert.equal(fraseDo([registro(["nenhum"])]), "Sem sintomas observados.");

  const uma = fraseDo([registro(["gases"])]);
  assert.match(uma, /^Seu corpo apresentou /);
  assert.ok(uma.includes("gases"));

  const duas = fraseDo([registro(["gases", "distensao"])]);
  assert.ok(duas.includes(" e "), duas);

  // Nada de conclusão sobre a pessoa, em nenhum dos casos.
  for (const frase of [uma, duas, fraseDo([registro(["diarreia", "refluxo", "nausea"])])]) {
    assert.doesNotMatch(frase, /intoler|proibid|não pode|faz mal|alérgic/i);
  }
});
