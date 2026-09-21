import test from "node:test";
import assert from "node:assert/strict";
import type { CardioSessao, SessaoDeTreino, SerieDaSessao } from "@/central/types/treino";
import {
  exerciciosComHistorico,
  frequenciaPorSemana,
  noPeriodo,
  serieDoExercicio,
} from "./graficosTreino";

function serie(nome: string, numero: number, carga: number | null, reps: number | null): SerieDaSessao {
  return {
    id: `${nome}-${numero}`,
    exercicioId: null,
    exercicioNome: nome,
    numero,
    carga,
    repeticoes: reps,
    observacao: null,
  };
}

function sessao(data: string, series: SerieDaSessao[]): SessaoDeTreino {
  return { id: data, data, treinoId: null, observacao: null, series };
}

function cardio(data: string, minutos: number | null): CardioSessao {
  return {
    id: `${data}-c`, data, tipo: "Caminhada", duracaoMin: minutos,
    distanciaKm: null, intensidade: null, observacao: null,
  };
}

const AGACHAMENTO = [
  sessao("2026-09-10", [serie("Agachamento", 1, 60, 6)]),
  sessao("2026-09-13", [serie("Agachamento", 1, 60, 7)]),
  sessao("2026-09-17", [serie("Agachamento", 1, 62, 6)]),
];

test("a série de carga sai em ordem de data, da melhor série de cada sessão", () => {
  assert.deepEqual(serieDoExercicio(AGACHAMENTO, "Agachamento", "carga"), [
    { data: "2026-09-10", valor: 60 },
    { data: "2026-09-13", valor: 60 },
    { data: "2026-09-17", valor: 62 },
  ]);
  assert.deepEqual(
    serieDoExercicio(AGACHAMENTO, "Agachamento", "repeticoes").map((p) => p.valor),
    [6, 7, 6],
  );
});

test("a melhor série é a mesma régua do texto: maior carga, depois mais repetições", () => {
  const misto = [
    sessao("2026-09-10", [
      serie("Supino", 1, 40, 20),
      serie("Supino", 2, 60, 8),
      serie("Supino", 3, 60, 9),
    ]),
  ];
  // 40 × 20 tem mais volume, mas a melhor série é 60 × 9. Duas réguas
  // diferentes fariam o gráfico e a mensagem discordarem do mesmo dia.
  assert.deepEqual(serieDoExercicio(misto, "Supino", "carga"), [
    { data: "2026-09-10", valor: 60 },
  ]);
  assert.deepEqual(serieDoExercicio(misto, "Supino", "repeticoes"), [
    { data: "2026-09-10", valor: 9 },
  ]);
});

test("o volume soma carga × repetições de TODAS as séries da sessão", () => {
  const dia = [sessao("2026-09-10", [serie("Supino", 1, 60, 8), serie("Supino", 2, 60, 7)])];
  assert.deepEqual(serieDoExercicio(dia, "Supino", "volume"), [
    { data: "2026-09-10", valor: 900 },
  ]);
});

test("exercício sem carga não entra no gráfico de carga nem no de volume", () => {
  // Prancha: nulo não vira zero. Uma linha rente ao chão diria que ela não
  // fez nada naquele dia.
  const prancha = [sessao("2026-09-10", [serie("Prancha", 1, null, 30)])];
  assert.deepEqual(serieDoExercicio(prancha, "Prancha", "carga"), []);
  assert.deepEqual(serieDoExercicio(prancha, "Prancha", "volume"), []);
  // Mas no de repetições ele existe, que é como esse exercício evolui.
  assert.deepEqual(serieDoExercicio(prancha, "Prancha", "repeticoes"), [
    { data: "2026-09-10", valor: 30 },
  ]);
});

test("a frequência conta DIA de treino e MINUTO de cardio", () => {
  const treinos = [
    // Mesmo dia, duas vezes: é UM dia de treino.
    sessao("2026-09-22", [serie("A", 1, 10, 10)]),
    sessao("2026-09-22", [serie("B", 1, 10, 10)]),
    sessao("2026-09-24", [serie("A", 1, 10, 10)]),
  ];
  const semanas = frequenciaPorSemana(treinos, [cardio("2026-09-23", 30), cardio("2026-09-25", 20)], 2, "2026-09-24");
  const atual = semanas[semanas.length - 1]!;
  assert.equal(atual.semana, "2026-09-21");
  assert.equal(atual.treinos, 2);
  assert.equal(atual.cardioMin, 50);
});

test("semana sem nada aparece com zero — é o buraco que a profissional quer ver", () => {
  const semanas = frequenciaPorSemana([sessao("2026-09-22", [serie("A", 1, 10, 10)])], [], 3, "2026-09-24");
  assert.deepEqual(
    semanas.map((s) => s.treinos),
    [0, 0, 1],
  );
  // E sempre o número de semanas pedido, para a régua não mudar de tamanho.
  assert.equal(semanas.length, 3);
});

test("os exercícios vêm do mais registrado para o menos", () => {
  const s = [
    sessao("2026-09-10", [serie("Agachamento", 1, 60, 6), serie("Leg press", 1, 80, 12)]),
    sessao("2026-09-13", [serie("Agachamento", 1, 60, 7)]),
  ];
  assert.deepEqual(exerciciosComHistorico(s), ["Agachamento", "Leg press"]);
});

test("o período corta pelas pontas, e ponta nula não limita", () => {
  const lista = [{ data: "2026-09-01" }, { data: "2026-09-15" }, { data: "2026-09-30" }];
  assert.deepEqual(noPeriodo(lista, "2026-09-10", "2026-09-20"), [{ data: "2026-09-15" }]);
  assert.equal(noPeriodo(lista, null, null).length, 3);
  assert.equal(noPeriodo(lista, "2026-09-15", null).length, 2);
  // As pontas ENTRAM: quem escolhe "de 01 a 30" espera os dois dias dentro.
  assert.equal(noPeriodo(lista, "2026-09-01", "2026-09-30").length, 3);
});
