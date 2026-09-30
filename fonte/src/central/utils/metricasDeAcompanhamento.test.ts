import test from "node:test";
import assert from "node:assert/strict";
import { calcularMetricas, textoDaPermanencia } from "./metricasDeAcompanhamento";

// O MESMO cenário da bateria 25_metricas.sql.
const PACIENTES = [
  { situacao: "ativo", dataInicio: "2026-08-01", dataFim: "2026-10-30", valorMensal: 400 },
  { situacao: "proximo_do_vencimento", dataInicio: "2026-09-20", dataFim: "2026-10-05", valorMensal: 600 },
  { situacao: "expirado", dataInicio: "2026-06-21", dataFim: "2026-09-19", valorMensal: 300 }, // 90 dias
  { situacao: "expirado", dataInicio: "2026-03-13", dataFim: "2026-06-21", valorMensal: null }, // 100 dias
  { situacao: "suspenso", dataInicio: "2026-09-10", dataFim: "2026-10-20", valorMensal: 500 },
  { situacao: "convite_pendente", dataInicio: "2026-09-30", dataFim: "2026-10-30", valorMensal: 500 },
];
const RECEBIMENTOS = [
  { pacienteId: "a1", valor: 400 },
  { pacienteId: "a1", valor: 400 },
  { pacienteId: "a2", valor: 200 },
  { pacienteId: "e1", valor: 300 },
  { pacienteId: null, valor: 1000 }, // palestra avulsa
];

test("os números batem com a bateria do banco", () => {
  assert.deepEqual(calcularMetricas(PACIENTES, RECEBIMENTOS), {
    ativas: 2,
    encerradas: 2,
    permanenciaMediaDias: 95,
    pacientesQuePagaram: 3,
    totalRecebido: 1300,
    ticketMedio: 433.33,
    valorMensalMedioAtivas: 500,
  });
});

test("sem dado, o que não tem de onde sair é nulo — nunca zero", () => {
  const m = calcularMetricas([], []);
  assert.equal(m.ticketMedio, null);
  assert.equal(m.permanenciaMediaDias, null);
  assert.equal(m.valorMensalMedioAtivas, null);
  assert.equal(m.ativas, 0);
});

test("entrada avulsa sozinha não cria ticket", () => {
  assert.equal(calcularMetricas(PACIENTES, [{ pacienteId: null, valor: 500 }]).ticketMedio, null);
});

test("texto da permanência", () => {
  assert.equal(textoDaPermanencia(null), "—");
  assert.equal(textoDaPermanencia(1), "1 dia");
  assert.equal(textoDaPermanencia(12), "12 dias");
  assert.equal(textoDaPermanencia(30), "1 mês");
  assert.equal(textoDaPermanencia(95), "3 meses e 5 dias");
  assert.equal(textoDaPermanencia(91), "3 meses e 1 dia");
});
