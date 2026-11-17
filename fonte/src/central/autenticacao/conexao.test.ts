import { test } from "node:test";
import assert from "node:assert/strict";
import { dentroDoPrazo, idDaContaGuardadaNoAparelho, pareceFalhaDeRede, pareceLoginVencido } from "./conexao";

function armazenamento(itens: Record<string, string>): Storage {
  const chaves = Object.keys(itens);
  return {
    get length() {
      return chaves.length;
    },
    key: (i: number) => chaves[i] ?? null,
    getItem: (k: string) => itens[k] ?? null,
    setItem: () => undefined,
    removeItem: () => undefined,
    clear: () => undefined,
  } as Storage;
}

test("falha de rede: renovação do login sem internet e fetch que não chegou", () => {
  assert.equal(pareceFalhaDeRede({ name: "AuthRetryableFetchError", message: "x", status: 0 }), true);
  assert.equal(pareceFalhaDeRede({ message: "TypeError: Failed to fetch", code: "" }), true);
  assert.equal(pareceFalhaDeRede({ message: "Load failed" }), true);
  assert.equal(pareceFalhaDeRede(new TypeError("NetworkError when attempting to fetch resource.")), true);
});

test("resposta do servidor não é falha de rede", () => {
  assert.equal(pareceFalhaDeRede(null), false);
  assert.equal(pareceFalhaDeRede(undefined), false);
  assert.equal(pareceFalhaDeRede({ name: "AuthApiError", message: "Invalid Refresh Token: Refresh Token Not Found", status: 400 }), false);
  assert.equal(pareceFalhaDeRede({ code: "42501", message: "permission denied for function meu_acesso" }), false);
});

test("login vencido é reconhecido pelo código e pela mensagem", () => {
  assert.equal(pareceLoginVencido({ code: "PGRST303", message: "JWT expired" }), true);
  assert.equal(pareceLoginVencido({ code: "PGRST301", message: "x" }), true);
  assert.equal(pareceLoginVencido({ message: "JWT expired" }), true);
  assert.equal(pareceLoginVencido({ code: "42501", message: "permission denied" }), false);
  assert.equal(pareceLoginVencido(null), false);
});

test("conta guardada no aparelho vem da chave do Supabase", () => {
  const guardado = armazenamento({
    outra: "{}",
    "sb-abc-auth-token": JSON.stringify({ access_token: "a", user: { id: "conta-1" } }),
  });
  assert.equal(idDaContaGuardadaNoAparelho(guardado), "conta-1");
});

test("sem conta guardada, corrompida ou sem armazenamento: nenhuma conta", () => {
  assert.equal(idDaContaGuardadaNoAparelho(armazenamento({})), null);
  assert.equal(idDaContaGuardadaNoAparelho(armazenamento({ "sb-abc-auth-token": "{quebrado" })), null);
  assert.equal(idDaContaGuardadaNoAparelho(armazenamento({ "sb-abc-auth-token": "null" })), null);
  assert.equal(idDaContaGuardadaNoAparelho(undefined), null);
});

test("dentro do prazo: devolve a resposta que chega a tempo", async () => {
  assert.equal(await dentroDoPrazo(Promise.resolve(7), 50), 7);
});

test("dentro do prazo: devolve null quando a internet demora, e a promessa segue valendo", async () => {
  const lenta = new Promise<string>((resolve) => setTimeout(() => resolve("chegou"), 80));
  assert.equal(await dentroDoPrazo(lenta, 10), null);
  assert.equal(await lenta, "chegou");
});

test("dentro do prazo: erro que chega a tempo continua sendo erro", async () => {
  await assert.rejects(dentroDoPrazo(Promise.reject(new Error("falhou")), 50), /falhou/);
});
