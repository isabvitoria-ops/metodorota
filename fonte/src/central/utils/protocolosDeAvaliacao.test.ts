import test from "node:test";
import assert from "node:assert/strict";
import { DOBRAS } from "./medidasCorporais";
import { PROTOCOLOS_DE_AVALIACAO, protocoloDoMetodo } from "./protocolosDeAvaliacao";

const NOMES_CONHECIDOS = new Set(DOBRAS.map((d) => d.nome));

test("toda dobra citada num protocolo existe na lista oficial de dobras", () => {
  for (const p of PROTOCOLOS_DE_AVALIACAO) {
    for (const dobra of p.dobras) {
      assert.ok(NOMES_CONHECIDOS.has(dobra), `${p.id}: "${dobra}" não está em DOBRAS`);
    }
  }
});

test("nenhum protocolo fica sem dobra nenhuma", () => {
  for (const p of PROTOCOLOS_DE_AVALIACAO) {
    assert.ok(p.dobras.length > 0, p.id);
  }
});

test("os rótulos são únicos — dois protocolos com o mesmo nome confundiriam o registro", () => {
  const rotulos = PROTOCOLOS_DE_AVALIACAO.map((p) => p.rotulo);
  assert.equal(new Set(rotulos).size, rotulos.length);
});

test("protocoloDoMetodo acha pelo rótulo exato", () => {
  const achado = protocoloDoMetodo("Slaughter — 2 dobras");
  assert.equal(achado?.id, "slaughter");
});

test("protocoloDoMetodo ignora espaço em volta", () => {
  assert.equal(protocoloDoMetodo("  Slaughter — 2 dobras  ")?.id, "slaughter");
});

test("protocoloDoMetodo devolve nulo para texto livre dela", () => {
  assert.equal(protocoloDoMetodo("Bioimpedância feita na academia"), null);
  assert.equal(protocoloDoMetodo(""), null);
});
