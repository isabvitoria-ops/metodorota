import test from "node:test";
import assert from "node:assert/strict";
import { ehMaisNova } from "./atualizacao.ts";

test("só é atualização se for mais nova que a aberta", () => {
  assert.equal(ehMaisNova("2026-11-23 23:25 UTC", "2026-11-23 18:37 UTC"), true);
  assert.equal(ehMaisNova("2026-11-23 18:37 UTC", "2026-11-23 23:25 UTC"), false);
  assert.equal(ehMaisNova("2026-11-23 23:25 UTC", "2026-11-23 23:25 UTC"), false);
});

test("sem resposta ou carimbo estranho não é atualização", () => {
  assert.equal(ehMaisNova(null, "2026-11-23 23:25 UTC"), false);
  assert.equal(ehMaisNova("2026-11-24 10:00 UTC", "versão de desenvolvimento"), false);
  assert.equal(ehMaisNova("<html>", "2026-11-23 23:25 UTC"), false);
});
