import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { Meta, RegistroDeMeta } from "@/central/types/meta";
import {
  historico,
  metaEmDestaque,
  periodoDe,
  progressoNoPeriodo,
  resumoDoProgresso,
  sequencia,
} from "@/central/utils/progressoMetas";

function meta(parcial: Partial<Meta> = {}): Meta {
  return {
    id: "m1",
    titulo: "Beber água",
    descricao: null,
    categoria: null,
    frequencia: "diaria",
    alvo: 2,
    unidade: "litros",
    inicio: "2026-09-01",
    prazo: null,
    status: "ativa",
    registros: [],
    ...parcial,
  };
}

function reg(data: string, quantidade: number | null = null): RegistroDeMeta {
  return { id: `${data}-${quantidade}`, data, quantidade, observacao: null };
}

test("o período de uma meta diária é o próprio dia", () => {
  assert.deepEqual(periodoDe("diaria", "2026-09-16"), {
    inicio: "2026-09-16",
    fim: "2026-09-16",
  });
});

test("o período de uma meta semanal vai de segunda a domingo", () => {
  // 2026-09-16 é uma quarta-feira.
  assert.deepEqual(periodoDe("semanal", "2026-09-16"), {
    inicio: "2026-09-14",
    fim: "2026-09-20",
  });
});

test("domingo pertence à semana que começou na segunda anterior", () => {
  assert.equal(periodoDe("semanal", "2026-09-20").inicio, "2026-09-14");
});

test("soma só o que caiu dentro do período", () => {
  const m = meta({
    registros: [reg("2026-09-16", 1), reg("2026-09-16", 0.5), reg("2026-09-15", 2)],
  });
  const p = progressoNoPeriodo(m, "2026-09-16");
  assert.equal(p.feito, 1.5);
  assert.equal(p.percentual, 75);
  assert.equal(p.cumprida, false);
});

test("atingir o alvo cumpre a meta", () => {
  const m = meta({ registros: [reg("2026-09-16", 2)] });
  assert.equal(progressoNoPeriodo(m, "2026-09-16").cumprida, true);
});

test("passar do alvo não passa de 100%", () => {
  // Uma barra de 137% seria maior que a caixa, e "137%" não diz nada melhor
  // do que "cumpriu".
  const m = meta({ registros: [reg("2026-09-16", 5)] });
  const p = progressoNoPeriodo(m, "2026-09-16");
  assert.equal(p.percentual, 100);
  assert.equal(p.feito, 5, "o número cru continua disponível, sem teto");
});

test("quantidade nula numa meta com alvo vale uma ocorrência, não zero", () => {
  // Valendo zero, quem só toca no botão veria a barra parada e concluiria
  // que o aplicativo não registrou.
  const m = meta({ alvo: 3, unidade: "vezes", registros: [reg("2026-09-16"), reg("2026-09-16")] });
  assert.equal(progressoNoPeriodo(m, "2026-09-16").feito, 2);
});

test("meta sem alvo é cumprida ao marcar uma vez", () => {
  const m = meta({ alvo: null, unidade: null, registros: [reg("2026-09-16")] });
  const p = progressoNoPeriodo(m, "2026-09-16");
  assert.equal(p.cumprida, true);
  assert.equal(p.percentual, 100);
});

test("meta sem alvo e sem marcação fica em zero, não em cumprida", () => {
  const m = meta({ alvo: null, unidade: null });
  assert.equal(progressoNoPeriodo(m, "2026-09-16").percentual, 0);
});

test("a meta semanal soma a semana inteira", () => {
  const m = meta({
    frequencia: "semanal",
    alvo: 3,
    unidade: "dias",
    registros: [reg("2026-09-14"), reg("2026-09-16"), reg("2026-09-18")],
  });
  assert.equal(progressoNoPeriodo(m, "2026-09-16").cumprida, true);
});

test("o período zerado entra no histórico em vez de sumir", () => {
  // O buraco é o que a profissional quer enxergar.
  const m = meta({ inicio: "2026-09-10", registros: [reg("2026-09-16", 2)] });
  const h = historico(m, "2026-09-16", 3);
  assert.equal(h.length, 3);
  assert.equal(h[0]?.percentual, 100);
  assert.equal(h[1]?.percentual, 0);
  assert.equal(h[2]?.percentual, 0);
});

test("o histórico não recua para antes de a meta existir", () => {
  // Dias anteriores à meta não são dias em que ela deixou de fazer algo.
  const m = meta({ inicio: "2026-09-15" });
  assert.equal(historico(m, "2026-09-16", 10).length, 2);
});

test("o histórico vem do mais recente para o mais antigo", () => {
  const m = meta({ inicio: "2026-09-10" });
  const h = historico(m, "2026-09-16", 3);
  assert.deepEqual(
    h.map((p) => p.periodo.inicio),
    ["2026-09-16", "2026-09-15", "2026-09-14"],
  );
});

test("a sequência conta os períodos cumpridos seguidos", () => {
  const m = meta({
    inicio: "2026-09-01",
    registros: [reg("2026-09-16", 2), reg("2026-09-15", 2), reg("2026-09-14", 2)],
  });
  assert.equal(sequencia(m, "2026-09-16"), 3);
});

test("o dia de hoje ainda aberto não quebra a sequência", () => {
  // Às nove da manhã ninguém bebeu dois litros. Zerar ali diria que ela
  // perdeu uma coisa que ainda dá tempo de fazer.
  const m = meta({ inicio: "2026-09-01", registros: [reg("2026-09-15", 2), reg("2026-09-14", 2)] });
  assert.equal(sequencia(m, "2026-09-16"), 2);
});

test("um dia perdido no meio quebra a sequência", () => {
  const m = meta({ inicio: "2026-09-01", registros: [reg("2026-09-16", 2), reg("2026-09-14", 2)] });
  assert.equal(sequencia(m, "2026-09-16"), 1);
});

test("o destaque é a meta ativa com menos progresso hoje", () => {
  const cheia = meta({ id: "cheia", titulo: "Cheia", registros: [reg("2026-09-16", 2)] });
  const vazia = meta({ id: "vazia", titulo: "Vazia", registros: [] });
  assert.equal(metaEmDestaque([cheia, vazia], "2026-09-16")?.id, "vazia");
});

test("meta pausada não entra no destaque", () => {
  const pausada = meta({ id: "p", status: "pausada" });
  const ativa = meta({ id: "a", registros: [reg("2026-09-16", 2)] });
  assert.equal(metaEmDestaque([pausada, ativa], "2026-09-16")?.id, "a");
});

test("sem meta ativa nenhuma, não há destaque", () => {
  assert.equal(metaEmDestaque([meta({ status: "concluida" })], "2026-09-16"), null);
});

test("empatadas, vence a que começou primeiro", () => {
  const nova = meta({ id: "nova", inicio: "2026-09-10" });
  const antiga = meta({ id: "antiga", inicio: "2026-09-01" });
  assert.equal(metaEmDestaque([nova, antiga], "2026-09-16")?.id, "antiga");
});

test("o resumo escreve o feito e o alvo com vírgula decimal", () => {
  const m = meta({ registros: [reg("2026-09-16", 1.5)] });
  assert.equal(
    resumoDoProgresso(progressoNoPeriodo(m, "2026-09-16"), "litros"),
    "1,5 de 2 litros",
  );
});

test("o resumo de meta sem alvo é 'Feito' ou 'Ainda não'", () => {
  const m = meta({ alvo: null, unidade: null });
  assert.equal(resumoDoProgresso(progressoNoPeriodo(m, "2026-09-16"), null), "Ainda não");
  const feita = meta({ alvo: null, unidade: null, registros: [reg("2026-09-16")] });
  assert.equal(resumoDoProgresso(progressoNoPeriodo(feita, "2026-09-16"), null), "Feito");
});
