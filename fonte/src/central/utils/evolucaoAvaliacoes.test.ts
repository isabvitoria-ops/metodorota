import test from "node:test";
import assert from "node:assert/strict";
import { AVALIACAO_VAZIA } from "@/central/types/protocolo";
import type { AvaliacaoNoTempo } from "./evolucaoAvaliacoes";
import {
  emOrdemDeData,
  pontosDaLinha,
  serieDe,
  tabelaDeMedidas,
  variacaoRecente,
  variacaoTotal,
} from "./evolucaoAvaliacoes";

function av(
  id: string,
  data: string,
  parte: Partial<typeof AVALIACAO_VAZIA>,
): AvaliacaoNoTempo {
  return { id, data, dados: { ...AVALIACAO_VAZIA, ...parte } };
}

const tres: AvaliacaoNoTempo[] = [
  // Chegam do banco da mais nova para a mais antiga, como a tela pede.
  av("c", "2026-06-02", { peso: 105.4, dobras: [{ nome: "Tríceps", valor: "21,0 mm" }] }),
  av("b", "2026-05-01", { peso: 107.0, dobras: [] }),
  av("a", "2026-04-14", { peso: 117.0, dobras: [{ nome: "Bíceps", valor: "16,4 mm" }] }),
];

test("a linha do tempo é desenhada da mais antiga para a mais nova", () => {
  // Na ordem do banco, uma perda de peso subiria no gráfico.
  assert.deepEqual(
    emOrdemDeData(tres).map((a) => a.id),
    ["a", "b", "c"],
  );
});

test("a série pula a consulta que não tem aquele número, em vez de contar zero", () => {
  const comBuraco = [...tres, av("d", "2026-07-01", { peso: null })];
  assert.deepEqual(
    serieDe(comBuraco, "peso").map((p) => p.valor),
    [117, 107, 105.4],
  );
});

test("com uma medida só não há variação — e isso não é 'não mudou nada'", () => {
  assert.equal(variacaoRecente(serieDe([tres[0]!], "peso")), null);
  assert.equal(variacaoTotal(serieDe([], "peso")), null);
});

test("a variação recente é contra a anterior; a total, contra a primeira", () => {
  const serie = serieDe(tres, "peso");

  const recente = variacaoRecente(serie);
  assert.equal(recente?.delta, -1.6);
  assert.equal(recente?.absoluto, "1,6");
  assert.equal(recente?.sentido, "desceu");
  assert.equal(recente?.desde, "2026-05-01");

  const total = variacaoTotal(serie);
  assert.equal(total?.delta, -11.6);
  assert.equal(total?.desde, "2026-04-14");
});

test("diferença que some no arredondamento é 'igual', não uma seta para cima", () => {
  const quase = [av("a", "2026-01-01", { peso: 80.0 }), av("b", "2026-02-01", { peso: 80.04 })];
  const v = variacaoRecente(serieDe(quase, "peso"));
  assert.equal(v?.sentido, "igual");
  assert.equal(v?.absoluto, "0,0");
});

test("a tabela segue a ordem da lista oficial, não a ordem em que ela digitou", () => {
  const trocado = [
    av("a", "2026-01-01", {
      dobras: [
        { nome: "Coxa", valor: "20,0 mm" },
        { nome: "Bíceps", valor: "9,6 mm" },
      ],
    }),
  ];
  assert.deepEqual(
    tabelaDeMedidas(trocado, "dobras").linhas.map((l) => l.nome),
    ["Bíceps", "Coxa"],
  );
});

test("o que não foi medido vira travessão naquela coluna, não some da linha", () => {
  const tabela = tabelaDeMedidas(tres, "dobras");
  assert.deepEqual(
    tabela.colunas.map((c) => c.data),
    ["2026-04-14", "2026-05-01", "2026-06-02"],
  );
  assert.deepEqual(tabela.linhas, [
    { nome: "Bíceps", valores: ["16,4 mm", null, null] },
    { nome: "Tríceps", valores: [null, null, "21,0 mm"] },
  ]);
});

test("linha sem nenhum valor não entra, e valor em branco conta como não medido", () => {
  const comVazio = [
    av("a", "2026-01-01", {
      dobras: [
        { nome: "Bíceps", valor: "" },
        { nome: "Coxa", valor: "mm" },
        { nome: "Tríceps", valor: "12,0 mm" },
      ],
    }),
  ];
  assert.deepEqual(
    tabelaDeMedidas(comVazio, "dobras").linhas.map((l) => l.nome),
    ["Tríceps"],
  );
});

test("medida que ela inventou não some: entra no fim, depois das oficiais", () => {
  const propria = [
    av("a", "2026-01-01", {
      circunferencias: [
        { nome: "Pescoço", valor: "38 cm" },
        { nome: "Cintura", valor: "105 cm" },
      ],
    }),
  ];
  assert.deepEqual(
    tabelaDeMedidas(propria, "circunferencias").linhas.map((l) => l.nome),
    ["Cintura", "Pescoço"],
  );
});

test("mostrando as três últimas de cinco, a primeira coluna é a 3ª, não a 1ª", () => {
  const cinco = [1, 2, 3, 4, 5].map((n) =>
    av(String(n), `2026-0${n}-01`, { dobras: [{ nome: "Bíceps", valor: `${n},0 mm` }] }),
  );
  const tabela = tabelaDeMedidas(cinco, "dobras", 3);
  assert.deepEqual(
    tabela.colunas.map((c) => c.ordinal),
    ["3ª", "4ª", "5ª"],
  );
  assert.deepEqual(tabela.linhas[0]?.valores, ["3,0 mm", "4,0 mm", "5,0 mm"]);
});

test("o eixo do tempo é a data, não a posição: intervalo maior ocupa mais espaço", () => {
  const desigual = [
    av("a", "2026-01-01", { peso: 100 }),
    av("b", "2026-01-08", { peso: 99 }),
    av("c", "2026-07-01", { peso: 98 }),
  ];
  const pontos = pontosDaLinha(serieDe(desigual, "peso"), 100, 40);
  assert.equal(pontos[0]?.x, 0);
  assert.equal(pontos[2]?.x, 100);
  // Uma semana dentro de seis meses tem que ficar perto do começo. Espaçando
  // por posição, este ponto cairia em 50 e o desenho contaria um ritmo que
  // não existiu.
  assert.ok((pontos[1]?.x ?? 0) < 10, `esperava perto de zero, veio ${pontos[1]?.x}`);
});

test("o valor maior fica em cima, e série toda igual vira linha reta no meio", () => {
  const pontos = pontosDaLinha(serieDe(tres, "peso"), 100, 40);
  // 117 é o maior e é o primeiro: tem que ter o menor y.
  assert.ok((pontos[0]?.y ?? 99) < (pontos[2]?.y ?? 0));

  const iguais = [
    av("a", "2026-01-01", { peso: 80 }),
    av("b", "2026-02-01", { peso: 80 }),
  ];
  for (const p of pontosDaLinha(serieDe(iguais, "peso"), 100, 40)) {
    assert.equal(p.y, 20);
  }
});

test("um ponto só fica no meio, e nenhum ponto não quebra", () => {
  assert.deepEqual(pontosDaLinha([], 100, 40), []);
  const um = pontosDaLinha(serieDe([tres[0]!], "peso"), 100, 40);
  assert.equal(um[0]?.x, 50);
  assert.equal(um[0]?.y, 20);
});
