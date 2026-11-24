import test from "node:test";
import assert from "node:assert/strict";
import type { DadosDoCaso } from "./panoramaDoCaso.ts";
import { panoramaDoCaso } from "./panoramaDoCaso.ts";

const vazio: DadosDoCaso = {
  pacienteId: "p1",
  hoje: "2026-11-24",
  reintroducao: { ativo: false, orientacao: null, inicio: null, semanaAtual: 0, semanasComRegistro: [], itens: [], registros: [] },
  restricoes: [],
  marcadores: [],
  exames: [],
  peso: { atual: null, inicial: null, data: null },
  treinos: [],
  cardio: [],
  metas: [],
};

const textos = (d: DadosDoCaso) => panoramaDoCaso(d).map((b) => [b.titulo, b.linhas.map((l) => l.texto)]);

test("os seis blocos, na ordem combinada, dizem quando não há nada", () => {
  assert.deepEqual(textos(vazio), [
    ["Intestino", ["Rastreio desligado"]],
    ["Restrições", ["Nenhuma cadastrada"]],
    ["Exames", ["Nenhum exame guardado"]],
    ["Corpo", ["Nenhuma avaliação com peso"]],
    ["Treino", ["Nenhum treino registrado"]],
    ["Adesão", ["Nenhuma meta ativa"]],
  ]);
});

test("leitura que falhou não vira 'nada'", () => {
  const b = panoramaDoCaso({ ...vazio, reintroducao: null, restricoes: null, marcadores: null, treinos: null });
  assert.equal(b[0]!.linhas[0]!.texto, "Não consegui ler agora");
  assert.equal(b[1]!.linhas[0]!.texto, "Não consegui ler agora");
  assert.equal(b[2]!.linhas[0]!.texto, "Não consegui ler agora");
  assert.equal(b[4]!.linhas[0]!.texto, "Não consegui ler agora");
});

test("intestino: semana, registros com sintoma e status, com data e link", () => {
  const registro = (data: string, sintomas: string[]) =>
    ({ id: data, itemId: "i", itemNome: "Feijão", data, horario: null, semana: 1, quantidade: null, preparo: null, sintomas, intensidade: null, bristol: 4, observacao: null }) as never;
  const item = (status: string) => ({ id: status, status }) as never;
  const [intestino] = panoramaDoCaso({
    ...vazio,
    reintroducao: {
      ativo: true, orientacao: null, inicio: "2026-11-10", semanaAtual: 3, semanasComRegistro: [1],
      itens: [item("bem_tolerado"), item("bem_tolerado"), item("em_teste"), item("nao_iniciado")],
      registros: [registro("2026-11-20", ["nenhum"]), registro("2026-11-22", ["gases"])],
    },
  });
  assert.deepEqual(intestino!.linhas.map((l) => [l.texto, l.data]), [
    ["Rastreio ligado · semana 3", "2026-11-10"],
    ["2 registros, 1 com sintoma", "2026-11-22"],
    ["Em teste: 1 · Bem tolerado: 2", null],
  ]);
  assert.equal(intestino!.linhas[0]!.link, "/admin/rastreabilidade/p1");
});

test("restrição sem alimento ligado avisa que não muda as trocas", () => {
  const [, r] = panoramaDoCaso({
    ...vazio,
    restricoes: [
      { id: "1", tipo: "intolerancia", alimento: "Leite", gravidade: "moderada", notas: null, alimentoIds: [], criadoEm: "2026-11-01T10:00:00Z", atualizadoEm: "2026-11-02T10:00:00Z" },
      { id: "2", tipo: "alergia", alimento: "Camarão", gravidade: "grave", notas: null, alimentoIds: ["a"], origem: "rastreio", criadoEm: "2026-11-03T10:00:00Z", atualizadoEm: "2026-11-03T10:00:00Z" },
    ],
  });
  assert.deepEqual(r!.linhas.map((l) => [l.texto, l.origem, l.data]), [
    ["Alergia: Camarão (grave)", "Restrições, veio do rastreio", "2026-11-03"],
    ["Intolerância: Leite (moderada) · sem alimento ligado, não muda as trocas", "Restrições", "2026-11-02"],
  ]);
});

test("exames: só aponta fora da faixa que ela lançou no marcador", () => {
  const m = (nome: string, valor: number, refMin: number | null, refMax: number | null) => ({ id: nome, codigo: nome, nome, valor, unidade: "", refMin, refMax });
  const [, , e] = panoramaDoCaso({
    ...vazio,
    marcadores: [
      { data: "2026-10-01", exameId: null, marcadores: [m("Velho", 1, 5, 10)] },
      { data: "2026-11-15", exameId: null, marcadores: [m("Ferritina", 8, 15, 150), m("B12", 300, 200, 900), m("Sem faixa", 1, null, null)] },
    ],
    exames: [
      { id: "x", caminho: "", nome: "hemograma.pdf", tipo: "", tamanho: 1, data: "2026-11-15", descricao: null, origem: "paciente", criadoEm: "2026-11-16T00:00:00Z" },
    ] as never,
  });
  assert.deepEqual(e!.linhas.map((l) => [l.texto, l.data]), [
    ["3 marcadores lançados · fora da faixa informada: Ferritina", "2026-11-15"],
    ["1 arquivo · o mais recente: hemograma.pdf", "2026-11-15"],
  ]);
});

test("corpo: peso atual e a diferença para a 1ª avaliação, com sinal", () => {
  const corpo = (atual: number | null, inicial: number | null) =>
    panoramaDoCaso({ ...vazio, peso: { atual, inicial, data: "2026-11-19" } })[3]!.linhas[0]!;
  assert.equal(corpo(72.8, 77).texto, "72,8 kg · −4,2 kg desde a 1ª avaliação");
  assert.equal(corpo(61.5, 60).texto, "61,5 kg · +1,5 kg desde a 1ª avaliação");
  assert.equal(corpo(60, 60).texto, "60 kg");
  assert.equal(corpo(60, 60).data, "2026-11-19");
  assert.equal(corpo(null, null).texto, "Nenhuma avaliação com peso");
});

test("treino: conta só os últimos 28 dias até hoje (data futura fora), e mostra a data do último", () => {
  const s = (data: string) => ({ id: data, data, treinoId: null, observacao: null, duracaoMin: null, series: [] });
  const [, , , , t] = panoramaDoCaso({ ...vazio, treinos: [s("2026-10-01"), s("2026-11-20"), s("2026-11-23"), s("2026-11-28")] });
  assert.deepEqual(t!.linhas.map((l) => [l.texto, l.data]), [["2 treinos nos últimos 28 dias", "2026-11-23"]]);
});
