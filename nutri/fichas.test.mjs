import test from "node:test";
import assert from "node:assert/strict";

/**
 * `fichas.mjs` fala com o localStorage do navegador, que não existe aqui.
 * Um de mentira, em memória, basta: o que precisa ser testado é a regra,
 * não o navegador.
 */
const gaveta = new Map();
globalThis.localStorage = {
  getItem: (k) => (gaveta.has(k) ? gaveta.get(k) : null),
  setItem: (k, v) => gaveta.set(k, String(v)),
  removeItem: (k) => gaveta.delete(k),
  clear: () => gaveta.clear(),
};

const {
  apagarFicha,
  fichaVazia,
  lerFicha,
  listarFichas,
  migrarGavetaAntiga,
  novoId,
  restaurarBackup,
  salvarFicha,
  textoDoBackup,
} = await import("./fichas.mjs");

const limpar = () => gaveta.clear();
const ficha = (nome, extra = {}) => ({
  id: novoId(),
  nome,
  dieta: { peso: "", meta: "", refeicoes: [] },
  corpo: {},
  macros: {},
  ...extra,
});

test("uma ficha salva volta inteira", () => {
  limpar();
  const f = ficha("Alana", { corpo: { "c-peso": "47,8", "dob-triceps": "9,6" } });
  salvarFicha(f);
  const lida = lerFicha(f.id);
  assert.equal(lida.nome, "Alana");
  assert.equal(lida.corpo["c-peso"], "47,8");
  assert.ok(lida.atualizadoEm, "a data de gravação entra sozinha");
});

test("salvar de novo substitui, não duplica", () => {
  limpar();
  const f = ficha("Alana");
  salvarFicha(f);
  salvarFicha({ ...f, nome: "Alana Simões" });
  assert.equal(listarFichas().length, 1);
  assert.equal(lerFicha(f.id).nome, "Alana Simões");
});

test("duas pacientes não se misturam", () => {
  limpar();
  const a = ficha("Alana", { corpo: { "c-peso": "47,8" } });
  const bea = ficha("Beatriz", { corpo: { "c-peso": "70" } });
  salvarFicha(a);
  salvarFicha(bea);
  assert.equal(lerFicha(a.id).corpo["c-peso"], "47,8");
  assert.equal(lerFicha(bea.id).corpo["c-peso"], "70");
});

test("a lista vem da mais recente para a mais antiga", () => {
  limpar();
  // Pela restauração, porque `salvarFicha` carimba sempre a hora de agora —
  // é ela que mantém "mexi nesta por último" verdadeiro.
  restaurarBackup(
    JSON.stringify({
      fichas: [
        { ...ficha("Antiga"), atualizadoEm: "2020-01-01T00:00:00.000Z" },
        { ...ficha("Meio"), atualizadoEm: "2023-01-01T00:00:00.000Z" },
        { ...ficha("Nova"), atualizadoEm: "2026-01-01T00:00:00.000Z" },
      ],
    }),
  );
  assert.deepEqual(listarFichas().map((f) => f.nome), ["Nova", "Meio", "Antiga"]);
});

test("salvar uma ficha antiga a traz para o topo da lista", () => {
  limpar();
  const antiga = { ...ficha("Antiga"), atualizadoEm: "2020-01-01T00:00:00.000Z" };
  restaurarBackup(JSON.stringify({ fichas: [antiga, { ...ficha("Nova"), atualizadoEm: "2026-01-01T00:00:00.000Z" }] }));
  salvarFicha(antiga);
  assert.equal(listarFichas()[0].nome, "Antiga");
});

test("apagar tira uma e deixa as outras", () => {
  limpar();
  const a = ficha("Alana");
  const bea = ficha("Beatriz");
  salvarFicha(a);
  salvarFicha(bea);
  apagarFicha(a.id);
  assert.equal(lerFicha(a.id), null);
  assert.equal(lerFicha(bea.id).nome, "Beatriz");
});

test("ficha sem nome e sem dado nenhum é vazia", () => {
  assert.equal(fichaVazia(null), true);
  assert.equal(fichaVazia(ficha("")), true);
  assert.equal(fichaVazia(ficha("  ")), true);
});

test("basta um dado para a ficha deixar de ser vazia", () => {
  assert.equal(fichaVazia(ficha("Alana")), false);
  assert.equal(fichaVazia(ficha("", { corpo: { "c-peso": "47,8" } })), false);
  assert.equal(fichaVazia(ficha("", { macros: { "m-kcal": "1800" } })), false);
  assert.equal(
    fichaVazia(ficha("", { dieta: { peso: "", meta: "", refeicoes: [{ nome: "Café", itens: [{ codigo: "1" }] }] } })),
    false,
  );
});

test("refeição sem itens não conta como dado", () => {
  const vazia = ficha("", { dieta: { peso: "", meta: "", refeicoes: [{ nome: "Café da manhã", itens: [] }] } });
  assert.equal(fichaVazia(vazia), true);
});

// --- backup ----------------------------------------------------------------

test("o backup leva todas as fichas", () => {
  limpar();
  salvarFicha(ficha("Alana"));
  salvarFicha(ficha("Beatriz"));
  const lido = JSON.parse(textoDoBackup());
  assert.equal(lido.fichas.length, 2);
  assert.deepEqual(lido.fichas.map((f) => f.nome).sort(), ["Alana", "Beatriz"]);
});

test("restaurar ACRESCENTA — nunca apaga o que já está aqui", () => {
  limpar();
  salvarFicha(ficha("Alana"));
  const backup = textoDoBackup();
  limpar();
  const hoje = ficha("Beatriz");
  salvarFicha(hoje);
  const r = restaurarBackup(backup);
  assert.equal(r.novas, 1);
  assert.equal(lerFicha(hoje.id).nome, "Beatriz", "a ficha de hoje continua");
  assert.equal(listarFichas().length, 2);
});

test("restaurar duas vezes não duplica", () => {
  limpar();
  salvarFicha(ficha("Alana"));
  const backup = textoDoBackup();
  restaurarBackup(backup);
  restaurarBackup(backup);
  assert.equal(listarFichas().length, 1);
});

test("entre duas versões da mesma ficha, fica a mais recente", () => {
  limpar();
  const f = ficha("Alana", { corpo: { "c-peso": "47,8" } });
  salvarFicha({ ...f, atualizadoEm: "2026-01-01T00:00:00.000Z" });
  const backup = textoDoBackup();
  // Depois do backup ela mexeu na ficha. Restaurar não pode desfazer isso.
  salvarFicha({ ...f, corpo: { "c-peso": "48,5" }, atualizadoEm: "2026-06-01T00:00:00.000Z" });
  restaurarBackup(backup);
  assert.equal(lerFicha(f.id).corpo["c-peso"], "48,5");
});

test("um backup mais novo que o daqui entra", () => {
  limpar();
  const f = ficha("Alana", { corpo: { "c-peso": "47,8" } });
  restaurarBackup(
    JSON.stringify({ fichas: [{ ...f, corpo: { "c-peso": "50" }, atualizadoEm: "2026-09-01T00:00:00.000Z" }] }),
  );
  const r = restaurarBackup(
    JSON.stringify({ fichas: [{ ...f, corpo: { "c-peso": "47,8" }, atualizadoEm: "2026-09-10T00:00:00.000Z" }] }),
  );
  assert.equal(r.atualizadas, 1);
  assert.equal(lerFicha(f.id).corpo["c-peso"], "47,8");
});

test("arquivo que não é backup é recusado sem estragar nada", () => {
  limpar();
  const f = ficha("Alana");
  salvarFicha(f);
  assert.throws(() => restaurarBackup('{"qualquer":"coisa"}'), /não é um backup/);
  assert.throws(() => restaurarBackup("isto não é json"));
  assert.equal(lerFicha(f.id).nome, "Alana");
});

test("uma lista crua de fichas também serve de backup", () => {
  limpar();
  const f = ficha("Alana");
  restaurarBackup(JSON.stringify([f]));
  assert.equal(lerFicha(f.id).nome, "Alana");
});

test("linha estragada dentro do backup é pulada, o resto entra", () => {
  limpar();
  const boa = ficha("Alana");
  restaurarBackup(JSON.stringify({ fichas: [null, { semId: true }, boa, "texto solto"] }));
  assert.equal(listarFichas().length, 1);
  assert.equal(listarFichas()[0].nome, "Alana");
});

// --- migração da versão antiga ---------------------------------------------

test("a paciente que estava na tela na versão antiga vira ficha", () => {
  limpar();
  gaveta.set("nutri:dieta:v1", JSON.stringify({ nome: "Alana", peso: "47.8", meta: "", refeicoes: [] }));
  gaveta.set("nutri:corpo:v1", JSON.stringify({ campos: { "c-peso": "47,8", "dob-triceps": "9,6" } }));
  const r = migrarGavetaAntiga();
  assert.equal(r.nome, "Alana");
  assert.equal(r.corpo["dob-triceps"], "9,6");
  assert.equal(listarFichas().length, 1);
});

test("o nome podia estar só na aba de composição — vale também", () => {
  limpar();
  gaveta.set("nutri:corpo:v1", JSON.stringify({ campos: { "c-nome": "Beatriz", "c-peso": "70" } }));
  assert.equal(migrarGavetaAntiga().nome, "Beatriz");
});

test("sem nome em lugar nenhum, a ficha recuperada ganha um rótulo", () => {
  limpar();
  gaveta.set("nutri:corpo:v1", JSON.stringify({ campos: { "c-peso": "70" } }));
  assert.equal(migrarGavetaAntiga().nome, "Ficha recuperada");
});

test("a migração não roda se já existirem fichas", () => {
  limpar();
  salvarFicha(ficha("Alana"));
  gaveta.set("nutri:dieta:v1", JSON.stringify({ nome: "Outra", refeicoes: [] }));
  assert.equal(migrarGavetaAntiga(), null);
  assert.equal(listarFichas().length, 1);
});

test("gaveta antiga vazia não cria ficha nenhuma", () => {
  limpar();
  assert.equal(migrarGavetaAntiga(), null);
  gaveta.set("nutri:corpo:v1", JSON.stringify({ campos: {} }));
  assert.equal(migrarGavetaAntiga(), null);
  assert.equal(listarFichas().length, 0);
});

test("gaveta antiga com lixo dentro não derruba a abertura", () => {
  limpar();
  gaveta.set("nutri:dieta:v1", "{isto não é json");
  gaveta.set("nutri:corpo:v1", "nem isto");
  assert.doesNotThrow(() => migrarGavetaAntiga());
});

test("gaveta principal com lixo devolve lista vazia em vez de quebrar", () => {
  limpar();
  gaveta.set("nutri:fichas:v1", "{estragado");
  assert.deepEqual(listarFichas(), []);
  assert.equal(lerFicha("qualquer"), null);
});

test("ids não se repetem", () => {
  const ids = new Set(Array.from({ length: 500 }, novoId));
  assert.equal(ids.size, 500);
});

test("dieta montada com opções não é ficha vazia — senão nada é gravado", () => {
  const comOpcoes = {
    nome: "",
    corpo: {},
    macros: {},
    dieta: {
      peso: "",
      meta: "",
      refeicoes: [
        {
          nome: "Café da manhã",
          opcaoAtiva: 0,
          opcoes: [
            { rotulo: "Principal", itens: [] },
            { rotulo: "Opção 2", itens: [{ codigo: "taco:1", quantidade: 100 }] },
          ],
        },
      ],
    },
  };
  assert.equal(fichaVazia(comOpcoes), false);

  const semNada = structuredClone(comOpcoes);
  semNada.dieta.refeicoes[0].opcoes[1].itens = [];
  assert.equal(fichaVazia(semNada), true);
});
