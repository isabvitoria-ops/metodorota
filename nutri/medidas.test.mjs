import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * O arquivo de medidas é gerado (`scripts/gerar-medidas.py`), e estes
 * testes conferem o que ele promete: todo peso é positivo, todo alimento
 * existe na tabela de onde diz vir, e toda medida de TACO/IBGE carrega a
 * referência para conferir na fonte (USDA ou a planilha dela).
 */
const ler = (f) => JSON.parse(readFileSync(new URL(`./dados/${f}`, import.meta.url)));
const medidas = ler("medidas.json").alimentos;
const taco = new Set(ler("taco.json").alimentos.map((a) => `taco:${a.c}`));
const ibge = new Set(ler("ibge.json").alimentos.map((a) => `ibge:${a.codigo}:${a.preparo_codigo}`));
const usda = new Set(ler("usda.json").alimentos.map((a) => `usda:${a.c}`));

test("todo alimento com medida existe na sua tabela", () => {
  for (const id of Object.keys(medidas)) {
    // A TBCA mora no navegador dela, não no site: não há como conferir aqui.
    if (id.startsWith("imp:")) continue;
    const base = id.startsWith("taco:") ? taco : id.startsWith("ibge:") ? ibge : usda;
    assert.ok(base.has(id), `${id} não existe na tabela`);
  }
});

test("todo peso é um número maior que zero", () => {
  for (const [id, lista] of Object.entries(medidas)) {
    assert.ok(lista.length > 0, id);
    for (const m of lista) {
      const g = Array.isArray(m) ? m[1] : m.g;
      assert.ok(Number.isFinite(g) && g > 0, `${id}: ${JSON.stringify(m)}`);
    }
  }
});

test("TACO, IBGE e TBCA sempre dizem de onde veio o peso", () => {
  for (const [id, lista] of Object.entries(medidas)) {
    if (id.startsWith("usda:")) continue;
    for (const m of lista) assert.match(m.ref, /USDA SR28 \d{5}|medidas_caseiras_lote\d+\.xlsx/, id);
  }
});

test("a planilha dela substitui o USDA, e não soma", () => {
  // Castanha-do-pará: USDA dizia 5 g; a planilha (Tucunduva) diz 4 g.
  // No seletor fica só a dela — duas "unidade" com pesos diferentes, não.
  assert.deepEqual(
    medidas["taco:589"].map((m) => [m.n, m.g]),
    [["xícara", 130], ["unidade", 4]],
  );
  assert.match(medidas["taco:589"][1].ref, /TUCUNDUVA.*32,5/);
});

test("pão francês e filé de frango vêm da planilha", () => {
  assert.deepEqual(medidas["taco:53"].map((m) => [m.n, m.g]), [["unidade", 50]]);
  assert.deepEqual(
    medidas["taco:410"].map((m) => m.g),
    [70, 100, 120],
  );
});

test("a tapioca da TBCA importada ganha a unidade pelo código", () => {
  assert.deepEqual(medidas["imp:BRC0906B"].map((m) => [m.n, m.g]), [["unidade média", 60]]);
});

test("o kiwi pesa o que o USDA diz: 69 g", () => {
  assert.deepEqual(
    medidas["taco:207"].map((m) => [m.n, m.g]),
    [["unidade", 69]],
  );
});

test("variedade diferente não ganha peso americano", () => {
  // Laranja-pera e goiaba brasileira não são as do USDA: sem medida.
  const ids = [...taco].filter((id) => !medidas[id]);
  const nomes = new Map(ler("taco.json").alimentos.map((a) => [`taco:${a.c}`, a.n]));
  const semMedida = ids.map((id) => nomes.get(id));
  assert.ok(semMedida.includes("Laranja, pêra, crua"));
  assert.ok(semMedida.includes("Goiaba, vermelha, com casca, crua"));
  assert.ok(semMedida.includes("Abacate, cru"));
});
