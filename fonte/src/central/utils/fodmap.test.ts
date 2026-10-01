import test from "node:test";
import assert from "node:assert/strict";
import { filtrarFodmap, alimentosParaFase, contarPorNivel, ordenarPorNivel } from "./fodmap.ts";
import { CATALOGO_FODMAP } from "@/central/dados/sementes/fodmap.ts";
import type { AlimentoFodmap } from "@/central/types/fodmap.ts";

test("fodmap: catálogo tem pelo menos 100 alimentos", () => {
  assert.ok(CATALOGO_FODMAP.length >= 100);
});

test("fodmap: cada alimento tem id único", () => {
  const ids = CATALOGO_FODMAP.map((a) => a.id);
  assert.equal(ids.length, new Set(ids).size);
});

test("fodmap: filtrar por busca", () => {
  const r = filtrarFodmap(CATALOGO_FODMAP, "banana", null, null, null);
  assert.ok(r.length >= 1);
  assert.ok(r.every((a) => a.nome.toLowerCase().includes("banana")));
});

test("fodmap: filtrar por categoria", () => {
  const r = filtrarFodmap(CATALOGO_FODMAP, "", "frutas", null, null);
  assert.ok(r.length > 5);
  assert.ok(r.every((a) => a.categoria === "frutas"));
});

test("fodmap: filtrar por grupo", () => {
  const r = filtrarFodmap(CATALOGO_FODMAP, "", null, "lactose", null);
  assert.ok(r.length >= 3);
  assert.ok(r.every((a) => a.grupos.includes("lactose")));
});

test("fodmap: filtrar por nível", () => {
  const r = filtrarFodmap(CATALOGO_FODMAP, "", null, null, "vermelho");
  assert.ok(r.length >= 10);
  assert.ok(r.every((a) => a.nivel === "vermelho"));
});

test("fodmap: eliminação mostra só verde", () => {
  const r = alimentosParaFase(CATALOGO_FODMAP, "eliminacao");
  assert.ok(r.length > 0);
  assert.ok(r.every((a) => a.nivel === "verde"));
});

test("fodmap: reintrodução e manutenção mostram tudo", () => {
  const ri = alimentosParaFase(CATALOGO_FODMAP, "reintroducao");
  const ma = alimentosParaFase(CATALOGO_FODMAP, "manutencao");
  assert.equal(ri.length, CATALOGO_FODMAP.length);
  assert.equal(ma.length, CATALOGO_FODMAP.length);
});

test("fodmap: contar por nível", () => {
  const c = contarPorNivel(CATALOGO_FODMAP);
  assert.ok(c.verde > 0);
  assert.ok(c.amarelo > 0);
  assert.ok(c.vermelho > 0);
  assert.equal(c.verde + c.amarelo + c.vermelho, CATALOGO_FODMAP.length);
});

test("fodmap: ordenar por nível (verde primeiro, depois amarelo, depois vermelho)", () => {
  const mini: AlimentoFodmap[] = [
    { id: "a", nome: "Alho", categoria: "condimentos", porcaoSegura: null, porcaoModerada: null, nivel: "vermelho", grupos: ["frutanos"], dica: null },
    { id: "b", nome: "Arroz", categoria: "graos_cereais", porcaoSegura: "Livre", porcaoModerada: null, nivel: "verde", grupos: [], dica: null },
    { id: "c", nome: "Beterraba", categoria: "verduras_legumes", porcaoSegura: null, porcaoModerada: "20 g", nivel: "amarelo", grupos: ["frutanos"], dica: null },
  ];
  const ord = ordenarPorNivel(mini);
  assert.equal(ord[0]!.nivel, "verde");
  assert.equal(ord[1]!.nivel, "amarelo");
  assert.equal(ord[2]!.nivel, "vermelho");
});

test("fodmap: filtros combinam", () => {
  const r = filtrarFodmap(CATALOGO_FODMAP, "queijo", "laticinios", null, "verde");
  assert.ok(r.length >= 1);
  assert.ok(r.every((a) => a.categoria === "laticinios" && a.nivel === "verde"));
});

test("fodmap: busca é case-insensitive e aceita acentos", () => {
  const r = filtrarFodmap(CATALOGO_FODMAP, "MAÇÃ", null, null, null);
  assert.ok(r.length >= 1);
});
