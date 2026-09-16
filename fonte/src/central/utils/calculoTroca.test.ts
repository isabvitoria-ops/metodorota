import assert from "node:assert/strict";
import test from "node:test";
import type { Alimento, Equivalencia, GrupoAlimentar, Medida } from "@/central/types";
import { calcularTroca, destinosPossiveis, type ContextoCalculo } from "./calculoTroca";
import { combinarPorcoes, emPorcoes, medidaDePorcoes } from "./porcoes";
import { arredondarExibicao, converter } from "./medidas";
import { catalogo, hidratar } from "@/central/dados/catalogo";
import { repositorioLocal } from "@/central/dados/repositorioLocal";

// O catálogo vive em memória e é preenchido no início do app. Nos testes,
// preenchemos a partir das mesmas sementes que alimentam o banco.
hidratar(await repositorioLocal.carregarCatalogo());

/**
 * Testes do motor de cálculo (§34 do briefing: "teste também exemplos
 * matemáticos manualmente"). Rodam com `npm test`, no runner nativo do
 * Node — sem nenhuma dependência de teste instalada.
 */

function grupo(id: string, trocaPorPorcao = true, trocaParaGrupos: string[] = []): GrupoAlimentar {
  return {
    id,
    nome: id,
    descricao: null,
    ordem: 1,
    regra: { tipo: "porcoes" },
    trocaPorPorcao,
    trocaParaGrupos,
    tags: [],
  };
}

function alimento(id: string, extra: Partial<Alimento> = {}): Alimento {
  return {
    id,
    nome: id,
    grupoId: "carbo",
    unidadeBaseId: "g",
    porcao: null,
    quantidadeLivre: false,
    medidas: [],
    atributos: { semGluten: null, semLactose: null },
    tags: [],
    imagem: null,
    observacao: null,
    ativo: true,
    ...extra,
  };
}

function contexto(alimentos: Alimento[], equivalencias: Equivalencia[], grupos: GrupoAlimentar[]): ContextoCalculo {
  return {
    alimento: (id) => alimentos.find((a) => a.id === id) ?? null,
    grupo: (id) => grupos.find((g) => g.id === id) ?? null,
    equivalenciasDe: (id) =>
      equivalencias.filter((e) => e.origemAlimentoId === id || (e.bidirecional && e.destinoAlimentoId === id)),
  };
}

const g = (quantidade: number): Medida => ({ quantidade, unidadeId: "g" });

// ---------------------------------------------------------------- o exemplo do briefing

test("o exemplo do briefing: 90 g de arroz viram 72 g de macarrão", () => {
  const arroz = catalogo.alimento("arroz-cozido");
  const macarrao = catalogo.alimento("macarrao-cozido");
  assert.ok(arroz && macarrao, "os dois alimentos precisam estar cadastrados");

  const r = calcularTroca({ alimentoOrigem: arroz, alimentoDestino: macarrao, medida: g(90) });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.saida.quantidade, 72);
  assert.equal(r.saida.unidadeId, "g");
  assert.equal(r.origem, "regra-direta");
});

test("a mesma equivalência lida ao contrário: 80 g de macarrão voltam a ser 100 g de arroz", () => {
  const arroz = catalogo.alimento("arroz-cozido")!;
  const macarrao = catalogo.alimento("macarrao-cozido")!;
  const r = calcularTroca({ alimentoOrigem: macarrao, alimentoDestino: arroz, medida: g(80) });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.saida.quantidade, 100);
  assert.equal(r.origem, "regra-invertida");
});

test("a troca escala: 45 g de arroz viram 36 g de macarrão", () => {
  const arroz = catalogo.alimento("arroz-cozido")!;
  const macarrao = catalogo.alimento("macarrao-cozido")!;
  const r = calcularTroca({ alimentoOrigem: arroz, alimentoDestino: macarrao, medida: g(45) });
  assert.ok(r.ok && r.saida.quantidade === 36);
});

// ---------------------------------------------------------------- porções (§8)

test("porções: 2 porções de arroz são 200 g e 1,6 porção são 160 g", () => {
  const arroz = catalogo.alimento("arroz-cozido")!;
  assert.deepEqual(medidaDePorcoes(arroz, 2), { quantidade: 200, unidadeId: "g" });
  assert.deepEqual(medidaDePorcoes(arroz, 1.6), { quantidade: 160, unidadeId: "g" });
  assert.equal(emPorcoes(arroz, g(150)), 1.5);
});

test("troca derivada só das porções, sem equivalência escrita", () => {
  const grupos = [grupo("carbo")];
  const a = alimento("a", { porcao: g(100) });
  const b = alimento("b", { porcao: g(50) });
  const ctx = contexto([a, b], [], grupos);

  const r = calcularTroca({ alimentoOrigem: a, alimentoDestino: b, medida: g(90) }, ctx);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.saida.quantidade, 45);
  assert.equal(r.origem, "porcoes");
  assert.equal(r.porcoes, 0.9);
});

test("grupo com trocaPorPorcao desligado não deriva nada", () => {
  const grupos = [grupo("carbo", false)];
  const a = alimento("a", { porcao: g(100) });
  const b = alimento("b", { porcao: g(50) });
  const r = calcularTroca(
    { alimentoOrigem: a, alimentoDestino: b, medida: g(90) },
    contexto([a, b], [], grupos),
  );
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.motivo, "sem-equivalencia");
});

test("alimento sem porção cadastrada não é estimado — devolve falha explicada", () => {
  const grupos = [grupo("carbo")];
  const a = alimento("a", { porcao: g(100) });
  const b = alimento("b");
  const r = calcularTroca({ alimentoOrigem: a, alimentoDestino: b, medida: g(90) }, contexto([a, b], [], grupos));
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.motivo, "porcao-nao-cadastrada");
});

test("combinar frações de porção: 0,5 de um + 0,5 de outro", () => {
  const a = alimento("a", { porcao: g(100) });
  const b = alimento("b", { porcao: g(60) });
  const partes = combinarPorcoes([
    { alimento: a, fracao: 0.5 },
    { alimento: b, fracao: 0.5 },
  ]);
  assert.equal(partes[0]?.medida?.quantidade, 50);
  assert.equal(partes[1]?.medida?.quantidade, 30);
});

// ---------------------------------------------------------------- unidades (§5)

test("converte a unidade do paciente antes de aplicar a regra", () => {
  const grupos = [grupo("carbo")];
  const a = alimento("a", {
    porcao: g(100),
    medidas: [{ unidadeId: "colher-sopa", equivalenteNaBase: 25 }],
  });
  const b = alimento("b", { porcao: g(50) });
  // 4 colheres de sopa = 100 g = 1 porção → 50 g de b.
  const r = calcularTroca(
    { alimentoOrigem: a, alimentoDestino: b, medida: { quantidade: 4, unidadeId: "colher-sopa" } },
    contexto([a, b], [], grupos),
  );
  assert.ok(r.ok && r.saida.quantidade === 50);
  assert.equal(converter(a, { quantidade: 2, unidadeId: "colher-sopa" }, "g"), 50);
});

test("unidade não cadastrada no alimento não é convertida na marra", () => {
  const a = alimento("a", { porcao: g(100) });
  assert.equal(converter(a, { quantidade: 1, unidadeId: "fatia" }, "g"), null);
});

// ---------------------------------------------------------------- regras não lineares (§10)

test("regra em tabela interpola entre os pontos cadastrados", () => {
  const a = alimento("a");
  const b = alimento("b");
  const eq: Equivalencia = {
    id: "t",
    origemAlimentoId: "a",
    destinoAlimentoId: "b",
    regra: {
      tipo: "tabela",
      unidadeOrigemId: "g",
      unidadeDestinoId: "g",
      pontos: [
        { de: 50, para: 40 },
        { de: 100, para: 70 },
      ],
    },
    bidirecional: true,
    fonte: null,
    observacao: null,
    ativo: true,
  };
  const ctx = contexto([a, b], [eq], [grupo("carbo")]);
  const r = calcularTroca({ alimentoOrigem: a, alimentoDestino: b, medida: g(75) }, ctx);
  assert.ok(r.ok && r.saida.quantidade === 55);
});

test("regra em tabela trava nos extremos em vez de extrapolar", () => {
  const a = alimento("a");
  const b = alimento("b");
  const eq: Equivalencia = {
    id: "t",
    origemAlimentoId: "a",
    destinoAlimentoId: "b",
    regra: {
      tipo: "tabela",
      unidadeOrigemId: "g",
      unidadeDestinoId: "g",
      pontos: [
        { de: 50, para: 40 },
        { de: 100, para: 70 },
      ],
    },
    bidirecional: false,
    fonte: null,
    observacao: null,
    ativo: true,
  };
  const ctx = contexto([a, b], [eq], [grupo("carbo", false)]);
  const r = calcularTroca({ alimentoOrigem: a, alimentoDestino: b, medida: g(400) }, ctx);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.saida.quantidade, 70);
  assert.match(r.observacoes.join(" "), /acima da faixa/);
});

test("regra fixa ignora a quantidade informada", () => {
  const a = alimento("a");
  const b = alimento("b");
  const eq: Equivalencia = {
    id: "f",
    origemAlimentoId: "a",
    destinoAlimentoId: "b",
    regra: { tipo: "fixa", para: { quantidade: 1, unidadeId: "unidade" } },
    bidirecional: true,
    fonte: null,
    observacao: null,
    ativo: true,
  };
  const ctx = contexto([a, b], [eq], [grupo("carbo", false)]);
  const r = calcularTroca({ alimentoOrigem: a, alimentoDestino: b, medida: g(999) }, ctx);
  assert.ok(r.ok && r.saida.quantidade === 1 && r.saida.unidadeId === "unidade");
  // Regra fixa não tem inverso: no sentido contrário não deve inventar nada.
  const volta = calcularTroca({ alimentoOrigem: b, alimentoDestino: a, medida: { quantidade: 1, unidadeId: "unidade" } }, ctx);
  assert.equal(volta.ok, false);
});

test("equivalência desativada não vale mais", () => {
  const a = alimento("a");
  const b = alimento("b");
  const eq: Equivalencia = {
    id: "x",
    origemAlimentoId: "a",
    destinoAlimentoId: "b",
    regra: {
      tipo: "proporcional",
      de: { quantidade: 100, unidadeId: "g" },
      para: { quantidade: 80, unidadeId: "g" },
    },
    bidirecional: true,
    fonte: null,
    observacao: null,
    ativo: false,
  };
  // O catálogo já filtra o que está desativado; aqui simulamos esse filtro
  // no contexto, que é como a calculadora recebe as equivalências.
  const ctx = contexto([a, b], [eq].filter((e) => e.ativo), [grupo("carbo", false)]);
  assert.equal(calcularTroca({ alimentoOrigem: a, alimentoDestino: b, medida: g(90) }, ctx).ok, false);
});

// ---------------------------------------------------------------- entradas inválidas

test("recusa quantidade zero, negativa e alimento igual", () => {
  const arroz = catalogo.alimento("arroz-cozido")!;
  const macarrao = catalogo.alimento("macarrao-cozido")!;
  assert.equal(calcularTroca({ alimentoOrigem: arroz, alimentoDestino: macarrao, medida: g(0) }).ok, false);
  assert.equal(calcularTroca({ alimentoOrigem: arroz, alimentoDestino: macarrao, medida: g(-5) }).ok, false);
  const igual = calcularTroca({ alimentoOrigem: arroz, alimentoDestino: arroz, medida: g(90) });
  assert.equal(igual.ok, false);
  if (igual.ok) return;
  assert.equal(igual.motivo, "mesmo-alimento");
});

test("par sem equivalência devolve falha, nunca um número", () => {
  const arroz = catalogo.alimento("arroz-cozido")!;
  const tomate = catalogo.alimento("tomate")!;
  const r = calcularTroca({ alimentoOrigem: arroz, alimentoDestino: tomate, medida: g(90) });
  assert.equal(r.ok, false);
});

// ---------------------------------------------------------------- arredondamento

test("arredonda grama para inteiro e unidade discreta para meio", () => {
  const grama = catalogo.unidade("g");
  const fatia = catalogo.unidade("fatia");
  assert.equal(arredondarExibicao(71.96, grama), 72);
  assert.equal(arredondarExibicao(7.24, grama), 7.2);
  assert.equal(arredondarExibicao(1.3, fatia), 1.5);
  assert.equal(arredondarExibicao(0.1, fatia), 0.5);
});

// ---------------------------------------------------------------- carboidrato → fruta

/**
 * A regra de mão única do material: 1 porção de carboidrato equivale a 1
 * porção de fruta, e fruta não vira carboidrato. O que estes testes guardam
 * não é só o cálculo — é a assimetria, que um campo bidirecional apagaria.
 */
const GRUPOS_MAO_UNICA = [grupo("carbo", true, ["fruta"]), grupo("fruta", true)];

const ARROZ = alimento("arroz", { grupoId: "carbo", porcao: g(100) });
const MACA = alimento("maca", { grupoId: "fruta", porcao: g(190) });
const CTX_MAO_UNICA = contexto([ARROZ, MACA], [], GRUPOS_MAO_UNICA);

test("carboidrato vira fruta: 100 g de arroz são 1 porção, logo 190 g de maçã", () => {
  const r = calcularTroca({ alimentoOrigem: ARROZ, alimentoDestino: MACA, medida: g(100) }, CTX_MAO_UNICA);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.saida.quantidade, 190);
  assert.equal(r.porcoes, 1);
  assert.equal(r.origem, "porcoes");
});

test("a conta escala: 200 g de arroz são 2 porções, logo 380 g de maçã", () => {
  const r = calcularTroca({ alimentoOrigem: ARROZ, alimentoDestino: MACA, medida: g(200) }, CTX_MAO_UNICA);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.saida.quantidade, 380);
  assert.equal(r.porcoes, 2);
});

test("fruta NÃO vira carboidrato, e a recusa diz o porquê", () => {
  const r = calcularTroca({ alimentoOrigem: MACA, alimentoDestino: ARROZ, medida: g(190) }, CTX_MAO_UNICA);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.motivo, "sentido-nao-permitido");
  assert.match(r.mensagem, /outro sentido/i);
});

test("sem a liberação, um grupo não alcança o outro", () => {
  const ctx = contexto([ARROZ, MACA], [], [grupo("carbo"), grupo("fruta")]);
  const r = calcularTroca({ alimentoOrigem: ARROZ, alimentoDestino: MACA, medida: g(100) }, ctx);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.motivo, "sem-equivalencia");
});

test("quantidade livre não entra em conta de porção, e não é chamada de pendente", () => {
  const limao = alimento("limao", { grupoId: "fruta", porcao: null, quantidadeLivre: true });
  const ctx = contexto([ARROZ, MACA, limao], [], GRUPOS_MAO_UNICA);
  const r = calcularTroca({ alimentoOrigem: MACA, alimentoDestino: limao, medida: g(190) }, ctx);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.motivo, "quantidade-livre");
  assert.match(r.mensagem, /livre/i);
});

// --------------------------------------------- a regra no catálogo de verdade

/**
 * Os testes acima usam um catálogo de mentira, para isolar o motor. Estes
 * rodam sobre a lista real: é o que garante que o dado cadastrado e a regra
 * concordam — e que a paciente nunca chega a ver a troca proibida na tela,
 * porque `destinosPossiveis` é quem monta o segundo campo.
 */
test("no catálogo real, 100 g de arroz viram 190 g de maçã", () => {
  const arroz = catalogo.alimento("arroz-cozido")!;
  const maca = catalogo.alimento("maca")!;
  const r = calcularTroca({ alimentoOrigem: arroz, alimentoDestino: maca, medida: g(100) });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.saida.quantidade, 190);
  assert.equal(r.porcoes, 1);
});

test("a maçã aparece entre os destinos do arroz", () => {
  const arroz = catalogo.alimento("arroz-cozido")!;
  const ids = destinosPossiveis(arroz).map((a) => a.id);
  assert.ok(ids.includes("maca"), "fruta deveria ser destino de carboidrato");
});

test("nenhum carboidrato aparece entre os destinos da maçã", () => {
  const maca = catalogo.alimento("maca")!;
  const destinos = destinosPossiveis(maca);
  const carbos = destinos.filter((a) => a.grupoId === "carboidratos").map((a) => a.nome);
  assert.deepEqual(carbos, [], `a paciente não pode ver carboidrato como destino de fruta: ${carbos.join(", ")}`);
  assert.ok(destinos.some((a) => a.grupoId === "frutas"), "fruta ainda troca com fruta");
});

test("o limão não é oferecido como destino nem como origem", () => {
  const limao = catalogo.alimento("limao")!;
  assert.equal(limao.quantidadeLivre, true);
  assert.equal(destinosPossiveis(limao).length, 0);
  const maca = catalogo.alimento("maca")!;
  assert.ok(!destinosPossiveis(maca).some((a) => a.id === "limao"));
});

test("a lista inteira está cadastrada com porção, exceto quem é livre", () => {
  const pendentes = catalogo
    .alimentos()
    .filter((a) => !a.porcao && !a.quantidadeLivre)
    .map((a) => a.nome);
  assert.deepEqual(pendentes, [], `alimentos sem porção e sem ser livres: ${pendentes.join(", ")}`);
});
