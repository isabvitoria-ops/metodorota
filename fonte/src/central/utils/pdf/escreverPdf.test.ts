import assert from "node:assert/strict";
import test from "node:test";
import { enderecoDoLink, escreverPdf } from "./escreverPdf.ts";

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

test("pdf: o link vira área clicável na página, e a tabela de endereços continua certa", () => {
  const pdf = escreverPdf(
    [
      { jpeg: jpegDeMentira, largura: 10, altura: 14 },
      {
        jpeg: jpegDeMentira,
        largura: 10,
        altura: 14,
        links: [
          { x: 40, y: 700, largura: 80, altura: 12, url: "https://youtu.be/abc?t=1" },
          { x: 40, y: 600, largura: 80, altura: 12, url: "javascript:alert(1)" },
        ],
      },
    ],
    "Plano de treino",
  );
  const t = texto(pdf);
  // Só o link da web entra; o "javascript:" fica de fora.
  assert.equal((t.match(/\/Subtype \/Link/g) ?? []).length, 1);
  assert.match(t, /\/Rect \[40 700 120 712\] \/Border \[0 0 0\] \/A << \/S \/URI \/URI \(https:\/\/youtu\.be\/abc\?t=1\) >>/);
  // A segunda página aponta para o objeto do link; a primeira não tem nenhum.
  assert.match(t, /7 0 obj\n<< \/Type \/Page [^\n]*\/Annots \[10 0 R\]/);
  assert.doesNotMatch(t, /4 0 obj\n<< \/Type \/Page [^\n]*\/Annots/);
  const inicioDaTabela = Number(/startxref\n(\d+)\n/.exec(t)?.[1]);
  assert.ok(t.slice(inicioDaTabela).startsWith("xref\n0 11\n"));
  const linhas = t.slice(inicioDaTabela).split("\n").slice(2, 13);
  for (let numero = 1; numero <= 10; numero += 1) {
    const endereco = Number(linhas[numero]?.slice(0, 10));
    assert.ok(t.slice(endereco).startsWith(`${numero} 0 obj\n`), `objeto ${numero}`);
  }
});

test("pdf: o endereço do link é escrito do jeito que o formato pede", () => {
  assert.equal(enderecoDoLink("https://exemplo.com/a(b)"), "(https://exemplo.com/a\\(b\\))");
  assert.equal(enderecoDoLink("https://exemplo.com/execução"), "(https://exemplo.com/execu%C3%A7%C3%A3o)");
  assert.equal(enderecoDoLink("youtube.com/x"), null);
  assert.equal(enderecoDoLink("mailto:a@b.c"), null);
});
