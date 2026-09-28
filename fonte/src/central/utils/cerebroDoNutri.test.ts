import test from "node:test";
import assert from "node:assert/strict";
import {
  PALAVRAS_POR_TRECHO,
  SOBREPOSICAO,
  caminhoDoPdf,
  normalizarTexto,
  partirEmTrechos,
  porQueNaoServe,
  tamanhoBonito,
} from "./cerebroDoNutri";

test("tamanhoBonito imprime KB e MB legíveis", () => {
  assert.equal(tamanhoBonito(500), "500 B");
  assert.equal(tamanhoBonito(2048), "2 KB");
  assert.equal(tamanhoBonito(3 * 1024 * 1024), "3,0 MB");
});

test("porQueNaoServe recusa arquivo vazio", () => {
  assert.match(
    porQueNaoServe({ name: "x.pdf", size: 0, type: "application/pdf" }) ?? "",
    /vazio/i,
  );
});

test("porQueNaoServe recusa PDF gigante", () => {
  assert.match(
    porQueNaoServe({ name: "gigante.pdf", size: 30 * 1024 * 1024, type: "application/pdf" }) ?? "",
    /limite/,
  );
});

test("porQueNaoServe recusa qualquer coisa que não seja PDF", () => {
  assert.equal(
    porQueNaoServe({ name: "foto.jpg", size: 1000, type: "image/jpeg" }),
    "O Cérebro só aceita PDF. Se for texto colado, use a outra caixa.",
  );
});

test("porQueNaoServe aceita PDF válido", () => {
  assert.equal(
    porQueNaoServe({ name: "artigo.pdf", size: 500000, type: "application/pdf" }),
    null,
  );
});

test("porQueNaoServe aceita PDF sem MIME quando extensão é .pdf", () => {
  assert.equal(porQueNaoServe({ name: "artigo.pdf", size: 500000, type: "" }), null);
});

test("normalizarTexto junta palavra cortada por hífen na quebra", () => {
  assert.equal(normalizarTexto("meta-\n bolismo é rápido"), "metabolismo é rápido");
});

test("normalizarTexto derrete espaços múltiplos", () => {
  assert.equal(normalizarTexto("a    b\t\tc"), "a b c");
});

test("normalizarTexto trata formfeed como quebra de página", () => {
  assert.equal(normalizarTexto("pag1\fpag2"), "pag1\n\npag2");
});

test("partirEmTrechos devolve zero quando o texto é só espaço", () => {
  assert.deepEqual(partirEmTrechos("   \n\n   "), []);
});

test("partirEmTrechos devolve um trecho quando o texto é curto", () => {
  const t = "uma frase curta que cabe num trecho só";
  assert.deepEqual(partirEmTrechos(t), [t]);
});

test("partirEmTrechos parte em vários com sobreposição, sem perder palavra", () => {
  // 2100 palavras: cabe em 3 trechos com sobreposição de 100
  // (800 + 700 + 700 = 2200 palavras nos trechos, com 200 sobrepostas).
  const palavras = Array.from({ length: 2100 }, (_, i) => `p${i}`);
  const trechos = partirEmTrechos(palavras.join(" "));

  assert.ok(trechos.length >= 3, `esperava 3+ trechos, veio ${trechos.length}`);
  // Todo trecho respeita o tamanho.
  for (const t of trechos) {
    const n = t.split(/\s+/).length;
    assert.ok(n <= PALAVRAS_POR_TRECHO, `trecho com ${n} palavras excede o limite`);
  }
  // Nenhuma palavra some — todas aparecem em algum trecho.
  const juntos = trechos.join(" ").split(/\s+/);
  const conjunto = new Set(juntos);
  for (const p of palavras) {
    assert.ok(conjunto.has(p), `palavra ${p} sumiu`);
  }
});

test("partirEmTrechos: trechos vizinhos compartilham sobreposição", () => {
  const palavras = Array.from({ length: 1800 }, (_, i) => `p${i}`);
  const trechos = partirEmTrechos(palavras.join(" "));
  assert.ok(trechos.length >= 2);

  const primeiro = (trechos[0] ?? "").split(/\s+/);
  const segundo = (trechos[1] ?? "").split(/\s+/);
  const fimDoPrimeiro = new Set(primeiro.slice(-SOBREPOSICAO));
  const inicioDoSegundo = new Set(segundo.slice(0, SOBREPOSICAO));

  let compartilhadas = 0;
  for (const p of inicioDoSegundo) if (fimDoPrimeiro.has(p)) compartilhadas++;
  assert.ok(compartilhadas > SOBREPOSICAO / 2, "trechos vizinhos deveriam se sobrepor");
});

test("caminhoDoPdf higieniza acento, espaço e pontuação estranha", () => {
  const c = caminhoDoPdf("Dieta Anti-inflamatória (2024).pdf");
  assert.match(c, /^\d+-Dieta-Anti-inflamatoria-2024\.pdf$/);
});

test("caminhoDoPdf tolera nome vazio", () => {
  const c = caminhoDoPdf("???");
  assert.match(c, /^\d+-documento\.pdf$/);
});

test("caminhoDoPdf: dois arquivos com o mesmo nome geram caminhos diferentes", async () => {
  const a = caminhoDoPdf("artigo.pdf");
  await new Promise((r) => setTimeout(r, 5));
  const b = caminhoDoPdf("artigo.pdf");
  assert.notEqual(a, b);
});
