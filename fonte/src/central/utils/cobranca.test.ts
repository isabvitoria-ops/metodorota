import assert from "node:assert/strict";
import { test } from "node:test";

import {
  reais,
  mesPorExtenso,
  dia,
  textoDaSituacao,
  diasDeAtraso,
  mensagemDeCobranca,
  linkDoWhatsapp,
} from "./cobranca";
import type { Cobranca } from "@/central/types/financeiro";

function cobranca(p: Partial<Cobranca> = {}): Cobranca {
  return {
    id: "c1",
    pacienteId: "p1",
    paciente: "Mariana Silva",
    telefone: "11999998888",
    competencia: "2026-10-01",
    valor: 300,
    vencimento: "2026-10-10",
    status: "aberta",
    situacao: "aberta",
    pagoEm: null,
    forma: null,
    observacao: null,
    ...p,
  };
}

test("o valor sai em reais", () => {
  assert.ok(reais(300).includes("300,00"));
  assert.ok(reais(1234.5).includes("1.234,50"));
});

test("o mês sai por extenso", () => {
  assert.equal(mesPorExtenso("2026-10-01"), "outubro de 2026");
  assert.equal(mesPorExtenso("2026-01-01"), "janeiro de 2026");
});

test("a data sai em dia/mês/ano", () => {
  assert.equal(dia("2026-10-10"), "10/10/2026");
});

test("cada situação tem texto em português", () => {
  for (const s of ["aberta", "vencendo", "atrasada", "paga", "cancelada"] as const) {
    assert.ok(textoDaSituacao(s).length > 0);
  }
});

test("conta os dias de atraso", () => {
  assert.equal(diasDeAtraso(cobranca({ vencimento: "2026-10-10" }), "2026-10-15"), 5);
});

test("vencendo hoje NÃO é atraso — zero dias não é atraso", () => {
  assert.equal(diasDeAtraso(cobranca({ vencimento: "2026-10-10" }), "2026-10-10"), null);
});

test("antes do vencimento não há atraso", () => {
  assert.equal(diasDeAtraso(cobranca({ vencimento: "2026-10-20" }), "2026-10-10"), null);
});

test("cobrança PAGA não tem atraso, mesmo vencida", () => {
  assert.equal(
    diasDeAtraso(cobranca({ status: "paga", vencimento: "2026-01-01" }), "2026-10-10"),
    null,
  );
});

test("a mensagem traz nome, mês, valor e vencimento", () => {
  const m = mensagemDeCobranca(cobranca(), "Isabela Marçal");
  assert.ok(m.includes("Mariana"), "faltou o nome");
  assert.ok(m.includes("outubro de 2026"), "faltou o mês");
  assert.ok(m.includes("300,00"), "faltou o valor");
  assert.ok(m.includes("10/10/2026"), "faltou o vencimento");
  assert.ok(m.includes("Isabela Marçal"), "faltou a assinatura");
});

test("a mensagem usa o PRIMEIRO nome, e não o nome inteiro", () => {
  const m = mensagemDeCobranca(cobranca({ paciente: "Mariana Silva" }), "Isabela");
  assert.ok(m.includes("Oi, Mariana!"));
  assert.ok(!m.includes("Oi, Mariana Silva!"));
});

test("A MENSAGEM NÃO AMEAÇA — ela cobra quem atende clinicamente", () => {
  const m = mensagemDeCobranca(cobranca(), "Isabela").toLowerCase();
  for (const palavra of [
    "regularize", "pendência", "inadimpl", "suspens", "bloque",
    "sob pena", "urgente", "imediatamente", "cobrança em atraso", "negativ",
  ]) {
    assert.ok(!m.includes(palavra), `a mensagem contém "${palavra}"`);
  }
});

test("a mensagem dá saída para quem já pagou", () => {
  assert.ok(mensagemDeCobranca(cobranca(), "Isabela").includes("já tiver pago"));
});

test("sem nome de nutricionista, não sobra assinatura vazia", () => {
  const m = mensagemDeCobranca(cobranca(), "   ");
  assert.ok(!m.endsWith("\n"), "sobrou linha em branco no fim");
});

test("o link do WhatsApp põe o 55 na frente", () => {
  const link = linkDoWhatsapp("11999998888", "oi");
  assert.ok(link?.startsWith("https://wa.me/5511999998888"), link ?? "sem link");
});

test("número que já tem 55 não ganha outro", () => {
  const link = linkDoWhatsapp("5511999998888", "oi");
  assert.ok(link?.includes("wa.me/5511999998888"));
  assert.ok(!link?.includes("wa.me/555511"));
});

test("pontuação e espaços no telefone não atrapalham", () => {
  const link = linkDoWhatsapp("(11) 99999-8888", "oi");
  assert.ok(link?.startsWith("https://wa.me/5511999998888"));
});

test("SEM TELEFONE não há link — a tela tem que dizer isso, não dar botão morto", () => {
  assert.equal(linkDoWhatsapp(null, "oi"), null);
  assert.equal(linkDoWhatsapp("", "oi"), null);
  assert.equal(linkDoWhatsapp("123", "oi"), null);
});

test("a mensagem vai codificada no endereço", () => {
  const link = linkDoWhatsapp("11999998888", "oi, tudo bem?");
  assert.ok(link?.includes("text=oi%2C%20tudo%20bem%3F") || link?.includes("text=oi%2C+tudo+bem%3F"));
});
