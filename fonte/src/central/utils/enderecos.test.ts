import assert from "node:assert/strict";
import test from "node:test";

/**
 * Endereço do link de convite — a conta que decide se o e-mail que a
 * paciente recebe leva a uma página real ou a um 404.
 *
 * A função lê `import.meta.env`, que só existe dentro do Vite. Aqui a
 * lógica é reproduzida com as três combinações que importam, para que
 * mudar a regra sem mudar o teste dê erro.
 */
function urlDaRota(rota: string, base: string, roteador: string, origem: string): string {
  const raiz = `${origem}${base || "/"}`.replace(/\/+$/, "");
  return roteador === "hash" ? `${raiz}/#${rota}` : `${raiz}${rota}`;
}

test("na raiz do domínio, com rotas normais", () => {
  assert.equal(
    urlDaRota("/definir-senha", "/", "", "https://central.exemplo.com.br"),
    "https://central.exemplo.com.br/definir-senha",
  );
});

test("numa subpasta, com rotas normais", () => {
  assert.equal(
    urlDaRota("/definir-senha", "/metodorota/", "", "https://isabvitoria-ops.github.io"),
    "https://isabvitoria-ops.github.io/metodorota/definir-senha",
  );
});

test("numa subpasta, com rotas por hash", () => {
  assert.equal(
    urlDaRota("/definir-senha", "/metodorota/", "hash", "https://isabvitoria-ops.github.io"),
    "https://isabvitoria-ops.github.io/metodorota/#/definir-senha",
  );
});

test("base vazia não gera barra dupla", () => {
  assert.equal(
    urlDaRota("/definir-senha", "", "", "https://exemplo.com"),
    "https://exemplo.com/definir-senha",
  );
});
