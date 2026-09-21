import assert from "node:assert/strict";
import test from "node:test";
import type {
  ItemDeReintroducao,
  MarcadorDoAlimento,
  RegistroDeReintroducao,
  SintomaReintroducao,
} from "@/central/types";
import {
  BRISTOL,
  alimentosSemLigacao,
  buscarNoMapa,
  etapasDoMaterial,
  inicioParaSemana,
  opcoesDeSemana,
  panoramaDeMarcadores,
  semanaEm,
  SINTOMAS,
  STATUS,
  faixaDaIntensidade,
  fraseDoHistorico,
  itensParaRegistrar,
  mostrarMarcacao,
  porSemana,
  rotuloSintoma,
  status,
  temSintoma,
  textoDaMarcacao,
} from "./reintroducao";

function item(parcial: Partial<ItemDeReintroducao>): ItemDeReintroducao {
  return {
    id: "i1",
    alimentoId: "abacate",
    nome: "Abacate",
    categoria: "gorduras",
    semanaSugerida: 1,
    porcaoReferencia: "60g",
    observacaoMaterial: null,
    doCatalogo: true,
    ligadoDepois: false,
    status: "nao_iniciado",
    notaNutri: null,
    ordem: 1,
    marcacao: [],
    totalDeRegistros: 0,
    ultimoRegistro: null,
    ...parcial,
  };
}

function registro(parcial: Partial<RegistroDeReintroducao>): RegistroDeReintroducao {
  return {
    id: "r1",
    itemId: "i1",
    itemNome: "Abacate",
    data: "2026-09-01",
    horario: null,
    semana: 1,
    quantidade: null,
    preparo: null,
    sintomas: [],
    intensidade: null,
    bristol: null,
    observacao: null,
    marcacao: [],
    criadoEm: "2026-09-01T10:00:00Z",
    ...parcial,
  };
}

// ---------------------------------------------------------------- intensidade

test("a escala de intensidade é a que ela definiu", () => {
  assert.equal(faixaDaIntensidade(0), "Nenhum");
  assert.equal(faixaDaIntensidade(1), "Leve");
  assert.equal(faixaDaIntensidade(3), "Leve");
  assert.equal(faixaDaIntensidade(4), "Moderado");
  assert.equal(faixaDaIntensidade(6), "Moderado");
  assert.equal(faixaDaIntensidade(7), "Intenso");
  assert.equal(faixaDaIntensidade(10), "Intenso");
});

// ------------------------------------------------------------------ vocabulário

test("todo sintoma do protocolo dela tem rótulo em português", () => {
  for (const sintoma of SINTOMAS) {
    assert.equal(rotuloSintoma(sintoma.chave), sintoma.rotulo);
    assert.notEqual(sintoma.rotulo.trim(), "");
  }
});

test("as manchas pelo corpo do protocolo dela estão na lista", () => {
  assert.ok(SINTOMAS.some((s) => s.chave === "manchas_pele"));
});

test("a escala de Bristol tem os sete tipos do material", () => {
  assert.equal(BRISTOL.length, 7);
  assert.deepEqual(
    BRISTOL.map((b) => b.tipo),
    [1, 2, 3, 4, 5, 6, 7],
  );
});

// Este é o teste que protege a regra mais importante do módulo. Se alguém um
// dia acrescentar um status chamado "proibido", "intolerante" ou "excluir", é
// aqui que isso para.
test("nenhum status sugere exclusão ou culpa", () => {
  const proibidos = [
    "proib", "intoler", "excluir", "excluído", "vetado", "não pode",
    "falhou", "atrasad", "pendente", "errado",
  ];
  for (const s of STATUS) {
    for (const palavra of proibidos) {
      assert.ok(
        !s.rotulo.toLowerCase().includes(palavra),
        `o rótulo "${s.rotulo}" carrega a palavra "${palavra}"`,
      );
      assert.ok(
        !s.paciente.toLowerCase().includes(palavra),
        `o texto da paciente "${s.paciente}" carrega a palavra "${palavra}"`,
      );
    }
  }
});

test("status desconhecido não quebra a tela", () => {
  assert.equal(status("inventado" as never).chave, "nao_iniciado");
});

// ------------------------------------------------------------------- semanas

test("os registros são agrupados por semana, da mais recente para a mais antiga", () => {
  const grupos = porSemana([
    registro({ id: "a", semana: 1 }),
    registro({ id: "b", semana: 3 }),
    registro({ id: "c", semana: 1 }),
  ]);
  assert.deepEqual(
    grupos.map((g) => g.semana),
    [3, 1],
  );
  assert.equal(grupos[1]?.registros.length, 2);
});

test("sem registro nenhum, não existe semana — e não existe cobrança", () => {
  assert.deepEqual(porSemana([]), []);
});

// --------------------------------------------------- o que aparece para marcar

test("o alimento que ela disse não comer sai da hora de registrar", () => {
  const lista = [
    item({ id: "i1", nome: "Abacate" }),
    item({ id: "i2", nome: "Brócolis", status: "nao_relevante" }),
  ];
  assert.deepEqual(
    itensParaRegistrar(lista).map((i) => i.nome),
    ["Abacate"],
  );
});

test("mas tudo o mais continua disponível, inclusive o que tem sintoma anotado", () => {
  const lista = [
    item({ id: "i1", status: "sintomas_observados" }),
    item({ id: "i2", status: "pausado" }),
    item({ id: "i3", status: "bem_tolerado" }),
  ];
  assert.equal(itensParaRegistrar(lista).length, 3);
});

// ------------------------------------------------------------------- frases

test("a frase do histórico nunca conta o que falta", () => {
  const frases = [
    fraseDoHistorico(0, 0),
    fraseDoHistorico(0, 12),
    fraseDoHistorico(1, 1),
    fraseDoHistorico(7, 3),
  ];
  for (const frase of frases) {
    for (const palavra of ["falta", "restam", "ainda precisa", "complete", "de 12", "atrasad"]) {
      assert.ok(
        !frase.toLowerCase().includes(palavra),
        `a frase "${frase}" cobra com "${palavra}"`,
      );
    }
  }
});

test("sem registro e sem lista, a frase convida em vez de cobrar", () => {
  const frase = fraseDoHistorico(0, 0);
  assert.ok(frase.includes("já pode registrar"));
});

test("com registros, a frase conta o que existe", () => {
  assert.equal(fraseDoHistorico(1, 1), "1 registro até agora, em 1 alimento.");
  assert.equal(fraseDoHistorico(7, 3), "7 registros até agora, em 3 alimentos.");
});

// ------------------------------------- oxalato, histamina e lectina

test("a marcação alta ganha seta, e a média não", () => {
  assert.equal(
    textoDaMarcacao([
      { nome: "Histamina", nivel: "muito_alta" },
      { nome: "Oxalato", nivel: "alta" },
      { nome: "Lectina", nivel: "media" },
    ]),
    "↑↑ Histamina muito alta · ↑ Oxalato alta · Lectina média",
  );
});

test("sem marcador nenhum, a linha some em vez de ficar vazia", () => {
  assert.equal(textoDaMarcacao([]), "");
});

// A regra que ela deu, e a única que decide se a linha aparece.
test("a marcação NÃO aparece quando o registro não teve sintoma", () => {
  const semSintoma = registro({
    sintomas: ["nenhum"],
    marcacao: [{ nome: "Histamina", nivel: "muito_alta" }],
  });
  assert.equal(mostrarMarcacao(semSintoma), false);
});

test("nem quando a paciente não marcou sintoma nenhum", () => {
  const vazio = registro({
    sintomas: [],
    marcacao: [{ nome: "Oxalato", nivel: "muito_alta" }],
  });
  assert.equal(mostrarMarcacao(vazio), false);
});

test("aparece quando teve sintoma e o alimento tem marcador alto", () => {
  const comSintoma = registro({
    sintomas: ["gases", "distensao"],
    marcacao: [{ nome: "Histamina", nivel: "muito_alta" }],
  });
  assert.equal(mostrarMarcacao(comSintoma), true);
});

test("com sintoma mas sem marcador, não desenha uma linha vazia", () => {
  const semMarcador = registro({ sintomas: ["gases"], marcacao: [] });
  assert.equal(mostrarMarcacao(semMarcador), false);
});

test("temSintoma separa o registro tranquilo do que precisa de olhar", () => {
  assert.equal(temSintoma({ sintomas: [] }), false);
  assert.equal(temSintoma({ sintomas: ["nenhum"] }), false);
  assert.equal(temSintoma({ sintomas: ["colica"] }), true);
});

// O mesmo cuidado dos status: a marcação é pista, nunca veredito.
test("nenhum texto de marcação acusa o alimento", () => {
  const todos = textoDaMarcacao([
    { nome: "Oxalato", nivel: "muito_alta" },
    { nome: "Histamina", nivel: "alta" },
    { nome: "Lectina", nivel: "media" },
  ]).toLowerCase();
  for (const palavra of ["evite", "cuidado", "perigo", "faz mal", "proib", "exclua"]) {
    assert.ok(!todos.includes(palavra), `a marcação diz "${palavra}"`);
  }
});

// ------------------------------------------------ panorama de marcadores

function itemDe(
  id: string,
  nome: string,
  marcacao: MarcadorDoAlimento[] = [],
  doCatalogo = true,
): ItemDeReintroducao {
  return {
    id,
    alimentoId: doCatalogo ? `a-${id}` : null,
    nome,
    categoria: "outros",
    semanaSugerida: null,
    porcaoReferencia: null,
    observacaoMaterial: null,
    doCatalogo,
    ligadoDepois: false,
    status: "em_teste",
    notaNutri: null,
    ordem: 0,
    marcacao,
    totalDeRegistros: 0,
    ultimoRegistro: null,
  };
}

function registroDe(
  id: string,
  itemId: string,
  itemNome: string,
  sintomas: SintomaReintroducao[],
  marcacao: MarcadorDoAlimento[] = [],
): RegistroDeReintroducao {
  return {
    id,
    itemId,
    itemNome,
    data: "2026-09-01",
    horario: null,
    semana: 1,
    quantidade: null,
    preparo: null,
    sintomas,
    intensidade: null,
    bristol: null,
    observacao: null,
    marcacao,
    criadoEm: "2026-09-01T10:00:00.000Z",
  };
}

const HISTAMINA_ALTA: MarcadorDoAlimento[] = [{ nome: "Histamina", nivel: "muito_alta" }];

test("panorama: conta os registros com sintoma de cada marcador", () => {
  const itens = [itemDe("1", "Abacate", HISTAMINA_ALTA)];
  const registros = [
    registroDe("r1", "1", "Abacate", ["gases"], HISTAMINA_ALTA),
    registroDe("r2", "1", "Abacate", ["diarreia"], HISTAMINA_ALTA),
    registroDe("r3", "1", "Abacate", ["nenhum"], HISTAMINA_ALTA),
  ];
  const [linha] = panoramaDeMarcadores(itens, registros);
  assert.equal(linha?.marcador, "Histamina");
  assert.equal(linha?.registros, 3);
  assert.equal(linha?.registrosComSintoma, 2);
  assert.deepEqual(linha?.alimentos, ["Abacate"]);
});

test("panorama: o denominador aparece — 2 de 3 não é 2 de 20", () => {
  // É a diferença entre "sempre que come, passa mal" e "passou mal uma vez".
  const itens = [itemDe("1", "Abacate", HISTAMINA_ALTA)];
  const muitos = Array.from({ length: 20 }, (_, i) =>
    registroDe(`r${i}`, "1", "Abacate", i < 2 ? ["gases"] : ["nenhum"], HISTAMINA_ALTA),
  );
  const [linha] = panoramaDeMarcadores(itens, muitos);
  assert.equal(linha?.registrosComSintoma, 2);
  assert.equal(linha?.registros, 20);
});

test("panorama: um alimento com dois marcadores conta nos dois", () => {
  const dois: MarcadorDoAlimento[] = [
    { nome: "Histamina", nivel: "muito_alta" },
    { nome: "Oxalato", nivel: "alta" },
  ];
  const linhas = panoramaDeMarcadores(
    [itemDe("1", "Abacate", dois)],
    [registroDe("r1", "1", "Abacate", ["gases"], dois)],
  );
  assert.equal(linhas.length, 2);
  for (const l of linhas) {
    assert.equal(l.registrosComSintoma, 1);
    assert.deepEqual(l.alimentos, ["Abacate"]);
  }
});

test("panorama: guarda o nível mais alto visto naquele marcador", () => {
  const linhas = panoramaDeMarcadores(
    [
      itemDe("1", "Pêra", [{ nome: "Histamina", nivel: "media" }]),
      itemDe("2", "Abacate", [{ nome: "Histamina", nivel: "muito_alta" }]),
    ],
    [
      registroDe("r1", "1", "Pêra", ["gases"], [{ nome: "Histamina", nivel: "media" }]),
      registroDe("r2", "2", "Abacate", ["gases"], [{ nome: "Histamina", nivel: "muito_alta" }]),
    ],
  );
  assert.equal(linhas[0]?.nivelMaisAlto, "muito_alta");
  assert.deepEqual(linhas[0]?.alimentos, ["Abacate", "Pêra"]);
});

test("panorama: alimento sem marcação vira uma linha própria, no fim", () => {
  const linhas = panoramaDeMarcadores(
    [itemDe("1", "Abacate", HISTAMINA_ALTA), itemDe("2", "Carne boi", [], false)],
    [
      registroDe("r1", "1", "Abacate", ["gases"], HISTAMINA_ALTA),
      registroDe("r2", "2", "Carne boi", ["diarreia"]),
    ],
  );
  assert.equal(linhas.at(-1)?.marcador, null);
  assert.equal(linhas.at(-1)?.registrosComSintoma, 1);
  assert.deepEqual(linhas.at(-1)?.alimentos, ["Carne boi"]);
  assert.equal(linhas.at(-1)?.nivelMaisAlto, null);
});

test("panorama: a marcação do item salva o registro que veio sem ela", () => {
  const linhas = panoramaDeMarcadores(
    [itemDe("1", "Abacate", HISTAMINA_ALTA)],
    [registroDe("r1", "1", "Abacate", ["gases"])],
  );
  assert.equal(linhas[0]?.marcador, "Histamina");
});

test("panorama: quem teve mais sintomas vem primeiro", () => {
  const linhas = panoramaDeMarcadores(
    [
      itemDe("1", "Abacate", [{ nome: "Histamina", nivel: "alta" }]),
      itemDe("2", "Manga", [{ nome: "Oxalato", nivel: "alta" }]),
    ],
    [
      registroDe("r1", "2", "Manga", ["gases"], [{ nome: "Oxalato", nivel: "alta" }]),
      registroDe("r2", "2", "Manga", ["colica"], [{ nome: "Oxalato", nivel: "alta" }]),
      registroDe("r3", "1", "Abacate", ["gases"], [{ nome: "Histamina", nivel: "alta" }]),
    ],
  );
  assert.equal(linhas[0]?.marcador, "Oxalato");
  assert.equal(linhas[1]?.marcador, "Histamina");
});

test("panorama: sem registro nenhum, nenhuma linha", () => {
  assert.deepEqual(panoramaDeMarcadores([itemDe("1", "Pêra", HISTAMINA_ALTA)], []), []);
});

test("panorama: 'nenhum' não é sintoma", () => {
  const linhas = panoramaDeMarcadores(
    [itemDe("1", "Abacate", HISTAMINA_ALTA)],
    [registroDe("r1", "1", "Abacate", ["nenhum"], HISTAMINA_ALTA)],
  );
  assert.equal(linhas[0]?.registros, 1);
  assert.equal(linhas[0]?.registrosComSintoma, 0);
});

test("alimentosSemLigacao lista só os digitados à mão", () => {
  const itens = [
    itemDe("1", "Abacate", HISTAMINA_ALTA),
    itemDe("2", "Mussarela de búfala", [], false),
    itemDe("3", "Carne boi", [], false),
  ];
  assert.deepEqual(alimentosSemLigacao(itens), ["Carne boi", "Mussarela de búfala"]);
});

// ------------------------------------------------ em que semana ela está

test("semanaEm: o dia do início é a semana 1", () => {
  assert.equal(semanaEm("2026-09-01", "2026-09-01"), 1);
  assert.equal(semanaEm("2026-09-01", "2026-09-07"), 1);
});

test("semanaEm: o sétimo dia depois já é a semana 2", () => {
  assert.equal(semanaEm("2026-09-01", "2026-09-08"), 2);
  assert.equal(semanaEm("2026-09-01", "2026-09-14"), 2);
  assert.equal(semanaEm("2026-09-01", "2026-09-15"), 3);
});

test("semanaEm: sem data de início, semana 1", () => {
  assert.equal(semanaEm(null, "2026-09-20"), 1);
});

test("semanaEm: data anterior ao início não cai antes da semana 1", () => {
  assert.equal(semanaEm("2026-09-10", "2026-09-01"), 1);
});

test("inicioParaSemana: semana 1 é hoje", () => {
  assert.equal(inicioParaSemana(1, "2026-09-20"), "2026-09-20");
});

test("inicioParaSemana: o caso da Daniela — terceira semana, duas para trás", () => {
  assert.equal(inicioParaSemana(3, "2026-09-20"), "2026-09-06");
  assert.equal(inicioParaSemana(4, "2026-09-20"), "2026-08-30");
});

test("inicioParaSemana: a ida e a volta fecham", () => {
  for (let semana = 1; semana <= 30; semana += 1) {
    assert.equal(semanaEm(inicioParaSemana(semana, "2026-09-20"), "2026-09-20"), semana);
  }
});

test("inicioParaSemana: a ida e a volta fecham atravessando a virada do ano", () => {
  for (const hoje of ["2026-01-05", "2026-03-01", "2026-12-31"]) {
    for (let semana = 1; semana <= 12; semana += 1) {
      assert.equal(semanaEm(inicioParaSemana(semana, hoje), hoje), semana, `${hoje} semana ${semana}`);
    }
  }
});

test("inicioParaSemana: semana inválida vira 1, nunca uma data no futuro", () => {
  assert.equal(inicioParaSemana(0, "2026-09-20"), "2026-09-20");
  assert.equal(inicioParaSemana(-5, "2026-09-20"), "2026-09-20");
  assert.equal(inicioParaSemana(2.7, "2026-09-20"), "2026-09-13");
});

test("semanaEm dá o mesmo que a conta do banco, caso a caso", () => {
  // Os dez casos rodados contra o Postgres de produção. Se um dia a regra
  // mudar de um lado só, a tela e o histórico passariam a discordar sobre a
  // semana da mesma paciente, e este teste é quem avisa.
  const doBanco: [string, string, number][] = [
    ["2026-09-01", "2026-09-01", 1],
    ["2026-09-01", "2026-09-07", 1],
    ["2026-09-01", "2026-09-08", 2],
    ["2026-09-01", "2026-09-14", 2],
    ["2026-09-01", "2026-09-15", 3],
    ["2026-09-01", "2026-09-27", 4],
    ["2026-08-24", "2026-09-21", 5],
    ["2026-09-07", "2026-09-21", 3],
    ["2026-09-10", "2026-09-01", 1],
    ["2025-12-28", "2026-01-05", 2],
  ];
  for (const [inicio, dia, esperado] of doBanco) {
    assert.equal(semanaEm(inicio, dia), esperado, `${inicio} → ${dia}`);
  }
});

// ------------------------------------------------ o Mapa e as suas etapas

test("as etapas saem do material, não de um número escrito no código", () => {
  const material = [
    { semanaSugerida: 1 },
    { semanaSugerida: 2 },
    { semanaSugerida: 4 },
    { semanaSugerida: null },
  ];
  assert.deepEqual(etapasDoMaterial(material), [1, 2, 3, 4]);
});

test("material ainda não carregado não deixa a lista vazia", () => {
  assert.deepEqual(etapasDoMaterial([]), [1, 2, 3, 4]);
});

test("a semana 20 não é oferecida a quem tem quatro etapas", () => {
  const opcoes = opcoesDeSemana([1, 2, 3, 4], 1);
  assert.equal(opcoes.length, 4);
  assert.deepEqual(opcoes.map((o) => o.rotulo), [
    "Semana 1",
    "Semana 2",
    "Semana 3",
    "Semana 4",
  ]);
});

test("mas a paciente que já passou das quatro não fica sem opção", () => {
  // Levar seis semanas para vencer quatro etapas acontece. O seletor não
  // pode ficar em branco para ela.
  const opcoes = opcoesDeSemana([1, 2, 3, 4], 6);
  assert.equal(opcoes.length, 5);
  assert.equal(opcoes.at(-1)?.valor, "6");
  assert.match(opcoes.at(-1)?.rotulo ?? "", /além do material/);
});

// --- a busca no Mapa -------------------------------------------------------

/** Nomes reais do material dela, como estão em produção. */
const MAPA = [
  { nome: "Abacate / avocado", observacao: null },
  { nome: "Carne de porco", observacao: null },
  { nome: "Queijos de búfala", observacao: null },
  { nome: "Queijo cottage de búfala", observacao: "Prefira sem lactose." },
  { nome: "Muçarela", observacao: "Queijo de vaca. Prefira sem lactose." },
  { nome: "Parmesão", observacao: "Queijo de vaca. Prefira sem lactose." },
  { nome: "Manga", observacao: null },
  { nome: "Couve-flor", observacao: null },
];

test("o caso que motivou tudo: 'Mussarela de búfala' acha os queijos de búfala", () => {
  // Procurando a frase inteira não viria nada, e a tela diria que o Mapa não
  // tem o alimento — quando tem dois candidatos.
  //
  // Nenhum deles é "o certo" para o código: os dois casam a mesma palavra, e
  // escolher entre "Queijos de búfala" e "Queijo cottage de búfala" é leitura
  // clínica. O trabalho daqui é pôr os dois na frente dela.
  const nomes = buscarNoMapa(MAPA, "Mussarela de búfala").map((a) => a.nome);
  assert.ok(nomes.includes("Queijos de búfala"));
  assert.ok(nomes.includes("Queijo cottage de búfala"));
  assert.ok(!nomes.includes("Manga"), "e não traz o Mapa inteiro junto");
});

test("'Carne de porco' encontra o mesmo nome, e ele vem primeiro", () => {
  assert.equal(buscarNoMapa(MAPA, "Carne de porco")[0]?.nome, "Carne de porco");
});

test("quem casa mais palavras vem antes", () => {
  const achados = buscarNoMapa(MAPA, "queijo cottage búfala");
  assert.equal(achados[0]?.nome, "Queijo cottage de búfala");
});

test("a observação também é procurada — é onde mora 'queijo de vaca'", () => {
  const nomes = buscarNoMapa(MAPA, "queijo").map((a) => a.nome);
  assert.ok(nomes.includes("Muçarela"), "Muçarela não tem 'queijo' no nome, só na observação");
  assert.ok(nomes.includes("Parmesão"));
});

test("acento não atrapalha, nos dois sentidos", () => {
  assert.ok(buscarNoMapa(MAPA, "bufala").some((a) => a.nome === "Queijos de búfala"));
  assert.ok(buscarNoMapa(MAPA, "COUVE-FLOR").some((a) => a.nome === "Couve-flor"));
  assert.ok(buscarNoMapa(MAPA, "parmesao").some((a) => a.nome === "Parmesão"));
});

test("palavrinha de ligação não traz o Mapa inteiro", () => {
  // "de" tem duas letras e fica de fora, senão "Carne de porco" casaria com
  // tudo que tem "de" e a ordem perderia o sentido.
  assert.deepEqual(buscarNoMapa(MAPA, "de"), MAPA);
  assert.equal(buscarNoMapa(MAPA, "porco").length, 1);
});

test("termo vazio devolve o Mapa inteiro, não uma lista vazia", () => {
  assert.equal(buscarNoMapa(MAPA, "").length, MAPA.length);
  assert.equal(buscarNoMapa(MAPA, "   ").length, MAPA.length);
});

test("o que não existe no Mapa devolve nada, sem inventar parecido", () => {
  assert.deepEqual(buscarNoMapa(MAPA, "champagne"), []);
});
