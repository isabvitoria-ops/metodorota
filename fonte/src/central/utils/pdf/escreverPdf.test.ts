import assert from "node:assert/strict";
import test from "node:test";
import { escreverPdf } from "./escreverPdf.ts";

const jpegDeMentira = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 0xff, 0xd9]);
const texto = (bytes: Uint8Array) => new TextDecoder("latin1").decode(bytes);

test("pdf: começa e termina como PDF, com uma página por imagem", () => {
  const pdf = escreverPdf(
    [
      { jpeg: jpegDeMentira, largura: 100, altura: 141 },
      { jpeg: jpegDeMentira, largura: 100, altura: 141 },
    ],
    "Protocolo Alimentar — Ana (teste)",
  );
  const t = texto(pdf);
  assert.ok(t.startsWith("%PDF-1.4\n"));
  assert.ok(t.endsWith("%%EOF\n"));
  assert.match(t, /\/Type \/Pages \/Count 2 /);
  assert.equal((t.match(/\/Type \/Page /g) ?? []).length, 2);
  assert.equal((t.match(/\/Filter \/DCTDecode/g) ?? []).length, 2);
  // O título vai em UTF-16 (hexadecimal), para o acento chegar inteiro: "Pr" = 0050 0072.
  assert.match(t, /\/Title <FEFF00500072006F/);
});

test("pdf: cada endereço da tabela aponta para o começo do objeto certo", () => {
  const pdf = escreverPdf([{ jpeg: jpegDeMentira, largura: 10, altura: 14 }], "x");
  const t = texto(pdf);
  const inicioDaTabela = Number(/startxref\n(\d+)\n/.exec(t)?.[1]);
  assert.ok(t.slice(inicioDaTabela).startsWith("xref\n0 7\n"));
  const linhas = t.slice(inicioDaTabela).split("\n").slice(2, 9);
  assert.equal(linhas[0], "0000000000 65535 f ");
  for (let numero = 1; numero <= 6; numero += 1) {
    const endereco = Number(linhas[numero]?.slice(0, 10));
    assert.ok(t.slice(endereco).startsWith(`${numero} 0 obj\n`), `objeto ${numero}`);
  }
});

test("pdf: sem página nenhuma é erro, não arquivo vazio", () => {
  assert.throws(() => escreverPdf([], "x"));
});
