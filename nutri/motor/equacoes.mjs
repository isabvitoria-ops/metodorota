import { fmt, linear } from "./formato.mjs";

/**
 * O catálogo de equações de gasto energético — DADOS, não lógica espalhada.
 *
 * Cada equação é um registro: quem é, para quem vale, o que pede, o que
 * devolve e de onde vem. A tela só LÊ este catálogo; nenhuma fórmula mora na
 * interface.
 *
 * `resultado`:
 *   'geb' — a fórmula devolve o gasto basal; o total sai multiplicando por um
 *           fator de atividade (GET = GEB × FA);
 *   'get' — a fórmula JÁ devolve o gasto total (TEE/EER) e o nível de
 *           atividade (`pa`) entra DENTRO dela. Multiplicar de novo contaria a
 *           atividade duas vezes.
 *
 * `status`:
 *   'em_vistoria'      — implementada; coeficientes vêm da spec do DietSystem e
 *                        de conferências marcadas em `conferida`. Nada é
 *                        "validado" até ela marcar no CHANGELOG-VISTORIA.
 *   'aguardando_fonte' — a fórmula NÃO foi exposta pela spec e não foi possível
 *                        buscá-la na fonte primária. Fica listada, mas não
 *                        calcula. Não se inventa coeficiente.
 *
 * `conferida`: o que foi conferido contra a fonte primária (PubMed) e como.
 */

export const NIVEIS = {
  sedentario: "Sedentário",
  pouco_ativo: "Pouco ativo",
  ativo: "Ativo",
  muito_ativo: "Muito ativo",
};

const mulher = (e) => e.sexo === "feminino";

/** Níveis de atividade da DRI 2023 (nomes da própria tabela). */
const NIVEIS_DRI2023 = [
  { chave: "sedentario", rotulo: "Inativo" },
  { chave: "pouco_ativo", rotulo: "Pouco ativo" },
  { chave: "ativo", rotulo: "Ativo" },
  { chave: "muito_ativo", rotulo: "Muito ativo" },
];

const NIVEIS_IOM = [
  { chave: "sedentario", rotulo: "Sedentário (PA 1,00)" },
  { chave: "pouco_ativo", rotulo: "Pouco ativo" },
  { chave: "ativo", rotulo: "Ativo" },
  { chave: "muito_ativo", rotulo: "Muito ativo" },
];

// ---- DRI 2023 (NASEM), 19+ anos: o fator de atividade já está na fórmula ----
const DRI2023_ADULTO = {
  masculino: {
    sedentario: [753.07, 6.5, 14.1],
    pouco_ativo: [581.47, 8.3, 14.94],
    ativo: [1004.82, 6.52, 15.91],
    muito_ativo: [-517.88, 15.61, 19.11],
  },
  feminino: {
    sedentario: [584.9, 5.72, 11.71],
    pouco_ativo: [575.77, 6.6, 12.14],
    ativo: [710.25, 6.54, 12.34],
    muito_ativo: [511.83, 9.07, 12.56],
  },
  idadeCoef: { masculino: -10.83, feminino: -7.01 },
};

// ---- DRI 2023 (NASEM), 3 a 18 anos ----
const DRI2023_CRIANCA = {
  masculino: {
    idadeCoef: 3.68,
    sedentario: [-447.51, 13.01, 13.15],
    pouco_ativo: [19.12, 8.62, 20.28],
    ativo: [-388.19, 12.66, 20.46],
    muito_ativo: [-671.75, 15.38, 23.25],
  },
  feminino: {
    idadeCoef: -22.25,
    sedentario: [55.59, 8.43, 17.07],
    pouco_ativo: [-297.54, 12.77, 14.73],
    ativo: [-189.55, 11.74, 18.34],
    muito_ativo: [-709.59, 18.22, 14.25],
  },
};

// ---- Schofield (1985): só o peso; a faixa de idade escolhe o par ----
// [idade a partir de (inclusive), coeficiente do peso, constante]
const SCHOFIELD = {
  masculino: [
    [0, 59.512, -30.4],
    [3, 22.706, 504.3],
    [10, 17.686, 658.2],
    [18, 15.057, 692.2],
    [30, 11.472, 873.1],
    [60, 11.711, 587.7],
  ],
  feminino: [
    [0, 58.317, -31.1],
    [3, 20.315, 485.9],
    [10, 13.384, 692.6],
    [18, 14.818, 486.6],
    [30, 8.126, 845.6],
    [60, 9.082, 658.5],
  ],
};

/** O mesmo texto de PA para o painel "Como este cálculo é feito". */
const rotuloNivel = (lista, chave) => lista.find((n) => n.chave === chave)?.rotulo ?? chave;

// ---- EER/IOM 2005 de crianças e adolescentes (3 a 18 anos) ----
const PA_CRIANCA = {
  masculino: { sedentario: 1.0, pouco_ativo: 1.13, ativo: 1.26, muito_ativo: 1.42 },
  feminino: { sedentario: 1.0, pouco_ativo: 1.16, ativo: 1.31, muito_ativo: 1.56 },
};

/** `crescimento`: kcal de depósito de energia (20 de 3 a 8 anos; 25 de 9 a 18). */
function eerCrianca(e, crescimento) {
  const h = e.sexo === "masculino";
  const pa = PA_CRIANCA[h ? "masculino" : "feminino"][e.pa ?? "sedentario"];
  const m = e.alturaCm / 100;
  const [k, ci, cp, ch] = h ? [88.5, -61.9, 26.7, 903] : [135.3, -30.8, 10.0, 934];
  return {
    valor: k + ci * e.idade + pa * (cp * e.peso + ch * m) + crescimento,
    formula: `EER = ${fmt(k)} − ${fmt(Math.abs(ci))}×I + PA×(${fmt(cp)}×P + ${fmt(ch)}×E_m) + ${crescimento}`,
    substituicao: `EER = ${fmt(k)} − ${fmt(Math.abs(ci))}×${fmt(e.idade)} + ${fmt(pa)}×(${fmt(cp)}×${fmt(e.peso)} + ${fmt(ch)}×${fmt(m)}) + ${crescimento}`,
    extra: { pa },
  };
}

// ---- Gestação e lactação ----
/** Trimestre pela semana gestacional (1º até a 13ª; 2º da 14ª à 27ª; 3º a partir da 28ª). */
export function trimestreDa(semana) {
  return semana < 14 ? 1 : semana < 28 ? 2 : 3;
}

/** Deposição de energia pelo IMC pré-gestacional (DRI 2023). */
export function deposicaoPorImc(imcPre) {
  if (imcPre < 18.5) return { kcal: 300, classe: "baixo peso" };
  if (imcPre < 25) return { kcal: 200, classe: "eutrófica" };
  if (imcPre < 30) return { kcal: 150, classe: "sobrepeso" };
  return { kcal: -50, classe: "obesa" };
}

const DRI2023_GESTANTE = {
  sedentario: [1131.2, 0.34, 12.15],
  pouco_ativo: [693.35, 5.73, 10.2],
  ativo: [-223.84, 13.23, 8.15],
  muito_ativo: [-779.72, 18.45, 8.73],
  idadeCoef: -2.04,
  semanaCoef: 9.16,
};

/** A conta de uma mulher adulta da DRI 2023 (usada pela lactante). */
function dri2023Mulher(e) {
  const [k, ce, cp] = DRI2023_ADULTO.feminino[e.pa ?? "sedentario"];
  return linear(k, [
    [DRI2023_ADULTO.idadeCoef.feminino, "I", e.idade],
    [ce, "E", e.alturaCm],
    [cp, "P", e.peso],
  ]);
}

/** Lactante: a mulher adulta da DRI 2023 + acréscimo do semestre de lactação. */
function lactante(e, acrescimo, rotuloSemestre) {
  const r = dri2023Mulher(e);
  return {
    valor: r.valor + acrescimo,
    formula: `TEE = ${r.formula} + ${acrescimo} (${rotuloSemestre})`,
    substituicao: `TEE = ${r.substituicao} + ${acrescimo}`,
  };
}

export const EQUACOES = [
  // ------------------------------------------------------------------ GERAL
  {
    id: "dri2023_0_2",
    nome: "DRI 2023 - 0 a 2 anos",
    categoria: "geral",
    sexo: "ambos",
    idade: [0, 2],
    entradas: ["peso", "idade"],
    resultado: "get",
    status: "aguardando_fonte",
    motivo:
      "A spec do DietSystem não expõe esta fórmula e as tabelas da NASEM (2023) não estão acessíveis daqui. Envie a tabela da NASEM para implementar.",
    fonte: "NASEM. Dietary Reference Intakes for Energy. 2023.",
  },
  {
    id: "dri2005_0_3",
    nome: "DRI 2005 - 0 a 3 anos",
    categoria: "geral",
    sexo: "ambos",
    idade: [0, 3],
    entradas: ["peso", "idadeMeses"],
    resultado: "get",
    status: "em_vistoria",
    fonte: "IOM. Dietary Reference Intakes for Energy, Carbohydrate, Fiber, Fat, Fatty Acids, Cholesterol, Protein, and Amino Acids. 2005 (EER de 0 a 35 meses).",
    observacao:
      "Pede a idade em MESES. EER = (89×P − 100) + acréscimo de crescimento: 0-3 meses +175; 4-6 +56; 7-12 +22; 13-35 +20. Fórmula da literatura (o DietSystem não a exibe): conferir na fonte antes de uso clínico.",
    validar: (e) => (e.idadeMeses >= 0 && e.idadeMeses < 36 ? null : "Informe a idade em meses (0 a 35) no campo que aparece para esta equação."),
    calcular(e) {
      const m = e.idadeMeses;
      const add = m <= 3 ? 175 : m <= 6 ? 56 : m <= 12 ? 22 : 20;
      return {
        valor: 89 * e.peso - 100 + add,
        formula: `EER = (89×P − 100) + ${add}`,
        substituicao: `EER = (89×${fmt(e.peso)} − 100) + ${add}`,
      };
    },
  },
  {
    id: "dri2023_3_18",
    nome: "DRI 2023 - 3 a 18 anos",
    categoria: "geral",
    sexo: "ambos",
    idade: [3, 18],
    entradas: ["peso", "altura", "idade", "sexo"],
    resultado: "get",
    atividade: { tipo: "pa", niveis: NIVEIS_DRI2023 },
    status: "em_vistoria",
    fonte: "NASEM. Dietary Reference Intakes for Energy. 2023, tabela S-3.",
    observacao:
      "Ajuste de crescimento embutido no intercepto. O nível de atividade já está dentro da fórmula: não se multiplica de novo.",
    calcular(e) {
      const c = DRI2023_CRIANCA[e.sexo === "masculino" ? "masculino" : "feminino"];
      const [k, ce, cp] = c[e.pa ?? "sedentario"];
      const r = linear(k, [
        [c.idadeCoef, "I", e.idade],
        [ce, "E", e.alturaCm],
        [cp, "P", e.peso],
      ]);
      return { ...r, formula: `GET = ${r.formula}`, substituicao: `GET = ${r.substituicao}` };
    },
  },
  {
    id: "dri2023_19",
    nome: "DRI 2023 - 19+ anos",
    categoria: "geral",
    sexo: "ambos",
    idade: [19, 120],
    entradas: ["peso", "altura", "idade", "sexo"],
    resultado: "get",
    atividade: { tipo: "pa", niveis: NIVEIS_DRI2023 },
    status: "em_vistoria",
    fonte: "NASEM. Dietary Reference Intakes for Energy. 2023.",
    observacao:
      "O fator de atividade já está dentro da fórmula (TEE); não multiplicar de novo. Altura em cm.",
    conferida: "Vetor: mulher 21 a, 90 kg, 178 cm, pouco ativo = 2695,96 kcal (valor observado na spec, recalculado à mão).",
    calcular(e) {
      const s = e.sexo === "masculino" ? "masculino" : "feminino";
      const [k, ce, cp] = DRI2023_ADULTO[s][e.pa ?? "sedentario"];
      const r = linear(k, [
        [DRI2023_ADULTO.idadeCoef[s], "I", e.idade],
        [ce, "E", e.alturaCm],
        [cp, "P", e.peso],
      ]);
      return { ...r, formula: `TEE = ${r.formula}`, substituicao: `TEE = ${r.substituicao}` };
    },
  },
  {
    id: "dri2005_3_8",
    nome: "DRI 2005 - 3 a 8 anos",
    categoria: "geral",
    sexo: "ambos",
    idade: [3, 8],
    entradas: ["peso", "altura", "idade", "sexo"],
    resultado: "get",
    atividade: { tipo: "pa", niveis: NIVEIS_IOM },
    status: "em_vistoria",
    fonte: "IOM. Dietary Reference Intakes for Energy... 2005 (EER de crianças, 3 a 8 anos).",
    observacao:
      "O PA já está na fórmula; altura em metros. Fórmula da literatura (o DietSystem não a exibe): a menina com PA 1,00 foi conferida contra o valor medido no DietSystem; o menino e os demais PA não foram conferidos de forma independente.",
    calcular: (e) => eerCrianca(e, 20),
  },
  {
    id: "eer_9_18",
    nome: "EER/IOM - 9 a 18 anos",
    categoria: "geral",
    sexo: "ambos",
    idade: [9, 18],
    entradas: ["peso", "altura", "idade", "sexo"],
    resultado: "get",
    atividade: { tipo: "pa", niveis: NIVEIS_IOM },
    status: "em_vistoria",
    fonte: "IOM. Dietary Reference Intakes for Energy... 2005 (EER de adolescentes, 9 a 18 anos, peso saudável).",
    observacao:
      "O PA já está na fórmula; altura em metros. Menina de 22 anos, 170 cm, 70 kg, PA 1,00 = 1.771 kcal, igual ao valor medido no DietSystem. O menino vem da literatura.",
    conferida: "Vetor: 135,3 − 30,8×22 + 1,00×(10,0×70 + 934×1,70) + 25 = 1.770,5 kcal (DietSystem: 1.771).",
    calcular: (e) => eerCrianca(e, 25),
  },
  {
    id: "eer_adulto",
    nome: "EER/IOM 2005 - Adulto",
    categoria: "geral",
    sexo: "ambos",
    idade: [19, 120],
    entradas: ["peso", "altura", "idade", "sexo"],
    resultado: "get",
    atividade: { tipo: "pa", niveis: NIVEIS_IOM },
    status: "em_vistoria",
    fonte: "IOM. Dietary Reference Intakes for Energy... 2005. Adultos ≥ 19 anos saudáveis.",
    observacao: "O PA (coeficiente de atividade) já está na fórmula. Altura em metros.",
    conferida: "Vetor: mulher 21 a, 90 kg, 178 cm, PA 1,12 = 2599,7 kcal (valor observado na spec, recalculado à mão).",
    PA: {
      masculino: { sedentario: 1.0, pouco_ativo: 1.11, ativo: 1.25, muito_ativo: 1.48 },
      feminino: { sedentario: 1.0, pouco_ativo: 1.12, ativo: 1.27, muito_ativo: 1.45 },
    },
    calcular(e) {
      const h = e.sexo === "masculino";
      const pa = this.PA[h ? "masculino" : "feminino"][e.pa ?? "sedentario"];
      const m = e.alturaCm / 100;
      const [k, ci, cp, ch] = h ? [662, -9.53, 15.91, 539.6] : [354, -6.91, 9.36, 726];
      const valor = k + ci * e.idade + pa * (cp * e.peso + ch * m);
      const sinal = ci < 0 ? "−" : "+";
      return {
        valor,
        formula: `EER = ${fmt(k)} ${sinal} ${fmt(Math.abs(ci))}×I + PA×(${fmt(cp)}×P + ${fmt(ch)}×E_m)`,
        substituicao: `EER = ${fmt(k)} ${sinal} ${fmt(Math.abs(ci))}×${fmt(e.idade)} + ${fmt(pa)}×(${fmt(cp)}×${fmt(e.peso)} + ${fmt(ch)}×${fmt(m)})`,
        extra: { pa },
      };
    },
  },
  {
    id: "schofield",
    nome: "Schofield (1985)",
    categoria: "geral",
    sexo: "ambos",
    idade: [0, 120],
    entradas: ["peso", "idade", "sexo"],
    resultado: "geb",
    status: "em_vistoria",
    fonte: "FAO/WHO/UNU 1985; Schofield. Hum Nutr Clin Nutr 1985;39(Suppl 1):5-41.",
    observacao:
      "Usa só o peso. Idade exatamente na fronteira entre faixas (3, 10, 18, 30, 60) usa a faixa de cima — conferir na fonte. Diferente da tabela FAO/OMS 1985 (que fica na categoria Extras).",
    calcular(e) {
      const faixas = SCHOFIELD[e.sexo === "masculino" ? "masculino" : "feminino"];
      let faixa = faixas[0];
      for (const f of faixas) if (e.idade >= f[0]) faixa = f;
      const r = linear(faixa[2], [[faixa[1], "P", e.peso]]);
      // Escrito "a×P + c", como na tabela.
      return {
        valor: r.valor,
        formula: `GEB = ${fmt(faixa[1])}×P ${faixa[2] < 0 ? "−" : "+"} ${fmt(Math.abs(faixa[2]))}`,
        substituicao: `GEB = ${fmt(faixa[1])}×${fmt(e.peso)} ${faixa[2] < 0 ? "−" : "+"} ${fmt(Math.abs(faixa[2]))}`,
      };
    },
  },
  {
    id: "henry_rees",
    nome: "Henry & Rees (1991) - Adultos",
    categoria: "geral",
    sexo: "ambos",
    idade: [18, 60],
    entradas: ["peso", "idade", "sexo"],
    resultado: "geb",
    status: "em_vistoria",
    fonte: "Henry CJK, Rees DG. Eur J Clin Nutr 1991;45:177-85.",
    observacao:
      "Equação original em MJ/dia; ×239 converte para kcal (a spec usa 239, não 238,85). Populações tropicais; indicada para 18-60 anos.",
    calcular(e) {
      const h = e.sexo === "masculino";
      const jovem = e.idade < 30;
      const [a, b] = h ? (jovem ? [0.056, 2.8] : [0.046, 3.16]) : jovem ? [0.047, 2.57] : [0.037, 2.83];
      return {
        valor: (a * e.peso + b) * 239,
        formula: `GEB = (${fmt(a)}×P + ${fmt(b)}) × 239`,
        substituicao: `GEB = (${fmt(a)}×${fmt(e.peso)} + ${fmt(b)}) × 239`,
      };
    },
  },
  {
    id: "mifflin",
    padrao: true,
    nome: "Mifflin-St Jeor (1990)",
    categoria: "geral",
    sexo: "ambos",
    idade: [19, 78],
    entradas: ["peso", "altura", "idade", "sexo"],
    resultado: "geb",
    status: "em_vistoria",
    fonte: "Mifflin MD et al. Am J Clin Nutr 1990;51(2):241-247.",
    observacao:
      "Adultos de 19 a 78 anos e IMC de 17 a 42. Em obesidade grave (IMC ≥ 35) considere Horie-Waitzberg-Gonzalez.",
    validadeImc: [17, 42],
    conferida: "Vetor: mulher 21 a, 77,05 kg, 158 cm = 1492 kcal; ×1,55 = 2312,6 (spec).",
    calcular(e) {
      const r = linear(e.sexo === "masculino" ? 5 : -161, [
        [10, "P", e.peso],
        [6.25, "E", e.alturaCm],
        [-5, "I", e.idade],
      ]);
      // Escrito na ordem do artigo: 10P + 6,25E − 5I (+5 | −161).
      const c = e.sexo === "masculino" ? 5 : -161;
      return {
        valor: r.valor,
        formula: `GEB = 10×P + 6,25×E − 5×I ${c < 0 ? "−" : "+"} ${Math.abs(c)}`,
        substituicao: `GEB = 10×${fmt(e.peso)} + 6,25×${fmt(e.alturaCm)} − 5×${fmt(e.idade)} ${c < 0 ? "−" : "+"} ${Math.abs(c)}`,
      };
    },
  },
  {
    id: "hb1919",
    nome: "Harris-Benedict (1919)",
    categoria: "geral",
    sexo: "ambos",
    idade: [19, 120],
    entradas: ["peso", "altura", "idade", "sexo"],
    resultado: "geb",
    status: "em_vistoria",
    fonte: "Harris JA, Benedict FG. Carnegie Institution, 1919 (239 adultos).",
    observacao: "Tende a superestimar 5 a 15% em adultos atuais. O fator de injúria (opcional) multiplica o resultado.",
    calcular(e) {
      const h = e.sexo === "masculino";
      const [k, cp, ce, ci] = h ? [66.473, 13.7516, 5.0033, -6.755] : [655.0955, 9.5634, 1.8496, -4.6756];
      const r = linear(k, [
        [cp, "P", e.peso],
        [ce, "E", e.alturaCm],
        [ci, "I", e.idade],
      ]);
      return { ...r, formula: `GEB = ${r.formula}`, substituicao: `GEB = ${r.substituicao}` };
    },
  },
  {
    id: "hb1984",
    nome: "Harris-Benedict (1984)",
    categoria: "geral",
    sexo: "ambos",
    idade: [19, 120],
    entradas: ["peso", "altura", "idade", "sexo"],
    resultado: "geb",
    status: "em_vistoria",
    fonte: "Roza AM, Shizgal HM. Am J Clin Nutr 1984;40(1):168-182 (337 sujeitos).",
    observacao: "Revisão de Roza & Shizgal da Harris-Benedict. O fator de injúria (opcional) multiplica o resultado.",
    conferida: "Vetor: mulher 21 a, 90 kg, 178 cm = 1740,34 kcal; ×1,55×1,10 = 2967 (spec).",
    calcular(e) {
      const h = e.sexo === "masculino";
      const [k, cp, ce, ci] = h ? [88.362, 13.397, 4.799, -5.677] : [447.593, 9.247, 3.098, -4.33];
      const r = linear(k, [
        [cp, "P", e.peso],
        [ce, "E", e.alturaCm],
        [ci, "I", e.idade],
      ]);
      return { ...r, formula: `GEB = ${r.formula}`, substituicao: `GEB = ${r.substituicao}` };
    },
  },

  // ---------------------------------------------------------------- ATLETAS
  {
    id: "cunningham",
    padrao: true,
    nome: "Cunningham (1980)",
    categoria: "atletas",
    sexo: "ambos",
    idade: [0, 120],
    entradas: ["massaMagra"],
    resultado: "geb",
    status: "em_vistoria",
    fonte: "Cunningham JJ. Am J Clin Nutr 1980;33:2372-4 (223 adultos; massa magra por bioimpedância, dobras ou DEXA).",
    calcular(e) {
      const r = linear(500, [[22, "MM", e.massaMagra]]);
      return { valor: r.valor, formula: "GEB = 500 + 22×MM", substituicao: `GEB = 500 + 22×${fmt(e.massaMagra)}` };
    },
  },
  {
    id: "katch_mcardle",
    nome: "Katch-McArdle (1996)",
    categoria: "atletas",
    sexo: "ambos",
    idade: [0, 120],
    entradas: ["massaMagra"],
    resultado: "geb",
    status: "em_vistoria",
    fonte: "McArdle, Katch & Katch. Exercise Physiology.",
    calcular(e) {
      const r = linear(370, [[21.6, "MM", e.massaMagra]]);
      return { valor: r.valor, formula: "GEB = 370 + 21,6×MM", substituicao: `GEB = 370 + 21,6×${fmt(e.massaMagra)}` };
    },
  },
  {
    id: "tenhaaf_mm",
    nome: "Ten Haaf (2014) - Massa Magra",
    categoria: "atletas",
    sexo: "ambos",
    idade: [18, 35],
    entradas: ["massaMagra"],
    resultado: "geb",
    status: "em_vistoria",
    fonte: "ten Haaf T, Weijs PJM. PLoS ONE 2014;9(9):e108460. doi:10.1371/journal.pone.0108460",
    observacao: "Atletas recreacionais de 18 a 35 anos (90 atletas).",
    conferida:
      "Conferida no artigo (PubMed): REE = 95,272×MM + 2026,161 kJ/dia; ÷ 4,184 dá 22,771×MM + 484,264 kcal/dia. A citação do volume é 9(9), como no DietSystem (a spec apontava 9(10) por engano).",
    calcular(e) {
      const r = linear(484.264, [[22.771, "MM", e.massaMagra]]);
      return {
        valor: r.valor,
        formula: "GEB = 22,771×MM + 484,264",
        substituicao: `GEB = 22,771×${fmt(e.massaMagra)} + 484,264`,
      };
    },
  },
  {
    id: "tenhaaf_peso",
    nome: "Ten Haaf (2014) - Peso",
    categoria: "atletas",
    sexo: "ambos",
    idade: [18, 35],
    entradas: ["peso", "altura", "idade", "sexo"],
    resultado: "geb",
    status: "em_vistoria",
    fonte: "ten Haaf T, Weijs PJM. PLoS ONE 2014;9(9):e108460. doi:10.1371/journal.pone.0108460",
    observacao: "Atletas recreacionais de 18 a 35 anos. S = 1 homem, 0 mulher; altura em metros.",
    conferida:
      "Conferida no artigo (PubMed): REE = 49,940×P + 2459,053×E_m − 34,014×I + 799,257×S + 122,502 kJ/dia; ÷ 4,184 dá os coeficientes em kcal usados aqui.",
    calcular(e) {
      const s = e.sexo === "masculino" ? 1 : 0;
      const m = e.alturaCm / 100;
      const r = linear(29.279, [
        [11.936, "P", e.peso],
        [587.728, "E_m", m],
        [-8.129, "I", e.idade],
        [191.027, "S", s],
      ]);
      return { ...r, formula: `GEB = ${r.formula}`, substituicao: `GEB = ${r.substituicao}` };
    },
  },
  {
    id: "tinsley_mm",
    nome: "Tinsley (2019) - Massa Muscular",
    categoria: "atletas",
    sexo: "ambos",
    idade: [0, 120],
    entradas: ["massaMagra"],
    resultado: "geb",
    status: "em_vistoria",
    fonte: "Tinsley GM, Graybeal AJ, Moore ML. Appl Physiol Nutr Metab 2019;44(4):397-406.",
    observacao:
      "Fisiculturistas. A spec aponta inconsistência de rótulo no DietSystem (\"massa magra\" no pop-up e \"massa muscular\" na lista); aqui a entrada é a MASSA MAGRA (kg), a que a equação usa — a conferir na fonte.",
    calcular(e) {
      const r = linear(284, [[25.9, "MM", e.massaMagra]]);
      return { valor: r.valor, formula: "GEB = 25,9×MM + 284", substituicao: `GEB = 25,9×${fmt(e.massaMagra)} + 284` };
    },
  },
  {
    id: "tinsley_peso",
    nome: "Tinsley (2019) - Peso",
    categoria: "atletas",
    sexo: "ambos",
    idade: [0, 120],
    entradas: ["peso"],
    resultado: "geb",
    status: "em_vistoria",
    fonte: "Tinsley GM, Graybeal AJ, Moore ML. Appl Physiol Nutr Metab 2019;44(4):397-406.",
    observacao: "Não recomendada para a população geral.",
    calcular(e) {
      const r = linear(10, [[24.8, "P", e.peso]]);
      return { valor: r.valor, formula: "GEB = 24,8×P + 10", substituicao: `GEB = 24,8×${fmt(e.peso)} + 10` };
    },
  },

  // ------------------------------------------------------------- LACTANTES
  {
    id: "dri2023_lact1_19",
    nome: "DRI 2023 - Lactante 1º semestre (19+ anos)",
    categoria: "lactantes",
    sexo: "feminino",
    idade: [19, 120],
    entradas: ["peso", "altura", "idade"],
    resultado: "get",
    atividade: { tipo: "pa", niveis: NIVEIS_DRI2023 },
    status: "em_vistoria",
    fonte: "NASEM. Dietary Reference Intakes for Energy. 2023.",
    observacao:
      "INFERIDO, não publicado pelo DietSystem: é a equação da mulher adulta (DRI 2023, 19+) no nível escolhido + 400 kcal. O acréscimo foi deduzido de testes no DietSystem (2.223 → 2.623); conferir na publicação da NASEM antes de uso clínico. Meses 1 a 6 de lactação.",
    conferida: "Vetor do DietSystem: 22 anos, 170 cm, 70 kg, inativa = 2.223 + 400 = 2.623 kcal.",
    calcular: (e) => lactante(e, 400, "1º semestre"),
  },
  {
    id: "dri2023_lact2_19",
    nome: "DRI 2023 - Lactante 2º semestre (19+ anos)",
    categoria: "lactantes",
    sexo: "feminino",
    idade: [19, 120],
    entradas: ["peso", "altura", "idade"],
    resultado: "get",
    atividade: { tipo: "pa", niveis: NIVEIS_DRI2023 },
    status: "em_vistoria",
    fonte: "NASEM. Dietary Reference Intakes for Energy. 2023.",
    observacao:
      "INFERIDO, não publicado pelo DietSystem: mulher adulta (DRI 2023, 19+) + 380 kcal. Deduzido de testes no DietSystem (2.223 → 2.603); conferir na NASEM antes de uso clínico. Meses 7 a 12 de lactação.",
    conferida: "Vetor do DietSystem: 22 anos, 170 cm, 70 kg, inativa = 2.223 + 380 = 2.603 kcal.",
    calcular: (e) => lactante(e, 380, "2º semestre"),
  },
  {
    id: "dri2023_lact1_14",
    nome: "DRI 2023 - Lactante 1º semestre (14-19 anos)",
    categoria: "lactantes",
    sexo: "feminino",
    idade: [14, 19],
    entradas: ["peso", "altura", "idade"],
    resultado: "get",
    status: "aguardando_fonte",
    motivo: "O comportamento da adolescente lactante não foi medido na spec. Envie a tabela da NASEM (2023) para implementar.",
    fonte: "NASEM. Dietary Reference Intakes for Energy. 2023.",
  },
  {
    id: "dri2023_lact2_14",
    nome: "DRI 2023 - Lactante 2º semestre (14-19 anos)",
    categoria: "lactantes",
    sexo: "feminino",
    idade: [14, 19],
    entradas: ["peso", "altura", "idade"],
    resultado: "get",
    status: "aguardando_fonte",
    motivo: "O comportamento da adolescente lactante não foi medido na spec. Envie a tabela da NASEM (2023) para implementar.",
    fonte: "NASEM. Dietary Reference Intakes for Energy. 2023.",
  },

  // -------------------------------------------------------------- GESTANTES
  {
    id: "dri2023_gestante",
    nome: "DRI 2023 - Gestante",
    categoria: "gestantes",
    sexo: "feminino",
    idade: [19, 50],
    entradas: ["peso", "altura", "idade", "semanaGestacional"],
    resultado: "get",
    atividade: { tipo: "pa", niveis: NIVEIS_DRI2023 },
    status: "em_vistoria",
    fonte: "NASEM. Dietary Reference Intakes for Energy. 2023 (2º e 3º trimestres).",
    observacao:
      "TEE = fórmula por nível de atividade + 9,16×SG, mais a deposição de energia pelo IMC pré-gestacional (+300 baixo peso, +200 eutrófica, +150 sobrepeso, −50 obesa). Sem o peso pré-gestacional, usa-se o peso atual para classificar o IMC (e a conta avisa). DIVERGÊNCIA A CONFERIR: a spec chama de P o peso, sem dizer se é o atual ou o pré-gestacional; aqui entra o peso atual. Gestante adolescente (até 18 anos) tem equação própria, ainda sem fonte.",
    validar: (e) =>
      e.semanaGestacional >= 14 && e.semanaGestacional <= 42
        ? null
        : "A fórmula cobre o 2º e o 3º trimestres (semana 14 em diante). No 1º trimestre use a equação da mulher adulta (DRI 2023 19+), sem acréscimo. Informe a semana gestacional.",
    calcular(e) {
      const [k, ce, cp] = DRI2023_GESTANTE[e.pa ?? "sedentario"];
      const r = linear(k, [
        [DRI2023_GESTANTE.idadeCoef, "I", e.idade],
        [ce, "E", e.alturaCm],
        [cp, "P", e.peso],
        [DRI2023_GESTANTE.semanaCoef, "SG", e.semanaGestacional],
      ]);
      const pre = e.pesoPreGestacional > 0 ? e.pesoPreGestacional : e.peso;
      const m = e.alturaCm / 100;
      const imcPre = pre / (m * m);
      const dep = deposicaoPorImc(imcPre);
      return {
        valor: r.valor + dep.kcal,
        formula: `TEE = ${r.formula} ${dep.kcal < 0 ? "−" : "+"} ${Math.abs(dep.kcal)} (deposição, IMC pré-gestacional)`,
        substituicao: `TEE = ${r.substituicao} ${dep.kcal < 0 ? "−" : "+"} ${Math.abs(dep.kcal)}  [IMC pré-gestacional ${fmt(imcPre, 1)}: ${dep.classe}${e.pesoPreGestacional > 0 ? "" : ", calculado com o peso ATUAL"}]`,
        extra: { imcPre, deposicao: dep.kcal },
      };
    },
  },
  {
    id: "gestante_14_19",
    nome: "Gestante 14-19 anos",
    categoria: "gestantes",
    sexo: "feminino",
    idade: [14, 19],
    entradas: ["peso", "altura", "idade", "semanaGestacional"],
    resultado: "get",
    status: "aguardando_fonte",
    motivo: "A spec manda usar equações próprias de 14 a 19 anos, mas não as traz. Envie a tabela (NASEM/IOM) para implementar.",
    fonte: "NASEM. Dietary Reference Intakes for Energy. 2023.",
  },
  {
    id: "gestante_19",
    nome: "Gestante 19+ anos (estilo IOM 2005)",
    categoria: "gestantes",
    sexo: "feminino",
    idade: [19, 50],
    entradas: ["peso", "altura", "idade", "semanaGestacional"],
    resultado: "get",
    atividade: { tipo: "pa", niveis: NIVEIS_IOM },
    status: "em_vistoria",
    fonte: "IOM. Dietary Reference Intakes for Energy... 2005 (EER de gestantes: equação da mulher adulta + acréscimo por trimestre).",
    observacao:
      "Equação EER da mulher adulta (IOM 2005) + acréscimo por trimestre: 1º +0, 2º +340, 3º +452 kcal. Comportamento medido no DietSystem; conferir os acréscimos na publicação do IOM. O trimestre sai da semana gestacional (2º: 14ª a 27ª; 3º: a partir da 28ª).",
    conferida: "Vetor do DietSystem: 22 anos, 170 cm, 70 kg, PA 1,00 = 2.091 (1º) / 2.431 (2º) / 2.543 (3º).",
    validar: (e) => (e.semanaGestacional >= 1 && e.semanaGestacional <= 42 ? null : "Informe a semana gestacional (1 a 42)."),
    calcular(e) {
      const pa = equacaoPorId("eer_adulto").PA.feminino[e.pa ?? "sedentario"];
      const m = e.alturaCm / 100;
      const base = 354 - 6.91 * e.idade + pa * (9.36 * e.peso + 726 * m);
      const tri = trimestreDa(e.semanaGestacional);
      const add = [0, 340, 452][tri - 1];
      return {
        valor: base + add,
        formula: `EER = 354 − 6,91×I + PA×(9,36×P + 726×E_m) + ${add} (${tri}º trimestre)`,
        substituicao: `EER = 354 − 6,91×${fmt(e.idade)} + ${fmt(pa)}×(9,36×${fmt(e.peso)} + 726×${fmt(m)}) + ${add}`,
        extra: { pa, trimestre: tri },
      };
    },
  },

  // -------------------------------------------------------------- OBESIDADE
  {
    id: "iom_obesidade",
    padrao: true,
    nome: "IOM/DRI (2005) 19+ Obesidade",
    categoria: "obesidade",
    sexo: "ambos",
    idade: [19, 120],
    entradas: ["peso", "altura", "idade", "sexo"],
    resultado: "get",
    atividade: { tipo: "pa", niveis: NIVEIS_IOM },
    status: "em_vistoria",
    fonte: "IOM. Dietary Reference Intakes... 2005, tabelas 5-23 e 5-24 (IMC ≥ 25).",
    observacao:
      "É a estimativa de MANUTENÇÃO (necessidade de energia); para perder peso aplique o déficit à parte. Altura em metros.",
    PA: {
      masculino: { sedentario: 1.0, pouco_ativo: 1.12, ativo: 1.29, muito_ativo: 1.59 },
      feminino: { sedentario: 1.0, pouco_ativo: 1.16, ativo: 1.27, muito_ativo: 1.44 },
    },
    calcular(e) {
      const h = e.sexo === "masculino";
      const pa = this.PA[h ? "masculino" : "feminino"][e.pa ?? "sedentario"];
      const m = e.alturaCm / 100;
      const [k, ci, cp, ch] = h ? [1086, -10.1, 13.7, 416] : [448, -7.95, 11.4, 619];
      const valor = k + ci * e.idade + pa * (cp * e.peso + ch * m);
      return {
        valor,
        formula: `TEE = ${fmt(k)} − ${fmt(Math.abs(ci))}×I + PA×(${fmt(cp)}×P + ${fmt(ch)}×E_m)`,
        substituicao: `TEE = ${fmt(k)} − ${fmt(Math.abs(ci))}×${fmt(e.idade)} + ${fmt(pa)}×(${fmt(cp)}×${fmt(e.peso)} + ${fmt(ch)}×${fmt(m)})`,
        extra: { pa },
      };
    },
  },
  {
    id: "horie_waitzberg",
    nome: "Horie-Waitzberg-Gonzalez (2011)",
    categoria: "obesidade",
    sexo: "ambos",
    idade: [18, 120],
    entradas: ["peso", "massaMagra"],
    resultado: "geb",
    status: "em_vistoria",
    fonte: "Horie LM et al. 2011 (120 obesos graves, HC-FMUSP). Indicada para IMC ≥ 35.",
    observacao: "Entra com a massa magra (kg).",
    conferida:
      "NÃO conferida: o resumo no PubMed não traz os coeficientes (560,43 + 5,39×P + 14,14×MM vêm só da spec do DietSystem). Verificar na fonte antes de uso clínico.",
    validadeImc: [35, 120],
    calcular(e) {
      const r = linear(560.43, [
        [5.39, "P", e.peso],
        [14.14, "MM", e.massaMagra],
      ]);
      return { ...r, formula: `GER = ${r.formula}`, substituicao: `GER = ${r.substituicao}` };
    },
  },

  // ----------------------------------------------------------------- EXTRAS
  // Já existiam na calculadora e foram mantidas (decisão dela). A tabela FAO/OMS
  // é a do manual do CEPRAN; o fator é o ocupacional da Tabela 25.
  {
    id: "fao_oms",
    nome: "FAO/OMS (1985) — tabela do manual",
    categoria: "extras",
    sexo: "ambos",
    idade: [0, 120],
    entradas: ["peso", "idade", "sexo"],
    resultado: "geb",
    atividade: { tipo: "fao" },
    status: "em_vistoria",
    fonte: "FAO/OMS 1985, Tabelas 24 e 25 (manual CEPRAN/UNESP).",
    observacao:
      "Não é a mesma coisa que a equação de Schofield da categoria Geral (coeficientes diferentes). O fator é o ocupacional (leve, moderada, intensa), que muda com idade e sexo.",
    FAO: {
      masculino: [
        [3, 60.9, -54, false],
        [10, 22.7, 495, false],
        [18, 17.5, 651, false],
        [30, 15.3, 679, true],
        [60, 11.6, 879, true],
        [200, 13.5, 487, true],
      ],
      feminino: [
        [3, 61.0, -51, false],
        [10, 22.5, 499, false],
        [18, 12.2, 746, false],
        [30, 14.7, 496, true],
        [60, 8.7, 829, true],
        [200, 10.5, 596, true],
      ],
    },
    calcular(e) {
      const faixas = this.FAO[e.sexo === "masculino" ? "masculino" : "feminino"];
      const faixa =
        faixas.find(([ate, , , inclui]) => (inclui ? e.idade <= ate : e.idade < ate)) ?? faixas[faixas.length - 1];
      const [, a, c] = faixa;
      return {
        valor: a * e.peso + c,
        formula: `GEB = ${fmt(a)}×P ${c < 0 ? "−" : "+"} ${fmt(Math.abs(c))}`,
        substituicao: `GEB = ${fmt(a)}×${fmt(e.peso)} ${c < 0 ? "−" : "+"} ${fmt(Math.abs(c))}`,
      };
    },
  },
];

export const CATEGORIAS = [
  { chave: "geral", rotulo: "Geral" },
  { chave: "atletas", rotulo: "Atletas" },
  { chave: "lactantes", rotulo: "Lactantes" },
  { chave: "gestantes", rotulo: "Gestantes" },
  { chave: "obesidade", rotulo: "Sobrepeso e obesidade" },
  { chave: "extras", rotulo: "Extras (já existiam na calculadora)" },
];

export function equacaoPorId(id) {
  return EQUACOES.find((e) => e.id === id) ?? null;
}

export function equacoesDaCategoria(chave) {
  return EQUACOES.filter((e) => e.categoria === chave);
}

export { rotuloNivel, mulher };
