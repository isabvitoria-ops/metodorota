import assert from "node:assert/strict";
import { test } from "node:test";

import {
  valorNaEscala,
  pontuacaoDoEnvio,
  pontuacaoPorEixo,
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

// --- múltipla escolha com pontos por opção (0054) -------------------------

const escolha: PerguntaPontuavel = {
  id: "e",
  tipo: "escolha",
  peso: 1,
  invertida: false,
  opcoes: ["Nunca", "Às vezes", "Sempre"],
  pontosOpcoes: [10, 5, 0],
};

test("múltipla escolha: a opção escolhida vale os pontos que ela definiu", () => {
  assert.equal(valorNaEscala(escolha, { perguntaId: "e", numero: null, texto: "Nunca" }), 10);
  assert.equal(valorNaEscala(escolha, { perguntaId: "e", numero: null, texto: "Às vezes" }), 5);
  assert.equal(valorNaEscala(escolha, { perguntaId: "e", numero: null, texto: "Sempre" }), 0);
});

test("múltipla escolha sem pontos definidos não pontua", () => {
  const semPontos: PerguntaPontuavel = { ...escolha, pontosOpcoes: [] };
  assert.equal(valorNaEscala(semPontos, { perguntaId: "e", numero: null, texto: "Nunca" }), null);
});

test("múltipla escolha com opção desconhecida não pontua", () => {
  assert.equal(valorNaEscala(escolha, { perguntaId: "e", numero: null, texto: "Talvez" }), null);
});

test("múltipla escolha entra na nota do envio", () => {
  // escolha "Às vezes" = 5, peso 1 -> 5/10 = 50%.
  assert.equal(pontuacaoDoEnvio([escolha], envio("2026-09-21", { e: "Às vezes" })), 50);
});

// --- quebra por eixo ------------------------------------------------------

test("a quebra por eixo dá uma nota por eixo", () => {
  const intestino1: PerguntaPontuavel = { id: "i1", tipo: "escala", peso: 1, invertida: false, eixoId: "int", eixoNome: "Intestino" };
  const intestino2: PerguntaPontuavel = { id: "i2", tipo: "escala", peso: 1, invertida: false, eixoId: "int", eixoNome: "Intestino" };
  const sono1: PerguntaPontuavel = { id: "s1", tipo: "escala", peso: 1, invertida: false, eixoId: "sono", eixoNome: "Sono" };

  const eixos = pontuacaoPorEixo(
    [intestino1, intestino2, sono1],
    envio("2026-09-21", { i1: 8, i2: 6, s1: 10 }),
  );
  const porNome = new Map(eixos.map((e) => [e.eixoNome, e]));
  assert.equal(porNome.get("Intestino")?.nota, 70); // (8+6)/20
  assert.equal(porNome.get("Sono")?.nota, 100); // 10/10
  assert.equal(porNome.get("Intestino")?.perguntas, 2);
});

test("pergunta sem eixo cai no grupo 'Sem eixo'", () => {
  const eixos = pontuacaoPorEixo([bemEstar], envio("2026-09-21", { a: 7 }));
  assert.equal(eixos[0]?.eixoNome, "Sem eixo");
  assert.equal(eixos[0]?.eixoId, null);
  assert.equal(eixos[0]?.nota, 70);
});

// --- congelamento pela foto da régua (regua_snapshot) ---------------------

test("a foto da régua congela a nota: mudar o peso hoje não mexe no envio antigo", () => {
  // Régua atual diz que 'a' tem peso 3. Mas o envio foi respondido quando
  // 'a' tinha peso 1 — a foto manda, e a nota usa peso 1.
  const reguaAtual: PerguntaPontuavel[] = [
    { id: "a", tipo: "escala", peso: 3, invertida: false },
    { id: "b", tipo: "escala", peso: 1, invertida: true },
  ];
  const envioCongelado: EnvioCru = {
    id: "2026-09-21",
    periodo: "2026-09-21",
    respostas: [
      { perguntaId: "a", numero: 10, texto: null },
      { perguntaId: "b", numero: 10, texto: null },
    ],
    reguaSnapshot: [
      { id: "a", tipo: "escala", peso: 1, invertida: false },
      { id: "b", tipo: "escala", peso: 1, invertida: true },
    ],
  };
  // Com a foto (peso 1 e 1): a=10 -> 10, b=10 dor -> 0. (10+0)/20 = 50.
  assert.equal(pontuacaoDoEnvio(reguaAtual, envioCongelado), 50);
  // Sem foto, a régua atual (peso 3) daria: (30+0)/40 = 75. Prova o congelamento.
  assert.equal(pontuacaoDoEnvio(reguaAtual, { ...envioCongelado, reguaSnapshot: null }), 75);
});

test("envio sem foto usa a régua atual (compatível com o que já existia)", () => {
  const nota = pontuacaoDoEnvio([bemEstar, dor], envio("2026-09-21", { a: 8, b: 2 }));
  assert.equal(nota, 80);
});
