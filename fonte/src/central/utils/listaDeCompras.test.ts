import test from "node:test";
import assert from "node:assert/strict";
import { lerQuantidade, montarListaDeCompras, textoDaQuantidade } from "./listaDeCompras.ts";
import type { ConteudoProtocolo } from "../types/protocolo.ts";

test("lê a quantidade do jeito que ela escreve", () => {
  assert.deepEqual(lerQuantidade("150g"), { valor: 150, unidade: "g" });
  assert.deepEqual(lerQuantidade("2 fatias - 50g"), { valor: 50, unidade: "g" });
  assert.deepEqual(lerQuantidade("1,5 kg"), { valor: 1500, unidade: "g" });
  assert.deepEqual(lerQuantidade("200 ml"), { valor: 200, unidade: "ml" });
  assert.deepEqual(lerQuantidade("2 unidades"), { valor: 2, unidade: "unidade" });
  assert.deepEqual(lerQuantidade("1 pote"), { valor: 1, unidade: "pote" });
  assert.equal(lerQuantidade("à vontade"), null);
  assert.equal(lerQuantidade("1 colher de sopa"), null);
});

test("escreve o total", () => {
  assert.equal(textoDaQuantidade(2100, "g"), "2,1 kg");
  assert.equal(textoDaQuantidade(350, "g"), "350 g");
  assert.equal(textoDaQuantidade(14, "unidade"), "14 unidades");
  assert.equal(textoDaQuantidade(1, "pote"), "1 pote");
});

const PLANO = {
  orientacoes: [],
  secoes: [],
  refeicoes: [
    {
      nome: "Café da manhã",
      opcoes: [
        {
          rotulo: "",
          notas: [],
          itens: [
            { alimento: "Pão de forma", quantidade: "2 fatias - 50g", substituicoes: [] },
            { alimento: "Ovo", quantidade: "2 unidades", substituicoes: [] },
            { alimento: "Café", quantidade: "à vontade", substituicoes: [] },
          ],
        },
      ],
    },
    { nome: "Almoço", opcoes: [{ rotulo: "", notas: [], itens: [{ alimento: "Arroz cozido", quantidade: "150g", substituicoes: [] }] }] },
    {
      nome: "Jantar",
      opcoes: [
        { rotulo: "Padrão", notas: [], itens: [{ alimento: "Arroz cozido", quantidade: "150g", substituicoes: [] }] },
        // A segunda opção não entra: a lista é da opção padrão.
        { rotulo: "Hambúrguer", notas: [], itens: [{ alimento: "Pão de hambúrguer", quantidade: "60g", substituicoes: [] }] },
      ],
    },
  ],
} as unknown as ConteudoProtocolo;

test("soma 7 dias, junta o mesmo alimento e separa por corredor", () => {
  const l = montarListaDeCompras(PLANO);
  const todos = l.secoes.flatMap((s) => s.itens);
  const arroz = todos.find((i) => i.nome === "Arroz cozido");
  assert.equal(arroz?.total, "2,1 kg");
  assert.equal(arroz?.conta, "por dia: 150 g no almoço + 150 g no jantar");
  assert.equal(todos.find((i) => i.nome === "Ovo")?.total, "14 unidades");
  assert.equal(todos.find((i) => i.nome === "Pão de forma")?.total, "350 g");
  assert.ok(!todos.some((i) => i.nome === "Pão de hambúrguer"));
  assert.deepEqual(l.semConta, ["Café (à vontade)"]);
  assert.deepEqual(
    l.secoes.map((s) => s.titulo),
    ["Ovos e laticínios", "Padaria", "Mercearia"],
  );
});

test("macarrão não vai para o hortifrúti por causa de \"maçã\"", () => {
  const l = montarListaDeCompras({ orientacoes: [], secoes: [], refeicoes: [{ nome: "Almoço", opcoes: [{ rotulo: "", notas: [], itens: [{ alimento: "Macarrão cozido", quantidade: "130g", substituicoes: [] }, { alimento: "Maçã", quantidade: "1 unidade", substituicoes: [] }] }] }] } as unknown as ConteudoProtocolo);
  assert.deepEqual(l.secoes.map((s) => [s.titulo, s.itens.map((i) => i.nome)]), [["Hortifrúti", ["Maçã"]], ["Mercearia", ["Macarrão cozido"]]]);
});

test("plano vazio dá lista vazia", () => {
  assert.deepEqual(montarListaDeCompras(null), { secoes: [], semConta: [] });
});
