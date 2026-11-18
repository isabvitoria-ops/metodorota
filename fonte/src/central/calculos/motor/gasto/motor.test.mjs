import test from "node:test";
import assert from "node:assert/strict";
import { EQUACOES, CATEGORIAS, equacaoPorId } from "./equacoes.mjs";
import { calcularGasto, compararEquacoes, FA_SEDENTARIO } from "./gasto.mjs";
import { kcalDeAtividade, totalDeAtividades } from "./met.mjs";
import { avisosDaEquacao, avisosDoResultado, imc } from "./guardas.mjs";
import { fmt, linear } from "./formato.mjs";

/**
 * Os VALORES ESPERADOS abaixo foram recalculados à mão, por fora do código
 * (cada conta está escrita ao lado). Onde o DietSystem diverge da conta
 * correta, o teste segue a conta correta.
 */
const perto = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `esperado ${b}, veio ${a}`);

const MULHER_21 = { sexo: "feminino", idade: 21, peso: 90, alturaCm: 178, massaMagra: 50.5 };

test("Mifflin: mulher 21 a, 77,05 kg, 158 cm = 1492; ×1,55 = 2312,6 (spec)", () => {
  // 10×77,05 + 6,25×158 − 5×21 − 161 = 770,5 + 987,5 − 105 − 161
  const r = calcularGasto("mifflin", { sexo: "feminino", idade: 21, peso: 77.05, alturaCm: 158 }, { modo: "fa", fa: 1.55 });
  perto(r.geb, 1492);
  perto(r.get, 2312.6);
  assert.match(r.passos[1].texto, /1\.492/);
});

test("Harris-Benedict 1984: mulher 21 a, 90 kg, 178 cm = 1740,34; ×1,55×1,10 = 2967 (spec)", () => {
  // 447,593 + 9,247×90 + 3,098×178 − 4,33×21 = 447,593 + 832,23 + 551,444 − 90,93
  const r = calcularGasto("hb1984", MULHER_21, { modo: "fa", fa: 1 });
  perto(r.geb, 1740.337);
  perto(1740.337 * 1.55 * 1.1, 2967, 1);
});

test("Harris-Benedict 1919, mulher: 655,0955 + 9,5634×90 + 1,8496×178 − 4,6756×21 = 1746,84", () => {
  perto(calcularGasto("hb1919", MULHER_21).geb, 1746.8427);
});

test("DRI 2023 19+: mulher 21 a, 90 kg, 178 cm, pouco ativo = 2695,96 (spec)", () => {
  // 575,77 − 7,01×21 + 6,60×178 + 12,14×90 = 575,77 − 147,21 + 1174,8 + 1092,6
  const r = calcularGasto("dri2023_19", MULHER_21, { modo: "fa", pa: "pouco_ativo" });
  perto(r.geb, 2695.96);
  assert.equal(r.fator, null, "o nível já está dentro da fórmula: sem multiplicar de novo");
  perto(r.get, 2695.96);
});

test("EER/IOM adulto: mulher 21 a, 90 kg, 178 cm, PA 1,12 = 2599,7 (spec)", () => {
  // 354 − 6,91×21 + 1,12×(9,36×90 + 726×1,78) = 208,89 + 1,12×2134,68
  const r = calcularGasto("eer_adulto", MULHER_21, { modo: "fa", pa: "pouco_ativo" });
  perto(r.geb, 2599.7, 0.1);
});

test("EER/IOM adulto, homem: 662 − 9,53×30 + 1,25×(15,91×80 + 539,6×1,80) (PA ativo)", () => {
  // 662 − 285,9 + 1,25×(1272,8 + 971,28) = 376,1 + 1,25×2244,08 = 376,1 + 2805,1
  const r = calcularGasto("eer_adulto", { sexo: "masculino", idade: 30, peso: 80, alturaCm: 180 }, { modo: "fa", pa: "ativo" });
  perto(r.geb, 3181.2, 0.05);
});

test("DRI 2023 3 a 18: menina 15 a, 55 kg, 160 cm, pouco ativo", () => {
  // −297,54 − 22,25×15 + 12,77×160 + 14,73×55 = −297,54 − 333,75 + 2043,2 + 810,15
  const r = calcularGasto("dri2023_3_18", { sexo: "feminino", idade: 15, peso: 55, alturaCm: 160 }, { modo: "fa", pa: "pouco_ativo" });
  perto(r.geb, 2222.06);
});

test("Schofield: mulher 21 a, 90 kg = 14,818×90 + 486,6 = 1820,22", () => {
  perto(calcularGasto("schofield", MULHER_21).geb, 1820.22);
});

test("Schofield: fronteiras de idade usam a faixa de cima; homem 40 a, 80 kg = 11,472×80 + 873,1", () => {
  perto(calcularGasto("schofield", { sexo: "masculino", idade: 40, peso: 80 }).geb, 11.472 * 80 + 873.1);
  perto(calcularGasto("schofield", { sexo: "masculino", idade: 18, peso: 70 }).geb, 15.057 * 70 + 692.2);
  perto(calcularGasto("schofield", { sexo: "masculino", idade: 2, peso: 12 }).geb, 59.512 * 12 - 30.4);
});

test("Henry & Rees: mulher 21 a, 90 kg = (0,047×90 + 2,57)×239 = 1625,2; homem 40 a, 80 kg = 1634,76", () => {
  perto(calcularGasto("henry_rees", MULHER_21).geb, 1625.2);
  perto(calcularGasto("henry_rees", { sexo: "masculino", idade: 40, peso: 80 }).geb, 1634.76);
});

test("Atletas: Cunningham, Katch-McArdle, Tinsley (MM 50,5 kg / peso 90 kg)", () => {
  perto(calcularGasto("cunningham", MULHER_21).geb, 500 + 22 * 50.5); // 1611
  perto(calcularGasto("katch_mcardle", MULHER_21).geb, 370 + 21.6 * 50.5); // 1460,8
  perto(calcularGasto("tinsley_mm", MULHER_21).geb, 25.9 * 50.5 + 284); // 1591,95
  perto(calcularGasto("tinsley_peso", MULHER_21).geb, 24.8 * 90 + 10); // 2242
});

test("Ten Haaf: a conta em kcal bate com a do artigo em kJ ÷ 4,184 (conferência independente)", () => {
  // Artigo (kJ/dia): peso: 49,940P + 2459,053E_m − 34,014I + 799,257S + 122,502 | MM: 95,272MM + 2026,161
  const kjPeso = 49.94 * 90 + 2459.053 * 1.78 - 34.014 * 21 + 799.257 * 0 + 122.502;
  perto(calcularGasto("tenhaaf_peso", MULHER_21).geb, kjPeso / 4.184, 0.05);
  const kjMM = 95.272 * 50.5 + 2026.161;
  perto(calcularGasto("tenhaaf_mm", MULHER_21).geb, kjMM / 4.184, 0.05);
  // homem (S = 1)
  const h = { sexo: "masculino", idade: 25, peso: 75, alturaCm: 180, massaMagra: 65 };
  const kjH = 49.94 * 75 + 2459.053 * 1.8 - 34.014 * 25 + 799.257 + 122.502;
  perto(calcularGasto("tenhaaf_peso", h).geb, kjH / 4.184, 0.05);
});

test("Obesidade: Horie = 560,43 + 5,39×90 + 14,14×50,5 = 1759,6; IOM obesidade, mulher PA 1,16 = 2749,32", () => {
  perto(calcularGasto("horie_waitzberg", MULHER_21).geb, 1759.6);
  // 448 − 7,95×21 + 1,16×(11,4×90 + 619×1,78)
  perto(calcularGasto("iom_obesidade", MULHER_21, { modo: "fa", pa: "pouco_ativo" }).geb, 2749.317, 0.01);
});

test("MET: 8, 77,05 kg, 60 min, 3×/semana → bruto 264,2; líquido (MET−1) 231,2 (spec)", () => {
  const base = { met: 8, pesoKg: 77.05, minutos: 60, vezesPorSemana: 3 };
  perto(kcalDeAtividade({ ...base, liquido: false }), 264.2, 0.05);
  perto(kcalDeAtividade(base), 7 * 77.05 * (3 / 7), 0.01); // 231,15
  assert.equal(kcalDeAtividade({ ...base, met: 0 }), null);
  assert.equal(kcalDeAtividade({ ...base, met: 1 }), 0, "1 MET é o repouso: líquido zero");
  assert.equal(kcalDeAtividade({ ...base, minutos: -5 }), null);
});

test("FA e MET NÃO se somam: no modo MET a base é sedentária (1,2), sem o fator escolhido", () => {
  const e = { sexo: "feminino", idade: 21, peso: 77.05, alturaCm: 158 };
  const exercicios = [{ nome: "Corrida", met: 8, minutos: 60, vezes: 3 }];
  const fa = calcularGasto("mifflin", e, { modo: "fa", fa: 1.9, exercicios });
  const met = calcularGasto("mifflin", e, { modo: "met", fa: 1.9, exercicios });
  perto(fa.get, 1492 * 1.9, 0.01);
  assert.equal(fa.kcalMet, 0, "no modo FA o exercício NÃO entra por MET");
  perto(met.get, 1492 * FA_SEDENTARIO + 7 * 77.05 * (3 / 7), 0.01);
  assert.equal(met.fator, FA_SEDENTARIO, "o 1,9 escolhido é ignorado no modo MET");
});

test("Equação que já é TEE: o modo MET usa o nível sedentário da fórmula e soma o exercício", () => {
  const exercicios = [{ nome: "Natação", met: 6, minutos: 45, vezes: 4 }];
  const r = calcularGasto("dri2023_19", MULHER_21, { modo: "met", pa: "muito_ativo", exercicios });
  // sedentário: 584,90 − 7,01×21 + 5,72×178 + 11,71×90 = 584,9 − 147,21 + 1018,16 + 1053,9
  perto(r.geb, 2509.75, 0.01);
  perto(r.kcalMet, 5 * 90 * 0.75 * (4 / 7), 0.01);
});

test("o que a spec não expõe NÃO calcula e diz por quê (não se inventa coeficiente)", () => {
  for (const id of ["dri2023_0_2", "dri2023_lact1_14", "dri2023_lact2_14", "gestante_14_19"]) {
    const r = calcularGasto(id, MULHER_21);
    assert.equal(r.ok, false);
    assert.equal(r.aguardando, true);
    assert.match(r.motivo, /tabela|fórmula/i);
  }
});

test("entrada faltando não vira zero: devolve o que falta", () => {
  const r = calcularGasto("mifflin", { sexo: "feminino", idade: 21, peso: 70 });
  assert.equal(r.ok, false);
  assert.deepEqual(r.faltando, ["altura"]);
  assert.equal(calcularGasto("cunningham", { peso: 70 }).ok, false);
});

test("guardas: idade e IMC fora da validade avisam, sem bloquear", () => {
  const mif = equacaoPorId("mifflin");
  assert.equal(avisosDaEquacao(mif, { idade: 15, peso: 60, alturaCm: 165 }).length, 1);
  assert.equal(avisosDaEquacao(mif, { idade: 30, peso: 60, alturaCm: 165 }).length, 0);
  const obeso = avisosDaEquacao(mif, { idade: 30, peso: 130, alturaCm: 165 }); // IMC 47,8
  assert.ok(obeso.some((a) => /IMC/.test(a)));
  const r = calcularGasto("mifflin", { sexo: "feminino", idade: 15, peso: 60, alturaCm: 165 });
  assert.equal(r.ok, true, "avisa, mas calcula");
  assert.ok(r.avisos.length > 0);
  perto(imc(90, 178), 28.4, 0.05);
});

test("resultado absurdo nunca sai sem aviso", () => {
  assert.equal(avisosDoResultado(2000).length, 0);
  assert.equal(avisosDoResultado(200).length, 1);
  assert.equal(avisosDoResultado(9000).length, 1);
});

test("a explicação usa os MESMOS números da conta (fórmula, substituição e resultado)", () => {
  const r = calcularGasto("mifflin", { sexo: "feminino", idade: 21, peso: 77.05, alturaCm: 158 }, { modo: "fa", fa: 1.55 });
  assert.equal(r.passos[0].texto, "GEB = 10×P + 6,25×E − 5×I − 161");
  assert.equal(r.passos[1].texto, "GEB = 10×77,05 + 6,25×158 − 5×21 − 161 = 1.492 kcal");
});

test("catálogo: cada equação tem fonte e status; as que calculam têm função", () => {
  const ids = new Set();
  for (const e of EQUACOES) {
    assert.ok(!ids.has(e.id), `id repetido: ${e.id}`);
    ids.add(e.id);
    assert.ok(e.nome && e.fonte && e.categoria, e.id);
    assert.ok(CATEGORIAS.some((c) => c.chave === e.categoria), `categoria desconhecida em ${e.id}`);
    assert.ok(["em_vistoria", "aguardando_fonte"].includes(e.status), e.id);
    if (e.status === "em_vistoria") assert.equal(typeof e.calcular, "function", e.id);
    else assert.ok(e.motivo, e.id);
  }
  // Geral = 12 equações, como na spec (4 delas aguardando fonte).
  assert.equal(EQUACOES.filter((e) => e.categoria === "geral").length, 12);
  assert.equal(EQUACOES.filter((e) => e.categoria === "atletas").length, 6);
});

test("compararEquacoes devolve só as que calculam, para a tabela de comparação", () => {
  const lista = compararEquacoes(MULHER_21, { modo: "fa", fa: 1.55, pa: "pouco_ativo" });
  assert.ok(lista.length >= 10);
  assert.ok(lista.every((x) => x.resultado.ok));
});

test("formato: vírgula decimal e sem zeros sobrando; linear() monta fórmula e substituição juntas", () => {
  assert.equal(fmt(6.25), "6,25");
  assert.equal(fmt(10), "10");
  assert.equal(fmt(null), "—");
  const r = linear(5, [[10, "P", 2], [-3, "I", 4]]);
  assert.equal(r.valor, 13);
  assert.equal(r.formula, "5 + 10×P − 3×I");
  assert.equal(r.substituicao, "5 + 10×2 − 3×4");
});

// --- Lista de METs (planilha da nutricionista, 602 itens) -----------------------------------
import { ATIVIDADES_MET } from "./met-dados.mjs";
import { buscarAtividade, metPeloNome, kcalDeAtividade as kcalMet } from "./met.mjs";

test("lista de METs: 602 itens, números 1..602, METs entre 0,9 e 18, nomes sem repetição", () => {
  assert.equal(ATIVIDADES_MET.length, 602);
  assert.deepEqual(ATIVIDADES_MET.map((l) => l[0]), Array.from({ length: 602 }, (_, i) => i + 1));
  assert.ok(ATIVIDADES_MET.every((l) => l[2] >= 0.9 && l[2] <= 18 && typeof l[1] === "string" && l[1].length > 3));
  assert.equal(new Set(ATIVIDADES_MET.map((l) => l[1])).size, 602);
});

test("lista de METs: pontas conferidas contra a planilha", () => {
  assert.deepEqual(ATIVIDADES_MET[0], [1, "Pular corda, velocidade moderada, geral", 10]);
  assert.equal(ATIVIDADES_MET[601][2], 3);
  assert.equal(metPeloNome("Ciclismo, BMX ou montanha", ATIVIDADES_MET), 8.5);
});

test("busca de atividade: sem acento, sem caixa, palavras em qualquer ordem", () => {
  const a = buscarAtividade("CICLISMO estacionario 100", ATIVIDADES_MET);
  assert.ok(a.length >= 1 && a.every((x) => /estacion/i.test(x.nome.normalize("NFD").replace(/[̀-ͯ]/g, ""))));
  assert.equal(a[0].met, 5.5);
  assert.deepEqual(buscarAtividade("   ", ATIVIDADES_MET), []);
  assert.deepEqual(buscarAtividade("zzzxxyy", ATIVIDADES_MET), []);
});

test("spec: pular corda rápida (MET 12), 70 kg, 60 min x 3/sem = 360 kcal/dia pela conta BRUTA", () => {
  assert.equal(Math.round(kcalMet({ met: 12, pesoKg: 70, minutos: 60, vezesPorSemana: 3, liquido: false })), 360);
  assert.equal(Math.round(kcalMet({ met: 12, pesoKg: 70, minutos: 60, vezesPorSemana: 3 })), 330);
});

// --- Etapa 2: IOM infantil, gestantes, lactantes, Bolso ----------------------------------------
import { regraDeBolso } from "./bolso.mjs";
import { trimestreDa, deposicaoPorImc } from "./equacoes.mjs";

const MULHER = { sexo: "feminino", idade: 22, peso: 70, alturaCm: 170 };
const arred = (x) => Math.round(x);

test("catálogo: 28 equações, só 4 aguardando fonte (nenhuma inventada)", () => {
  assert.equal(EQUACOES.length, 28);
  assert.deepEqual(
    EQUACOES.filter((e) => e.status === "aguardando_fonte").map((e) => e.id).sort(),
    ["dri2023_0_2", "dri2023_lact1_14", "dri2023_lact2_14", "gestante_14_19"],
  );
});

test("vetor DietSystem: EER/IOM 9-18, menina, PA 1,00 = 1.771 kcal", () => {
  const r = calcularGasto("eer_9_18", MULHER, { pa: "sedentario" });
  assert.equal(arred(r.get), 1771);
});

test("EER 3-8 anos usa +20 e 9-18 usa +25; PA da menina 1,16 / menino 1,13 no pouco ativo", () => {
  const menina = { sexo: "feminino", idade: 6, peso: 20, alturaCm: 115 };
  const sed = calcularGasto("dri2005_3_8", menina, { pa: "sedentario" }).get;
  assert.equal(arred(sed), arred(135.3 - 30.8 * 6 + (10 * 20 + 934 * 1.15) + 20));
  const pouco = calcularGasto("dri2005_3_8", menina, { pa: "pouco_ativo" }).get;
  assert.equal(arred(pouco), arred(135.3 - 30.8 * 6 + 1.16 * (10 * 20 + 934 * 1.15) + 20));
  const menino = { sexo: "masculino", idade: 12, peso: 40, alturaCm: 150 };
  const m = calcularGasto("eer_9_18", menino, { pa: "pouco_ativo" }).get;
  assert.equal(arred(m), arred(88.5 - 61.9 * 12 + 1.13 * (26.7 * 40 + 903 * 1.5) + 25));
});

test("DRI 2005 0-3 anos: acréscimo por faixa de meses e exigência da idade em meses", () => {
  const conta = (meses) => calcularGasto("dri2005_0_3", { peso: 6, idadeMeses: meses }, {}).get;
  assert.equal(conta(2), 89 * 6 - 100 + 175);
  assert.equal(conta(5), 89 * 6 - 100 + 56);
  assert.equal(conta(10), 89 * 6 - 100 + 22);
  assert.equal(conta(20), 89 * 6 - 100 + 20);
  const sem = calcularGasto("dri2005_0_3", { peso: 6 }, {});
  assert.equal(sem.ok, false);
});

test("vetor DietSystem: gestante 19+ (IOM), PA 1,00: 2.091 / 2.431 / 2.543 por trimestre", () => {
  const por = (sg) => arred(calcularGasto("gestante_19", { ...MULHER, semanaGestacional: sg }, { pa: "sedentario" }).get);
  assert.equal(por(8), 2091);
  assert.equal(por(20), 2431);
  assert.equal(por(30), 2543);
  assert.deepEqual([trimestreDa(13), trimestreDa(14), trimestreDa(27), trimestreDa(28)], [1, 2, 2, 3]);
});

test("vetor DietSystem: lactante NASEM inativa, 1º semestre 2.623 e 2º semestre 2.603", () => {
  assert.equal(arred(calcularGasto("dri2023_lact1_19", MULHER, { pa: "sedentario" }).get), 2623);
  assert.equal(arred(calcularGasto("dri2023_lact2_19", MULHER, { pa: "sedentario" }).get), 2603);
});

test("DRI 2023 gestante: fórmula do nível + 9,16×SG + deposição pelo IMC pré-gestacional", () => {
  const base = 1131.2 - 2.04 * 22 + 0.34 * 170 + 12.15 * 70 + 9.16 * 20;
  const r = calcularGasto("dri2023_gestante", { ...MULHER, semanaGestacional: 20 }, { pa: "sedentario" });
  assert.ok(Math.abs(r.get - (base + 200)) < 0.01); // IMC 24,2 = eutrófica = +200
  // Com peso pré-gestacional de obesa (95 kg, IMC 32,9): -50
  const ob = calcularGasto("dri2023_gestante", { ...MULHER, semanaGestacional: 20, pesoPreGestacional: 95 }, { pa: "sedentario" });
  assert.ok(Math.abs(ob.get - (base - 50)) < 0.01);
  assert.deepEqual([18.4, 18.5, 24.9, 25, 29.9, 30].map((i) => deposicaoPorImc(i).kcal), [300, 200, 200, 150, 150, -50]);
  // 1º trimestre: a fórmula não cobre, e diz o que fazer
  const primeiro = calcularGasto("dri2023_gestante", { ...MULHER, semanaGestacional: 8 }, {});
  assert.equal(primeiro.ok, false);
  assert.match(primeiro.motivo, /1º trimestre/);
});

test("equações aguardando fonte continuam sem calcular, e dizem por quê", () => {
  const r = calcularGasto("gestante_14_19", { ...MULHER, idade: 17, semanaGestacional: 20 }, {});
  assert.equal(r.ok, false);
  assert.equal(r.aguardando, true);
});

test("regra de bolso: 70 kg = 1.400–1.750 (perder) e 2.100–2.450 (ganhar)", () => {
  assert.deepEqual(regraDeBolso(70), { perda: [1400, 1750], ganho: [2100, 2450] });
  assert.equal(regraDeBolso(0), null);
});
