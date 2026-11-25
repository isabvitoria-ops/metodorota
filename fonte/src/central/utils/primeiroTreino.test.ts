import test from "node:test";
import assert from "node:assert/strict";
import { conferirHoje, linhasIniciais, seriesDeHoje } from "./primeiroTreino.ts";
import type { Treino } from "../types/treino.ts";

const salvo = {
  id: "t1",
  exercicios: [
    { id: "e1", nome: "Agachamento", ordem: 1, seriesPlanejadas: 3, repeticoesMin: null, repeticoesMax: null, observacao: null, videoUrl: null, faixas: [] },
    { id: "e2", nome: "Remada", ordem: 2, seriesPlanejadas: null, repeticoesMin: null, repeticoesMax: null, observacao: null, videoUrl: null, faixas: [] },
  ],
} as unknown as Treino;

test("começa com as séries que ela escreveu, ou uma linha", () => {
  assert.equal(linhasIniciais("3"), 3);
  assert.equal(linhasIniciais(""), 1);
  assert.equal(linhasIniciais("abc"), 1);
  assert.equal(linhasIniciais("50"), 20);
});

test("as cargas de hoje viram a sessão, ligadas aos exercícios salvos", () => {
  const series = seriesDeHoje(
    [
      { nome: "Agachamento", hoje: [{ carga: "40", repeticoes: "10" }, { carga: "", repeticoes: "" }, { carga: "42,5", repeticoes: "8" }] },
      { nome: "  ", hoje: [{ carga: "1", repeticoes: "1" }] },
      { nome: "Remada", hoje: [{ carga: "", repeticoes: "12" }] },
    ],
    salvo,
  );
  assert.deepEqual(
    series.map((s) => [s.exercicioId, s.exercicioNome, s.numero, s.carga, s.repeticoes]),
    [["e1", "Agachamento", 1, "40", "10"], ["e1", "Agachamento", 2, "42,5", "8"], ["e2", "Remada", 3, "", "12"]],
  );
});

test("nada preenchido é aceito; carga sem repetições é avisada, não descartada", () => {
  assert.equal(conferirHoje([{ nome: "Agachamento", hoje: [{ carga: "", repeticoes: "" }] }]), null);
  assert.match(conferirHoje([{ nome: "Agachamento", hoje: [{ carga: "40", repeticoes: "" }] }])!, /Faltou o número de repetições em Agachamento, série 1/);
  assert.match(conferirHoje([{ nome: "Remada", hoje: [{ carga: "x", repeticoes: "10" }] }])!, /Não entendi a carga "x"/);
  assert.match(conferirHoje([{ nome: "Remada", hoje: [{ carga: "10", repeticoes: "8,5" }] }])!, /número inteiro/);
});
