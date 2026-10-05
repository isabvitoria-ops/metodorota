import assert from "node:assert/strict";
import { test } from "node:test";

import {
  semanaDoEpoch,
  cadenciaDeveAparecer,
  regraExibicaoCumprida,
  perguntasDestaSemana,
} from "./filtroPerguntasCheckin";
import type { PerguntaParaResponder, RegraExibicao } from "@/central/types/questionario";

// ---------------------------------------------------------------------------
// semanaDoEpoch
// ---------------------------------------------------------------------------

test("semanaDoEpoch: epoch zero é semana 0", () => {
  assert.equal(semanaDoEpoch("1970-01-01"), 0);
});

test("semanaDoEpoch: 7 dias depois é semana 1", () => {
  assert.equal(semanaDoEpoch("1970-01-08"), 1);
});

test("semanaDoEpoch: data real", () => {
  const s = semanaDoEpoch("2026-10-05");
  assert.ok(s > 2950);
});

test("semanaDoEpoch: data inválida retorna 0", () => {
  assert.equal(semanaDoEpoch("lixo"), 0);
});

// ---------------------------------------------------------------------------
// cadenciaDeveAparecer
// ---------------------------------------------------------------------------

test("semanal aparece sempre", () => {
  assert.ok(cadenciaDeveAparecer("semanal", "2026-10-05"));
  assert.ok(cadenciaDeveAparecer("semanal", "2026-10-12"));
});

test("null/undefined = semanal", () => {
  assert.ok(cadenciaDeveAparecer(null, "2026-10-05"));
  assert.ok(cadenciaDeveAparecer(undefined, "2026-10-05"));
});

test("quinzenal aparece só em semana par", () => {
  const par = semanaDoEpoch("2026-10-05") % 2 === 0;
  assert.equal(cadenciaDeveAparecer("quinzenal", "2026-10-05"), par);
  const proxima = semanaDoEpoch("2026-10-12") % 2 === 0;
  assert.equal(cadenciaDeveAparecer("quinzenal", "2026-10-12"), proxima);
  // Uma das duas tem que ser true, outra false
  assert.notEqual(par, proxima);
});

test("mensal aparece a cada 4 semanas", () => {
  let apareceu = 0;
  for (let d = 0; d < 28; d += 7) {
    const dia = new Date(Date.UTC(2026, 0, 5 + d)).toISOString().slice(0, 10);
    if (cadenciaDeveAparecer("mensal", dia)) apareceu++;
  }
  assert.equal(apareceu, 1);
});

// ---------------------------------------------------------------------------
// regraExibicaoCumprida
// ---------------------------------------------------------------------------

test("sem regra → sempre visível", () => {
  assert.ok(regraExibicaoCumprida(null, new Map()));
  assert.ok(regraExibicaoCumprida(undefined, new Map()));
});

test("igual: resposta bate", () => {
  const regra: RegraExibicao = { perguntaCodigo: "I03", operador: "igual", valor: "sim" };
  const respostas = new Map([["I03", "sim"]]);
  assert.ok(regraExibicaoCumprida(regra, respostas));
});

test("igual: resposta não bate", () => {
  const regra: RegraExibicao = { perguntaCodigo: "I03", operador: "igual", valor: "sim" };
  const respostas = new Map([["I03", "nao"]]);
  assert.ok(!regraExibicaoCumprida(regra, respostas));
});

test("diferente", () => {
  const regra: RegraExibicao = { perguntaCodigo: "I03", operador: "diferente", valor: "sim" };
  assert.ok(regraExibicaoCumprida(regra, new Map([["I03", "nao"]])));
  assert.ok(!regraExibicaoCumprida(regra, new Map([["I03", "sim"]])));
});

test("inclui", () => {
  const regra: RegraExibicao = { perguntaCodigo: "G03", operador: "inclui", valor: "dor" };
  assert.ok(regraExibicaoCumprida(regra, new Map([["G03", "dor de cabeça"]])));
  assert.ok(!regraExibicaoCumprida(regra, new Map([["G03", "náusea"]])));
});

test("nao_inclui", () => {
  const regra: RegraExibicao = { perguntaCodigo: "G03", operador: "nao_inclui", valor: "dor" };
  assert.ok(!regraExibicaoCumprida(regra, new Map([["G03", "dor de cabeça"]])));
  assert.ok(regraExibicaoCumprida(regra, new Map([["G03", "náusea"]])));
});

test("pergunta-filtro sem resposta → esconde", () => {
  const regra: RegraExibicao = { perguntaCodigo: "I03", operador: "igual", valor: "sim" };
  assert.ok(!regraExibicaoCumprida(regra, new Map()));
});

// ---------------------------------------------------------------------------
// perguntasDestaSemana
// ---------------------------------------------------------------------------

function p(
  id: string,
  opts: Partial<PerguntaParaResponder> = {},
): PerguntaParaResponder {
  return {
    id,
    texto: `Pergunta ${id}`,
    tipo: "escala",
    opcoes: [],
    obrigatoria: true,
    peso: 1,
    invertida: false,
    ...opts,
  };
}

test("filtra ativa=false", () => {
  const lista = [p("1"), p("2", { ativa: false })];
  const resultado = perguntasDestaSemana(lista, "2026-10-05", {});
  assert.equal(resultado.length, 1);
  assert.equal(resultado[0].id, "1");
});

test("filtra por cadência quinzenal", () => {
  const par = semanaDoEpoch("2026-10-05") % 2 === 0;
  const lista = [p("1"), p("2", { cadencia: "quinzenal" })];
  const resultado = perguntasDestaSemana(lista, "2026-10-05", {});
  if (par) {
    assert.equal(resultado.length, 2);
  } else {
    assert.equal(resultado.length, 1);
    assert.equal(resultado[0].id, "1");
  }
});

test("regra condicional esconde quando trigger não respondido", () => {
  const regra: RegraExibicao = { perguntaCodigo: "I03", operador: "igual", valor: "sim" };
  const lista = [
    p("trigger", { codigo: "I03" }),
    p("cond", { codigo: "I05", regraExibicao: regra }),
  ];
  const resultado = perguntasDestaSemana(lista, "2026-10-05", {});
  const ids = resultado.map((r) => r.id);
  assert.ok(ids.includes("trigger"));
  assert.ok(!ids.includes("cond"));
});

test("regra condicional mostra quando trigger respondido com valor certo", () => {
  const regra: RegraExibicao = { perguntaCodigo: "I03", operador: "igual", valor: "sim" };
  const lista = [
    p("trigger", { codigo: "I03" }),
    p("cond", { codigo: "I05", regraExibicao: regra }),
  ];
  const resultado = perguntasDestaSemana(lista, "2026-10-05", { trigger: "sim" });
  const ids = resultado.map((r) => r.id);
  assert.ok(ids.includes("trigger"));
  assert.ok(ids.includes("cond"));
});

test("regra condicional esconde quando trigger respondido com valor errado", () => {
  const regra: RegraExibicao = { perguntaCodigo: "I03", operador: "igual", valor: "sim" };
  const lista = [
    p("trigger", { codigo: "I03" }),
    p("cond", { codigo: "I05", regraExibicao: regra }),
  ];
  const resultado = perguntasDestaSemana(lista, "2026-10-05", { trigger: "nao" });
  const ids = resultado.map((r) => r.id);
  assert.ok(ids.includes("trigger"));
  assert.ok(!ids.includes("cond"));
});

test("pergunta sem código: cód é inferido do mapa id→codigo e resposta vazia não conta", () => {
  const lista = [p("1"), p("2")];
  const resultado = perguntasDestaSemana(lista, "2026-10-05", {});
  assert.equal(resultado.length, 2);
});
