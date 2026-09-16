import assert from "node:assert/strict";
import test from "node:test";
import type { ItemDeReintroducao, RegistroDeReintroducao } from "@/central/types";
import {
  BRISTOL,
  SINTOMAS,
  STATUS,
  faixaDaIntensidade,
  fraseDoHistorico,
  itensParaRegistrar,
  porSemana,
  rotuloSintoma,
  status,
} from "./reintroducao";

function item(parcial: Partial<ItemDeReintroducao>): ItemDeReintroducao {
  return {
    id: "i1",
    alimentoId: "abacate",
    nome: "Abacate",
    categoria: "gorduras",
    semanaSugerida: 1,
    porcaoReferencia: "60g",
    observacaoMaterial: null,
    doCatalogo: true,
    status: "nao_iniciado",
    notaNutri: null,
    ordem: 1,
    totalDeRegistros: 0,
    ultimoRegistro: null,
    ...parcial,
  };
}

function registro(parcial: Partial<RegistroDeReintroducao>): RegistroDeReintroducao {
  return {
    id: "r1",
    itemId: "i1",
    itemNome: "Abacate",
    data: "2026-09-01",
    horario: null,
    semana: 1,
    quantidade: null,
    preparo: null,
    sintomas: [],
    intensidade: null,
    bristol: null,
    observacao: null,
    criadoEm: "2026-09-01T10:00:00Z",
    ...parcial,
  };
}

// ---------------------------------------------------------------- intensidade

test("a escala de intensidade é a que ela definiu", () => {
  assert.equal(faixaDaIntensidade(0), "Nenhum");
  assert.equal(faixaDaIntensidade(1), "Leve");
  assert.equal(faixaDaIntensidade(3), "Leve");
  assert.equal(faixaDaIntensidade(4), "Moderado");
  assert.equal(faixaDaIntensidade(6), "Moderado");
  assert.equal(faixaDaIntensidade(7), "Intenso");
  assert.equal(faixaDaIntensidade(10), "Intenso");
});

// ------------------------------------------------------------------ vocabulário

test("todo sintoma do protocolo dela tem rótulo em português", () => {
  for (const sintoma of SINTOMAS) {
    assert.equal(rotuloSintoma(sintoma.chave), sintoma.rotulo);
    assert.notEqual(sintoma.rotulo.trim(), "");
  }
});

test("as manchas pelo corpo do protocolo dela estão na lista", () => {
  assert.ok(SINTOMAS.some((s) => s.chave === "manchas_pele"));
});

test("a escala de Bristol tem os sete tipos do material", () => {
  assert.equal(BRISTOL.length, 7);
  assert.deepEqual(
    BRISTOL.map((b) => b.tipo),
    [1, 2, 3, 4, 5, 6, 7],
  );
});

// Este é o teste que protege a regra mais importante do módulo. Se alguém um
// dia acrescentar um status chamado "proibido", "intolerante" ou "excluir", é
// aqui que isso para.
test("nenhum status sugere exclusão ou culpa", () => {
  const proibidos = [
    "proib", "intoler", "excluir", "excluído", "vetado", "não pode",
    "falhou", "atrasad", "pendente", "errado",
  ];
  for (const s of STATUS) {
    for (const palavra of proibidos) {
      assert.ok(
        !s.rotulo.toLowerCase().includes(palavra),
        `o rótulo "${s.rotulo}" carrega a palavra "${palavra}"`,
      );
      assert.ok(
        !s.paciente.toLowerCase().includes(palavra),
        `o texto da paciente "${s.paciente}" carrega a palavra "${palavra}"`,
      );
    }
  }
});

test("status desconhecido não quebra a tela", () => {
  assert.equal(status("inventado" as never).chave, "nao_iniciado");
});

// ------------------------------------------------------------------- semanas

test("os registros são agrupados por semana, da mais recente para a mais antiga", () => {
  const grupos = porSemana([
    registro({ id: "a", semana: 1 }),
    registro({ id: "b", semana: 3 }),
    registro({ id: "c", semana: 1 }),
  ]);
  assert.deepEqual(
    grupos.map((g) => g.semana),
    [3, 1],
  );
  assert.equal(grupos[1]?.registros.length, 2);
});

test("sem registro nenhum, não existe semana — e não existe cobrança", () => {
  assert.deepEqual(porSemana([]), []);
});

// --------------------------------------------------- o que aparece para marcar

test("o alimento que ela disse não comer sai da hora de registrar", () => {
  const lista = [
    item({ id: "i1", nome: "Abacate" }),
    item({ id: "i2", nome: "Brócolis", status: "nao_relevante" }),
  ];
  assert.deepEqual(
    itensParaRegistrar(lista).map((i) => i.nome),
    ["Abacate"],
  );
});

test("mas tudo o mais continua disponível, inclusive o que tem sintoma anotado", () => {
  const lista = [
    item({ id: "i1", status: "sintomas_observados" }),
    item({ id: "i2", status: "pausado" }),
    item({ id: "i3", status: "bem_tolerado" }),
  ];
  assert.equal(itensParaRegistrar(lista).length, 3);
});

// ------------------------------------------------------------------- frases

test("a frase do histórico nunca conta o que falta", () => {
  const frases = [
    fraseDoHistorico(0, 0),
    fraseDoHistorico(0, 12),
    fraseDoHistorico(1, 1),
    fraseDoHistorico(7, 3),
  ];
  for (const frase of frases) {
    for (const palavra of ["falta", "restam", "ainda precisa", "complete", "de 12", "atrasad"]) {
      assert.ok(
        !frase.toLowerCase().includes(palavra),
        `a frase "${frase}" cobra com "${palavra}"`,
      );
    }
  }
});

test("sem registro e sem lista, a frase convida em vez de cobrar", () => {
  const frase = fraseDoHistorico(0, 0);
  assert.ok(frase.includes("já pode registrar"));
});

test("com registros, a frase conta o que existe", () => {
  assert.equal(fraseDoHistorico(1, 1), "1 registro até agora, em 1 alimento.");
  assert.equal(fraseDoHistorico(7, 3), "7 registros até agora, em 3 alimentos.");
});
