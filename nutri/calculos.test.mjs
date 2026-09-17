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

// ---------------------------------------------------------------------------
// O que entrou depois dos prints que ela mandou
// ---------------------------------------------------------------------------

test("Brozek converte densidade em percentual", async () => {
  const { brozek } = await import("./calculos.mjs");
  // (4,57 / 1,05 − 4,142) × 100 = 21,0381
  perto(brozek(1.05), 21.0381, 0.0001);
});

test("relação cintura/quadril e os cortes da OMS", async () => {
  const { relacaoCinturaQuadril, riscoRCQ } = await import("./calculos.mjs");
  // 61 / 87 = 0,7011 — é o caso real do PDF que ela mandou, que deu 0,70.
  perto(relacaoCinturaQuadril(61, 87), 0.7011, 0.0001);
  assert.equal(riscoRCQ(0.7011, "feminino"), "Baixo risco");
  assert.equal(riscoRCQ(0.86, "feminino"), "Risco aumentado");
  assert.equal(riscoRCQ(0.86, "masculino"), "Baixo risco");
  assert.equal(riscoRCQ(0.91, "masculino"), "Risco aumentado");
});

test("cintura: 80 cm na mulher, 94 no homem", async () => {
  const { riscoCintura } = await import("./calculos.mjs");
  assert.equal(riscoCintura(61, "feminino"), "Adequada");
  assert.equal(riscoCintura(81, "feminino"), "Aumentada");
  assert.equal(riscoCintura(93, "masculino"), "Adequada");
});

test("classificação do IMC pela OMS", async () => {
  const { classificarIMC } = await import("./calculos.mjs");
  assert.equal(classificarIMC(18.4), "Baixo peso");
  assert.equal(classificarIMC(18.9), "Eutrófico"); // o caso do PDF dela
  assert.equal(classificarIMC(27), "Sobrepeso");
  assert.equal(classificarIMC(32), "Obesidade grau I");
  assert.equal(classificarIMC(41), "Obesidade grau III");
});

test("peso ideal bate com o PDF dela: 1,59 m dá 46,5 a 62,6 kg", async () => {
  const { pesoIdeal } = await import("./calculos.mjs");
  const faixa = pesoIdeal(1.59);
  perto(faixa.minimo, 46.77, 0.05);
  perto(faixa.maximo, 62.95, 0.05);
});

test("macros por percentual batem com o print: 2000 kcal em 50/30/20", async () => {
  const { macrosPorPercentual } = await import("./calculos.mjs");
  const r = macrosPorPercentual(2000, { carboidrato: 50, proteina: 30, lipideo: 20 }, 70);
  perto(r.carboidrato.kcal, 1000, 0.001);
  perto(r.carboidrato.gramas, 250, 0.001);
  perto(r.proteina.gramas, 150, 0.001);
  perto(r.lipideo.gramas, 44.44, 0.01);
  perto(r.proteina.porQuilo, 2.14, 0.01);
});

test("VENTA: perder 2 kg em 30 dias pede 513 kcal a menos por dia", async () => {
  const { venta } = await import("./calculos.mjs");
  // (77 − 75) × 7700 / 30 = 513,33
  perto(venta(77, 75, 30), 513.33, 0.01);
  // Ganhar peso devolve negativo: o consumo sobe.
  assert.ok(venta(75, 77, 30) < 0);
});
