import assert from "node:assert/strict";
import test from "node:test";
import {
  cunningham,
  densidadeDurnin,
  densidadePollock3,
  densidadePollock7,
  distribuicao,
  faulkner,
  harrisBenedict,
  imc,
  massaGorda,
  massaMagra,
  mifflin,
  porGramas,
  porQuilo,
  siri,
  somar,
} from "./calculos.mjs";

/**
 * Testes das contas.
 *
 * Uma conta errada aqui vira prescrição errada. Cada teste confere um
 * exemplo calculado à mão a partir da fórmula publicada — não é o código
 * conferindo a si mesmo.
 */

const perto = (valor, esperado, tolerancia = 0.05) =>
  assert.ok(
    Math.abs(valor - esperado) <= tolerancia,
    `esperava ~${esperado}, veio ${valor}`,
  );

test("IMC: 70 kg e 1,75 m dão 22,86", () => {
  perto(imc(70, 1.75), 22.857, 0.001);
});

test("IMC sem altura não inventa resultado", () => {
  assert.equal(imc(70, 0), null);
  assert.equal(imc(0, 1.7), null);
});

test("Pollock 3 dobras, mulher: soma 60 mm, 30 anos", () => {
  // 1.0994921 − 0.0009929(60) + 0.0000023(3600) − 0.0001392(30)
  // = 1.0994921 − 0.059574 + 0.00828 − 0.004176 = 1.0440221
  perto(densidadePollock3(60, 30, "feminino"), 1.044022, 0.000001);
});

test("Pollock 3 dobras, homem: soma 60 mm, 30 anos", () => {
  // 1.10938 − 0.0008267(60) + 0.0000016(3600) − 0.0002574(30)
  // = 1.10938 − 0.049602 + 0.00576 − 0.007722 = 1.057816
  perto(densidadePollock3(60, 30, "masculino"), 1.057816, 0.000001);
});

test("Pollock 7 dobras, homem: soma 100 mm, 35 anos", () => {
  // 1.112 − 0.00043499(100) + 0.00000055(10000) − 0.00028826(35)
  // = 1.112 − 0.043499 + 0.0055 − 0.0100891 = 1.0639119
  perto(densidadePollock7(100, 35, "masculino"), 1.063912, 0.000001);
});

test("Durnin & Womersley troca de coeficiente conforme a idade", () => {
  // Mulher de 25 anos usa a faixa 20-29: c = 1.1599, m = 0.0717.
  // log10(50) = 1.6989700 → 1.1599 − 0.0717 × 1.6989700 = 1.0380839
  perto(densidadeDurnin(50, 25, "feminino"), 1.0380839, 0.000001);

  // Aos 35 a faixa muda (c = 1.1423, m = 0.0632) e o resultado tem de mudar.
  assert.notEqual(densidadeDurnin(50, 25, "feminino"), densidadeDurnin(50, 35, "feminino"));
});

test("Siri converte densidade em percentual", () => {
  // 495 / 1.05 − 450 = 21.4285…
  perto(siri(1.05), 21.4286, 0.0001);
});

test("Faulkner: soma 60 mm dá 14,96%", () => {
  // 60 × 0,153 + 5,783 = 14,963
  perto(faulkner(60), 14.963, 0.001);
});

test("massa gorda e massa magra fecham com o peso", () => {
  const gorda = massaGorda(80, 20);
  const magra = massaMagra(80, 20);
  perto(gorda, 16, 0.001);
  perto(magra, 64, 0.001);
  perto(gorda + magra, 80, 0.001);
});

test("Mifflin-St Jeor nos dois sexos", () => {
  // Homem 80 kg, 180 cm, 30 anos: 800 + 1125 − 150 + 5 = 1780
  perto(mifflin(80, 180, 30, "masculino"), 1780, 0.001);
  // Mulher 60 kg, 165 cm, 30 anos: 600 + 1031.25 − 150 − 161 = 1320.25
  perto(mifflin(60, 165, 30, "feminino"), 1320.25, 0.001);
});

test("Harris-Benedict revisada nos dois sexos", () => {
  // Homem 80 kg, 180 cm, 30: 88.362 + 1071.76 + 863.82 − 170.31 = 1853.632
  perto(harrisBenedict(80, 180, 30, "masculino"), 1853.632, 0.01);
  // Mulher 60 kg, 165 cm, 30: 447.593 + 554.82 + 511.17 − 129.9 = 1383.683
  perto(harrisBenedict(60, 165, 30, "feminino"), 1383.683, 0.01);
});

test("Cunningham parte da massa magra", () => {
  // 500 + 22 × 55 = 1710
  perto(cunningham(55), 1710, 0.001);
});

test("regra de três da TACO: 150 g de um alimento de 128 kcal/100 g", () => {
  perto(porGramas(128, 150), 192, 0.001);
  perto(porGramas(2.5, 150), 3.75, 0.001);
});

test("valor ausente na TACO não vira zero", () => {
  assert.equal(porGramas(null, 150), null);
  assert.equal(porGramas(undefined, 150), null);
});

test("a soma avisa quantos valores faltaram em vez de fingir zero", () => {
  assert.deepEqual(somar([10, 20, null, 30]), { total: 60, faltando: 1 });
  assert.deepEqual(somar([null, null]), { total: 0, faltando: 2 });
  assert.deepEqual(somar([]), { total: 0, faltando: 0 });
});

test("distribuição de macros em percentual das calorias", () => {
  // 200 g carbo = 800 kcal, 150 g ptn = 600, 50 g lip = 450. Total 1850.
  const d = distribuicao(200, 150, 50);
  perto(d.kcal, 1850, 0.001);
  perto(d.carboidrato, 43.24, 0.01);
  perto(d.proteina, 32.43, 0.01);
  perto(d.lipideo, 24.32, 0.01);
  perto(d.carboidrato + d.proteina + d.lipideo, 100, 0.001);
});

test("gramas por quilo de peso", () => {
  perto(porQuilo(120, 60), 2, 0.001);
  assert.equal(porQuilo(120, 0), null);
});
