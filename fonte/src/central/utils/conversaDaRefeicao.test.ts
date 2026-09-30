import test from "node:test";
import assert from "node:assert/strict";
import type { RefeicaoProtocolo } from "@/central/types/protocolo";
import type { ResumoDaConversa } from "@/central/types/conversaDaRefeicao";
import {
  alimentosDaRefeicao,
  chaveDaRefeicao,
  enderecoDaRastreabilidade,
  lerPreenchimento,
  mesmaRefeicao,
  naoLidasDaRefeicao,
  sintomasMencionados,
  totalNaoLidas,
} from "./conversaDaRefeicao";

test("a chave da refeição não liga para maiúscula nem espaço", () => {
  assert.equal(chaveDaRefeicao("  Jantar "), "jantar");
  assert.ok(mesmaRefeicao("Almoço", " almoço "));
  assert.ok(!mesmaRefeicao("Jantar", "Almoço"));
});

test("sintomas que ela menciona, com e sem acento", () => {
  assert.deepEqual(sintomasMencionados("me deu inchaço depois do arroz"), ["distensao"]);
  assert.deepEqual(sintomasMencionados("fiquei com muito gás e cólica"), ["gases", "colica"]);
  assert.deepEqual(sintomasMencionados("tive DIARREIA"), ["diarreia"]);
  assert.deepEqual(sintomasMencionados("senti azia e enjoo"), ["nausea", "refluxo"]);
  assert.deepEqual(sintomasMencionados("dor na barriga logo depois"), ["dor_abdominal"]);
  assert.deepEqual(sintomasMencionados("intestino preso de novo"), ["constipacao"]);
});

test("frases sem sintoma de barriga não oferecem o atalho", () => {
  assert.deepEqual(sintomasMencionados("esse jantar ficou ótimo, obrigada"), []);
  assert.deepEqual(sintomasMencionados("estou com dor de cabeça"), []);
  assert.deepEqual(sintomasMencionados("posso trocar o arroz por tapioca?"), []);
  assert.deepEqual(sintomasMencionados(""), []);
});

test("alimentos da refeição: todas as opções, sem repetir", () => {
  const r: RefeicaoProtocolo = {
    nome: "Jantar",
    opcoes: [
      { rotulo: "A", notas: [], itens: [
        { alimento: "Arroz", quantidade: "4 col", substituicoes: [] },
        { alimento: "Frango", quantidade: "1 filé", substituicoes: [] },
      ] },
      { rotulo: "B", notas: [], itens: [
        { alimento: "arroz ", quantidade: "3 col", substituicoes: [] },
        { alimento: "Ovo", quantidade: "2", substituicoes: [] },
      ] },
    ],
  };
  assert.deepEqual(alimentosDaRefeicao(r), ["Arroz", "Frango", "Ovo"]);
});

test("o endereço da Rastreabilidade ida e volta", () => {
  const url = enderecoDaRastreabilidade({
    alimento: "Arroz & feijão",
    sintomas: ["distensao", "gases"],
    observacao: "me deu inchaço",
    refeicao: "Jantar",
  });
  assert.ok(url.startsWith("/rastreabilidade?"));
  const volta = lerPreenchimento(new URL(url, "https://x.test").searchParams);
  assert.deepEqual(volta, {
    alimento: "Arroz & feijão",
    sintomas: ["distensao", "gases"],
    observacao: "me deu inchaço",
    refeicao: "Jantar",
  });
});

test("o que vem no endereço não é confiado", () => {
  const p = lerPreenchimento(new URLSearchParams("alimento=Ovo&sintomas=gases,inventado,outros&obs=" + "x".repeat(500)));
  assert.deepEqual(p?.sintomas, ["gases", "outros"], "sintoma inventado é descartado");
  assert.equal(p?.observacao.length, 300);
  assert.equal(lerPreenchimento(new URLSearchParams("sintomas=gases")), null, "sem alimento, não preenche");
  assert.equal(lerPreenchimento(new URLSearchParams("alimento=%20%20")), null);
});

test("não lidas", () => {
  const r: ResumoDaConversa[] = [
    { refeicao: "Jantar", total: 3, naoLidas: 2, ultimaEm: "2026-09-30T20:00:00Z", ultimoAutor: "paciente" },
    { refeicao: "Almoço", total: 1, naoLidas: 1, ultimaEm: "2026-09-30T13:00:00Z", ultimoAutor: "paciente" },
  ];
  assert.equal(totalNaoLidas(r), 3);
  assert.equal(naoLidasDaRefeicao(r, " jantar"), 2);
  assert.equal(naoLidasDaRefeicao(r, "Café da manhã"), 0);
});
