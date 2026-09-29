import test from "node:test";
import assert from "node:assert/strict";
import type { CondutaPendente, ModeloDeConduta } from "@/central/types/conduta";
import {
  filtrarPendentes,
  ordenarCondutas,
  porColuna,
  rotuloDoPrazo,
  situacaoDoPrazo,
  tarefasDoModelo,
} from "./condutas";

const SIBO: ModeloDeConduta = {
  id: "m1",
  nome: "Protocolo SIBO",
  descricao: null,
  etapas: [
    { titulo: "Pedir teste respiratório", descricao: null, dias: 0 },
    { titulo: "  ", descricao: null, dias: 3 },
    { titulo: "Iniciar dieta", descricao: "  ", dias: 7 },
    { titulo: "Reavaliar", descricao: "Escala de inchaço", dias: 30 },
  ],
};

function conduta(p: Partial<CondutaPendente>): CondutaPendente {
  return {
    id: p.titulo ?? "x",
    pacienteId: "p1",
    pacienteNome: "Alda",
    titulo: "Tarefa",
    descricao: null,
    prazo: null,
    status: "a_fazer",
    modeloNome: null,
    criadoEm: "2026-09-01T10:00:00Z",
    concluidaEm: null,
    ...p,
  };
}

test("o modelo vira datas a partir do dia aplicado, pulando etapa vazia", () => {
  const t = tarefasDoModelo(SIBO, "2026-10-01");
  assert.deepEqual(
    t.map((x) => x.prazo),
    ["2026-10-01", "2026-10-08", "2026-10-31"],
  );
  assert.equal(t[1]?.descricao, null, "descrição só com espaço vira nula");
  assert.equal(t[2]?.descricao, "Escala de inchaço");
});

test("a conta atravessa mês e ano", () => {
  const m: ModeloDeConduta = { ...SIBO, etapas: [{ titulo: "Retorno", descricao: null, dias: 45 }] };
  assert.equal(tarefasDoModelo(m, "2026-12-20")[0]?.prazo, "2027-02-03");
});

test("dias negativos ou quebrados não geram data antes do início", () => {
  const m: ModeloDeConduta = {
    ...SIBO,
    etapas: [
      { titulo: "A", descricao: null, dias: -5 },
      { titulo: "B", descricao: null, dias: 2.6 },
    ],
  };
  assert.deepEqual(tarefasDoModelo(m, "2026-10-01").map((x) => x.prazo), ["2026-10-01", "2026-10-04"]);
});

test("situação do prazo", () => {
  const hoje = "2026-10-10";
  assert.equal(situacaoDoPrazo({ prazo: "2026-10-09", status: "a_fazer" }, hoje), "atrasada");
  assert.equal(situacaoDoPrazo({ prazo: "2026-10-10", status: "andamento" }, hoje), "hoje");
  assert.equal(situacaoDoPrazo({ prazo: "2026-10-13", status: "a_fazer" }, hoje), "em_breve");
  assert.equal(situacaoDoPrazo({ prazo: "2026-10-14", status: "a_fazer" }, hoje), "no_prazo");
  assert.equal(situacaoDoPrazo({ prazo: null, status: "a_fazer" }, hoje), "sem_prazo");
  assert.equal(situacaoDoPrazo({ prazo: "2026-01-01", status: "concluida" }, hoje), "concluida",
    "concluída atrasada não é atrasada");
  assert.equal(rotuloDoPrazo({ prazo: "2026-10-07", status: "a_fazer" }, hoje), "Atrasada 3 dias");
  assert.equal(rotuloDoPrazo({ prazo: "2026-10-11", status: "a_fazer" }, hoje), "Amanhã");
});

test("ordem: prazo mais cedo, sem prazo por último", () => {
  const l = ordenarCondutas([
    conduta({ titulo: "sem", prazo: null }),
    conduta({ titulo: "tarde", prazo: "2026-11-01" }),
    conduta({ titulo: "cedo", prazo: "2026-10-01" }),
  ]);
  assert.deepEqual(l.map((c) => c.titulo), ["cedo", "tarde", "sem"]);
});

test("colunas do Kanban", () => {
  const c = porColuna([
    conduta({ titulo: "a", status: "a_fazer" }),
    conduta({ titulo: "b", status: "concluida" }),
    conduta({ titulo: "c", status: "andamento" }),
  ]);
  assert.deepEqual([c.a_fazer.length, c.andamento.length, c.concluida.length], [1, 1, 1]);
});

test("visão geral: busca sem acento, status e só atrasadas", () => {
  const lista = [
    conduta({ titulo: "Pedir exame", pacienteNome: "Márcia", prazo: "2026-10-01" }),
    conduta({ titulo: "Mandar lista", pacienteNome: "Bela", status: "andamento", prazo: "2026-10-20" }),
    conduta({ titulo: "Feita", status: "concluida" }),
  ];
  const hoje = "2026-10-10";
  const base = { busca: "", status: "todas" as const, soAtrasadas: false };
  assert.equal(filtrarPendentes(lista, base, hoje).length, 2, "concluída nunca aparece");
  assert.equal(filtrarPendentes(lista, { ...base, busca: "marcia" }, hoje)[0]?.titulo, "Pedir exame");
  assert.equal(filtrarPendentes(lista, { ...base, status: "andamento" }, hoje).length, 1);
  assert.deepEqual(filtrarPendentes(lista, { ...base, soAtrasadas: true }, hoje).map((c) => c.titulo), ["Pedir exame"]);
});
