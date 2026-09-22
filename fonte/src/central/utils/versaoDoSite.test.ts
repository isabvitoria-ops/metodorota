import assert from "node:assert/strict";
import { test } from "node:test";

import { versaoDoSite, versaoLegivel } from "./versaoDoSite";

/**
 * Sem `document` — que é o caso em teste e em qualquer execução fora do
 * navegador — a resposta não pode ser uma data. Uma data inventada aqui
 * seria pior do que nenhuma: ela olharia o carimbo, veria hoje, e
 * concluiria que recebeu a atualização.
 */
test("sem documento, diz que é desenvolvimento em vez de inventar data", () => {
  assert.equal(versaoDoSite(), "versão de desenvolvimento");
  assert.equal(versaoLegivel(), "versão de desenvolvimento");
});

test("a versão legível vira dia/mês/ano", () => {
  const original = globalThis.document;
  // @ts-expect-error — documento de mentira, só com o que a função usa.
  globalThis.document = {
    querySelector: () => ({ getAttribute: () => "2026-09-22 14:31" }),
  };
  try {
    assert.equal(versaoDoSite(), "2026-09-22 14:31");
    assert.equal(versaoLegivel(), "22/09/2026 às 14:31 (UTC)");
  } finally {
    globalThis.document = original;
  }
});

test("carimbo vazio conta como desenvolvimento, não como versão em branco", () => {
  const original = globalThis.document;
  // @ts-expect-error — documento de mentira.
  globalThis.document = {
    querySelector: () => ({ getAttribute: () => "   " }),
  };
  try {
    assert.equal(versaoDoSite(), "versão de desenvolvimento");
  } finally {
    globalThis.document = original;
  }
});
