import test from "node:test";
import assert from "node:assert/strict";
import type { MesDoHistorico } from "@/central/types/desafio";
import {
  alturasDasBarras,
  diasEntre,
  fraseDoMes,
  medalhaDaPosicao,
  nomeAbreviado,
  placarParaWhatsApp,
  placarPublicavel,
  posicoesDoPlacar,
  prazoDoLancamento,
  rotuloDaSemana,
  semanaDoDia,
  somarDias,
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
  const m = (pontos: number) => ({ mes: "2026-09-01", pontos, saldo: pontos, posicao: null, participantes: 0 });
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

test("nome abreviado, como o ranking da paciente", () => {
  assert.equal(nomeAbreviado("Eduarda Martins Souza"), "Eduarda S.");
  assert.equal(nomeAbreviado("  ana   maria "), "ana M.");
  assert.equal(nomeAbreviado("Felipe"), "Felipe");
});

test("medalhas: coroa, prata, bronze e mais nada", () => {
  assert.equal(medalhaDaPosicao(1), "👑");
  assert.equal(medalhaDaPosicao(2), "🥈");
  assert.equal(medalhaDaPosicao(3), "🥉");
  assert.equal(medalhaDaPosicao(4), "");
});

test("empate divide o lugar e o seguinte pula", () => {
  assert.deepEqual(posicoesDoPlacar([100, 100, 80, 80, 10]), [1, 1, 3, 3, 5]);
  assert.deepEqual(posicoesDoPlacar([]), []);
});

test("placar publicável: nome curto, sem saldo, sem quem não pontuou", () => {
  const mes: MesDoHistorico = {
    mes: "2026-09-01",
    total: 0,
    ranking: [
      { pacienteId: "a", nome: "Eduarda Martins", pontos: 100, resgatou: 0, saldo: 900, recompensa: "Kit" },
      { pacienteId: "b", nome: "Felipe Souza", pontos: 60, resgatou: 0, saldo: 60, recompensa: null },
      { pacienteId: "c", nome: "Gustavo", pontos: 0, resgatou: 0, saldo: 5, recompensa: null },
    ],
  };
  const p = placarPublicavel(mes);
  assert.equal(p.titulo, "Setembro de 2026");
  assert.deepEqual(p.linhas.map((l) => [l.posicao, l.medalha, l.nome, l.pontos]), [
    [1, "👑", "Eduarda M.", 100],
    [2, "🥈", "Felipe S.", 60],
  ]);
  assert.equal(p.participantes, 2);
  assert.equal(p.total, 160);
  assert.equal(placarPublicavel(mes, { nomeCompleto: true }).linhas[0]?.nome, "Eduarda Martins");
});

test("o limite nunca corta no meio de um empate", () => {
  const ranking = ["A", "B", "C", "D", "E"].map((n, i) => ({
    pacienteId: n, nome: `${n} X`, pontos: i < 2 ? 50 : i === 2 ? 40 : 10, resgatou: 0, saldo: 0, recompensa: null,
  }));
  const mes: MesDoHistorico = { mes: "2026-09-01", total: 0, ranking };
  assert.equal(placarPublicavel(mes, { limite: 3 }).linhas.length, 3);
  assert.equal(placarPublicavel(mes, { limite: 3 }).ocultas, 2);
  // limite 1 com dois empatados em 1º: os dois ficam
  assert.equal(placarPublicavel(mes, { limite: 1 }).linhas.length, 2);
  assert.equal(placarPublicavel(mes, { limite: null }).ocultas, 0);
});

test("texto do WhatsApp com as medalhas", () => {
  const mes: MesDoHistorico = {
    mes: "2026-09-01", total: 0,
    ranking: [
      { pacienteId: "a", nome: "Eduarda Martins", pontos: 100, resgatou: 0, saldo: 0, recompensa: null },
      { pacienteId: "b", nome: "Felipe Souza", pontos: 60, resgatou: 0, saldo: 0, recompensa: null },
      { pacienteId: "c", nome: "Gustavo Lima", pontos: 40, resgatou: 0, saldo: 0, recompensa: null },
      { pacienteId: "d", nome: "Helena Dias", pontos: 1, resgatou: 0, saldo: 0, recompensa: null },
    ],
  };
  const t = placarParaWhatsApp(mes, { limite: 3 }, "Bora, verão! 💚");
  assert.match(t, /^🏆 \*Placar de Setembro de 2026\*/);
  assert.match(t, /👑 1º Eduarda M\. — 100 pontos/);
  assert.match(t, /🥈 2º Felipe S\. — 60 pontos/);
  assert.match(t, /🥉 3º Gustavo L\. — 40 pontos/);
  assert.match(t, /…e mais 1 pessoa que pontuou!/);
  assert.match(t, /Bora, verão! 💚$/);
  assert.equal(
    placarParaWhatsApp({ mes: "2026-09-01", total: 0, ranking: [] }),
    "Placar de Setembro de 2026: ninguém pontuou.",
  );
});

test("datas: somar dias e contar a diferença", () => {
  assert.equal(somarDias("2026-09-30", 7), "2026-10-07");
  assert.equal(somarDias("2026-12-28", 7), "2027-01-04");
  assert.equal(diasEntre("2026-10-01", "2026-10-07"), 6);
});

test("prazo de lançar: dentro do mês, na semana de graça e depois dela", () => {
  const set = { dataInicio: "2026-09-01", dataFim: "2026-09-30" };
  assert.deepEqual(prazoDoLancamento(set, "2026-09-15"), { tipo: "atual" });
  assert.deepEqual(prazoDoLancamento(set, "2026-09-30"), { tipo: "atual" });
  assert.deepEqual(prazoDoLancamento(set, "2026-10-01"), { tipo: "retroativo", ultimoDia: "2026-10-07", diasRestantes: 6 });
  // o último dia da janela ainda vale
  assert.deepEqual(prazoDoLancamento(set, "2026-10-07"), { tipo: "retroativo", ultimoDia: "2026-10-07", diasRestantes: 0 });
  assert.deepEqual(prazoDoLancamento(set, "2026-10-08"), { tipo: "fechado", ultimoDia: "2026-10-07", diasDeAtraso: 1 });
  assert.deepEqual(prazoDoLancamento(set, "2026-08-20"), { tipo: "futuro" });
});

test("a semana de um dia e o rótulo dela, com a mesma conta do banco", () => {
  const set = { dataInicio: "2026-09-01", dataFim: "2026-09-30" };
  assert.equal(semanaDoDia(set, "2026-09-01"), 1);
  assert.equal(semanaDoDia(set, "2026-09-07"), 1);
  assert.equal(semanaDoDia(set, "2026-09-08"), 2);
  assert.equal(semanaDoDia(set, "2026-09-30"), 5);
  // depois do fim, vale a última semana (é para ela lançar o que faltou)
  assert.equal(semanaDoDia(set, "2026-10-02"), 5);
  assert.equal(rotuloDaSemana(set, 5), "Semana 5 · 29/09 a 30/09");
  assert.equal(rotuloDaSemana(set, 1), "Semana 1 · 01/09 a 07/09");
});

test("a frase do mês passado, para a paciente", () => {
  assert.equal(
    fraseDoMes({ mes: "2026-09-01", pontos: 120, posicao: 2, participantes: 8 }),
    "Em setembro você fez 120 pontos e ficou em 2º lugar entre 8 participantes.",
  );
  assert.equal(fraseDoMes({ mes: "2026-09-01", pontos: 1, posicao: 1, participantes: 1 }), "Em setembro você fez 1 ponto.");
  assert.equal(fraseDoMes({ mes: "2026-09-01", pontos: 0, posicao: null, participantes: 5 }), null);
});
