import test from "node:test";
import assert from "node:assert/strict";
import {
  blocoEmBranco,
  diasDaViagem,
  guiaEmBranco,
  normalizarFicha,
  normalizarGuia,
  normalizarParaBusca,
  secoesDaBarra,
  trechosDeTexto,
} from "./guiaViagem.ts";

test("guia: o que não é guia vira nulo, sem lançar", () => {
  for (const lixo of [null, undefined, 3, "texto", [], {}, { secoes: "não é lista" }]) {
    assert.equal(normalizarGuia(lixo), null);
  }
});

test("guia: bloco desconhecido ou torto é descartado, o resto fica", () => {
  const guia = normalizarGuia({
    destinos: "Itália",
    secoes: [
      {
        id: "a",
        rotulo: "A",
        titulo: "Seção A",
        blocos: [
          { tipo: "texto", texto: "fica" },
          { tipo: "inventado", texto: "sai" },
          "nem objeto é",
          { tipo: "lista", estilo: "torto", itens: [{ texto: "um" }, { titulo: "", texto: "  " }, 7] },
        ],
      },
    ],
  });
  assert.ok(guia);
  assert.deepEqual(guia.secoes[0]?.blocos, [
    { tipo: "texto", texto: "fica" },
    { tipo: "lista", estilo: "marcadores", itens: [{ texto: "um" }] },
  ]);
});

test("guia: ids de seção viram âncoras válidas e não se repetem", () => {
  const guia = normalizarGuia({ secoes: [{ id: "Kit de Bolso!" }, { id: "kitdebolso" }, {}] });
  assert.ok(guia);
  const ids = guia.secoes.map((s) => s.id);
  assert.equal(new Set(ids).size, 3);
  assert.ok(ids.every((id) => /^[a-z0-9-]+$/.test(id)));
});

test("guia: tabela sempre tem uma célula por coluna", () => {
  const guia = normalizarGuia({
    secoes: [{ id: "t", blocos: [{ tipo: "tabela", colunas: ["PT", "IT"], linhas: [["a"], ["b", "c", "sobra"], "torta"] }] }],
  });
  assert.deepEqual(guia?.secoes[0]?.blocos[0], {
    tipo: "tabela",
    colunas: ["PT", "IT"],
    linhas: [
      ["a", ""],
      ["b", "c"],
      ["", ""],
    ],
  });
});

test("guia: abas não aninham sem fim", () => {
  const aninhar = (n: number): unknown =>
    n === 0 ? { tipo: "texto", texto: "fundo" } : { tipo: "abas", abas: [{ rotulo: "x", blocos: [aninhar(n - 1)] }] };
  const guia = normalizarGuia({ secoes: [{ id: "a", blocos: [aninhar(6)] }] });
  assert.ok(guia);
  assert.ok(!JSON.stringify(guia).includes("fundo"));
});

test("guia: semáforo só aceita as três cores", () => {
  const guia = normalizarGuia({
    secoes: [
      {
        id: "s",
        blocos: [
          {
            tipo: "semaforo",
            grupos: [
              { cor: "verde", titulo: "ok", itens: [{ titulo: "Arroz", texto: "branco" }] },
              { cor: "roxo", titulo: "não existe", itens: [] },
            ],
          },
        ],
      },
    ],
  });
  const bloco = guia?.secoes[0]?.blocos[0];
  assert.ok(bloco?.tipo === "semaforo");
  assert.deepEqual(
    bloco.grupos.map((g) => g.cor),
    ["verde"],
  );
});

test("guia: data inválida ou fim antes do início não gera diário", () => {
  assert.equal(normalizarGuia({ secoes: [], dataInicio: "11/11/2026", dataFim: "2026-11-26" })?.dataInicio, null);
  const invertido = normalizarGuia({ secoes: [], dataInicio: "2026-11-26", dataFim: "2026-11-11" });
  assert.equal(invertido?.dataFim, null);
  assert.deepEqual(diasDaViagem(invertido?.dataInicio ?? null, invertido?.dataFim ?? null), []);
});

test("dias: conta o primeiro e o último, com dia da semana certo", () => {
  const dias = diasDaViagem("2026-11-11", "2026-11-26");
  assert.equal(dias.length, 16);
  assert.deepEqual(dias[0], { numero: 1, data: "2026-11-11", rotulo: "11/11", semana: "qua" });
  assert.deepEqual(dias[15], { numero: 16, data: "2026-11-26", rotulo: "26/11", semana: "qui" });
});

test("dias: atravessa mês, ano e 29 de fevereiro sem pular nem repetir", () => {
  const virada = diasDaViagem("2027-12-30", "2028-01-02").map((d) => d.data);
  assert.deepEqual(virada, ["2027-12-30", "2027-12-31", "2028-01-01", "2028-01-02"]);
  const bissexto = diasDaViagem("2028-02-28", "2028-03-01").map((d) => d.rotulo);
  assert.deepEqual(bissexto, ["28/02", "29/02", "01/03"]);
});

test("dias: um dia só, e teto para data digitada errada", () => {
  assert.equal(diasDaViagem("2026-11-11", "2026-11-11").length, 1);
  assert.equal(diasDaViagem("2026-01-01", "2036-01-01").length, 90);
  assert.deepEqual(diasDaViagem(null, "2026-11-11"), []);
});

test("texto: negrito, itálico e asterisco solto", () => {
  assert.deepEqual(trechosDeTexto("**Enzima antes.** Massa, *pizza*."), [
    { texto: "Enzima antes.", negrito: true, italico: false },
    { texto: " Massa, ", negrito: false, italico: false },
    { texto: "pizza", negrito: false, italico: true },
    { texto: ".", negrito: false, italico: false },
  ]);
  assert.deepEqual(trechosDeTexto("5 * 2 = 10"), [{ texto: "5 * 2 = 10", negrito: false, italico: false }]);
  assert.deepEqual(trechosDeTexto("**sem par"), [{ texto: "**sem par", negrito: false, italico: false }]);
  assert.deepEqual(trechosDeTexto(""), []);
});

test("busca: ignora acento, caixa e marcas de negrito", () => {
  assert.equal(normalizarParaBusca("**Feijão**, grão-de-bico"), "feijao, grao-de-bico");
});

test("ficha: vazia vira nula; preenchida fica", () => {
  assert.equal(normalizarFicha({ nome: "  ", nascimento: "" }), null);
  assert.equal(normalizarFicha("texto"), null);
  assert.deepEqual(normalizarFicha({ nome: " Ana ", extra: 1 }), { nome: "Ana", nascimento: null, diagnosticos: null });
});

test("produto: só imagem embutida e link https; o resto é descartado", () => {
  const produto = (extra: Record<string, unknown>) =>
    normalizarGuia({ secoes: [{ id: "p", blocos: [{ tipo: "produto", titulo: "Barrinha", texto: "ok", ...extra }] }] })
      ?.secoes[0]?.blocos[0];
  const embutida = "data:image/webp;base64,AAAA";
  assert.deepEqual(produto({ imagem: embutida, link: "https://exemplo.com/p" }), {
    tipo: "produto",
    imagem: embutida,
    titulo: "Barrinha",
    texto: "ok",
    link: "https://exemplo.com/p",
  });
  assert.deepEqual(produto({ imagem: "https://rastreador.exemplo/foto.png", link: "javascript:alert(1)" }), {
    tipo: "produto",
    imagem: "",
    titulo: "Barrinha",
    texto: "ok",
  });
  assert.equal((produto({ imagem: "data:image/svg+xml;base64,AAAA" }) as { imagem: string }).imagem, "");
});

test("guia em branco: passa pela própria fronteira sem perder nada", () => {
  const novo = guiaEmBranco();
  assert.deepEqual(normalizarGuia(JSON.parse(JSON.stringify(novo))), novo);
  assert.deepEqual(
    secoesDaBarra(novo).map((s) => s.rotulo),
    ["Estratégia", "Guia", "Pedir", "Kit", "Alerta", "Diário"],
  );
});

test("bloco em branco: todo tipo sobrevive à fronteira", () => {
  const tipos = ["texto", "subtitulo", "destaque", "lista", "semaforo", "abas", "cartao", "tabela", "ficha", "diario", "produto"] as const;
  for (const tipo of tipos) {
    const guia = normalizarGuia({ secoes: [{ id: "a", blocos: [JSON.parse(JSON.stringify(blocoEmBranco(tipo)))] }] });
    assert.equal(guia?.secoes[0]?.blocos[0]?.tipo, tipo, tipo);
  }
});
