import assert from "node:assert/strict";
import test from "node:test";
import { CATEGORIAS_COMER_FORA } from "./sementes/comerFora";
import { CONFIGURACOES } from "./sementes/configuracoes";
import { GUIAS } from "./sementes/guias";

/**
 * A estrutura de Comer fora depois da reorganização: sem a aba "Refeição
 * livre", e com as casas (McDonald's, Burger King, Artesanal) dentro da
 * categoria, agrupadas por tipo.
 */

const porId = new Map(CATEGORIAS_COMER_FORA.map((c) => [c.id, c]));

test('a aba "Refeição livre" saiu', () => {
  assert.equal(porId.has("refeicao-livre"), false);
});

test("a conta que morava nela virou a frase do topo de Comer fora", () => {
  const frase = CONFIGURACOES.find((c) => c.chave === "comer_fora_introducao");
  assert.ok(frase, "a configuração precisa existir");
  assert.match(String(frase.valor), /duas meias refeições equivalem a uma completa/i);
});

test("hambúrguer tem as quatro casas, separadas em lanchonete e artesanal", () => {
  const casas = porId.get("hamburguer")?.estabelecimentos ?? [];
  assert.deepEqual(
    casas.map((c) => [c.nome, c.grupo]),
    [
      ["McDonald's", "Lanchonetes"],
      ["Burger King", "Lanchonetes"],
      ["Subway", "Lanchonetes"],
      ["Artesanal", "Artesanais"],
    ],
  );
});

test("massas tem o Spoleto e o italiano, separados por tipo de casa", () => {
  const casas = porId.get("massas")?.estabelecimentos ?? [];
  assert.deepEqual(
    casas.map((c) => [c.nome, c.grupo]),
    [
      ["Spoleto", "Montar no balcão"],
      ["Restaurante italiano", "Restaurantes"],
    ],
  );
});

test("cada casa com opções tem as três classificações, uma de cada", () => {
  const casas = CATEGORIAS_COMER_FORA.flatMap((c) => c.estabelecimentos).filter(
    (c) => c.opcoes.length > 0,
  );
  assert.ok(casas.length >= 5, "as casas cadastradas precisam estar aqui");
  for (const casa of casas) {
    const niveis = casa.opcoes.map((o) => o.nivel);
    assert.deepEqual(niveis, ["melhor", "boa", "ocasional"], `${casa.nome} saiu fora da ordem`);
  }
});

test("o total em kcal cresce de melhor escolha para mais ocasional", () => {
  for (const casa of CATEGORIAS_COMER_FORA.flatMap((c) => c.estabelecimentos)) {
    const totais = casa.opcoes.map((o) => o.energia?.kcal ?? null);
    if (totais.some((v) => v === null)) continue;
    const ordenado = [...totais].sort((a, b) => a! - b!);
    assert.deepEqual(totais, ordenado, `${casa.nome}: a ordem das kcal não acompanha a classificação`);
  }
});

test("os totais em kcal batem com a soma dos itens", () => {
  for (const categoria of CATEGORIAS_COMER_FORA) {
    for (const casa of categoria.estabelecimentos) {
      for (const opcao of casa.opcoes) {
        const soma = opcao.detalhes
          .map((d) => Number(d.match(/(\d+) kcal/)?.[1] ?? NaN))
          .filter((n) => !Number.isNaN(n))
          .reduce((a, b) => a + b, 0);
        if (soma > 0 && opcao.energia?.kcal) {
          assert.equal(
            opcao.energia.kcal,
            soma,
            `${casa.nome} · ${opcao.titulo}: total ${opcao.energia.kcal} ≠ soma ${soma}`,
          );
        }
      }
    }
  }
});

test("o que é estimativa diz que é estimativa", () => {
  const estimadas = [
    "hamburgueria-artesanal",
    "restaurante-italiano",
    "restaurante-japones",
    "pizzaria",
    "acaiteria",
  ];
  for (const id of estimadas) {
    const casa = CATEGORIAS_COMER_FORA.flatMap((c) => c.estabelecimentos).find((c) => c.id === id);
    assert.ok(casa, `${id} precisa existir`);
    assert.match(casa.observacoes.join(" "), /estimativa/i, `${id} sem aviso nas observações`);
    assert.match(casa.resumo ?? "", /estimad/i, `${id} sem aviso no resumo`);
    for (const opcao of casa.opcoes) {
      assert.match(opcao.energia?.observacao ?? "", /estimativa/i, `${id} · ${opcao.titulo}`);
    }
  }
});

test("toda casa e toda categoria publicada tem imagem própria", () => {
  const semImagem: string[] = [];
  for (const categoria of CATEGORIAS_COMER_FORA) {
    if (categoria.status !== "publicado") continue;
    for (const casa of categoria.estabelecimentos) {
      if (!casa.logo) semImagem.push(`${categoria.nome} · ${casa.nome}`);
    }
    // Categoria sem casa precisa da imagem dela; com uma casa só, a tela
    // empresta a da casa; com várias, cada cartão mostra a sua.
    if (categoria.estabelecimentos.length === 0 && !categoria.logo) {
      semImagem.push(categoria.nome);
    }
  }
  assert.deepEqual(semImagem, [], `sem ilustração: ${semImagem.join(", ")}`);
});

test("as imagens são embutidas, não endereço de fora", () => {
  const todas = CATEGORIAS_COMER_FORA.flatMap((c) => [
    c.logo,
    ...c.estabelecimentos.map((e) => e.logo),
  ]).filter((l): l is string => l !== null);
  assert.ok(todas.length >= 10, "as imagens precisam estar cadastradas");
  for (const logo of todas) {
    assert.match(logo, /^data:image\//, "imagem de fora quebraria a versão de arquivo único");
  }
});

test("o Subway virou lanchonete dentro de Hambúrguer, e não categoria solta", () => {
  assert.equal(porId.has("subway"), false, "não pode sobrar categoria Subway na raiz");
  const subway = porId.get("hamburguer")?.estabelecimentos.find((c) => c.id === "subway");
  assert.ok(subway, "o Subway precisa estar dentro de Hambúrguer");
  assert.deepEqual(subway.opcoes.map((o) => o.nivel), ["melhor", "boa", "ocasional"]);
});

/**
 * O que ela pediu depois de ver as telas: onde a casa ja diz tudo, a seção de
 * "montagem" era repetição. Onde a categoria tem uma casa só, a lista de um
 * item era um toque a mais para chegar ao mesmo lugar.
 */
test("as categorias com casa não repetem o conteúdo em decisões", () => {
  for (const categoria of CATEGORIAS_COMER_FORA) {
    if (categoria.estabelecimentos.length === 0) continue;
    assert.deepEqual(
      categoria.decisoes,
      [],
      `${categoria.nome} tem casa e decisão ao mesmo tempo — uma das duas está repetindo a outra`,
    );
  }
});

test("o que não está nos combos não se perdeu junto com as seções", () => {
  const japones = porId
    .get("japonesa")
    ?.estabelecimentos.find((c) => c.id === "restaurante-japones");
  assert.match(japones?.observacoes.join(" ") ?? "", /salmão/i, "a nota do salmão precisa sobreviver");

  assert.match(
    porId.get("massas")?.lembretes.join(" ") ?? "",
    /molho ao sugo/i,
    "a orientação de molho precisa sobreviver",
  );
  assert.match(
    porId.get("pizza")?.lembretes.join(" ") ?? "",
    /proteína/i,
    "a orientação de recheio precisa sobreviver",
  );
});

test("identificador de casa não se repete dentro da categoria", () => {
  for (const categoria of CATEGORIAS_COMER_FORA) {
    const ids = categoria.estabelecimentos.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length, `${categoria.nome} tem casa repetida`);
  }
});

test("a ordem das categorias não tem buraco nem repetição", () => {
  const ordens = CATEGORIAS_COMER_FORA.map((c) => c.ordem).sort((a, b) => a - b);
  assert.deepEqual(
    ordens,
    Array.from({ length: CATEGORIAS_COMER_FORA.length }, (_, i) => i + 1),
  );
});

test("o barzinho separa drink de chopp e avisa que é estimativa", () => {
  const bar = porId.get("barzinho");
  assert.equal(bar?.status, "publicado");
  assert.deepEqual(bar?.decisoes.map((d) => d.titulo), ["Com drink", "Com chopp"]);
  assert.match(bar?.introducao ?? "", /estimativa/i);
  assert.match(bar?.introducao ?? "", /duas doses/i);
  for (const decisao of bar?.decisoes ?? []) {
    assert.deepEqual(decisao.opcoes.map((o) => o.nivel), ["melhor", "boa", "ocasional"]);
    for (const opcao of decisao.opcoes) {
      assert.match(opcao.energia?.observacao ?? "", /estimativa/i, opcao.titulo);
    }
  }
});

test("todo combo com kcal por item bate com o total, em toda categoria", () => {
  const todas = CATEGORIAS_COMER_FORA.flatMap((c) => [
    ...c.estabelecimentos.flatMap((e) => e.opcoes),
    ...c.decisoes.flatMap((d) => d.opcoes),
  ]);
  let conferidos = 0;
  for (const opcao of todas) {
    const soma = opcao.detalhes
      .map((d) => Number(d.match(/(\d+) kcal/)?.[1] ?? NaN))
      .filter((n) => !Number.isNaN(n))
      .reduce((a, b) => a + b, 0);
    if (soma > 0 && opcao.energia?.kcal) {
      assert.equal(opcao.energia.kcal, soma, `${opcao.titulo}: ${opcao.energia.kcal} ≠ ${soma}`);
      conferidos += 1;
    }
  }
  assert.ok(conferidos >= 15, `só ${conferidos} combos tinham kcal por item para conferir`);
});

/**
 * Categoria de Comer fora e guia dividem a tabela `conteudos` no banco, e o
 * id é a chave primária das duas. Dois conteúdos com o mesmo id não convivem:
 * o primeiro entra e o segundo some calado, porque o seed é
 * `on conflict do nothing`. Foi o que aconteceu com o guia "Doces" e a
 * categoria "Doces e sobremesas" — o guia nunca chegou ao banco dela.
 */
test("nenhum guia tem o mesmo identificador de uma categoria de Comer fora", () => {
  const categorias = new Set(CATEGORIAS_COMER_FORA.map((c) => c.id));
  const colisoes = GUIAS.filter((g) => categorias.has(g.id)).map((g) => g.id);
  assert.deepEqual(
    colisoes,
    [],
    `estes ids existem nos dois lugares e um deles sumiria no banco: ${colisoes.join(", ")}`,
  );
});

test("nenhum identificador de conteúdo se repete", () => {
  const todos = [...CATEGORIAS_COMER_FORA.map((c) => c.id), ...GUIAS.map((g) => g.id)];
  assert.equal(new Set(todos).size, todos.length, "há identificador repetido entre categorias e guias");
});

test('o tema "No dia a dia" saiu dos guias', () => {
  assert.deepEqual(GUIAS.filter((g) => g.tema === "No dia a dia"), []);
  assert.deepEqual([...new Set(GUIAS.map((g) => g.tema))].sort(), [
    "Compras",
    "Digestão",
    "Marmitas",
    "Restrições",
  ]);
});
