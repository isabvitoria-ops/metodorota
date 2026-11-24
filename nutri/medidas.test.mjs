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

test("o kiwi pesa o que o IBGE POF diz (auditoria de 23/11): 94 g, e não os 69 g do USDA", () => {
  assert.deepEqual(
    medidas["taco:207"].map((m) => [m.n, m.g]),
    [["unidade média", 94]],
  );
  assert.match(medidas["taco:207"][0].ref, /IBGE POF 2008-09.*medidas_caseiras_lote2\.xlsx/);
});

test("variedade diferente não ganha peso americano", () => {
  // Laranja-pera, goiaba e abacate não são os do USDA. Hoje têm medida
  // brasileira (IBGE POF, auditoria de 23/11) — nunca uma do USDA.
  const nomes = new Map(ler("taco.json").alimentos.map((a) => [a.n, `taco:${a.c}`]));
  for (const nome of ["Laranja, pêra, crua", "Goiaba, vermelha, com casca, crua", "Abacate, cru"]) {
    for (const m of medidas[nomes.get(nome)] ?? []) assert.doesNotMatch(m.ref, /USDA/, nome);
  }
});

test("lote 2: medida de cozido nunca vai para o cru", () => {
  const nomes = new Map(ler("taco.json").alimentos.map((a) => [a.n, `taco:${a.c}`]));
  for (const cru of ["Arroz, tipo 1, cru", "Arroz, integral, cru", "Lentilha, crua", "Grão-de-bico, cru", "Feijão, carioca, cru", "Macarrão, trigo, cru"]) {
    for (const m of medidas[nomes.get(cru)] ?? []) assert.doesNotMatch(m.ref, /lote2/, cru);
  }
  assert.deepEqual(
    medidas[nomes.get("Arroz, tipo 1, cozido")].map((m) => [m.n, m.g]),
    [["escumadeira média cheia", 85], ["colher de servir cheia", 45], ["colher de sopa cheia", 25], ["colher de sopa rasa", 18], ["concha média cheia", 100]],
  );
});

test("os lotes somam: o lote 2 não apaga o que o lote 1 já tinha", () => {
  // Requeijão: "colher de sopa" do lote 1 e "colher de sopa cheia" do lote 2.
  assert.deepEqual(medidas["taco:468"].map((m) => [m.n, m.g]), [["colher de sopa", 30], ["colher de sopa cheia", 30]]);
  // Filé de frango: o lote 1 continua valendo (o "filé pequeno 60 g" da auditoria espera a decisão dela).
  assert.deepEqual(medidas["taco:410"].slice(0, 3).map((m) => m.g), [70, 100, 120]);
});
