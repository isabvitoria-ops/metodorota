import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { Consulta } from "@/central/types/consulta";
import {
  anotacaoDeHoje,
  comNovaAnotacao,
  consultasAnteriores,
  dataEHora,
  horaSaoPaulo,
} from "@/central/utils/consultas";

const HOJE = "2026-09-24";

function consulta(p: Partial<Consulta> = {}): Consulta {
  return {
    id: "c1",
    data: "2026-09-01",
    hora: null,
    tipo: "retorno",
    status: "concluida",
    resumo: null,
    observacoes: null,
    ...p,
  };
}

test("data e hora no formato da tela", () => {
  assert.equal(dataEHora({ data: "2026-09-24", hora: "16:28:00" }), "24/09/2026 às 16:28");
  assert.equal(dataEHora({ data: "2026-08-18", hora: null }), "18/08/2026");
});

test("hora de São Paulo, não a do servidor", () => {
  assert.equal(horaSaoPaulo(new Date("2026-09-24T19:28:00Z")), "16:28");
});

test("anteriores: mais nova primeiro, sem as agendadas do futuro", () => {
  const lista = consultasAnteriores(
    [
      consulta({ id: "a", data: "2026-08-18", hora: "19:38" }),
      consulta({ id: "futura", data: "2026-10-01", status: "agendada" }),
      consulta({ id: "b", data: "2026-09-24", hora: "16:28" }),
      consulta({ id: "c", data: "2026-09-24", hora: "09:00" }),
      consulta({ id: "faltou", data: "2026-09-10", status: "faltou" }),
    ],
    HOJE,
  );
  assert.deepEqual(
    lista.map((c) => c.id),
    ["b", "c", "faltou", "a"],
  );
});

test("salvar sem agendamento cria consulta concluída de hoje", () => {
  const { id, dados } = anotacaoDeHoje([], "  quanto está pesando?  ", HOJE, "16:28");
  assert.equal(id, null);
  assert.equal(dados.data, HOJE);
  assert.equal(dados.hora, "16:28");
  assert.equal(dados.status, "concluida");
  assert.equal(dados.tipo, "primeira");
  assert.equal(dados.observacoes, "quanto está pesando?");
});

test("depois da primeira, a nova é retorno", () => {
  const { dados } = anotacaoDeHoje([consulta()], "x", HOJE, "10:00");
  assert.equal(dados.tipo, "retorno");
});

test("retorno agendado para hoje é concluído, não duplicado", () => {
  const agendada = consulta({ id: "ag", data: HOJE, hora: "15:00:00", status: "agendada", resumo: "Retorno" });
  const { id, dados } = anotacaoDeHoje([agendada], "evoluiu bem", HOJE, "16:28");
  assert.equal(id, "ag");
  assert.equal(dados.status, "concluida");
  assert.equal(dados.hora, "15:00:00");
  assert.equal(dados.resumo, "Retorno");
  assert.equal(dados.observacoes, "evoluiu bem");
});

test("editar a anotação não mexe no resto da consulta", () => {
  const c = consulta({ hora: "16:28:00", resumo: "Ajuste no jantar", status: "faltou" });
  const dados = comNovaAnotacao(c, "nova");
  assert.equal(dados.hora, "16:28");
  assert.equal(dados.resumo, "Ajuste no jantar");
  assert.equal(dados.status, "faltou");
  assert.equal(dados.observacoes, "nova");
});
