import test from "node:test";
import assert from "node:assert/strict";
import { buscarNoComerFora, desenhoDaCategoria } from "./comerForaVisual.ts";

test("desenho: sai pelo nome, com ou sem acento; nome desconhecido cai no prato", () => {
  assert.equal(desenhoDaCategoria("Hambúrguer"), "hamburguer");
  assert.equal(desenhoDaCategoria("Comida japonesa"), "japonesa");
  assert.equal(desenhoDaCategoria("Massas"), "massa");
  assert.equal(desenhoDaCategoria("Pizza"), "pizza");
  assert.equal(desenhoDaCategoria("Açaí"), "acai");
  assert.equal(desenhoDaCategoria("Doces e sobremesas"), "doce");
  assert.equal(desenhoDaCategoria("Barzinho"), "bar");
  assert.equal(desenhoDaCategoria("Cinema"), "cinema");
  assert.equal(desenhoDaCategoria("Restaurantes"), "restaurante");
  assert.equal(desenhoDaCategoria("Delivery"), "delivery");
  assert.equal(desenhoDaCategoria("Aeroporto"), "prato");
});

const categorias = [
  {
    id: "hamburguer",
    nome: "Hambúrguer",
    status: "publicado",
    logo: null,
    estabelecimentos: [
      { id: "mcdonalds", nome: "McDonald's", logo: "m.png" },
      { id: "bk", nome: "Burger King", logo: null },
    ],
  },
  { id: "pizza", nome: "Pizza", status: "publicado", logo: null, estabelecimentos: [{ id: "pizzaria", nome: "Pizzaria", logo: null }] },
  { id: "delivery", nome: "Delivery", status: "em-preparacao", logo: null, estabelecimentos: [] },
];

test("busca: acha a casa pelo começo do nome, sem acento nem caixa", () => {
  assert.deepEqual(buscarNoComerFora(categorias, "MC"), [
    { tipo: "casa", categoriaId: "hamburguer", casaId: "mcdonalds", nome: "McDonald's", onde: "Hambúrguer", logo: "m.png" },
  ]);
  assert.deepEqual(
    buscarNoComerFora(categorias, "hamburguer").map((a) => a.nome),
    ["Hambúrguer"],
  );
});

test("busca: quem começa com o termo vem antes de quem só contém", () => {
  assert.deepEqual(
    buscarNoComerFora(categorias, "bu").map((a) => a.nome),
    ["Burger King", "Hambúrguer"],
  );
});

test("busca: categoria de uma casa só não repete a casa; não publicada fica fora; termo curto não busca", () => {
  assert.deepEqual(
    buscarNoComerFora(categorias, "pizz").map((a) => [a.tipo, a.nome]),
    [["categoria", "Pizza"]],
  );
  assert.deepEqual(buscarNoComerFora(categorias, "delivery"), []);
  assert.deepEqual(buscarNoComerFora(categorias, "m"), []);
});

// A conta do material: quando cada item do combo traz a sua caloria, o total
// escrito no cartão tem de ser a soma deles. Um total que não fecha é número
// sem origem na frente da paciente.
test("sementes: o total de cada combo é a soma dos itens", async () => {
  const { repositorioLocal } = await import("@/central/dados/repositorioLocal");
  const { categoriasComerFora } = await repositorioLocal.carregarCatalogo();
  let conferidos = 0;
  for (const categoria of categoriasComerFora) {
    const opcoes = [
      ...categoria.decisoes.flatMap((d) => d.opcoes),
      ...categoria.estabelecimentos.flatMap((e) => e.opcoes),
    ];
    for (const opcao of opcoes) {
      const valores = opcao.detalhes.map((d) => d.match(/[—–-]\s*(\d+(?:[.,]\d+)?)\s*kcal\s*$/)?.[1]);
      if (valores.length === 0 || valores.some((v) => v === undefined) || opcao.energia?.kcal == null) continue;
      const soma = valores.reduce((s, v) => s + Number((v as string).replace(",", ".")), 0);
      assert.equal(soma, opcao.energia.kcal, `${categoria.nome} · ${opcao.titulo}`);
      conferidos += 1;
    }
  }
  assert.ok(conferidos > 0, "nenhum combo com caloria por item para conferir");
});
