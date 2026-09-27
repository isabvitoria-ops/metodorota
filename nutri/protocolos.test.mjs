import test from "node:test";
import assert from "node:assert/strict";
import { PROTOCOLOS } from "./protocolos.mjs";
import { CONVERSOES } from "./calculos.mjs";

/**
 * A ligação entre equação e conversão é o que estes testes guardam.
 *
 * Os coeficientes já têm os seus testes em calculos.test.mjs. O que pode dar
 * errado aqui é outra coisa, e mais silenciosa: uma equação apontar para a
 * conversão do autor errado. O percentual sai plausível, ninguém estranha, e
 * uma fração de ponto percentual entra na prescrição.
 */

const DOBRAS = {
  biceps: 5,
  triceps: 9.6,
  peitoral: 6,
  subescapular: 8,
  axilar: 6.5,
  suprailiaca: 7.4,
  abdominal: 8.2,
  coxa: 12,
  panturrilha: 9,
};

/** A mesma conta que a tela faz, sem a tela. */
function calcular(chave, { sexo = "feminino", idade = 22 } = {}) {
  const dados = PROTOCOLOS[chave];
  const usadas = dados.dobras[sexo];
  const valores = Object.fromEntries(usadas.map((c) => [c, DOBRAS[c]]));
  const soma = usadas.reduce((t, c) => t + DOBRAS[c], 0);
  if (dados.percentual) {
    return { soma, densidade: null, percentual: dados.percentual({ soma, idade, sexo, valores }) };
  }
  const densidade = dados.densidade({ soma, idade, sexo, valores });
  return { soma, densidade, percentual: CONVERSOES[dados.conversao].calcular(densidade) };
}

const perto = (a, b, casas = 2) =>
  assert.equal(Number(a.toFixed(casas)), Number(b.toFixed(casas)), `${a} ≠ ${b}`);

test("cada protocolo declara a conversão do seu próprio autor", () => {
  const esperado = {
    pollock3: "siri",
    pollock7: "siri",
    pollock4: "siri",
    durnin: "siri",
    durninRahaman: "siri",
    lean: "lohman",
    petroski: "lohman",
    guedes: "siri",
    katch: "brozek",
    thorland3: "siri",
    thorland7: "siri",
  };
  for (const [chave, conversao] of Object.entries(esperado)) {
    assert.equal(PROTOCOLOS[chave].conversao, conversao, `${chave} está com a conversão errada`);
  }
});

test("Slaughter e Faulkner não têm conversão — devolvem o percentual direto", () => {
  for (const chave of ["slaughter", "faulkner"]) {
    assert.equal(PROTOCOLOS[chave].conversao, undefined);
    assert.equal(typeof PROTOCOLOS[chave].percentual, "function");
    assert.equal(PROTOCOLOS[chave].densidade, undefined);
  }
});

test("toda equação de densidade tem conversão, e vice-versa", () => {
  for (const [chave, d] of Object.entries(PROTOCOLOS)) {
    const temDensidade = typeof d.densidade === "function";
    const temPercentual = typeof d.percentual === "function";
    assert.ok(temDensidade !== temPercentual, `${chave}: precisa de uma das duas, e só uma`);
    if (temDensidade) assert.ok(CONVERSOES[d.conversao], `${chave}: conversão desconhecida`);
  }
});

test("toda dobra citada existe de verdade", () => {
  const conhecidas = new Set(Object.keys(DOBRAS));
  for (const [chave, d] of Object.entries(PROTOCOLOS)) {
    for (const sexo of ["masculino", "feminino"]) {
      for (const dobra of d.dobras[sexo]) {
        assert.ok(conhecidas.has(dobra), `${chave}/${sexo}: dobra "${dobra}" não existe`);
      }
    }
  }
});

test("Pollock 4 dobras continua sem equação para homem", () => {
  assert.deepEqual(PROTOCOLOS.pollock4.dobras.masculino, []);
  assert.equal(PROTOCOLOS.pollock4.dobras.feminino.length, 4);
});

// --- os números, conferidos à mão para a mesma paciente ---------------------

test("Faulkner: soma 33,2 mm dá 10,86% — o caso real do PDF dela", () => {
  const r = calcular("faulkner");
  perto(r.soma, 33.2, 1);
  perto(r.percentual, 10.86);
});

test("Petroski (homem): densidade 1,072924 e 11,15% por (498/D) − 453", () => {
  const r = calcular("petroski", { sexo: "masculino" });
  perto(r.soma, 34.0, 1);
  perto(r.densidade, 1.0729, 4);
  perto(r.percentual, 11.15);
});

test("Guedes (homem): densidade 1,077382 e 9,45% por Siri", () => {
  const r = calcular("guedes", { sexo: "masculino" });
  perto(r.soma, 25.2, 1);
  perto(r.densidade, 1.0774, 4);
  perto(r.percentual, 9.45);
});

test("Katch & McArdle (homem): cada dobra com o seu coeficiente, 9,79% por Brozek", () => {
  const r = calcular("katch", { sexo: "masculino" });
  perto(r.densidade, 1.0779, 4);
  perto(r.percentual, 9.79);
});

test("Katch não é a mesma conta que somar as dobras antes", () => {
  // A armadilha da linha: 1,09665 − 0,00103×25,8 daria outro número.
  const somando = 1.09665 - 0.00103 * 25.8;
  const certo = PROTOCOLOS.katch.densidade({
    valores: { triceps: 9.6, subescapular: 8, abdominal: 8.2 },
  });
  assert.notEqual(Number(somando.toFixed(4)), Number(certo.toFixed(4)));
});

test("Lean (homem): densidade 1,071943 e 11,58% por (498/D) − 453", () => {
  const r = calcular("lean", { sexo: "masculino" });
  perto(r.densidade, 1.0719, 4);
  perto(r.percentual, 11.58);
});

test("Durnin & Rahaman (homem): densidade 1,067646 e 13,64% por Siri", () => {
  const r = calcular("durninRahaman", { sexo: "masculino" });
  perto(r.densidade, 1.0676, 4);
  perto(r.percentual, 13.64);
});

test("Thorland 3 dobras (homem): densidade 1,079483 e 8,55% por Siri", () => {
  const r = calcular("thorland3", { sexo: "masculino" });
  perto(r.soma, 24.1, 1);
  perto(r.densidade, 1.0795, 4);
  perto(r.percentual, 8.55);
});

test("Thorland 7 dobras (homem): densidade 1,080161 e 8,26% por Siri", () => {
  const r = calcular("thorland7", { sexo: "masculino" });
  perto(r.soma, 57.7, 1);
  perto(r.densidade, 1.0802, 4);
  perto(r.percentual, 8.26);
});

test("Slaughter (menino): soma 17,6 mm dá 13,32%, sem densidade", () => {
  const r = calcular("slaughter", { sexo: "masculino" });
  perto(r.soma, 17.6, 1);
  assert.equal(r.densidade, null);
  perto(r.percentual, 13.32);
});

test("a conversão do autor muda o resultado — pouco, mas muda", () => {
  // Siri é 495/D − 450 e a de Petroski e Lean é 498/D − 453. A diferença
  // entre as duas é exatamente 3 × (1 − D) / D: nunca é zero, cresce quanto
  // MAIS magra for a paciente, e num corpo comum fica entre 0,05 e 0,3
  // ponto percentual. Pequena o bastante para ninguém estranhar na tela —
  // que é justamente por que ela não pode ser escolhida no chute.
  const d = PROTOCOLOS.petroski.densidade({ soma: 34, idade: 22 });
  const diferenca = CONVERSOES.lohman.calcular(d) - CONVERSOES.siri.calcular(d);
  perto(diferenca, (3 * (1 - d)) / d, 6);
  perto(diferenca, -0.2039, 3);
});

test("a diferença entre Siri e (498/D) − 453 cresce conforme a densidade sobe", () => {
  const gap = (d) => Math.abs(CONVERSOES.lohman.calcular(d) - CONVERSOES.siri.calcular(d));
  assert.ok(gap(1.02) < gap(1.05));
  assert.ok(gap(1.05) < gap(1.1));
  perto(gap(1.02), 0.0588, 3);
  perto(gap(1.1), 0.2727, 3);
});

// --- a versão feminina não pode ser a masculina com outro nome ----------------

test("Durnin & Rahaman (mulher) usa 1,1581 − 0,0720·log Σ", () => {
  const r = calcular("durninRahaman", { sexo: "feminino" });
  perto(r.soma, 30, 1);
  perto(r.densidade, 1.1581 - 0.072 * Math.log10(30), 6);
  // A conta masculina daria outro número para a mesma soma.
  assert.notEqual(r.densidade.toFixed(4), (1.161 - 0.0632 * Math.log10(30)).toFixed(4));
});

test("Durnin & Rahaman: o caso da vistoria — mulher, soma 50 → 27,9% (e não 19,8%)", () => {
  const d = PROTOCOLOS.durninRahaman.densidade({ soma: 50, sexo: "feminino" });
  perto(CONVERSOES.siri.calcular(d), 27.9, 1);
});

test("Guedes (mulher) soma coxa, supra-ilíaca e subescapular, com 1,1665 − 0,07063·log Σ", () => {
  assert.deepEqual(PROTOCOLOS.guedes.dobras.feminino, ["coxa", "suprailiaca", "subescapular"]);
  const r = calcular("guedes", { sexo: "feminino" });
  perto(r.soma, 27.4, 1);
  perto(r.densidade, 1.1665 - 0.07063 * Math.log10(27.4), 6);
});

test("Slaughter (menina) usa 1,33Σ − 0,013Σ² − 2,5", () => {
  const r = calcular("slaughter", { sexo: "feminino" });
  perto(r.percentual, 1.33 * 17.6 - 0.013 * 17.6 * 17.6 - 2.5);
});

test("Slaughter acima de 35 mm troca para a equação linear, nos dois sexos", () => {
  perto(PROTOCOLOS.slaughter.percentual({ soma: 60, sexo: "masculino" }), 0.783 * 60 + 1.6);
  perto(PROTOCOLOS.slaughter.percentual({ soma: 60, sexo: "feminino" }), 0.546 * 60 + 9.7);
  // 35 ainda é a quadrática
  perto(PROTOCOLOS.slaughter.percentual({ soma: 35, sexo: "feminino" }), 1.33 * 35 - 0.013 * 1225 - 2.5);
});

test("equações sem a versão feminina conferida não são oferecidas para mulher", () => {
  for (const chave of ["petroski", "katch", "thorland3", "thorland7", "lean"]) {
    assert.deepEqual(PROTOCOLOS[chave].dobras.feminino, [], chave);
    assert.equal(PROTOCOLOS[chave].soMasculinaConferida, true, chave);
    assert.ok(PROTOCOLOS[chave].dobras.masculino.length > 0, chave);
  }
});

test("toda equação que recebe dobras de mulher recebe também o sexo na conta", () => {
  // Uma equação com versão por sexo que ignorasse o sexo voltaria ao defeito.
  const soma = 40;
  for (const chave of ["durninRahaman", "guedes", "slaughter"]) {
    const d = PROTOCOLOS[chave];
    const f = d.percentual ?? d.densidade;
    assert.notEqual(
      f({ soma, idade: 20, sexo: "feminino", valores: {} }),
      f({ soma, idade: 20, sexo: "masculino", valores: {} }),
      chave,
    );
  }
});

test("toda equação com faixa de idade declara mínimo e máximo coerentes", () => {
  for (const [chave, d] of Object.entries(PROTOCOLOS)) {
    if (!d.idade) continue;
    assert.equal(d.idade.length, 2, chave);
    assert.ok(d.idade[0] < d.idade[1], chave);
  }
});
