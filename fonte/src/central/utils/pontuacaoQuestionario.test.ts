import assert from "node:assert/strict";
import { test } from "node:test";

import {
  valorNaEscala,
  pontuacaoDoEnvio,
  serieDePontuacao,
  compararComAnterior,
  textoDaVariacao,
  semanasSeguidas,
  type PerguntaPontuavel,
  type EnvioCru,
} from "./pontuacaoQuestionario";

const bemEstar: PerguntaPontuavel = { id: "a", tipo: "escala", peso: 1, invertida: false };
const dor: PerguntaPontuavel = { id: "b", tipo: "escala", peso: 1, invertida: true };
const frase: PerguntaPontuavel = { id: "c", tipo: "texto", peso: 0, invertida: false };
const simNao: PerguntaPontuavel = { id: "d", tipo: "sim_nao", peso: 1, invertida: false };

function envio(periodo: string, respostas: Record<string, number | string | null>): EnvioCru {
  return {
    id: periodo,
    periodo,
    respostas: Object.entries(respostas).map(([perguntaId, v]) => ({
      perguntaId,
      numero: typeof v === "number" ? v : null,
      texto: typeof v === "string" ? v : null,
    })),
  };
}

test("escala normal vai direto", () => {
  assert.equal(valorNaEscala(bemEstar, { perguntaId: "a", numero: 7, texto: null }), 7);
});

test("ESCALA INVERTIDA inverte — 3 de dor vale 7", () => {
  assert.equal(valorNaEscala(dor, { perguntaId: "b", numero: 3, texto: null }), 7);
});

test("dor máxima vale zero, e não dez", () => {
  assert.equal(valorNaEscala(dor, { perguntaId: "b", numero: 10, texto: null }), 0);
});

test("peso zero não entra na conta", () => {
  assert.equal(valorNaEscala(frase, { perguntaId: "c", numero: 9, texto: null }), null);
});

test("pergunta de texto não entra mesmo com peso", () => {
  const t: PerguntaPontuavel = { id: "c", tipo: "texto", peso: 2, invertida: false };
  assert.equal(valorNaEscala(t, { perguntaId: "c", numero: 9, texto: null }), null);
});

test("sim/não vira 10 ou 0", () => {
  assert.equal(valorNaEscala(simNao, { perguntaId: "d", numero: 1, texto: null }), 10);
  assert.equal(valorNaEscala(simNao, { perguntaId: "d", numero: 0, texto: null }), 0);
});

test("valor fora da escala é preso entre 0 e 10", () => {
  assert.equal(valorNaEscala(bemEstar, { perguntaId: "a", numero: 999, texto: null }), 10);
  assert.equal(valorNaEscala(bemEstar, { perguntaId: "a", numero: -5, texto: null }), 0);
});

test("NÃO RESPONDIDA NÃO VALE ZERO: sai da conta inteira", () => {
  // Só bem-estar respondido, com 8. Se a dor contasse como zero, a nota
  // cairia para 40. Ela tem que ficar em 80.
  const nota = pontuacaoDoEnvio([bemEstar, dor], envio("2026-09-21", { a: 8 }));
  assert.equal(nota, 80);
});

test("a nota é a média ponderada, de 0 a 100", () => {
  // bem-estar 8 (peso 1) + dor 2 -> vale 8 (peso 1). (8+8)/20 = 80%.
  const nota = pontuacaoDoEnvio([bemEstar, dor], envio("2026-09-21", { a: 8, b: 2 }));
  assert.equal(nota, 80);
});

test("o peso pesa mesmo", () => {
  const pesada: PerguntaPontuavel = { id: "a", tipo: "escala", peso: 3, invertida: false };
  // a=10 peso 3 -> 30/30 ; b=10 (dor) -> 0, peso 1 -> 0/10. (30+0)/40 = 75%.
  assert.equal(pontuacaoDoEnvio([pesada, dor], envio("2026-09-21", { a: 10, b: 10 })), 75);
});

test("UMA SEMANA PIOR NÃO PODE SUBIR A NOTA", () => {
  const boa = pontuacaoDoEnvio([bemEstar, dor], envio("2026-09-21", { a: 9, b: 1 }));
  const ruim = pontuacaoDoEnvio([bemEstar, dor], envio("2026-09-28", { a: 3, b: 9 }));
  assert.ok(boa !== null && ruim !== null);
  assert.ok(ruim < boa, `semana ruim (${ruim}) deveria pontuar menos que a boa (${boa})`);
});

test("check-in só de texto tem nota null, e não zero", () => {
  assert.equal(pontuacaoDoEnvio([frase], envio("2026-09-21", { c: "corrida" })), null);
});

test("envio sem resposta nenhuma tem nota null", () => {
  assert.equal(pontuacaoDoEnvio([bemEstar, dor], envio("2026-09-21", {})), null);
});

test("a série sai da mais antiga para a mais nova", () => {
  const s = serieDePontuacao(
    [bemEstar],
    [envio("2026-09-28", { a: 5 }), envio("2026-09-14", { a: 9 }), envio("2026-09-21", { a: 7 })],
  );
  assert.deepEqual(s.map((p) => p.periodo), ["2026-09-14", "2026-09-21", "2026-09-28"]);
  assert.deepEqual(s.map((p) => p.pontuacao), [90, 70, 50]);
});

test("a comparação pega as duas últimas COM NOTA", () => {
  const s = serieDePontuacao(
    [bemEstar, frase],
    [envio("2026-09-14", { a: 6 }), envio("2026-09-21", { c: "só texto" }), envio("2026-09-28", { a: 9 })],
  );
  const c = compararComAnterior(s);
  assert.equal(c.atual, 90);
  assert.equal(c.anterior, 60);
  assert.equal(c.variacao, 30);
});

test("com uma ponta só, a variação é null e NÃO zero", () => {
  const s = serieDePontuacao([bemEstar], [envio("2026-09-21", { a: 7 })]);
  const c = compararComAnterior(s);
  assert.equal(c.atual, 70);
  assert.equal(c.anterior, null);
  assert.equal(c.variacao, null);
});

test("o texto da variação não diz se é bom ou ruim", () => {
  assert.equal(
    textoDaVariacao({ atual: 80, anterior: 72, variacao: 8 }),
    "80 pontos — +8 em relação à semana anterior",
  );
  assert.equal(
    textoDaVariacao({ atual: 60, anterior: 75, variacao: -15 }),
    "60 pontos — −15 em relação à semana anterior",
  );
  for (const frase of [
    textoDaVariacao({ atual: 80, anterior: 72, variacao: 8 }),
    textoDaVariacao({ atual: 60, anterior: 75, variacao: -15 }),
  ]) {
    for (const veredito of ["melhor", "pior", "melhorou", "piorou", "ótima", "ruim"]) {
      assert.ok(!frase.toLowerCase().includes(veredito), `"${frase}" deu veredito`);
    }
  }
});

test("primeira semana é dita como primeira, sem comparação inventada", () => {
  assert.equal(
    textoDaVariacao({ atual: 70, anterior: null, variacao: null }),
    "70 pontos — primeira semana pontuada",
  );
});

test("sem nota, a frase diz isso em vez de mostrar zero", () => {
  assert.equal(
    textoDaVariacao({ atual: null, anterior: null, variacao: null }),
    "sem pontuação nesta semana",
  );
});

test("semanas seguidas conta de trás para frente", () => {
  const s = serieDePontuacao(
    [bemEstar],
    [envio("2026-09-07", { a: 5 }), envio("2026-09-14", { a: 5 }), envio("2026-09-21", { a: 5 })],
  );
  assert.equal(semanasSeguidas(s, "2026-09-21"), 3);
});

test("um buraco quebra a sequência", () => {
  const s = serieDePontuacao(
    [bemEstar],
    [envio("2026-09-07", { a: 5 }), envio("2026-09-21", { a: 5 })],
  );
  assert.equal(semanasSeguidas(s, "2026-09-21"), 1);
});

test("a semana em curso ainda aberta não quebra a sequência", () => {
  // Ela respondeu as duas anteriores e ainda não respondeu esta. São 2, e
  // não 0 — a semana de hoje ainda está correndo.
  const s = serieDePontuacao(
    [bemEstar],
    [envio("2026-09-07", { a: 5 }), envio("2026-09-14", { a: 5 })],
  );
  assert.equal(semanasSeguidas(s, "2026-09-21"), 2);
});

test("ninguém respondeu nada: zero semanas", () => {
  assert.equal(semanasSeguidas([], "2026-09-21"), 0);
});
