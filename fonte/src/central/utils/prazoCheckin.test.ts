import test from "node:test";
import assert from "node:assert/strict";
import { textoDoPrazo } from "./prazoCheckin.ts";

test("sem prazo, nada a dizer", () => {
  assert.equal(textoDoPrazo(null, "2026-11-23"), null);
});

test("antes e no dia do prazo", () => {
  assert.deepEqual(textoDoPrazo("2026-11-24", "2026-11-23"), { passou: false, texto: "Responda até terça, 24/11, às 23:59." });
  assert.deepEqual(textoDoPrazo("2026-11-24", "2026-11-24"), { passou: false, texto: "Responda até hoje às 23:59." });
});

test("depois do prazo, o recado sem cobrança", () => {
  const r = textoDoPrazo("2026-11-24", "2026-11-25");
  assert.equal(r?.passou, true);
  assert.match(r!.texto, /fora da conta da semana/);
});
