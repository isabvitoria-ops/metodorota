import test from "node:test";
import assert from "node:assert/strict";
import type { MesDoHistorico } from "@/central/types/desafio";
import {
  alturasDasBarras,
  escolherDesafioPadrao,
  nomeCurtoDoMes,
  nomeDoDesafioDoMes,
  nomeDoMes,
  periodoDoMes,
  placarComoTexto,
  precisaCriarDesafio,
} from "./historicoDePontos";

test("nomes de mês", () => {
  assert.equal(nomeDoMes("2026-09-01"), "Setembro de 2026");
  assert.equal(nomeDoMes("2026-03-01"), "Março de 2026");
  assert.equal(nomeCurtoDoMes("2026-10-01"), "Out");
  assert.equal(nomeDoDesafioDoMes("2026-10-01"), "Desafio de Outubro");
  assert.equal(nomeDoDesafioDoMes("2026-12-15"), "Desafio de Dezembro");
});

test("o período do mês, inclusive fevereiro e ano bissexto", () => {
  assert.deepEqual(periodoDoMes("2026-10-01"), { inicio: "2026-10-01", fim: "2026-10-31" });
  assert.deepEqual(periodoDoMes("2026-09-15"), { inicio: "2026-09-01", fim: "2026-09-30" });
  assert.deepEqual(periodoDoMes("2026-02-10"), { inicio: "2026-02-01", fim: "2026-02-28" });
  assert.deepEqual(periodoDoMes("2028-02-10"), { inicio: "2028-02-01", fim: "2028-02-29" });
});

const SETEMBRO: MesDoHistorico = {
  mes: "2026-09-01",
  total: 255,
  ranking: [
    { pacienteId: "a", nome: "Eduarda Martins", pontos: 100, resgatou: 0, saldo: 100, recompensa: null },
    { pacienteId: "b", nome: "Felipe", pontos: 60, resgatou: 50, saldo: 320, recompensa: "Kit degustação" },
    { pacienteId: "c", nome: "Gustavo", pontos: 1, resgatou: 0, saldo: 1, recompensa: null },
  ],
};

test("o placar em texto, para copiar", () => {
  const t = placarComoTexto(SETEMBRO).split("\n");
  assert.equal(t[0], "Placar de Setembro de 2026 — 255 pontos no total");
  assert.equal(t[1], "1. Eduarda Martins — 100 pontos (saldo 100)");
  assert.equal(t[2], "2. Felipe — 60 pontos (resgatou 50 · saldo 320 · alcançou: Kit degustação)");
  assert.equal(t[3], "3. Gustavo — 1 ponto (saldo 1)");
  assert.equal(placarComoTexto({ mes: "2026-08-01", total: 0, ranking: [] }), "Agosto de 2026: ninguém pontuou.");
});

test("barras: proporção, mínimo visível e zero de verdade", () => {
  const m = (pontos: number) => ({ mes: "2026-09-01", pontos, saldo: pontos });
  assert.deepEqual(alturasDasBarras([m(100), m(50), m(0), m(1)]), [100, 50, 0, 6]);
  assert.deepEqual(alturasDasBarras([m(0), m(0)]), [0, 0]);
  assert.deepEqual(alturasDasBarras([]), []);
});

test("precisa criar o desafio do mês quando nada está no ar nem agendado", () => {
  assert.equal(precisaCriarDesafio([]), true);
  assert.equal(precisaCriarDesafio([{ id: "1", situacao: "encerrado" }, { id: "2", situacao: "rascunho" }]), true);
  assert.equal(precisaCriarDesafio([{ id: "1", situacao: "ativo" }]), false);
  assert.equal(precisaCriarDesafio([{ id: "1", situacao: "agendado" }]), false);
});

test("o desafio que abre por padrão: no ar, depois o mais recente que não é rascunho", () => {
  assert.equal(escolherDesafioPadrao([{ id: "nov", situacao: "ativo" }, { id: "out", situacao: "encerrado" }]), "nov");
  // O caso real: o rascunho vazio vinha primeiro e era o que abria.
  assert.equal(
    escolherDesafioPadrao([{ id: "rascunho", situacao: "rascunho" }, { id: "set", situacao: "encerrado" }]),
    "set",
  );
  assert.equal(escolherDesafioPadrao([{ id: "so", situacao: "rascunho" }]), "so");
  assert.equal(escolherDesafioPadrao([]), null);
});
