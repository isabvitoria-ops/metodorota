import test from "node:test";
import assert from "node:assert/strict";
import {
  coocorrencias,
  gravarMemoria,
  lerMemoria,
  memoriaVazia,
  montarSugestoes,
  pontuar,
  registrar,
  sugestoesDeGrupos,
} from "./sugestoes.mjs";

const item = (codigo, nome, quantidade = 100, medida = { nome: "g", gramas: 1 }) => ({ codigo, nome, quantidade, medida });
const ficha = (...opcoes) => ({ dieta: { refeicoes: [{ nome: "Café", opcoes: opcoes.map((itens) => ({ rotulo: "P", itens })) }] } });

// Da mais recente para a mais antiga.
const FICHAS = [
  ficha([item("pao", "Pão de forma", 50), item("ovo", "Ovo", 2, { nome: "unidade", gramas: 50 }), item("cafe", "Café", 100)]),
  ficha([item("pao", "Pão de forma", 40), item("ovo", "Ovo", 1, { nome: "unidade", gramas: 50 })]),
  ficha([item("pao", "Pão de forma", 30), item("queijo", "Queijo minas", 30)]),
  ficha([item("arroz", "Arroz", 100), item("feijao", "Feijão", 80)]),
];

test("o que costuma vir junto, contado por vezes", () => {
  const c = coocorrencias(FICHAS, "pao");
  assert.equal(c.get("ovo").vezes, 2);
  assert.equal(c.get("queijo").vezes, 1);
  assert.equal(c.get("cafe").vezes, 1);
  assert.equal(c.has("arroz"), false, "não estava na mesma opção");
  assert.equal(c.has("pao"), false, "o próprio alimento não se sugere");
});

test("a quantidade sugerida é a da vez mais recente", () => {
  const ovo = coocorrencias(FICHAS, "pao").get("ovo");
  assert.equal(ovo.quantidade, 2);
  assert.equal(ovo.medida.nome, "unidade");
});

test("fichas do formato antigo (lista de itens direto na refeição) também contam", () => {
  const antiga = { dieta: { refeicoes: [{ nome: "Café", itens: [item("pao", "Pão"), item("manteiga", "Manteiga", 10)] }] } };
  assert.equal(coocorrencias([antiga], "pao").get("manteiga").vezes, 1);
});

test("grupos favoritos: os outros alimentos do grupo", () => {
  const grupos = [
    { nome: "Frutas", itens: [item("banana", "Banana"), item("maca", "Maçã")] },
    { nome: "Café da manhã", itens: [item("pao", "Pão de forma"), item("maca", "Maçã", 130)] },
  ];
  const g = sugestoesDeGrupos(grupos, "pao");
  assert.deepEqual([...g.keys()], ["maca"]);
  assert.deepEqual(g.get("maca").grupos, ["Café da manhã"]);
  assert.equal(sugestoesDeGrupos(grupos, "banana").get("maca").grupos[0], "Frutas");
});

test("a ordem: quem apareceu mais vezes vem primeiro; o que já está na opção não volta", () => {
  const s = montarSugestoes({ fichas: FICHAS, grupos: [], codigoBase: "pao", jaNaOpcao: new Set(["pao"]) });
  assert.deepEqual(s.map((x) => x.codigo), ["ovo", "cafe", "queijo"]);
  const sem = montarSugestoes({ fichas: FICHAS, grupos: [], codigoBase: "pao", jaNaOpcao: new Set(["pao", "ovo"]) });
  assert.ok(!sem.some((x) => x.codigo === "ovo"));
});

test("estar num grupo dela soma um ponto; sem histórico nenhum, ainda sugere", () => {
  const grupos = [{ nome: "Café", itens: [item("pao", "Pão"), item("mamao", "Mamão", 150)] }];
  const s = montarSugestoes({ fichas: FICHAS, grupos, codigoBase: "pao" });
  const mamao = s.find((x) => x.codigo === "mamao");
  assert.equal(mamao.origem, "grupo");
  assert.equal(mamao.pontos, 1);
  assert.equal(montarSugestoes({ fichas: [], grupos: [], codigoBase: "pao" }).length, 0, "sem dado, sem sugestão");
});

test("aceitar sobe, ignorar desce até sumir — e isso muda a ordem seguinte", () => {
  let m = memoriaVazia();
  // Ela aceita o queijo duas vezes...
  m = registrar(m, "pao", "queijo", "aceita");
  m = registrar(m, "pao", "queijo", "aceita");
  let s = montarSugestoes({ fichas: FICHAS, grupos: [], codigoBase: "pao", memoria: m });
  assert.equal(s[0].codigo, "queijo", "1 vez junto + 2 aceites = 5 pontos, passa o ovo (2)");
  // ...e ignora o café duas vezes: some (1 − 4 <= 0).
  m = registrar(m, "pao", "cafe", "ignorada");
  m = registrar(m, "pao", "cafe", "ignorada");
  s = montarSugestoes({ fichas: FICHAS, grupos: [], codigoBase: "pao", memoria: m });
  assert.ok(!s.some((x) => x.codigo === "cafe"));
});

test("a memória é por PAR: ignorar o ovo depois do pão não afeta o ovo depois do arroz", () => {
  let m = registrar(memoriaVazia(), "pao", "ovo", "ignorada");
  m = registrar(m, "pao", "ovo", "ignorada");
  const fs = [...FICHAS, ficha([item("arroz", "Arroz"), item("ovo", "Ovo")])];
  assert.ok(!montarSugestoes({ fichas: fs, grupos: [], codigoBase: "pao", memoria: m }).some((x) => x.codigo === "ovo"));
  assert.ok(montarSugestoes({ fichas: fs, grupos: [], codigoBase: "arroz", memoria: m }).some((x) => x.codigo === "ovo"));
});

test("registrar não muda a memória antiga", () => {
  const antes = memoriaVazia();
  const depois = registrar(antes, "a", "b", "aceita");
  assert.deepEqual(antes, { pares: {} });
  assert.equal(depois.pares["a>b"].aceitas, 1);
});

test("o limite de sugestões", () => {
  const muitos = ficha([item("base", "Base"), ...Array.from({ length: 10 }, (_, i) => item(`x${i}`, `Item ${i}`))]);
  assert.equal(montarSugestoes({ fichas: [muitos], grupos: [], codigoBase: "base" }).length, 6);
  assert.equal(montarSugestoes({ fichas: [muitos], grupos: [], codigoBase: "base", limite: 3 }).length, 3);
});

test("pontuação", () => {
  assert.equal(pontuar({ vezes: 3, emGrupo: true, aceitas: 1, ignoradas: 0 }), 6);
  assert.equal(pontuar({ ignoradas: 1 }), -2);
});

test("guardar e ler a memória; gaveta quebrada não derruba", () => {
  const gaveta = new Map();
  const arm = { getItem: (k) => gaveta.get(k) ?? null, setItem: (k, v) => gaveta.set(k, v) };
  const m = registrar(memoriaVazia(), "a", "b", "aceita");
  assert.equal(gravarMemoria(m, arm), true);
  assert.deepEqual(lerMemoria(arm), m);
  assert.deepEqual(lerMemoria({ getItem: () => "{lixo" }), memoriaVazia());
  assert.deepEqual(lerMemoria({ getItem: () => { throw new Error("bloqueado"); } }), memoriaVazia());
  assert.equal(gravarMemoria(m, { setItem: () => { throw new Error("cheia"); } }), false);
});
