import test from "node:test";
import assert from "node:assert/strict";
import type { PacienteQueEsfriou } from "@/central/types/quemEsfriou";
import { assinaturaDoOi, motivos, precisaDeOi, separarResolvidos, textoDoUltimoRegistro } from "./quemEsfriou.ts";

const base: PacienteQueEsfriou = {
  id: "p", nome: "Ana", telefone: null, comAcesso: true, ultimoRegistro: null,
  checkins: [], reintroducao: null, cobrancas: [], semRetorno: false, ultimaConsulta: null,
};

test("cada motivo vira uma frase com a data", () => {
  const p = {
    ...base,
    checkins: [{ titulo: "Check-in semanal", venceuEm: "2026-11-17" }],
    reintroducao: { emTeste: ["Feijão"], ultimoRastreio: "2026-11-14" },
    cobrancas: [{ id: "c", competencia: "2026-11-01", valor: 350, vencimento: "2026-11-12" }],
  };
  assert.deepEqual(motivos(p), [
    "Check-in semanal: o prazo venceu em 17/11 e não teve resposta.",
    "Testando Feijão e sem rastreio desde 14/11.",
    "Cobrança venceu em 12/11.",
  ]);
  assert.equal(precisaDeOi(p), true);
});

test("só sem retorno não pede mensagem (é aviso para ela)", () => {
  assert.equal(precisaDeOi({ ...base, semRetorno: true }), false);
  assert.deepEqual(motivos({ ...base, semRetorno: true }), []);
});

test("último registro em palavras", () => {
  assert.equal(textoDoUltimoRegistro(null, "2026-11-23"), "nenhum ainda");
  assert.equal(textoDoUltimoRegistro("2026-11-23", "2026-11-23"), "hoje");
  assert.equal(textoDoUltimoRegistro("2026-11-22", "2026-11-23"), "ontem");
  assert.equal(textoDoUltimoRegistro("2026-11-17", "2026-11-23"), "há 6 dias");
});

test("feito e ignorado tiram da lista só enquanto a situação é a mesma", () => {
  const ana = { ...base, id: "a", cobrancas: [{ id: "c", competencia: "2026-10-01", valor: 350, vencimento: "2026-10-28" }] };
  const bia = { ...base, id: "b", nome: "Bia", reintroducao: { emTeste: ["Mel"], ultimoRastreio: "2026-11-16" } };
  const marcas = {
    a: { assinatura: assinaturaDoOi(ana), como: "feito" as const, em: "2026-11-25" },
    b: { assinatura: assinaturaDoOi(bia), como: "ignorado" as const, em: "2026-11-25" },
  };
  const hoje = separarResolvidos([ana, bia], marcas);
  assert.deepEqual(hoje.pendentes.map((p) => p.id), []);
  assert.deepEqual(hoje.resolvidos.map((r) => [r.paciente.id, r.marca.como]), [["a", "feito"], ["b", "ignorado"]]);

  // Cobrança nova vencida: a Ana volta sozinha. A Bia continua ignorada.
  const anaDepois = { ...ana, cobrancas: [...ana.cobrancas, { id: "d", competencia: "2026-11-01", valor: 350, vencimento: "2026-11-28" }] };
  const depois = separarResolvidos([anaDepois, bia], marcas);
  assert.deepEqual(depois.pendentes.map((p) => p.id), ["a"]);
  assert.deepEqual(depois.resolvidos.map((r) => r.paciente.id), ["b"]);
});
