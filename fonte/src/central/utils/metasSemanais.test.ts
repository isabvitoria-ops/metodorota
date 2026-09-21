import test from "node:test";
import assert from "node:assert/strict";
import type { CardioSessao, MetaSemanal } from "@/central/types/treino";
import type { SessaoDeTreino } from "@/central/types/treino";
import {
  diasDaSemana,
  domingoDaSemana,
  estaNaSemana,
  metasDaSemana,
  progressoDaMeta,
  segundaDaSemana,
} from "./metasSemanais";

function treino(data: string): SessaoDeTreino {
  return { id: data, data, treinoId: null, observacao: null, series: [] };
}
function cardio(data: string, minutos: number | null): CardioSessao {
  return {
    id: `${data}-${minutos}`,
    data,
    tipo: "Caminhada",
    duracaoMin: minutos,
    distanciaKm: null,
    intensidade: null,
    observacao: null,
  };
}
const META_TREINO: MetaSemanal = {
  id: "m1",
  semanaInicio: "2026-09-21",
  tipo: "treino",
  alvo: 4,
  unidade: "treinos",
};
const META_CARDIO: MetaSemanal = {
  id: "m2",
  semanaInicio: "2026-09-21",
  tipo: "cardio",
  alvo: 90,
  unidade: "minutos",
};

test("a semana começa na segunda, e domingo pertence à semana que passou", () => {
  // 21/09/2026 é uma segunda.
  assert.equal(segundaDaSemana("2026-09-21"), "2026-09-21");
  assert.equal(segundaDaSemana("2026-09-24"), "2026-09-21");
  // Domingo 27/09 ainda é a semana que começou dia 21 — e não o começo da
  // seguinte. Contando domingo como início, a semana de quem treina no fim
  // de semana ficaria partida ao meio.
  assert.equal(segundaDaSemana("2026-09-27"), "2026-09-21");
  assert.equal(segundaDaSemana("2026-09-28"), "2026-09-28");
  assert.equal(domingoDaSemana("2026-09-23"), "2026-09-27");
});

test("a data é lida ao meio-dia, para o fuso não empurrar a segunda para domingo", () => {
  // Com meia-noite, o fuso do navegador (UTC−3) jogaria a data um dia para
  // trás e a semana inteira sairia deslocada.
  assert.equal(segundaDaSemana("2026-09-21T00:00:00"), "2026-09-21");
  assert.equal(segundaDaSemana("2026-01-01"), "2025-12-29");
});

test("data sem sentido volta como veio, em vez de quebrar a tela", () => {
  assert.equal(segundaDaSemana("nao-e-data"), "nao-e-data");
  assert.equal(segundaDaSemana(""), "");
});

test("dois treinos no mesmo dia contam como um dia de treino", () => {
  // A meta é "4 treinos na semana". Quem lançou a sessão em duas partes não
  // treinou duas vezes.
  const p = progressoDaMeta(
    META_TREINO,
    [treino("2026-09-22"), treino("2026-09-22"), treino("2026-09-24")],
    [],
  );
  assert.equal(p.feito, 2);
  assert.equal(p.texto, "2/4 treinos");
  assert.equal(p.porcento, 50);
  assert.equal(p.cumprida, false);
});

test("o cardio conta MINUTOS, não sessões", () => {
  // Contar sessão diria que três caminhadas de dez minutos valem o mesmo
  // que três de trinta.
  const p = progressoDaMeta(META_CARDIO, [], [
    cardio("2026-09-22", 30),
    cardio("2026-09-24", 30),
    cardio("2026-09-26", 20),
  ]);
  assert.equal(p.feito, 80);
  assert.equal(p.texto, "80/90 minutos");
  assert.equal(p.porcento, 89);
  assert.equal(p.cumprida, false);
});

test("cardio sem duração anotada não soma nada — e não quebra", () => {
  const p = progressoDaMeta(META_CARDIO, [], [cardio("2026-09-22", null), cardio("2026-09-23", 40)]);
  assert.equal(p.feito, 40);
});

test("passar da meta é 100%, não 125% — e é meta cumprida", () => {
  const p = progressoDaMeta(
    META_TREINO,
    ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25"].map(treino),
    [],
  );
  assert.equal(p.feito, 5);
  assert.equal(p.porcento, 100);
  assert.equal(p.cumprida, true);
});

test("o que ela fez FORA da semana da meta não conta", () => {
  const p = progressoDaMeta(META_TREINO, [treino("2026-09-20"), treino("2026-09-28")], []);
  assert.equal(p.feito, 0);
  assert.equal(p.cumprida, false);
});

test("meta com alvo zero não vira 100% nem 'cumprida' por divisão vazia", () => {
  const zerada: MetaSemanal = { ...META_TREINO, alvo: 0 };
  const p = progressoDaMeta(zerada, [treino("2026-09-22")], []);
  assert.equal(p.porcento, 0);
  assert.equal(p.cumprida, false);
});

test("a tela só mostra as metas da semana corrente", () => {
  const semanaPassada: MetaSemanal = { ...META_TREINO, id: "velha", semanaInicio: "2026-09-14" };
  // Uma meta de três semanas atrás na tela é cobrança por uma semana que já
  // passou, e não há o que fazer com ela.
  const lista = metasDaSemana([semanaPassada, META_TREINO, META_CARDIO], "2026-09-24", [], []);
  assert.deepEqual(
    lista.map((p) => p.meta.id),
    ["m1", "m2"],
  );
});

test("estaNaSemana aceita qualquer dia da semana como referência", () => {
  assert.equal(estaNaSemana("2026-09-27", "2026-09-21"), true);
  assert.equal(estaNaSemana("2026-09-27", "2026-09-24"), true);
  assert.equal(estaNaSemana("2026-09-28", "2026-09-21"), false);
});

test("a consistência tem sempre sete dias, de segunda a domingo", () => {
  // Sete posições fixas, para a régua não mudar de tamanho a cada semana.
  const dias = diasDaSemana("2026-09-24", [treino("2026-09-22")], [cardio("2026-09-26", 30)]);
  assert.equal(dias.length, 7);
  assert.equal(dias[0]?.data, "2026-09-21");
  assert.equal(dias[6]?.data, "2026-09-27");
  assert.equal(dias[1]?.treinou, true);
  assert.equal(dias[1]?.cardio, false);
  assert.equal(dias[5]?.cardio, true);
  assert.equal(dias[0]?.treinou, false);
});
