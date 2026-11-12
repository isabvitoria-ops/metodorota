import assert from "node:assert/strict";
import test from "node:test";
import { pedidoDePdf, pedirPdf } from "./pedidoDePdf.ts";

test("pedido de PDF: o que uma tela pede é o que Meus documentos lê", () => {
  assert.equal(pedidoDePdf(pedirPdf("protocolo")), "protocolo");
  assert.equal(pedidoDePdf(pedirPdf("avaliacao")), "avaliacao");
});

test("pedido de PDF: estado vazio ou estranho não gera nada", () => {
  assert.equal(pedidoDePdf(null), null);
  assert.equal(pedidoDePdf(undefined), null);
  assert.equal(pedidoDePdf("protocolo"), null);
  assert.equal(pedidoDePdf({ gerarPdf: "outro" }), null);
  assert.equal(pedidoDePdf({}), null);
});
