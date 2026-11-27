import assert from "node:assert/strict";
import test from "node:test";
import { A4_PT } from "./escreverPdf.ts";
import { linksDasFolhas } from "./linksDasFolhas.ts";

// Uma folha "de mentira" do tamanho do A4 em pontos: 1 px = 1 pt.
const FOLHA = { largura: A4_PT.largura, altura: A4_PT.altura, lateral: 40, topo: 70, topoDaCapa: 40 };

test("links: cada um vai para a folha onde está, deslocado pela margem", () => {
  const fatias = [
    { inicio: 0, fim: 700 },
    { inicio: 700, fim: 1400 },
  ];
  const [primeira, segunda] = linksDasFolhas(
    [
      { esquerda: 10, topo: 100, largura: 60, altura: 12, url: "https://a" },
      { esquerda: 20, topo: 800, largura: 60, altura: 12, url: "https://b" },
    ],
    fatias,
    FOLHA,
  );
  assert.deepEqual(primeira!.map((l) => l.url), ["https://a"]);
  assert.deepEqual(segunda!.map((l) => l.url), ["https://b"]);
  const a = primeira![0]!;
  assert.equal(a.x, 50);
  // Capa: começa a 40 do alto; o link está a 100 dentro dela → topo em 140, base em 152.
  assert.ok(Math.abs(a.y - (A4_PT.altura - 152)) < 0.001);
  const b = segunda![0]!;
  // Demais folhas: começa a 70 do alto; 800 - 700 = 100 → base em 182.
  assert.ok(Math.abs(b.y - (A4_PT.altura - 182)) < 0.001);
  assert.equal(b.altura, 12);
});

test("links: o que fica partido entre duas folhas sai em pedaço nas duas", () => {
  const folhas = linksDasFolhas(
    [{ esquerda: 0, topo: 695, largura: 50, altura: 10, url: "https://c" }],
    [
      { inicio: 0, fim: 700 },
      { inicio: 700, fim: 1400 },
    ],
    FOLHA,
  );
  assert.equal(folhas[0]![0]!.altura, 5);
  assert.equal(folhas[1]![0]!.altura, 5);
});
