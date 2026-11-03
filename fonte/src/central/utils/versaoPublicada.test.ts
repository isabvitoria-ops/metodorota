import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { versaoPublicada } from "./versaoPublicada.ts";

const fetchOriginal = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

function respostaEmPedacos(pedacos: string[], status = 200): Response {
  const codificador = new TextEncoder();
  const fluxo = new ReadableStream<Uint8Array>({
    start(controle) {
      for (const p of pedacos) controle.enqueue(codificador.encode(p));
      controle.close();
    },
  });
  return new Response(fluxo, { status });
}

const META = '<meta name="versao-do-site" content="2026-11-03 17:16 UTC" />';

test("acha o carimbo quando ele vem no primeiro pedaço", async () => {
  globalThis.fetch = (async () => respostaEmPedacos([`<head>${META}</head>`])) as typeof fetch;
  assert.equal(await versaoPublicada("/metodorota/"), "2026-11-03 17:16 UTC");
});

test("acha o carimbo quando ele chega cortado ao meio", async () => {
  globalThis.fetch = (async () =>
    respostaEmPedacos(['<head><meta name="versao-do-', 'site" content="2026-11-03 ', '17:16 UTC" /></head>'])) as typeof fetch;
  assert.equal(await versaoPublicada("/"), "2026-11-03 17:16 UTC");
});

test("aceita resposta parcial (206) e pede só o começo do arquivo", async () => {
  let pedido: RequestInit | undefined;
  let endereco = "";
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    endereco = url;
    pedido = init;
    return respostaEmPedacos([META], 206);
  }) as unknown as typeof fetch;
  assert.equal(await versaoPublicada("/metodorota/"), "2026-11-03 17:16 UTC");
  assert.match(endereco, /^\/metodorota\/\?v-site=\d+$/);
  assert.equal((pedido?.headers as Record<string, string>).Range, "bytes=0-16383");
  assert.equal(pedido?.cache, "no-store");
});

test("sem carimbo no começo do arquivo, devolve null", async () => {
  globalThis.fetch = (async () => respostaEmPedacos(["<head>", "x".repeat(20000)])) as typeof fetch;
  assert.equal(await versaoPublicada("/"), null);
});

test("resposta com erro ou falha de rede devolve null, nunca lança", async () => {
  globalThis.fetch = (async () => respostaEmPedacos([META], 404)) as typeof fetch;
  assert.equal(await versaoPublicada("/"), null);
  globalThis.fetch = (async () => {
    throw new TypeError("sem rede");
  }) as typeof fetch;
  assert.equal(await versaoPublicada("/"), null);
});
