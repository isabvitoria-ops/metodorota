import test from "node:test";
import assert from "node:assert/strict";

const gaveta = new Map();
globalThis.localStorage = {
  getItem: (k) => (gaveta.has(k) ? gaveta.get(k) : null),
  setItem: (k, v) => gaveta.set(k, String(v)),
  removeItem: (k) => gaveta.delete(k),
  clear: () => gaveta.clear(),
};

const {
  conferirAlimento,
  conferirMedidas,
  excluirAlimento,
  excluirGrupo,
  listarAlimentos,
  listarGrupos,
  medidasDe,
  restaurarDoBackup,
  salvarAlimento,
  salvarGrupo,
  salvarMedidas,
  tudoParaBackup,
} = await import("./meusAlimentos.mjs");

const limpar = () => gaveta.clear();

// --- alimentos dela --------------------------------------------------------

test("um alimento dela salva e volta inteiro", () => {
  limpar();
  const whey = salvarAlimento({
    nome: "Whey Growth baunilha",
    energia_kcal: "120", proteina: "24", carboidrato: "3", lipideos: "1,5", fibra_alimentar: "0",
  });
  const lido = listarAlimentos()[0];
  assert.equal(lido.nome, "Whey Growth baunilha");
  assert.equal(lido.proteina, 24);
  assert.equal(lido.lipideos, 1.5, "vírgula vira número");
  assert.equal(lido.fibra_alimentar, 0, "zero digitado é zero medido");
  assert.equal(lido.id, whey.id);
});

test("campo em branco fica NULO, não zero", () => {
  // Um whey sem fibra anotada não tem zero de fibra: tem fibra desconhecida.
  // Zero aqui faria o alimento dela mentir onde a TACO não mente.
  limpar();
  const a = salvarAlimento({ nome: "Pão da padaria", energia_kcal: "270" });
  assert.equal(a.energia_kcal, 270);
  assert.equal(a.fibra_alimentar, null);
  assert.equal(a.proteina, null);
});

test("alimento sem nome é recusado", () => {
  limpar();
  assert.throws(() => salvarAlimento({ nome: "   " }), /nome/i);
});

test("valor negativo é recusado", () => {
  limpar();
  assert.throws(() => salvarAlimento({ nome: "X", proteina: "-2" }), /negativo/i);
});

test("valor que não é número é recusado, em vez de virar zero", () => {
  limpar();
  assert.throws(() => salvarAlimento({ nome: "X", proteina: "muito" }), /não sei ler/i);
});

test("salvar de novo edita, não duplica", () => {
  limpar();
  const a = salvarAlimento({ nome: "Whey", proteina: "24" });
  salvarAlimento({ ...a, nome: "Whey chocolate", proteina: "25" });
  assert.equal(listarAlimentos().length, 1);
  assert.equal(listarAlimentos()[0].nome, "Whey chocolate");
  assert.equal(listarAlimentos()[0].proteina, 25);
});

test("excluir tira um e deixa os outros", () => {
  limpar();
  const a = salvarAlimento({ nome: "Whey" });
  salvarAlimento({ nome: "Pão" });
  excluirAlimento(a.id);
  assert.deepEqual(listarAlimentos().map((x) => x.nome), ["Pão"]);
});

// --- medidas caseiras ------------------------------------------------------

test("a porção que ela cria: 1 unidade = 100 g", () => {
  limpar();
  salvarMedidas("ibge:6300701:99", [{ nome: "unidade", gramas: "100" }]);
  assert.deepEqual(medidasDe("ibge:6300701:99"), [{ nome: "unidade", gramas: 100 }]);
});

test("medida sem nome, sem gramas ou com gramas zero não entra", () => {
  assert.deepEqual(conferirMedidas([{ nome: "", gramas: 10 }]), []);
  assert.deepEqual(conferirMedidas([{ nome: "unidade", gramas: "" }]), []);
  assert.deepEqual(conferirMedidas([{ nome: "unidade", gramas: 0 }]), []);
  assert.deepEqual(conferirMedidas([{ nome: "unidade", gramas: -5 }]), []);
});

test("a mesma medida duas vezes fica uma só", () => {
  const m = conferirMedidas([{ nome: "unidade", gramas: 100 }, { nome: "Unidade", gramas: 120 }]);
  assert.equal(m.length, 1);
  assert.equal(m[0].gramas, 100, "vale a primeira");
});

test("apagar todas as medidas de um alimento não deixa linha órfã", () => {
  limpar();
  salvarMedidas("taco:1", [{ nome: "colher", gramas: 15 }]);
  salvarMedidas("taco:1", []);
  assert.deepEqual(medidasDe("taco:1"), []);
  assert.equal(tudoParaBackup().medidas.length, 0);
});

// --- grupos favoritos ------------------------------------------------------

test("um grupo de frutas salva com os itens e as medidas", () => {
  limpar();
  const g = salvarGrupo({
    nome: "Frutas",
    itens: [
      { codigo: "taco:1", nome: "Banana", quantidade: 1, medida: { nome: "unidade", gramas: 60 } },
      { codigo: "taco:2", nome: "Mamão", quantidade: 150, medida: { nome: "g", gramas: 1 } },
    ],
  });
  const lido = listarGrupos()[0];
  assert.equal(lido.nome, "Frutas");
  assert.equal(lido.itens.length, 2);
  assert.equal(lido.itens[0].medida.gramas, 60);
  assert.equal(lido.id, g.id);
});

test("item sem código não entra no grupo", () => {
  limpar();
  const g = salvarGrupo({ nome: "Frutas", itens: [{ nome: "sem código" }, { codigo: "a", nome: "Banana" }] });
  assert.equal(g.itens.length, 1);
});

test("grupo sem nome é recusado", () => {
  limpar();
  assert.throws(() => salvarGrupo({ nome: "  ", itens: [] }), /nome/i);
});

test("editar o grupo troca os itens — é o 'poder excluir o que quero'", () => {
  limpar();
  const g = salvarGrupo({ nome: "Frutas", itens: [{ codigo: "a", nome: "Banana" }, { codigo: "b", nome: "Uva" }] });
  salvarGrupo({ ...g, itens: g.itens.filter((i) => i.codigo !== "b") });
  assert.equal(listarGrupos()[0].itens.length, 1);
  assert.equal(listarGrupos().length, 1, "editar não duplica o grupo");
});

test("excluir grupo não leva os outros junto", () => {
  limpar();
  const g = salvarGrupo({ nome: "Frutas", itens: [] });
  salvarGrupo({ nome: "Carbos do almoço", itens: [] });
  excluirGrupo(g.id);
  assert.deepEqual(listarGrupos().map((x) => x.nome), ["Carbos do almoço"]);
});

// --- backup ---------------------------------------------------------------

test("o backup leva alimentos, grupos e medidas", () => {
  limpar();
  salvarAlimento({ nome: "Whey" });
  salvarGrupo({ nome: "Frutas", itens: [] });
  salvarMedidas("taco:1", [{ nome: "colher", gramas: 15 }]);
  const b = tudoParaBackup();
  assert.equal(b.meusAlimentos.length, 1);
  assert.equal(b.grupos.length, 1);
  assert.equal(b.medidas.length, 1);
});

test("restaurar ACRESCENTA — o cadastrado hoje não some", () => {
  limpar();
  salvarAlimento({ nome: "Whey" });
  const backup = tudoParaBackup();
  limpar();
  const hoje = salvarAlimento({ nome: "Pão de hoje" });
  const r = restaurarDoBackup(backup);
  assert.equal(r.alimentos, 1);
  assert.equal(listarAlimentos().length, 2);
  assert.ok(listarAlimentos().some((a) => a.id === hoje.id));
});

test("restaurar duas vezes não duplica", () => {
  limpar();
  salvarAlimento({ nome: "Whey" });
  const backup = tudoParaBackup();
  restaurarDoBackup(backup);
  restaurarDoBackup(backup);
  assert.equal(listarAlimentos().length, 1);
});

test("backup sem as chaves novas não derruba a restauração", () => {
  limpar();
  assert.doesNotThrow(() => restaurarDoBackup({}));
  assert.doesNotThrow(() => restaurarDoBackup(null));
  assert.deepEqual(listarAlimentos(), []);
});

test("gaveta com lixo devolve lista vazia em vez de quebrar", () => {
  limpar();
  gaveta.set("nutri:meus-alimentos:v1", "{estragado");
  assert.deepEqual(listarAlimentos(), []);
});
