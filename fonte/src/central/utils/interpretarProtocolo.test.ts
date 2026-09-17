import assert from "node:assert/strict";
import test from "node:test";
import { colunas, contarProtocolo, interpretarProtocolo } from "./interpretarProtocolo";

/**
 * Testes do interpretador de protocolo.
 *
 * O material aqui não foi inventado: é o protocolo de emagrecimento que a
 * nutricionista escreveu para um paciente real (nome trocado), nas duas
 * formas em que ele pode chegar — colado da tabela do Google Docs, onde as
 * colunas vêm separadas por tabulação, e colado de um PDF, onde vêm
 * separadas por corrida de espaços.
 *
 * O que estes testes protegem, acima de tudo, é a promessa de não perder
 * linha. Um item que some da dieta de alguém é erro clínico, não defeito de
 * tela.
 */

// ---------------------------------------------------------------------------
// Colado do Google Docs: tabulação entre as colunas, célula de várias linhas
// vira linha seguinte sem primeira coluna.
// ---------------------------------------------------------------------------
const DO_DOCS = [
  "Orientações gerais - Felipe Neves",
  "●\tComer TODAS as porções da dieta",
  "●\tComer proteína em TODAS as refeições",
  "●\tBeber muita água. Meta atual: 4L dia",
  "",
  "CAFÉ DA MANHÃ",
  "ALIMENTO\tQUANTIDADE\tSUBSTITUIÇÃO",
  "Pão de forma\t3 fatias - 75g\tTapioca -70g",
  "\t\tPão francês - 1,5 unidade",
  "\t\tTorrada Bauducco - 60g",
  "Ovo\t3 unidades\tIogurte desnatado sem lactose - 170g (pote)",
  "\t\tAtum - 80g",
  "Banana\t1 unidade\tLaranja - 1 unidade",
  "- Chá de gengibre com limão pós refeição (pode ser de saquinho).",
  "SUPLEMENTAÇÃO PÓS CAFÉ DA MANHÃ: 500mg berberina, 2 cap ômega 3",
  "",
  "ALMOÇO",
  "ALIMENTO\tQUANTIDADE\tSUBSTITUIÇÃO",
  "Arroz cozido\t200g\tBatata doce cozida - 250g",
  "\t\tMacarrão - 180g",
  "Peito de frango grelhado\t100g\tPeixe branco grelhado - 120g",
  "VEGETAIS: estão liberados todos os vegetais que não são tubérculos.",
  "",
  "JANTAR",
  "ALIMENTO\tQUANTIDADE\tSUBSTITUIÇÃO",
  "Arroz cozido\t200g\tBatata doce cozida - 250g",
  "Peito de frango grelhado\t120g\tCarne de panela - 100g",
  "",
  "JANTAR - HAMBÚRGUER",
  "ALIMENTO\tQUANTIDADE\tSUBSTITUIÇÃO",
  "Pão de hambúrguer\t60g",
  "Patinho moído\t70g",
  "Queijo mussarela\t20g",
  "",
  "JANTAR - PASTEL AIRFRYER",
  "ALIMENTO\tQUANTIDADE\tSUBSTITUIÇÃO",
  "Massa de pastel média\t4 unidades",
  "Patinho moído\t70g",
  "Rechear a massa com frango, fechar e levar à airfryer 200 °C por ~8–10 min.",
  "SUPLEMENTAÇÃO PÓS JANTAR: 1 dose probiótico, 400 mg magnésio",
  "",
  "ACORDE CEDO (ANTES DAS 9H)",
  "Olhe para a luz natural logo ao acordar: abre a janela, sente o dia.",
  "BEBA 500ML DE ÁGUA EM TEMPERATURA AMBIENTE AO ACORDAR",
  "Essa água ajuda a ativar o reflexo gastrocólico.",
].join("\n");

test("as orientações do topo entram, e o título delas não vira orientação", () => {
  const { orientacoes } = interpretarProtocolo(DO_DOCS);
  assert.equal(orientacoes.length, 3);
  assert.equal(orientacoes[0], "Comer TODAS as porções da dieta");
  assert.ok(!orientacoes.some((o) => o.startsWith("Orientações gerais")));
});

test("as quatro refeições aparecem, e o jantar guarda as três versões", () => {
  const { refeicoes } = interpretarProtocolo(DO_DOCS);
  assert.deepEqual(
    refeicoes.map((r) => r.nome),
    ["Café da manhã", "Almoço", "Jantar"],
  );
  const jantar = refeicoes[2];
  assert.deepEqual(jantar?.opcoes.map((o) => o.rotulo), ["Padrão", "Hambúrguer", "Pastel airfryer"]);
});

test("a linha da tabela vira alimento, quantidade e substituições", () => {
  const { refeicoes } = interpretarProtocolo(DO_DOCS);
  const pao = refeicoes[0]?.opcoes[0]?.itens[0];
  assert.equal(pao?.alimento, "Pão de forma");
  assert.equal(pao?.quantidade, "3 fatias - 75g");
  assert.deepEqual(pao?.substituicoes, [
    "Tapioca -70g",
    "Pão francês - 1,5 unidade",
    "Torrada Bauducco - 60g",
  ]);
});

test("célula de várias linhas não vira alimento novo", () => {
  const { refeicoes } = interpretarProtocolo(DO_DOCS);
  const cafe = refeicoes[0]?.opcoes[0];
  assert.deepEqual(cafe?.itens.map((i) => i.alimento), ["Pão de forma", "Ovo", "Banana"]);
});

test("o cabeçalho ALIMENTO/QUANTIDADE/SUBSTITUIÇÃO não vira alimento", () => {
  const { refeicoes } = interpretarProtocolo(DO_DOCS);
  for (const refeicao of refeicoes) {
    for (const opcao of refeicao.opcoes) {
      assert.ok(!opcao.itens.some((i) => i.alimento.toUpperCase() === "ALIMENTO"));
    }
  }
});

test("chá, suplementação, vegetais e modo de preparo ficam na refeição certa", () => {
  const { refeicoes } = interpretarProtocolo(DO_DOCS);
  const cafe = refeicoes[0]?.opcoes[0];
  assert.equal(cafe?.notas.length, 2);
  assert.ok(cafe?.notas[0]?.startsWith("Chá de gengibre"));
  assert.ok(cafe?.notas[1]?.startsWith("SUPLEMENTAÇÃO PÓS CAFÉ"));

  const almoco = refeicoes[1]?.opcoes[0];
  assert.ok(almoco?.notas[0]?.startsWith("VEGETAIS:"));

  const pastel = refeicoes[2]?.opcoes[2];
  assert.ok(pastel?.notas.some((n) => n.startsWith("Rechear a massa")));
  assert.ok(pastel?.notas.some((n) => n.startsWith("SUPLEMENTAÇÃO PÓS JANTAR")));
});

test("os blocos de rotina do fim viram seções, não refeição", () => {
  const { secoes } = interpretarProtocolo(DO_DOCS);
  assert.deepEqual(secoes.map((s) => s.titulo), [
    "ACORDE CEDO (ANTES DAS 9H)",
    "BEBA 500ML DE ÁGUA EM TEMPERATURA AMBIENTE AO ACORDAR",
  ]);
  assert.ok(secoes[0]?.paragrafos[0]?.startsWith("Olhe para a luz natural"));
});

test("nenhuma linha do documento se perde", () => {
  const conteudo = interpretarProtocolo(DO_DOCS);

  // Em vez de contar, procura: cada pedaço de texto do documento precisa
  // reaparecer em algum lugar do resultado. É o teste que importa — contagem
  // bate por acaso, texto perdido não.
  const resultado = JSON.stringify(conteudo);
  const descartaveis = /^(ALIMENTO|ORIENTAÇÕES)/i;

  const perdidas: string[] = [];
  for (const linha of DO_DOCS.split("\n")) {
    if (!linha.trim()) continue;
    const cabecalho = linha.trim().replace(/^[●•\-\s]+/, "");
    if (descartaveis.test(cabecalho)) continue;
    for (const celula of colunas(linha)) {
      const texto = celula.replace(/^[●•\-\s]+/, "").trim();
      if (!texto) continue;
      // "JANTAR - HAMBÚRGUER" fica guardado em dois campos (a refeição e o
      // rótulo da opção), então cada pedaço é procurado por si. E a caixa
      // muda de propósito: "CAFÉ DA MANHÃ" é gravado "Café da manhã".
      for (const pedaco of texto.split(/\s+[-–—]\s+/)) {
        const procurado = pedaco.trim().toLowerCase().slice(0, 24);
        if (!procurado) continue;
        if (!resultado.toLowerCase().includes(procurado)) perdidas.push(pedaco);
      }
    }
  }

  assert.deepEqual(perdidas, []);
});

// ---------------------------------------------------------------------------
// Colado de PDF: as colunas chegam alinhadas por espaço.
// ---------------------------------------------------------------------------
const DO_PDF = [
  "CAFÉ DA MANHÃ",
  "            ALIMENTO                     QUANTIDADE              SUBSTITUIÇÃO",
  " Pão de forma                           3 fatias - 75g           Tapioca -70g",
  "                                                                 Pão francês - 1,5 unidade",
  " Ovo                                    3 unidades               Atum - 80g",
].join("\n");

test("tabela alinhada por espaço é lida igual à do Docs", () => {
  const { refeicoes } = interpretarProtocolo(DO_PDF);
  const itens = refeicoes[0]?.opcoes[0]?.itens;
  assert.equal(itens?.length, 2);
  assert.equal(itens?.[0]?.alimento, "Pão de forma");
  assert.equal(itens?.[0]?.quantidade, "3 fatias - 75g");
  assert.deepEqual(itens?.[0]?.substituicoes, ["Tapioca -70g", "Pão francês - 1,5 unidade"]);
  assert.equal(itens?.[1]?.alimento, "Ovo");
});

test("um espaço só não separa coluna — nome composto continua inteiro", () => {
  assert.deepEqual(colunas("Peito de frango grelhado"), ["Peito de frango grelhado"]);
  assert.deepEqual(colunas("Arroz cozido  200g"), ["Arroz cozido", "200g"]);
  assert.deepEqual(colunas("Arroz cozido\t200g"), ["Arroz cozido", "200g"]);
});

// ---------------------------------------------------------------------------
// Casos que ela vai encontrar mais cedo ou mais tarde.
// ---------------------------------------------------------------------------
test("refeição com uma opção só não ganha rótulo de opção", () => {
  const { refeicoes } = interpretarProtocolo("ALMOÇO\nArroz cozido\t200g");
  assert.equal(refeicoes[0]?.opcoes[0]?.rotulo, "");
});

test("OPÇÃO 1 e OPÇÃO 2 dentro da mesma refeição viram duas opções", () => {
  const texto = [
    "CAFÉ DA MANHÃ",
    "OPÇÃO 1",
    "Tapioca\t70g",
    "OPÇÃO 2",
    "Ovo\t2 unidades",
  ].join("\n");
  const { refeicoes } = interpretarProtocolo(texto);
  assert.equal(refeicoes.length, 1);
  assert.deepEqual(refeicoes[0]?.opcoes.map((o) => o.rotulo), ["Opção 1", "Opção 2"]);
  assert.equal(refeicoes[0]?.opcoes[1]?.itens[0]?.alimento, "Ovo");
});

test("a mesma refeição repetida sem traço abre uma opção, não uma refeição nova", () => {
  const texto = ["JANTAR", "Arroz\t200g", "JANTAR", "Sopa\t1 prato"].join("\n");
  const { refeicoes } = interpretarProtocolo(texto);
  assert.equal(refeicoes.length, 1);
  assert.equal(refeicoes[0]?.opcoes.length, 2);
});

test("linha que o interpretador não entende vira observação, nunca sumiço", () => {
  const texto = ["ALMOÇO", "Arroz\t200g", "isso aqui é uma frase solta que ela escreveu."].join("\n");
  const { refeicoes } = interpretarProtocolo(texto);
  assert.deepEqual(refeicoes[0]?.opcoes[0]?.notas, ["isso aqui é uma frase solta que ela escreveu."]);
});

test("texto vazio devolve protocolo vazio, sem estourar", () => {
  const conteudo = interpretarProtocolo("");
  assert.deepEqual(conteudo, { orientacoes: [], refeicoes: [], secoes: [] });
  assert.deepEqual(contarProtocolo(conteudo), {
    refeicoes: 0,
    itens: 0,
    substituicoes: 0,
    notas: 0,
  });
});

test("item sem substituição nenhuma continua sendo item", () => {
  const { refeicoes } = interpretarProtocolo("JANTAR - HAMBÚRGUER\nPão de hambúrguer\t60g");
  const item = refeicoes[0]?.opcoes[0]?.itens[0];
  assert.equal(item?.alimento, "Pão de hambúrguer");
  assert.deepEqual(item?.substituicoes, []);
});
