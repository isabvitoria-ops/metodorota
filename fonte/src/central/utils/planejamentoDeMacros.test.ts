import { test } from "node:test";
import assert from "node:assert/strict";
import {
  conferirFaixas,
  macrosPorPercentual,
  mensagemDaSoma,
  metaDePeso,
  percentuaisDosGramas,
  regraDeBolso,
} from "./planejamentoDeMacros";

test("2000 kcal em 50/30/20: os mesmos números da ferramenta (250 g, 150 g, 44 g)", () => {
  const r = macrosPorPercentual(2000, { carboidrato: 50, proteina: 30, lipideo: 20 }, null)!;
  assert.equal(r.carboidrato.gramas, 250);
  assert.equal(r.carboidrato.kcal, 1000);
  assert.equal(r.proteina.gramas, 150);
  assert.equal(r.proteina.kcal, 600);
  assert.equal(Math.round(r.lipideo.gramas), 44);
  assert.equal(r.lipideo.kcal, 400);
  assert.equal(r.proteina.porQuilo, null);
});

test("g/kg sai do peso quando ele existe", () => {
  const r = macrosPorPercentual(2000, { carboidrato: 50, proteina: 30, lipideo: 20 }, 75)!;
  assert.equal(r.proteina.porQuilo, 2);
});

test("sem calorias não há divisão", () => {
  assert.equal(macrosPorPercentual(null, { carboidrato: 50, proteina: 30, lipideo: 20 }, 70), null);
  assert.equal(macrosPorPercentual(0, { carboidrato: 50, proteina: 30, lipideo: 20 }, 70), null);
});

test("frase da soma: fechado, falta e sobra no singular e no plural", () => {
  assert.deepEqual(mensagemDaSoma({ carboidrato: 50, proteina: 30, lipideo: 20 }), { fechado: true, texto: "Soma 100% — fechado." });
  assert.equal(mensagemDaSoma({ carboidrato: 50, proteina: 30, lipideo: 0 }).texto, "Soma 80%. Faltam 20 pontos para fechar 100%.");
  assert.equal(mensagemDaSoma({ carboidrato: 50, proteina: 30, lipideo: 19 }).texto, "Soma 99%. Falta 1 ponto para fechar 100%.");
  assert.equal(mensagemDaSoma({ carboidrato: 50, proteina: 30, lipideo: 22 }).texto, "Soma 102%. Sobram 2 pontos para fechar 100%.");
});

test("faixas da Tabela 29 (CEPRAN/UNESP): 50/30/20 como na tela da ferramenta", () => {
  const [dri, who, sban] = conferirFaixas({ carboidrato: 50, proteina: 30, lipideo: 20 });
  assert.deepEqual(dri!.itens.map((i) => i.dentro), [true, true, true]);
  assert.deepEqual(who!.itens.map((i) => i.dentro), [false, false, true]);
  assert.deepEqual(sban!.itens.map((i) => i.dentro), [false, false, true]);
  assert.equal(who!.rotulo, "WHO (2003)");
});

test("regra de bolso: 70 kg dá 1.400–1.750 para perder e 2.100–2.450 para ganhar", () => {
  assert.deepEqual(regraDeBolso(70), { perda: [1400, 1750], ganho: [2100, 2450] });
  assert.equal(regraDeBolso(null), null);
});

test("meta de peso: (atual − desejado) × 7700 ÷ dias, e ritmo por semana", () => {
  const m = metaDePeso(70, 67, 60)!;
  assert.equal(Math.round(m.venta), 385);
  assert.equal(Math.round(m.kgPorSemana * 100) / 100, 0.35);
  assert.equal(m.ritmoAlto, false);
  const ganho = metaDePeso(60, 62, 70)!;
  assert.ok(ganho.venta < 0);
});

test("meta de peso: prazo curto demais avisa; valores negativos ou vazios não fazem conta", () => {
  assert.equal(metaDePeso(80, 70, 3)!.ritmoAlto, true);
  assert.equal(metaDePeso(70, 67, -30), null);
  assert.equal(metaDePeso(70, null, 30), null);
});

test("percentuais a partir dos gramas fecham 100", () => {
  const p = percentuaisDosGramas(112.3, 56.2, 209)!;
  assert.equal(p.carboidrato + p.proteina + p.lipideo, 100);
  assert.equal(p.proteina, 25);
  assert.equal(percentuaisDosGramas(null, 50, 200), null);
});
