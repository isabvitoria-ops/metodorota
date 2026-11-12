import assert from "node:assert/strict";
import test from "node:test";
import { abrirImpressao } from "./impressao.ts";

// Este teste existe por causa de um defeito que foi ao ar: trocar o
// `window.print()` pelo comando de edição "print" fez o iPhone parar de abrir
// a tela de salvar em TODOS os PDFs. A função chama `window.print()`, uma vez,
// e nada além dele.
test("impressão: chama window.print uma vez, e só ele", () => {
  let vezes = 0;
  abrirImpressao({ print: () => void (vezes += 1) });
  assert.equal(vezes, 1);
});
