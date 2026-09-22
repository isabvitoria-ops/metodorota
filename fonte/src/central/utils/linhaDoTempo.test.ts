import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { AvaliacaoFisica, DadosAvaliacao } from "@/central/types/protocolo";
import type { Consulta } from "@/central/types/consulta";
import type { Meta } from "@/central/types/meta";
import {
  montarLinhaDoTempo,
  quando,
  semanasDeAcompanhamento,
  seriePeso,
} from "@/central/utils/linhaDoTempo";

const HOJE = "2026-09-16";

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

function meta(p: Partial<Meta> = {}): Meta {
  return {
    id: "m1",
    titulo: "Beber água",
    descricao: null,
    categoria: null,
    frequencia: "diaria",
    alvo: 2,
    unidade: "litros",
    inicio: "2026-09-05",
    prazo: null,
    status: "ativa",
    registros: [],
    ...p,
  };
}

function avaliacao(p: Partial<AvaliacaoFisica> & { peso?: number | null } = {}): AvaliacaoFisica {
  const dados = {
    metodo: "",
    peso: p.peso === undefined ? 72 : p.peso,
    altura: null,
    idade: null,
    percentualGordura: null,
    massaGorda: null,
    massaMagra: null,
    imc: null,
    somaDobras: null,
    dobras: [],
    circunferencias: [],
    observacao: null,
  } satisfies DadosAvaliacao;
  return { id: p.id ?? "a1", data: p.data ?? "2026-09-10", dados, publicada: p.publicada ?? true };
}

test("a linha vem do mais recente para o mais antigo", () => {
  const linha = montarLinhaDoTempo(
    [consulta({ id: "velha", data: "2026-08-01" }), consulta({ id: "nova", data: "2026-09-10" })],
    [],
    [],
    HOJE,
  );
  assert.deepEqual(linha.map((e) => e.data), ["2026-09-10", "2026-08-01"]);
});

test("a consulta cancelada não entra na linha", () => {
  const linha = montarLinhaDoTempo([consulta({ status: "cancelada" })], [], [], HOJE);
  assert.equal(linha.length, 0);
});

test("a ordem da consulta conta só as que aconteceram", () => {
  // Contar as canceladas faria a terceira consulta virar a quinta.
  const linha = montarLinhaDoTempo(
    [
      consulta({ id: "1", data: "2026-07-01", tipo: "primeira" }),
      consulta({ id: "x", data: "2026-07-15", status: "cancelada" }),
      consulta({ id: "2", data: "2026-08-01" }),
      consulta({ id: "3", data: "2026-09-01" }),
    ],
    [], [], HOJE,
  );
  const titulos = linha.map((e) => e.titulo);
  assert.ok(titulos.includes("Retorno — 3ª consulta"), titulos.join(" | "));
  assert.ok(titulos.includes("Primeira consulta — 1ª consulta"));
});

test("a falta conta como consulta acontecida e ganha a marca", () => {
  const linha = montarLinhaDoTempo(
    [consulta({ id: "1", data: "2026-08-01" }), consulta({ id: "2", data: "2026-09-01", status: "faltou" })],
    [], [], HOJE,
  );
  const falta = linha.find((e) => e.id === "consulta:2");
  assert.equal(falta?.marca, "faltou");
  assert.equal(falta?.titulo, "Retorno — 2ª consulta");
});

test("a consulta agendada mostra quando é, não 'concluído'", () => {
  const linha = montarLinhaDoTempo(
    [consulta({ id: "f", data: "2026-09-17", status: "agendada" })],
    [], [], HOJE,
  );
  assert.equal(linha[0]?.marca, "amanhã");
  assert.equal(linha[0]?.tipo, "consulta_agendada");
});

test("a meta entra na linha no dia em que começou", () => {
  const linha = montarLinhaDoTempo([], [meta()], [], HOJE);
  assert.equal(linha[0]?.data, "2026-09-05");
  assert.equal(linha[0]?.titulo, "Meta: Beber água");
  assert.equal(linha[0]?.detalhe, "2 litros por dia");
});

test("meta sem alvo se descreve pelo período", () => {
  const linha = montarLinhaDoTempo([], [meta({ alvo: null, unidade: null })], [], HOJE);
  assert.equal(linha[0]?.detalhe, "todo dia");
  const semanal = montarLinhaDoTempo(
    [], [meta({ alvo: null, unidade: null, frequencia: "semanal" })], [], HOJE);
  assert.equal(semanal[0]?.detalhe, "toda semana");
});

test("meta encerrada leva a marca; meta ativa não leva nenhuma", () => {
  assert.equal(montarLinhaDoTempo([], [meta({ status: "concluida" })], [], HOJE)[0]?.marca, "concluída");
  assert.equal(montarLinhaDoTempo([], [meta()], [], HOJE)[0]?.marca, null);
});

test("avaliação não publicada é rascunho e não entra", () => {
  // Não é um acontecimento do acompanhamento até ela decidir que é.
  assert.equal(montarLinhaDoTempo([], [], [avaliacao({ publicada: false })], HOJE).length, 0);
  assert.equal(montarLinhaDoTempo([], [], [avaliacao()], HOJE).length, 1);
});

test("no mesmo dia, a consulta aparece acima da meta criada nela", () => {
  const linha = montarLinhaDoTempo(
    [consulta({ data: "2026-09-05" })],
    [meta({ inicio: "2026-09-05" })],
    [],
    HOJE,
  );
  assert.deepEqual(linha.map((e) => e.tipo), ["consulta", "meta_criada"]);
});

test("'quando' escreve hoje, amanhã e ontem por extenso", () => {
  assert.equal(quando("2026-09-16", HOJE), "hoje");
  assert.equal(quando("2026-09-17", HOJE), "amanhã");
  assert.equal(quando("2026-09-15", HOJE), "ontem");
  assert.equal(quando("2026-09-21", HOJE), "em 5 dias");
  assert.equal(quando("2026-09-11", HOJE), "há 5 dias");
});

test("data distante volta como data, não como 'em 80 dias'", () => {
  assert.equal(quando("2026-12-05", HOJE), "05/12/2026");
});

test("as semanas de acompanhamento são contadas do início", () => {
  assert.equal(semanasDeAcompanhamento("2026-07-22", HOJE), 8);
  assert.equal(semanasDeAcompanhamento(null, HOJE), null);
});

test("início no futuro não vira semana negativa", () => {
  assert.equal(semanasDeAcompanhamento("2026-10-01", HOJE), null);
});

test("a série de peso sai em ordem e sem os vazios", () => {
  const serie = seriePeso([
    avaliacao({ id: "b", data: "2026-09-10", peso: 72 }),
    avaliacao({ id: "a", data: "2026-08-10", peso: 75 }),
    avaliacao({ id: "sem", data: "2026-09-12", peso: null }),
    avaliacao({ id: "rascunho", data: "2026-09-14", peso: 71, publicada: false }),
  ]);
  assert.deepEqual(serie, [
    { data: "2026-08-10", valor: 75 },
    { data: "2026-09-10", valor: 72 },
  ]);
});
