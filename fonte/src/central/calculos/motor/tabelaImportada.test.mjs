import test from "node:test";
import assert from "node:assert/strict";

const gaveta = new Map();
globalThis.localStorage = {
  getItem: (k) => (gaveta.has(k) ? gaveta.get(k) : null),
  setItem: (k, v) => gaveta.set(k, String(v)),
  removeItem: (k) => gaveta.delete(k),
  clear: () => gaveta.clear(),
};

const { apagarTabela, conferirTabela, importarTabela, lerTabela } = await import(
  "./tabelaImportada.mjs"
);

const arquivo = {
  fonte: { sigla: "TBCA", nome: "Tabela Brasileira", licenca: "CC BY-NC-ND 4.0" },
  alimentos: [
    {
      codigo: "BRC0906B",
      nome: "Tapioca",
      grupo: "Vegetais e derivados",
      energia_kcal: 289,
      carboidrato: 71.7,
      colesterol: 0,
      sodio: null,
      medidas: [{ nome: "Pedaço/Unidade/Fatia (M)", gramas: 60 }],
    },
  ],
};

test("o zero medido continua zero, e o ausente continua nulo", () => {
  const { alimentos } = conferirTabela(arquivo);
  // Colesterol de vegetal é zero de verdade. Um `Number(v) || null` aqui
  // transformaria esse zero em "sem informação", e a tela mostraria "—"
  // onde a tabela mediu e disse zero.
  assert.equal(alimentos[0].colesterol, 0);
  assert.equal(alimentos[0].sodio, null);
  // Nutriente que o arquivo nem traz é nulo, nunca zero.
  assert.equal(alimentos[0].ferro, null);
});

test("vírgula decimal é lida, e texto que não é número vira nulo", () => {
  const { alimentos } = conferirTabela({
    ...arquivo,
    alimentos: [{ ...arquivo.alimentos[0], carboidrato: "71,7", ferro: "tr", zinco: "NA" }],
  });
  assert.equal(alimentos[0].carboidrato, 71.7);
  assert.equal(alimentos[0].ferro, null);
  assert.equal(alimentos[0].zinco, null);
});

test("medida sem grama, com grama zero ou repetida não entra", () => {
  const { alimentos } = conferirTabela({
    ...arquivo,
    alimentos: [
      {
        ...arquivo.alimentos[0],
        medidas: [
          { nome: "unidade", gramas: 60 },
          { nome: "Unidade", gramas: 80 },
          { nome: "fatia", gramas: 0 },
          { nome: "", gramas: 30 },
          { nome: "colher", gramas: "x" },
        ],
      },
    ],
  });
  assert.deepEqual(alimentos[0].medidas, [{ nome: "unidade", gramas: 60 }]);
});

test("alimento sem código ou sem nome fica de fora, e código repetido entra uma vez", () => {
  const { alimentos } = conferirTabela({
    ...arquivo,
    alimentos: [
      arquivo.alimentos[0],
      { ...arquivo.alimentos[0], nome: "Tapioca de novo" },
      { codigo: "", nome: "Sem código" },
      { codigo: "X1", nome: "" },
      { codigo: "X2", nome: "Vale" },
    ],
  });
  assert.deepEqual(
    alimentos.map((a) => a.codigo),
    ["BRC0906B", "X2"],
  );
});

test("arquivo que não é a tabela é recusado com o motivo, não com um erro qualquer", () => {
  assert.throws(() => importarTabela("isto não é json"), /não é o arquivo da tabela/);
  assert.throws(() => conferirTabela({ fonte: {}, alimentos: [] }), /nenhum alimento/);
  assert.throws(() => conferirTabela(null), /não é uma tabela/);
  assert.throws(
    () => conferirTabela({ alimentos: [{ codigo: "", nome: "" }] }),
    /nome e código/,
  );
});

test("importar guarda, ler devolve, apagar some — e uma importação substitui a anterior", () => {
  gaveta.clear();
  assert.equal(lerTabela(), null);

  importarTabela(JSON.stringify(arquivo));
  assert.equal(lerTabela().alimentos.length, 1);
  assert.equal(lerTabela().fonte.sigla, "TBCA");

  const outra = { fonte: { sigla: "USDA" }, alimentos: [{ codigo: "1", nome: "Butter" }] };
  importarTabela(JSON.stringify(outra));
  assert.equal(lerTabela().fonte.sigla, "USDA");
  assert.equal(lerTabela().alimentos.length, 1);

  apagarTabela();
  assert.equal(lerTabela(), null);
});

test("arquivo estragado na gaveta não derruba a tela: volta nulo", () => {
  gaveta.clear();
  gaveta.set("nutri:tabela-importada:v1", "{isto não fecha");
  assert.equal(lerTabela(), null);
  gaveta.set("nutri:tabela-importada:v1", JSON.stringify({ fonte: {} }));
  assert.equal(lerTabela(), null);
});

test("a citação e a licença viajam junto com os dados", () => {
  // Atribuir é a condição de usar, e a tela mostra isto. Perdendo a citação
  // na importação, não haveria o que mostrar.
  const { fonte } = conferirTabela(arquivo);
  assert.equal(fonte.licenca, "CC BY-NC-ND 4.0");
  assert.equal(fonte.nome, "Tabela Brasileira");
});
