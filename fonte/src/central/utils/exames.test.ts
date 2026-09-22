import assert from "node:assert/strict";
import { test } from "node:test";

import {
  tamanhoBonito,
  porQueNaoServe,
  caminhoDoExame,
  tipoPelaExtensao,
  TAMANHO_MAXIMO,
} from "./exames";

test("o tamanho sai legível", () => {
  assert.equal(tamanhoBonito(500), "500 B");
  assert.equal(tamanhoBonito(2048), "2 KB");
  assert.equal(tamanhoBonito(5 * 1024 * 1024), "5,0 MB");
});

test("PDF dentro do limite serve", () => {
  assert.equal(porQueNaoServe({ name: "exame.pdf", size: 200000, type: "application/pdf" }), null);
});

test("foto serve", () => {
  assert.equal(porQueNaoServe({ name: "foto.jpg", size: 200000, type: "image/jpeg" }), null);
});

test("arquivo grande demais é recusado, e a frase diz os dois tamanhos", () => {
  const m = porQueNaoServe({ name: "x.pdf", size: TAMANHO_MAXIMO + 1, type: "application/pdf" });
  assert.ok(m?.includes("10,0 MB"), m ?? "sem mensagem");
  assert.ok(m?.includes("limite"), m ?? "");
});

test("arquivo vazio é recusado", () => {
  assert.ok(porQueNaoServe({ name: "x.pdf", size: 0, type: "application/pdf" }));
});

test("VÍDEO é recusado — um vídeo comeria um décimo do plano inteiro", () => {
  assert.ok(porQueNaoServe({ name: "v.mp4", size: 1000, type: "video/mp4" }));
});

test("executável é recusado", () => {
  assert.ok(porQueNaoServe({ name: "x.exe", size: 1000, type: "application/x-msdownload" }));
});

test("navegador que não informa o tipo cai na extensão", () => {
  assert.equal(porQueNaoServe({ name: "exame.pdf", size: 1000, type: "" }), null);
  assert.ok(porQueNaoServe({ name: "exame.zip", size: 1000, type: "" }));
});

test("a extensão vira tipo", () => {
  assert.equal(tipoPelaExtensao("a.PDF"), "application/pdf");
  assert.equal(tipoPelaExtensao("a.jpeg"), "image/jpeg");
  assert.equal(tipoPelaExtensao("a.txt"), "");
});

test("A PRIMEIRA PASTA É A PACIENTE — é o que separa uma da outra no balde", () => {
  const c = caminhoDoExame("abc-123", "exame.pdf");
  assert.ok(c.startsWith("abc-123/"), c);
});

test("acento e espaço saem do nome do arquivo", () => {
  const c = caminhoDoExame("p1", "Exame de Sangue — Março.pdf");
  assert.ok(!/[^\x20-\x7E]/.test(c), c);
  assert.ok(!c.includes(" "), c);
  assert.ok(c.endsWith(".pdf"), c);
});

test("dois arquivos de mesmo nome não se sobrescrevem", async () => {
  const a = caminhoDoExame("p1", "exame.pdf");
  await new Promise((r) => setTimeout(r, 2));
  const b = caminhoDoExame("p1", "exame.pdf");
  assert.notEqual(a, b);
});

test("nome vazio não gera caminho terminando em barra", () => {
  const c = caminhoDoExame("p1", "");
  assert.ok(!c.endsWith("/"), c);
  assert.ok(c.startsWith("p1/"), c);
});

test("nome gigante é cortado, e a pasta continua sendo a primeira", () => {
  const c = caminhoDoExame("p1", "a".repeat(500) + ".pdf");
  assert.ok(c.startsWith("p1/"));
  assert.ok(c.length < 120, `caminho ficou com ${c.length}`);
});
