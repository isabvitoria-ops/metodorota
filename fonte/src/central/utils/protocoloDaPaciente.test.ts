import test from "node:test";
import assert from "node:assert/strict";
import {
  iconeDaRefeicao,
  minutosDoHorario,
  partirSubstituicao,
  proximaRefeicao,
  resumoDoProtocolo,
} from "./protocoloDaPaciente.ts";
import type { Protocolo, RefeicaoProtocolo } from "@/central/types/protocolo.ts";

const refeicao = (nome: string, horario?: string): RefeicaoProtocolo => ({ nome, horario, opcoes: [] });

test("ícone: pelo nome que ela deu, com e sem acento", () => {
  assert.equal(iconeDaRefeicao("Café da manhã"), "cafe");
  assert.equal(iconeDaRefeicao("CAFE DA MANHA"), "cafe");
  assert.equal(iconeDaRefeicao("Lanche da tarde"), "lanche");
  assert.equal(iconeDaRefeicao("Almoço"), "almoco");
  assert.equal(iconeDaRefeicao("JANTAR - HAMBÚRGUER"), "jantar");
  assert.equal(iconeDaRefeicao("Pré-treino"), "treino");
  assert.equal(iconeDaRefeicao("Ceia"), "sono");
});

test("ícone: nome que ela inventou cai no prato, sem quebrar", () => {
  assert.equal(iconeDaRefeicao("Refeição livre de sábado"), "almoco");
});

test("substituição: corta no último ' - ' e só nele", () => {
  assert.deepEqual(partirSubstituicao("Tapioca - 70g"), { alimento: "Tapioca", quantidade: "70g" });
  assert.deepEqual(partirSubstituicao("Pão francês - 1,5 unidade"), { alimento: "Pão francês", quantidade: "1,5 unidade" });
  assert.deepEqual(partirSubstituicao("Pão sem glúten - integral - 2 fatias"), {
    alimento: "Pão sem glúten - integral",
    quantidade: "2 fatias",
  });
});

test("substituição: hífen colado e texto sem quantidade ficam inteiros", () => {
  assert.deepEqual(partirSubstituicao("Grão-de-bico"), { alimento: "Grão-de-bico", quantidade: null });
  assert.deepEqual(partirSubstituicao("Qualquer fruta da lista"), { alimento: "Qualquer fruta da lista", quantidade: null });
  assert.deepEqual(partirSubstituicao("  Iogurte -  "), { alimento: "Iogurte -", quantidade: null });
});

test("horário: aceita 08:00, 8h, 8h30 e recusa o que não é hora", () => {
  assert.equal(minutosDoHorario("08:00"), 480);
  assert.equal(minutosDoHorario("8h"), 480);
  assert.equal(minutosDoHorario("8h30"), 510);
  assert.equal(minutosDoHorario("12:30"), 750);
  assert.equal(minutosDoHorario("ao acordar"), null);
  assert.equal(minutosDoHorario("25:00"), null);
  assert.equal(minutosDoHorario(undefined), null);
});

test("próxima refeição: a primeira que ainda não passou", () => {
  const dia = [refeicao("Café", "07:30"), refeicao("Almoço", "12:00"), refeicao("Lanche", "16:00"), refeicao("Jantar", "20:00")];
  assert.equal(proximaRefeicao(dia, 6 * 60), 0);
  assert.equal(proximaRefeicao(dia, 10 * 60), 1);
  assert.equal(proximaRefeicao(dia, 17 * 60), 3);
});

test("próxima refeição: meia hora de tolerância, e nenhuma depois da última", () => {
  const dia = [refeicao("Almoço", "12:00"), refeicao("Jantar", "20:00")];
  assert.equal(proximaRefeicao(dia, 12 * 60 + 20), 0);
  assert.equal(proximaRefeicao(dia, 12 * 60 + 40), 1);
  assert.equal(proximaRefeicao(dia, 22 * 60), null);
});

test("próxima refeição: sem horários suficientes não palpita", () => {
  assert.equal(proximaRefeicao([refeicao("Café"), refeicao("Almoço")], 600), null);
  assert.equal(proximaRefeicao([refeicao("Café", "08:00"), refeicao("Almoço")], 600), null);
  assert.equal(proximaRefeicao([], 600), null);
});

test("próxima refeição: funciona com as refeições fora de ordem", () => {
  const dia = [refeicao("Jantar", "20:00"), refeicao("Café", "07:00"), refeicao("Almoço", "12:00")];
  assert.equal(proximaRefeicao(dia, 9 * 60), 2);
});

test("resumo: mostra só o que existe", () => {
  const base: Protocolo = {
    id: "p",
    pacienteId: "x",
    titulo: "Plano",
    conteudo: { orientacoes: [], refeicoes: [refeicao("Café")], secoes: [] },
    ajustes: null,
    situacao: "publicado",
    versao: 1,
    atualizadoEm: "2026-11-08T10:00:00Z",
    publicadoEm: "2026-11-10T12:00:00Z",
  };
  assert.equal(resumoDoProtocolo(base), "Atualizado em 10/11/2026 · 1 refeição");
  assert.equal(
    resumoDoProtocolo({ ...base, versao: 3, publicadoEm: null, conteudo: { ...base.conteudo, refeicoes: [refeicao("a"), refeicao("b")] } }),
    "Atualizado em 08/11/2026 · versão 3 · 2 refeições",
  );
});
