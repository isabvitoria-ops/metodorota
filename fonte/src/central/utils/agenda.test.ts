import test from "node:test";
import assert from "node:assert/strict";
import { diaPorExtenso, itensDoDia, periodoDaGrade, problemasDoEvento, semanasDoMes } from "./agenda.ts";
import type { EventoParaSalvar } from "../types/agenda.ts";

test("novembro de 2026 começa num domingo e cabe em 5 semanas", () => {
  const s = semanasDoMes(2026, 10);
  assert.equal(s[0]![0], "2026-11-01");
  assert.equal(s.length, 5);
  assert.ok(s.every((sem) => sem.length === 7));
  assert.equal(s[4]![6], "2026-12-05");
});

test("fevereiro de 2026 cabe certinho em 4 semanas; março fecha com dias de abril", () => {
  assert.equal(semanasDoMes(2026, 1).length, 4);
  assert.deepEqual(periodoDaGrade(2026, 1), { de: "2026-02-01", ate: "2026-02-28" });
  assert.deepEqual(periodoDaGrade(2026, 2), { de: "2026-03-01", ate: "2026-04-04" });
  assert.deepEqual(periodoDaGrade(2026, 6), { de: "2026-06-28", ate: "2026-08-01" });
});

test("dia por extenso, sem erro de fuso", () => {
  assert.equal(diaPorExtenso("2026-11-18"), "Quarta, 18 de novembro");
  assert.equal(diaPorExtenso("2026-01-01"), "Quinta, 1 de janeiro");
});

test("o dia junta compromissos e consultas, por hora, sem as canceladas", () => {
  const ev = (id: string, h: string | null) => ({ id, titulo: id, tipo: "pessoal" as const, data: "2026-11-18", horaInicio: h, horaFim: null, local: null, observacao: null, pacienteId: null });
  const itens = itensDoDia(
    {
      eventos: [ev("academia", "07:00"), ev("aniversário", null), ev("outro dia", "08:00")].map((e, i) => (i === 2 ? { ...e, data: "2026-11-19" } : e)),
      consultas: [
        { id: "c1", pacienteId: "p", pacienteNome: "Ana", data: "2026-11-18", hora: "15:00", tipo: "retorno", status: "agendada" },
        { id: "c2", pacienteId: "p", pacienteNome: "Bia", data: "2026-11-18", hora: "16:00", tipo: "retorno", status: "cancelada" },
      ],
    },
    "2026-11-18",
  );
  assert.deepEqual(itens.map((i) => (i.tipo === "evento" ? i.evento.id : i.consulta.pacienteNome)), ["aniversário", "academia", "Ana"]);
});

test("não salva sem nome, sem dia ou com o fim antes do início", () => {
  const base: EventoParaSalvar = { id: null, titulo: "Visita", tipo: "visita", data: "2026-11-20", horaInicio: "10:00", horaFim: "11:00", local: null, observacao: null, pacienteId: null };
  assert.deepEqual(problemasDoEvento(base), []);
  assert.equal(problemasDoEvento({ ...base, titulo: "  " }).length, 1);
  assert.equal(problemasDoEvento({ ...base, data: "" }).length, 1);
  assert.equal(problemasDoEvento({ ...base, horaFim: "09:00" }).length, 1);
  assert.equal(problemasDoEvento({ ...base, horaInicio: null }).length, 1);
});
