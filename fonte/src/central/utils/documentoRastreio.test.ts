import test from "node:test";
import assert from "node:assert/strict";
import type { ItemDeReintroducao, RegistroDeReintroducao } from "@/central/types";
import { montarDocumento, rotuloDaFaixa } from "./documentoRastreio";

function item(id: string, nome: string): ItemDeReintroducao {
  return {
    id,
    alimentoId: null,
    nome,
    categoria: "outros",
    semanaSugerida: null,
    porcaoReferencia: null,
    observacaoMaterial: null,
    doCatalogo: false,
    ligadoDepois: false,
    status: "em_teste",
    notaNutri: null,
    ordem: 0,
    marcacao: [],
    marcacaoDaNutri: false,
    totalDeRegistros: 0,
    ultimoRegistro: null,
  };
}

function registro(
  itemId: string,
  itemNome: string,
  data: string,
  parte: Partial<RegistroDeReintroducao> = {},
): RegistroDeReintroducao {
  return {
    id: `${itemId}-${data}`,
    itemId,
    itemNome,
    data,
    horario: null,
    semana: 1,
    quantidade: null,
    preparo: null,
    sintomas: ["nenhum"],
    intensidade: null,
    bristol: null,
    observacao: null,
    marcacao: [],
    criadoEm: data,
    ...parte,
  };
}

test("quatro testes sem sintoma viram UMA linha, com a data do último", () => {
  // "Mussarela de búfala, mussarela de búfala, mussarela de búfala…" —
  // quatro vezes a mesma informação não é informação.
  const doc = montarDocumento({
    paciente: "Daniela Carvalho",
    semana: 3,
    itens: [item("i1", "Mussarela de búfala")],
    registros: [
      registro("i1", "Mussarela de búfala", "2026-09-10", { quantidade: "30 g" }),
      registro("i1", "Mussarela de búfala", "2026-09-13"),
      registro("i1", "Mussarela de búfala", "2026-09-17", { quantidade: "50 g" }),
    ],
  });

  assert.equal(doc.bemTolerados.length, 1);
  const linha = doc.bemTolerados[0]!;
  assert.equal(linha.testes, 3);
  assert.equal(linha.ultimaData, "2026-09-17");
  assert.equal(linha.primeiraData, "2026-09-10");
  // A quantidade do ÚLTIMO teste: é a que ela repetiria hoje.
  assert.equal(linha.quantidade, "50 g");
  assert.equal(linha.comoSeSentiu, "Não foram relatados sintomas.");
});

test("as três faixas saem da mesma escada da tela, com os nomes do papel", () => {
  const doc = montarDocumento({
    paciente: "Daniela Carvalho",
    semana: 3,
    itens: [item("a", "Abacaxi"), item("b", "Farinha de batata-doce"), item("c", "Abacate")],
    registros: [
      registro("a", "Abacaxi", "2026-09-20", { quantidade: "2 fatias" }),
      // 1 ponto → observar
      registro("b", "Farinha de batata-doce", "2026-09-20", {
        sintomas: ["gases"],
        intensidade: 2,
        quantidade: "30 g",
        observacao: "Gases com odor ruim.",
      }),
      // gases + distensão + diarreia = 1+1+2 = 4 → resposta registrada
      registro("c", "Abacate", "2026-09-19", {
        sintomas: ["gases", "distensao", "diarreia"],
        intensidade: 6,
        quantidade: "100 g",
      }),
    ],
  });

  assert.deepEqual(doc.bemTolerados.map((l) => l.alimento), ["Abacaxi"]);
  assert.deepEqual(doc.observar.map((l) => l.alimento), ["Farinha de batata-doce"]);
  assert.deepEqual(doc.respostas.map((l) => l.alimento), ["Abacate"]);
  assert.equal(rotuloDaFaixa("resposta"), "Resposta registrada");
  // A palavra "proibido" não existe em lugar nenhum do documento.
  assert.equal(rotuloDaFaixa("observar"), "Observar");
});

test("nenhuma frase do documento conclui coisa que não está no registro", () => {
  const doc = montarDocumento({
    paciente: "Daniela Carvalho",
    semana: 3,
    itens: [item("a", "Abacate"), item("b", "Arroz")],
    registros: [
      registro("a", "Abacate", "2026-09-19", { sintomas: ["dor_abdominal"], intensidade: 3 }),
      registro("b", "Arroz", "2026-09-18"),
    ],
  });

  // "Você não tolera", "causador", "intolerância", "retire" — nenhuma delas
  // pode aparecer. É o pedido 10, e este teste é o que o segura.
  const proibido = /não tolera|nao tolera|intoler|causad|culpad|retire|exclua|proibid/i;
  const frases = [...doc.observar, ...doc.respostas, ...doc.bemTolerados].map((l) => l.comoSeSentiu);
  for (const f of frases) assert.ok(!proibido.test(f), `frase conclui demais: ${f}`);

  assert.match(doc.observar[0]!.comoSeSentiu, /Vale observar em novos testes/);
  assert.equal(doc.bemTolerados[0]!.comoSeSentiu, "Não foram relatados sintomas.");
});

test("a intensidade mostrada é a MAIOR registrada — a menor esconderia o pior dia", () => {
  const doc = montarDocumento({
    paciente: "D",
    semana: 1,
    itens: [item("a", "Leite")],
    registros: [
      registro("a", "Leite", "2026-09-10", { sintomas: ["gases"], intensidade: 2 }),
      registro("a", "Leite", "2026-09-14", { sintomas: ["gases"], intensidade: 8 }),
    ],
  });
  assert.equal(doc.observar[0]!.intensidade, "Intenso");
});

test("sintoma aparece uma vez na linha, mesmo relatado em vários testes", () => {
  const doc = montarDocumento({
    paciente: "D",
    semana: 1,
    itens: [item("a", "Leite")],
    registros: [
      registro("a", "Leite", "2026-09-10", { sintomas: ["gases", "distensao"] }),
      registro("a", "Leite", "2026-09-14", { sintomas: ["gases"] }),
    ],
  });
  assert.equal(doc.observar[0]!.sintomas, "Gases, Distensão abdominal");
});

test("o resumo conta alimentos nas faixas e REGISTROS no total de testes", () => {
  const doc = montarDocumento({
    paciente: "D",
    semana: 2,
    itens: [item("a", "Arroz"), item("b", "Leite")],
    registros: [
      registro("a", "Arroz", "2026-09-10"),
      registro("a", "Arroz", "2026-09-12"),
      registro("b", "Leite", "2026-09-14", { sintomas: ["gases"] }),
    ],
  });
  assert.equal(doc.resumo.bemTolerados, 1);
  assert.equal(doc.resumo.observar, 1);
  assert.equal(doc.resumo.respostas, 0);
  // Três REGISTROS, dois alimentos.
  assert.equal(doc.resumo.testes, 3);
});

test("os sintomas mais relatados vêm ordenados, contando um por registro", () => {
  const doc = montarDocumento({
    paciente: "D",
    semana: 1,
    itens: [item("a", "A"), item("b", "B")],
    registros: [
      registro("a", "A", "2026-09-10", { sintomas: ["gases", "distensao"] }),
      registro("a", "A", "2026-09-11", { sintomas: ["gases"] }),
      registro("b", "B", "2026-09-12", { sintomas: ["gases", "colica"] }),
    ],
  });
  assert.deepEqual(doc.resumo.maisRelatados, [
    { nome: "Gases", vezes: 3 },
    { nome: "Cólica", vezes: 1 },
    { nome: "Distensão abdominal", vezes: 1 },
  ]);
});

test("o que ela pôs na lista e ainda não foi testado vai para 'próximos testes'", () => {
  const doc = montarDocumento({
    paciente: "D",
    semana: 1,
    itens: [item("a", "Arroz"), item("b", "Couve-flor"), item("c", "Aveia")],
    registros: [registro("a", "Arroz", "2026-09-10")],
  });
  // Em ordem alfabética, e fora do mapa de tolerância: alimento não testado
  // no meio do mapa seria cobrança disfarçada.
  assert.deepEqual(doc.aTestar, ["Aveia", "Couve-flor"]);
  assert.equal(doc.bemTolerados.length, 1);
});

test("registro cujo alimento saiu da lista não some do papel", () => {
  // Ela testou e sentiu. Tirar o item da lista depois não apaga o que a
  // paciente viveu.
  const doc = montarDocumento({
    paciente: "D",
    semana: 1,
    itens: [],
    registros: [registro("sumiu", "Chocolate quente", "2026-09-10", { sintomas: ["nausea"] })],
  });
  assert.equal(doc.respostas.length + doc.observar.length, 1);
  assert.equal([...doc.respostas, ...doc.observar][0]!.alimento, "Chocolate quente");
});

test("o período sai do primeiro e do último registro; sem registro, fica nulo", () => {
  const cheio = montarDocumento({
    paciente: "D",
    semana: 3,
    itens: [item("a", "A")],
    registros: [registro("a", "A", "2026-09-14"), registro("a", "A", "2026-09-02")],
  });
  assert.equal(cheio.inicio, "2026-09-02");
  assert.equal(cheio.fim, "2026-09-14");

  const vazio = montarDocumento({ paciente: "D", semana: 1, itens: [], registros: [] });
  assert.equal(vazio.inicio, null);
  assert.equal(vazio.fim, null);
  assert.equal(vazio.resumo.testes, 0);
});

test("as observações da paciente vão junto, sem repetir e sem reescrever", () => {
  const doc = montarDocumento({
    paciente: "D",
    semana: 1,
    itens: [item("a", "Carne bovina")],
    registros: [
      registro("a", "Carne bovina", "2026-09-16", {
        sintomas: ["distensao"],
        observacao: "Fiquei cheia e sem vontade do café da tarde.",
      }),
      registro("a", "Carne bovina", "2026-09-18", {
        sintomas: ["distensao"],
        observacao: "Fiquei cheia e sem vontade do café da tarde.",
      }),
    ],
  });
  assert.equal(doc.observar[0]!.observacao, "Fiquei cheia e sem vontade do café da tarde.");
});

test("a lista sai do mais recente para o mais antigo", () => {
  const doc = montarDocumento({
    paciente: "D",
    semana: 1,
    itens: [item("a", "Arroz"), item("b", "Batata"), item("c", "Cenoura")],
    registros: [
      registro("a", "Arroz", "2026-09-10"),
      registro("b", "Batata", "2026-09-20"),
      registro("c", "Cenoura", "2026-09-15"),
    ],
  });
  assert.deepEqual(doc.bemTolerados.map((l) => l.alimento), ["Batata", "Cenoura", "Arroz"]);
});
