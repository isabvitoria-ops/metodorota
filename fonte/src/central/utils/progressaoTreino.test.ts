import test from "node:test";
import assert from "node:assert/strict";
import type { SessaoDoExercicio } from "./progressaoTreino";
import {
  chegouAoTopoDaFaixa,
  evolucaoDoExercicio,
  melhorSerie,
  progressaoEntre,
  recordesDe,
  volumeDaSessao,
} from "./progressaoTreino";

/** Uma sessão de uma série só, que é o caso do teste do enunciado. */
function s(data: string, carga: number | null, reps: number): SessaoDoExercicio {
  return { data, series: [{ numero: 1, carga, repeticoes: reps }] };
}

// O teste obrigatório do pedido, escrito exatamente como ele veio.
const AGACHAMENTO: SessaoDoExercicio[] = [
  s("2026-09-10", 60, 6),
  s("2026-09-13", 60, 7),
  s("2026-09-17", 60, 8),
  s("2026-09-20", 60, 10),
  s("2026-09-24", 62, 6),
  s("2026-09-27", 62, 7),
];

test("o agachamento do enunciado: +1, +1, +2, carga, +1 — e nada de carga sugerida", () => {
  const linhas = evolucaoDoExercicio(AGACHAMENTO);

  assert.equal(linhas[0]?.progressao.tipo, "nenhuma"); // a primeira não tem com o que comparar
  assert.equal(linhas[1]?.progressao.tipo, "repeticoes");
  assert.equal(linhas[1]?.progressao.repeticoesAMais, 1);
  assert.equal(linhas[2]?.progressao.repeticoesAMais, 1);
  assert.equal(linhas[3]?.progressao.repeticoesAMais, 2);
  assert.equal(linhas[4]?.progressao.tipo, "carga");
  assert.equal(linhas[4]?.progressao.cargaAMais, 2);
  assert.equal(linhas[5]?.progressao.tipo, "repeticoes");
  assert.equal(linhas[5]?.progressao.repeticoesAMais, 1);

  // Nenhuma mensagem pode sugerir carga. É a linha mais importante deste
  // arquivo: o aplicativo não é personal trainer.
  const proibido = /use\b|tente\b|suba|aumente|diminua|reduza|próxima carga|recomend/i;
  for (const l of linhas) {
    assert.ok(!proibido.test(l.progressao.mensagem), `mensagem prescreve: ${l.progressao.mensagem}`);
  }
});

test("a sessão em que a carga subiu e as repetições caíram é progressão de carga", () => {
  // 60 kg × 10 -> 62 kg × 6. Menos repetições, mas subiu carga: é evolução,
  // e chamar de regressão seria o erro clássico.
  const p = progressaoEntre(s("2026-09-20", 60, 10), s("2026-09-24", 62, 6));
  assert.equal(p.tipo, "carga");
  assert.equal(p.repeticoesAMais, -4);
  assert.match(p.mensagem, /aumentou sua carga/);
});

test("meio quilo é evolução, e a mensagem diz isso com todas as letras", () => {
  const p = progressaoEntre(s("2026-01-01", 60, 8), s("2026-01-03", 60.5, 8));
  assert.equal(p.tipo, "carga");
  assert.equal(p.cargaAMais, 0.5);
  assert.equal(p.mensagem, "+0,5 kg também é evolução.");
});

test("menos repetições com a mesma carga não vira mensagem nenhuma", () => {
  // Não é regressão, não é piora, e não é assunto do aplicativo.
  const p = progressaoEntre(s("2026-01-01", 60, 8), s("2026-01-03", 60, 6));
  assert.equal(p.tipo, "nenhuma");
  assert.equal(p.mensagem, "");
  assert.equal(p.repeticoesAMais, -2);
});

test("1 repetição fala no singular, 2 ou mais no plural", () => {
  assert.equal(
    progressaoEntre(s("2026-01-01", 60, 6), s("2026-01-03", 60, 7)).mensagem,
    "Você fez 1 repetição a mais com a mesma carga.",
  );
  assert.match(
    progressaoEntre(s("2026-01-01", 60, 6), s("2026-01-03", 60, 8)).mensagem,
    /2 repetições a mais/,
  );
});

test("carga e repetições subindo juntas viram uma frase só", () => {
  const p = progressaoEntre(s("2026-01-01", 60, 6), s("2026-01-03", 62, 8));
  assert.equal(p.tipo, "carga_e_repeticoes");
  assert.equal(p.mensagem, "+2 kg e 2 repetições a mais.");
});

test("sujeira de ponto flutuante não vira meio grama a mais", () => {
  const p = progressaoEntre(s("2026-01-01", 20.1, 8), s("2026-01-03", 20.1 + 0.2 - 0.2, 8));
  assert.equal(p.cargaAMais, 0);
  assert.equal(p.tipo, "nenhuma");
});

test("a melhor série é a de maior carga, e no empate a de mais repetições", () => {
  const sessao = {
    data: "2026-01-01",
    series: [
      { numero: 1, carga: 40, repeticoes: 20 },
      { numero: 2, carga: 60, repeticoes: 8 },
      { numero: 3, carga: 60, repeticoes: 9 },
    ],
  };
  // Não é a de maior volume: 40 × 20 = 800 é mais que 60 × 9 = 540, e
  // chamar a primeira de melhor faria quem subiu para 60 kg parecer ter
  // regredido no mesmo dia em que subiu.
  assert.deepEqual(melhorSerie(sessao.series), { numero: 3, carga: 60, repeticoes: 9 });
});

test("série sem repetição não conta como melhor — nem zerada, nem em branco", () => {
  assert.equal(
    melhorSerie([
      { numero: 1, carga: 80, repeticoes: null },
      { numero: 2, carga: 80, repeticoes: 0 },
    ]),
    null,
  );
});

test("exercício sem carga (prancha, abdominal) evolui por repetição", () => {
  const p = progressaoEntre(s("2026-01-01", null, 12), s("2026-01-03", null, 15));
  assert.equal(p.tipo, "repeticoes");
  assert.equal(p.repeticoesAMais, 3);
  // Sem carga, a frase não fala em carga: "com a mesma carga" na prancha
  // soaria como se houvesse um peso que ninguém pôs.
  assert.equal(p.mensagem, "Você fez 3 repetições a mais.");
});

test("com carga, a frase diz 'com a mesma carga' — é o que diferencia o caso", () => {
  assert.equal(
    progressaoEntre(s("2026-01-01", 60, 6), s("2026-01-03", 60, 7)).mensagem,
    "Você fez 1 repetição a mais com a mesma carga.",
  );
  // Carga zero registrada (barra vazia) ainda É uma carga, e a frase a cita.
  assert.match(
    progressaoEntre(s("2026-01-01", 0, 6), s("2026-01-03", 0, 8)).mensagem,
    /com a mesma carga/,
  );
});

test("os maiores números vêm com o contexto do outro número junto", () => {
  const r = recordesDe(AGACHAMENTO);
  assert.equal(r.maiorCarga, 62);
  assert.equal(r.repeticoesNaMaiorCarga, 7);
  assert.equal(r.maiorRepeticoes, 10);
  assert.equal(r.cargaNasMaioresRepeticoes, 60);
});

test("sem sessão nenhuma, não há recorde — e não há zero", () => {
  const r = recordesDe([]);
  assert.equal(r.maiorCarga, null);
  assert.equal(r.maiorRepeticoes, null);
});

test("o topo da faixa é sinalizado, e só existe se a profissional programou", () => {
  const faixa = { series: 3, repeticoesMin: 8, repeticoesMax: 10 };
  assert.equal(chegouAoTopoDaFaixa(s("2026-01-01", 60, 9), faixa), false);
  assert.equal(chegouAoTopoDaFaixa(s("2026-01-01", 60, 10), faixa), true);
  assert.equal(chegouAoTopoDaFaixa(s("2026-01-01", 60, 12), faixa), true);
  // Sem faixa programada não há topo. Inventar um seria prescrever.
  assert.equal(chegouAoTopoDaFaixa(s("2026-01-01", 60, 99), null), false);
  assert.equal(
    chegouAoTopoDaFaixa(s("2026-01-01", 60, 99), { series: 3, repeticoesMin: 8, repeticoesMax: null }),
    false,
  );
});

test("a linha do tempo sai da mais antiga para a mais nova, venha na ordem que vier", () => {
  const embaralhado = [AGACHAMENTO[3]!, AGACHAMENTO[0]!, AGACHAMENTO[5]!, AGACHAMENTO[1]!];
  assert.deepEqual(
    evolucaoDoExercicio(embaralhado).map((l) => l.data),
    ["2026-09-10", "2026-09-13", "2026-09-20", "2026-09-27"],
  );
});

test("volume é a soma de carga × repetições, e nada mais", () => {
  assert.equal(
    volumeDaSessao([
      { numero: 1, carga: 60, repeticoes: 8 },
      { numero: 2, carga: 60, repeticoes: 7 },
    ]),
    900,
  );
  // Exercício sem carga não inventa volume.
  assert.equal(volumeDaSessao([{ numero: 1, carga: null, repeticoes: 20 }]), 0);
});
