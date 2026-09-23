import test from "node:test";
import assert from "node:assert/strict";
import {
  acrescentarOpcao,
  duplicarRefeicao,
  gramasDoItem,
  itensDoDia,
  normalizarItem,
  normalizarRefeicao,
  porcaoEquivalente,
  arredondarPorcao,
  opcaoAtiva,
  refeicaoNova,
  removerOpcao,
} from "./dieta.mjs";

// --- o que o total do dia conta, que é a regra que importa ----------------

test("só a opção ATIVA entra no total do dia", () => {
  // Duas opções de café da manhã são o mesmo café. Somando as duas, o dia
  // sairia com dois cafés da manhã e o número pareceria certo.
  const cafe = {
    nome: "Café da manhã",
    opcoes: [
      { rotulo: "Principal", itens: [{ codigo: "a", nome: "Pão", gramas: 50 }] },
      { rotulo: "Opção 2", itens: [{ codigo: "b", nome: "Tapioca", gramas: 60 }] },
    ],
    opcaoAtiva: 0,
  };
  assert.deepEqual(itensDoDia([cafe]).map((i) => i.nome), ["Pão"]);
  assert.deepEqual(itensDoDia([{ ...cafe, opcaoAtiva: 1 }]).map((i) => i.nome), ["Tapioca"]);
});

test("cada refeição contribui com a sua opção ativa, e só com ela", () => {
  const r = (nome, a, b, ativa) => ({
    nome,
    opcoes: [
      { rotulo: "Principal", itens: [{ codigo: a, nome: a }] },
      { rotulo: "Opção 2", itens: [{ codigo: b, nome: b }] },
    ],
    opcaoAtiva: ativa,
  });
  const itens = itensDoDia([r("Café", "pao", "tapioca", 1), r("Almoço", "arroz", "batata", 0)]);
  assert.deepEqual(itens.map((i) => i.nome), ["tapioca", "arroz"]);
});

test("refeição sem itens não quebra a soma", () => {
  assert.deepEqual(itensDoDia([refeicaoNova()]), []);
  assert.deepEqual(itensDoDia([]), []);
  assert.deepEqual(itensDoDia(undefined), []);
});

// --- medidas caseiras -----------------------------------------------------

test("a quantidade vezes a medida dá as gramas", () => {
  assert.equal(gramasDoItem({ quantidade: 2, medida: { nome: "unidade", gramas: 60 } }), 120);
  assert.equal(gramasDoItem({ quantidade: 1.5, medida: { nome: "colher", gramas: 15 } }), 22.5);
});

test("em gramas, a quantidade É as gramas", () => {
  assert.equal(gramasDoItem({ quantidade: 80, medida: { nome: "g", gramas: 1 } }), 80);
});

test("item sem medida não vira zero por acidente", () => {
  // Medida ausente é grama: é o que o item era antes de existirem medidas.
  assert.equal(gramasDoItem(normalizarItem({ codigo: "x", gramas: 75 })), 75);
});

// --- a ficha antiga continua abrindo --------------------------------------

test("refeição salva no formato antigo vira opção Principal", () => {
  const antiga = { nome: "Café da manhã", itens: [{ codigo: "a", nome: "Pão", gramas: 50 }] };
  const r = normalizarRefeicao(antiga);
  assert.equal(r.opcoes.length, 1);
  assert.equal(r.opcoes[0].rotulo, "Principal");
  assert.equal(r.opcoes[0].itens[0].nome, "Pão");
  assert.equal(gramasDoItem(r.opcoes[0].itens[0]), 50);
});

test("o item antigo, só com gramas, vira quantidade em gramas", () => {
  const i = normalizarItem({ codigo: "a", nome: "Pão", gramas: 50 });
  assert.equal(i.quantidade, 50);
  assert.deepEqual(i.medida, { nome: "g", gramas: 1 });
});

test("o item novo, com medida, atravessa inteiro", () => {
  const i = normalizarItem({ codigo: "a", nome: "Ovo", quantidade: 2, medida: { nome: "unidade", gramas: 50 } });
  assert.equal(i.quantidade, 2);
  assert.equal(i.medida.gramas, 50);
});

test("lixo no lugar da refeição não derruba a abertura da ficha", () => {
  assert.equal(normalizarRefeicao(null).opcoes.length, 1);
  assert.equal(normalizarRefeicao("texto solto").opcoes.length, 1);
  assert.equal(normalizarRefeicao({}).opcoes.length, 1);
});

test("opcaoAtiva fora do intervalo volta para a primeira", () => {
  const r = normalizarRefeicao({ nome: "x", opcoes: [{ rotulo: "P", itens: [] }], opcaoAtiva: 7 });
  assert.equal(r.opcaoAtiva, 0);
  assert.equal(normalizarRefeicao({ nome: "x", opcoes: [{ itens: [] }], opcaoAtiva: -1 }).opcaoAtiva, 0);
});

// --- duplicar e opções ----------------------------------------------------

test("duplicar copia a refeição inteira, sem dividir a original", () => {
  const original = normalizarRefeicao({
    nome: "Café da manhã",
    itens: [{ codigo: "a", nome: "Pão", gramas: 50 }],
  });
  const copia = duplicarRefeicao(original);
  copia.opcoes[0].itens[0].quantidade = 999;
  assert.equal(original.opcoes[0].itens[0].quantidade, 50, "mexer na cópia não mexe na original");
  assert.match(copia.nome, /cópia/);
});

test("acrescentar opção copia a que está aberta, e passa a ela", () => {
  // "Opção 2" costuma ser o mesmo café com uma troca, não um café do zero.
  const r = normalizarRefeicao({ nome: "Café", itens: [{ codigo: "a", nome: "Pão", gramas: 50 }] });
  const com2 = acrescentarOpcao(r);
  assert.equal(com2.opcoes.length, 2);
  assert.equal(com2.opcoes[1].rotulo, "Opção 2");
  assert.equal(com2.opcoes[1].itens[0].nome, "Pão");
  assert.equal(com2.opcaoAtiva, 1, "a nova é a que fica aberta");
  com2.opcoes[1].itens[0].quantidade = 1;
  assert.equal(com2.opcoes[0].itens[0].quantidade, 50, "as duas não compartilham o item");
});

test("remover opção nunca deixa a refeição sem nenhuma", () => {
  const r = refeicaoNova();
  assert.equal(removerOpcao(r, 0).opcoes.length, 1);
});

test("removendo a opção aberta, a seleção não fica apontando para o vazio", () => {
  let r = normalizarRefeicao({ nome: "Café", itens: [] });
  r = acrescentarOpcao(r);
  r = acrescentarOpcao(r);
  assert.equal(r.opcaoAtiva, 2);
  r = removerOpcao(r, 2);
  assert.equal(r.opcoes.length, 2);
  assert.equal(r.opcaoAtiva, 1);
});

test("opcaoAtiva devolve algo utilizável mesmo com a refeição estragada", () => {
  assert.deepEqual(opcaoAtiva(null).itens, []);
  assert.deepEqual(opcaoAtiva({}).itens, []);
});

// --- substitutos ----------------------------------------------------------

test("substituto não entra no total do dia", () => {
  // Frango OU peixe é um prato só. Somado, o dia teria duas proteínas.
  const almoco = normalizarRefeicao({
    nome: "Almoço",
    opcoes: [{
      rotulo: "Principal",
      itens: [{
        codigo: "frango", nome: "Frango", quantidade: 120, medida: { nome: "g", gramas: 1 },
        substitutos: [{ codigo: "peixe", nome: "Peixe" }],
      }],
    }],
  });
  assert.deepEqual(itensDoDia([almoco]).map((i) => i.codigo), ["frango"]);
});

test("a porção equivalente iguala o critério, arredondada de 5 em 5 g", () => {
  // 195 kcal de frango; patinho com 219 kcal/100 g → 89 g → 90 g.
  assert.deepEqual(porcaoEquivalente(195, 219), { quantidade: 90, gramas: 90 });
});

test("em medida caseira, arredonda de meia em meia unidade", () => {
  // 32 g de proteína; ovo com 13 g/100 g e unidade de 50 g → 4,9 → 5 unidades.
  assert.deepEqual(porcaoEquivalente(32, 13, { nome: "unidade", gramas: 50 }), {
    quantidade: 5,
    gramas: 250,
  });
});

test("porção pequena arredonda de grama em grama", () => {
  assert.equal(arredondarPorcao(7.4, { nome: "g", gramas: 1 }), 7);
  assert.equal(arredondarPorcao(0.2, { nome: "g", gramas: 1 }), 1, "nunca zero");
  assert.equal(arredondarPorcao(0.1, { nome: "unidade", gramas: 50 }), 0.5);
});

test("sem o valor na tabela, não inventa porção", () => {
  assert.equal(porcaoEquivalente(30, null), null);
  assert.equal(porcaoEquivalente(30, 0), null, "igualar proteína com azeite não existe");
  assert.equal(porcaoEquivalente(null, 20), null);
  assert.equal(porcaoEquivalente(0, 20), null);
});

test("os substitutos atravessam o salvar e abrir", () => {
  const i = normalizarItem({
    codigo: "f", nome: "Frango", quantidade: 120, medida: { nome: "g", gramas: 1 },
    substitutos: [{ codigo: "p", nome: "Patinho" }, null, { nome: "sem código" }],
    igualarPor: "proteina",
  });
  assert.deepEqual(i.substitutos, [{ codigo: "p", nome: "Patinho", medida: { nome: "g", gramas: 1 } }]);
  assert.equal(i.igualarPor, "proteina");
  assert.equal(i.verSubstitutos, true);
});

test("critério desconhecido volta para kcal; item sem substituto não ganha campo", () => {
  const i = normalizarItem({ codigo: "f", substitutos: [{ codigo: "p" }], igualarPor: "sódio" });
  assert.equal(i.igualarPor, "energia_kcal");
  assert.equal("substitutos" in normalizarItem({ codigo: "f", gramas: 10 }), false);
});

test("duplicar a refeição copia os substitutos sem compartilhar", () => {
  const original = normalizarRefeicao({
    nome: "Almoço",
    itens: [{ codigo: "f", nome: "Frango", gramas: 120, substitutos: [{ codigo: "p" }] }],
  });
  const copia = duplicarRefeicao(original);
  copia.opcoes[0].itens[0].substitutos.push({ codigo: "x", nome: "", medida: { nome: "g", gramas: 1 } });
  assert.equal(original.opcoes[0].itens[0].substitutos.length, 1);
});
