import test from "node:test";
import assert from "node:assert/strict";
import { resumoDaSemana } from "./desafio";

const acao = (periodicidade: string, maxPorSemana: number, ...status: string[]) => ({
  periodicidade,
  maxPorSemana,
  envios: status.map((s) => ({ status: s })),
});

test("resumo da semana: conta marcação, ignora recusada e ação extra", () => {
  assert.deepEqual(
    resumoDaSemana([
      acao("semanal", 1, "aprovado"),
      acao("semanal", 2, "enviado", "recusado"),
      acao("semanal", 1),
      acao("unica", 1, "aprovado"),
    ]),
    { feitas: 2, total: 4 },
  );
});

test("resumo da semana: envio a mais não passa do total; sem ação, zero", () => {
  assert.deepEqual(resumoDaSemana([acao("semanal", 1, "enviado", "enviado")]), { feitas: 1, total: 1 });
  assert.deepEqual(resumoDaSemana([]), { feitas: 0, total: 0 });
});
