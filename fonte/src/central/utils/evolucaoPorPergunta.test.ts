import assert from "node:assert/strict";
import { test } from "node:test";

import {
  resumoDaPergunta,
  serieDaPergunta,
  temGrafico,
  trechosDaLinha,
} from "./evolucaoPorPergunta";

const energia = { id: "e", tipo: "escala" as const, peso: 1, invertida: false };
const dor = { id: "d", tipo: "escala" as const, peso: 1, invertida: true };

const envios = [
  { id: "3", periodo: "2026-09-14", respostas: [{ perguntaId: "e", numero: 8, texto: null }] },
  { id: "1", periodo: "2026-08-31", respostas: [{ perguntaId: "e", numero: 4, texto: null }] },
  { id: "2", periodo: "2026-09-07", respostas: [{ perguntaId: "d", numero: 2, texto: null }] },
];

test("a série sai em ordem de data, não na ordem que chegou", () => {
  const serie = serieDaPergunta(energia, envios);
  assert.deepEqual(
    serie.map((p) => p.periodo),
    ["2026-08-31", "2026-09-07", "2026-09-14"],
  );
});

test("semana sem resposta é buraco, e não zero", () => {
  const serie = serieDaPergunta(energia, envios);
  assert.deepEqual(
    serie.map((p) => p.valor),
    [4, null, 8],
  );
});

test("pergunta invertida sobe quando a semana foi melhor", () => {
  // Dor 2 é semana boa: no gráfico, vale 8.
  const serie = serieDaPergunta(dor, envios);
  assert.equal(serie[1]?.valor, 8);
});

test("peso zero sai da nota, mas não sai do gráfico", () => {
  const serie = serieDaPergunta({ ...energia, peso: 0 }, envios);
  assert.equal(serie[0]?.valor, 4);
});

test("o buraco parte a linha em dois trechos", () => {
  const serie = serieDaPergunta(energia, envios);
  assert.deepEqual(trechosDaLinha(serie), [[0], [2]]);
});

test("sem buraco, é um trecho só", () => {
  const serie = [
    { periodo: "a", valor: 1 },
    { periodo: "b", valor: 2 },
    { periodo: "c", valor: 3 },
  ];
  assert.deepEqual(trechosDaLinha(serie), [[0, 1, 2]]);
});

test("o resumo conta as semanas respondidas e acha as pontas com valor", () => {
  const resumo = resumoDaPergunta(serieDaPergunta(energia, envios));
  assert.equal(resumo.respondidas, 2);
  assert.equal(resumo.total, 3);
  assert.equal(resumo.primeiro?.valor, 4);
  assert.equal(resumo.ultimo?.valor, 8);
});

test("texto e número livre não viram gráfico", () => {
  assert.equal(temGrafico({ tipo: "texto" }), false);
  assert.equal(temGrafico({ tipo: "numero" }), false);
  assert.equal(temGrafico({ tipo: "sim_nao" }), true);
});
