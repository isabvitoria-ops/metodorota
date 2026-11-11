import assert from "node:assert/strict";
import test from "node:test";
import { abrirImpressao } from "./impressao.ts";

function alvo(execCommand: () => boolean) {
  const chamadas: string[] = [];
  return {
    chamadas,
    documento: {
      execCommand: (comando: string) => {
        chamadas.push(`comando:${comando}`);
        return execCommand();
      },
    },
    janela: { print: () => void chamadas.push("window.print") },
  };
}

test("impressão: onde o comando abre a tela, o window.print não é chamado (não abre duas vezes)", () => {
  const a = alvo(() => true);
  abrirImpressao(a);
  assert.deepEqual(a.chamadas, ["comando:print"]);
});

test("impressão: onde o comando não existe, o window.print assume", () => {
  const a = alvo(() => false);
  abrirImpressao(a);
  assert.deepEqual(a.chamadas, ["comando:print", "window.print"]);
});

test("impressão: comando que estoura também cai no window.print", () => {
  const a = alvo(() => {
    throw new Error("não suportado");
  });
  abrirImpressao(a);
  assert.deepEqual(a.chamadas, ["comando:print", "window.print"]);
});
