import test from "node:test";
import assert from "node:assert/strict";
import type { FotoDoDiario } from "@/central/types/diarioDeFotos";
import {
  agruparPorDia,
  caminhoDaFoto,
  diasSeguidos,
  refeicaoPelaHora,
  rotuloDaRefeicao,
  rotuloDoDia,
  tamanhoReduzido,
} from "./diarioDeFotos";

function foto(p: Partial<FotoDoDiario>): FotoDoDiario {
  return {
    id: p.id ?? "x",
    caminho: "p/x.jpg",
    refeicao: "almoco",
    legenda: null,
    data: "2026-09-30",
    curtida: false,
    criadoEm: "2026-09-30T12:00:00Z",
    ...p,
  };
}

test("foto grande é reduzida mantendo a proporção; foto pequena fica como está", () => {
  assert.deepEqual(tamanhoReduzido(4000, 3000), { largura: 1280, altura: 960 });
  assert.deepEqual(tamanhoReduzido(3000, 4000), { largura: 960, altura: 1280 });
  assert.deepEqual(tamanhoReduzido(800, 600), { largura: 800, altura: 600 });
  assert.deepEqual(tamanhoReduzido(1280, 1280), { largura: 1280, altura: 1280 });
});

test("a refeição sugerida pela hora", () => {
  assert.equal(refeicaoPelaHora(7), "cafe");
  assert.equal(refeicaoPelaHora(10), "lanche_manha");
  assert.equal(refeicaoPelaHora(13), "almoco");
  assert.equal(refeicaoPelaHora(16), "lanche_tarde");
  assert.equal(refeicaoPelaHora(20), "jantar");
  assert.equal(refeicaoPelaHora(23), "ceia");
  assert.equal(refeicaoPelaHora(2), "ceia");
});

test("rótulos", () => {
  assert.equal(rotuloDaRefeicao("lanche_tarde"), "Lanche da tarde");
  assert.equal(rotuloDoDia("2026-09-30", "2026-09-30"), "Hoje");
  assert.equal(rotuloDoDia("2026-09-29", "2026-09-30"), "Ontem");
  // 28/09/2026 é segunda-feira.
  assert.equal(rotuloDoDia("2026-09-28", "2026-09-30"), "seg, 28/09");
  // virada de mês
  assert.equal(rotuloDoDia("2026-09-30", "2026-10-01"), "Ontem");
});

test("agrupar por dia: dias novos primeiro, e a foto mais recente do dia primeiro", () => {
  const g = agruparPorDia([
    foto({ id: "a", data: "2026-09-29", criadoEm: "2026-09-29T08:00:00Z" }),
    foto({ id: "b", data: "2026-09-30", criadoEm: "2026-09-30T08:00:00Z" }),
    foto({ id: "c", data: "2026-09-30", criadoEm: "2026-09-30T19:00:00Z" }),
  ]);
  assert.deepEqual(g.map((d) => d.data), ["2026-09-30", "2026-09-29"]);
  assert.deepEqual(g[0]?.fotos.map((f) => f.id), ["c", "b"]);
});

test("o caminho começa pela pasta da paciente e termina em .jpg", () => {
  const c = caminhoDaFoto("abc-123", 1700000000000, "zzz111");
  assert.equal(c, "abc-123/1700000000000-zzz111.jpg");
  assert.equal(c.split("/")[0], "abc-123");
});

test("dias seguidos: hoje sem foto ainda não quebra a sequência", () => {
  const f = [
    foto({ data: "2026-09-29" }),
    foto({ data: "2026-09-28" }),
    foto({ data: "2026-09-27" }),
    foto({ data: "2026-09-25" }),
  ];
  assert.equal(diasSeguidos(f, "2026-09-30"), 3);
  assert.equal(diasSeguidos([...f, foto({ data: "2026-09-30" })], "2026-09-30"), 4);
  assert.equal(diasSeguidos(f, "2026-10-02"), 0, "passou mais de um dia: recomeça");
  assert.equal(diasSeguidos([], "2026-09-30"), 0);
});
