import test from "node:test";
import assert from "node:assert/strict";
import { montarRelatorio, variacaoDoPeso } from "./relatorioMedico.ts";

const base = {
  paciente: "Ana", de: "2026-09-01", ate: "2026-11-30", medico: " Dr. Paulo ", emitidoEm: "2026-11-23",
  secoes: ["fase", "sintomas", "tolerancia", "checkin", "peso", "consultas"] as const,
  parecer: "  Evoluiu bem.  ",
  fases: [{ fase: "Eliminação", inicio: "2026-08-01" }, { fase: "Reintrodução", inicio: "2026-10-15" }, { fase: "Manutenção", inicio: "2026-12-10" }],
  registros: [
    { data: "2026-08-20", sintomas: ["gases"], bristol: 6 },
    { data: "2026-10-01", sintomas: ["gases", "distensao"], bristol: 4 },
    { data: "2026-10-02", sintomas: ["nenhum"], bristol: 4 },
    { data: "2026-11-02", sintomas: ["gases"], bristol: null },
  ],
  itens: [{ nome: "Lactose", status: "bem_tolerado" }, { nome: "Feijão", status: "nao_tolerado" }, { nome: "Pão", status: "em_teste" }],
  checkins: [{ titulo: "Check-in", envios: [{ data: "2026-08-30", nota: 50 }, { data: "2026-10-10", nota: 62 }, { data: "2026-11-10", nota: null }, { data: "2026-11-20", nota: 71 }] }],
  avaliacoes: [
    { data: "2026-09-05", peso: 77, circunferencias: [] },
    { data: "2026-11-15", peso: 72.8, circunferencias: [{ nome: "Cintura", valor: "80" }, { nome: "", valor: "" }] },
  ],
  consultas: [
    { data: "2026-10-01", status: "concluida", resumo: "Ajuste no jantar", observacoes: null },
    { data: "2026-10-20", status: "faltou", resumo: "x", observacoes: null },
    { data: "2026-11-01", status: "concluida", resumo: " ", observacoes: " " },
  ],
};

test("conta só o período, sem interpretar", () => {
  const r = montarRelatorio({ ...base, secoes: [...base.secoes] });
  assert.deepEqual(r.fase, { nome: "Reintrodução", desde: "2026-10-15" });
  assert.equal(r.sintomas?.registros, 3);
  assert.equal(r.sintomas?.comSintoma, 2);
  assert.deepEqual(r.sintomas?.porSintoma, [{ rotulo: "Gases", vezes: 2 }, { rotulo: "Distensão abdominal", vezes: 1 }]);
  assert.deepEqual(r.sintomas?.bristol, [{ tipo: 4, vezes: 2 }]);
  assert.deepEqual(r.tolerancia, [{ situacao: "Bem tolerado", alimentos: ["Lactose"] }, { situacao: "Não tolerado", alimentos: ["Feijão"] }]);
  assert.deepEqual(r.checkin, [{ titulo: "Check-in", notas: [{ data: "2026-10-10", nota: 62 }, { data: "2026-11-20", nota: 71 }] }]);
  assert.deepEqual(r.peso?.circunferencias, [{ nome: "Cintura", valor: "80" }]);
  assert.equal(variacaoDoPeso(r.peso), "−4,2 kg");
  assert.deepEqual(r.consultas, [{ data: "2026-10-01", resumo: "Ajuste no jantar", observacoes: null }]);
  assert.equal(r.medico, "Dr. Paulo");
  assert.equal(r.parecer, "Evoluiu bem.");
});

test("o que ela não marcou não entra", () => {
  const r = montarRelatorio({ ...base, secoes: ["peso"] });
  assert.equal(r.sintomas, null);
  assert.equal(r.consultas, null);
  assert.ok(r.peso);
});

test("uma pesagem só: sem variação", () => {
  const r = montarRelatorio({ ...base, secoes: ["peso"], avaliacoes: [base.avaliacoes[0]!] });
  assert.equal(r.peso?.ultima, null);
  assert.equal(variacaoDoPeso(r.peso), null);
});
