/**
 * Cálculos de composição corporal para o formulário de avaliação.
 *
 * Cada fórmula é a mesma publicada pelo autor, igual à ferramenta de cálculo
 * (nutri/calculos.mjs). Onde o dado falta, a conta devolve null — nunca zero.
 *
 * A conversão de densidade em percentual anda grudada no protocolo: Petroski e
 * Lean usam (498/D) − 453, Katch & McArdle usa Brozek, o resto Siri. Aplicar
 * Siri em todas seria trocar a conta do autor pela minha.
 */

export type Sexo = "masculino" | "feminino";

// ─── IMC ────────────────────────────────────────────────────────────────

export function calcularIMC(pesoKg: number | null, alturaCm: number | null): number | null {
  if (!pesoKg || !alturaCm) return null;
  const alturaM = alturaCm / 100;
  return pesoKg / (alturaM * alturaM);
}

export function classificarIMC(valor: number | null): string | null {
  if (!valor) return null;
  if (valor < 18.5) return "Baixo peso";
  if (valor < 25) return "Eutrófico";
  if (valor < 30) return "Sobrepeso";
  if (valor < 35) return "Obesidade grau I";
  if (valor < 40) return "Obesidade grau II";
  return "Obesidade grau III";
}

export function pesoIdeal(alturaCm: number | null): { minimo: number; maximo: number } | null {
  if (!alturaCm) return null;
  const m = alturaCm / 100;
  return { minimo: 18.5 * m * m, maximo: 24.9 * m * m };
}

// ─── Conversões de densidade → percentual ───────────────────────────────

function siri(d: number): number {
  return (4.95 / d - 4.5) * 100;
}

function brozek(d: number): number {
  return (4.57 / d - 4.142) * 100;
}

function lohman(d: number): number {
  return 498 / d - 453;
}

type Conversao = "siri" | "brozek" | "lohman";
const CONVERSOES: Record<Conversao, (d: number) => number> = { siri, brozek, lohman };

// ─── Densidades por protocolo ───────────────────────────────────────────

function densidadePollock3(soma: number, idade: number, sexo: Sexo): number | null {
  if (!soma || !idade) return null;
  if (sexo === "masculino") {
    return 1.10938 - 0.0008267 * soma + 0.0000016 * soma * soma - 0.0002574 * idade;
  }
  return 1.0994921 - 0.0009929 * soma + 0.0000023 * soma * soma - 0.0001392 * idade;
}

function densidadePollock7(soma: number, idade: number, sexo: Sexo): number | null {
  if (!soma || !idade) return null;
  if (sexo === "masculino") {
    return 1.112 - 0.00043499 * soma + 0.00000055 * soma * soma - 0.00028826 * idade;
  }
  return 1.097 - 0.00046971 * soma + 0.00000056 * soma * soma - 0.00012828 * idade;
}

function densidadePollock4(soma: number, idade: number): number | null {
  if (!soma || !idade) return null;
  return 1.096095 - 0.0006952 * soma + 0.0000011 * soma * soma - 0.0000714 * idade;
}

const DURNIN: Record<Sexo, [number, number, number][]> = {
  masculino: [
    [19, 1.162, 0.063],
    [29, 1.1631, 0.0632],
    [39, 1.1422, 0.0544],
    [49, 1.162, 0.07],
    [200, 1.1715, 0.0779],
  ],
  feminino: [
    [19, 1.1549, 0.0678],
    [29, 1.1599, 0.0717],
    [39, 1.1423, 0.0632],
    [49, 1.1333, 0.0612],
    [200, 1.1339, 0.0645],
  ],
};

function densidadeDurnin(soma: number, idade: number, sexo: Sexo): number | null {
  if (!soma || !idade || idade < 17) return null;
  const faixas = DURNIN[sexo];
  const faixa = faixas.find(([ate]) => idade <= ate) ?? faixas[faixas.length - 1]!;
  const [, c, m] = faixa!;
  return c - m * Math.log10(soma);
}

function densidadeDurninRahaman(soma: number, sexo: Sexo): number | null {
  if (!soma) return null;
  if (sexo === "feminino") return 1.1581 - 0.072 * Math.log10(soma);
  return 1.161 - 0.0632 * Math.log10(soma);
}

function densidadeLean(soma: number, idade: number): number | null {
  if (!soma || !idade) return null;
  return 1.1862 - 0.0684 * Math.log10(soma) - 0.000601 * idade;
}

function densidadePetroski(soma: number, idade: number): number | null {
  if (!soma || !idade) return null;
  return 1.10726863 - 0.00081201 * soma + 0.00000212 * soma * soma - 0.00041761 * idade;
}

function densidadeGuedes(soma: number, sexo: Sexo): number | null {
  if (!soma) return null;
  if (sexo === "feminino") return 1.1665 - 0.07063 * Math.log10(soma);
  return 1.17136 - 0.06706 * Math.log10(soma);
}

function densidadeKatch(
  triceps: number,
  subescapular: number,
  abdominal: number,
): number | null {
  if (!triceps || !subescapular || !abdominal) return null;
  return 1.09665 - 0.00103 * triceps - 0.00056 * subescapular - 0.00054 * abdominal;
}

function densidadeThorland3(soma: number): number | null {
  if (!soma) return null;
  return 1.1136 - 0.00154 * soma + 0.00000516 * soma * soma;
}

function densidadeThorland7(soma: number): number | null {
  if (!soma) return null;
  return 1.1091 - 0.00052 * soma + 0.00000032 * soma * soma;
}

function percentualFaulkner(soma: number): number | null {
  if (!soma) return null;
  return soma * 0.153 + 5.783;
}

function percentualSlaughter(soma: number, sexo: Sexo): number | null {
  if (!soma) return null;
  const menina = sexo === "feminino";
  if (soma > 35) return menina ? 0.546 * soma + 9.7 : 0.783 * soma + 1.6;
  return menina ? 1.33 * soma - 0.013 * soma * soma - 2.5 : 1.21 * soma - 0.008 * soma * soma - 5.5;
}

// ─── Mapa: nome da Central → chave do cálculo ──────────────────────────

const MAPA_DOBRAS: Record<string, string> = {
  "Bíceps": "biceps",
  "Tríceps": "triceps",
  "Peitoral / tórax": "peitoral",
  "Subescapular": "subescapular",
  "Axilar média": "axilar",
  "Supra-ilíaca": "suprailiaca",
  "Abdominal": "abdominal",
  "Coxa": "coxa",
  "Panturrilha": "panturrilha",
};

// ─── Definição dos protocolos para cálculo ──────────────────────────────

interface ProtocoloCalculo {
  dobras: { masculino: string[]; feminino: string[] };
  conversao?: Conversao;
  usaIdade?: boolean;
  densidade?: (p: { soma: number; idade: number; sexo: Sexo; valores: Record<string, number> }) => number | null;
  percentual?: (p: { soma: number; sexo: Sexo }) => number | null;
}

const PROTOCOLOS_CALCULO: Record<string, ProtocoloCalculo> = {
  pollock3: {
    dobras: {
      masculino: ["peitoral", "abdominal", "coxa"],
      feminino: ["triceps", "suprailiaca", "coxa"],
    },
    conversao: "siri",
    usaIdade: true,
    densidade: ({ soma, idade, sexo }) => densidadePollock3(soma, idade, sexo),
  },
  pollock7: {
    dobras: {
      masculino: ["peitoral", "axilar", "triceps", "subescapular", "abdominal", "suprailiaca", "coxa"],
      feminino: ["peitoral", "axilar", "triceps", "subescapular", "abdominal", "suprailiaca", "coxa"],
    },
    conversao: "siri",
    usaIdade: true,
    densidade: ({ soma, idade, sexo }) => densidadePollock7(soma, idade, sexo),
  },
  pollock4: {
    dobras: { masculino: [], feminino: ["triceps", "abdominal", "suprailiaca", "coxa"] },
    conversao: "siri",
    usaIdade: true,
    densidade: ({ soma, idade }) => densidadePollock4(soma, idade),
  },
  durnin: {
    dobras: {
      masculino: ["biceps", "triceps", "subescapular", "suprailiaca"],
      feminino: ["biceps", "triceps", "subescapular", "suprailiaca"],
    },
    conversao: "siri",
    usaIdade: true,
    densidade: ({ soma, idade, sexo }) => densidadeDurnin(soma, idade, sexo),
  },
  durninRahaman: {
    dobras: {
      masculino: ["biceps", "triceps", "subescapular", "suprailiaca"],
      feminino: ["biceps", "triceps", "subescapular", "suprailiaca"],
    },
    conversao: "siri",
    densidade: ({ soma, sexo }) => densidadeDurninRahaman(soma, sexo),
  },
  lean: {
    dobras: { masculino: ["biceps", "triceps", "subescapular", "suprailiaca"], feminino: [] },
    conversao: "lohman",
    usaIdade: true,
    densidade: ({ soma, idade }) => densidadeLean(soma, idade),
  },
  petroski: {
    dobras: { masculino: ["subescapular", "triceps", "suprailiaca", "panturrilha"], feminino: [] },
    conversao: "lohman",
    usaIdade: true,
    densidade: ({ soma, idade }) => densidadePetroski(soma, idade),
  },
  guedes: {
    dobras: {
      masculino: ["triceps", "suprailiaca", "abdominal"],
      feminino: ["coxa", "suprailiaca", "subescapular"],
    },
    conversao: "siri",
    densidade: ({ soma, sexo }) => densidadeGuedes(soma, sexo),
  },
  katch: {
    dobras: { masculino: ["triceps", "subescapular", "abdominal"], feminino: [] },
    conversao: "brozek",
    densidade: ({ valores }) =>
      densidadeKatch(valores.triceps ?? 0, valores.subescapular ?? 0, valores.abdominal ?? 0),
  },
  thorland3: {
    dobras: { masculino: ["triceps", "subescapular", "axilar"], feminino: [] },
    conversao: "siri",
    densidade: ({ soma }) => densidadeThorland3(soma),
  },
  thorland7: {
    dobras: {
      masculino: ["peitoral", "axilar", "triceps", "subescapular", "abdominal", "suprailiaca", "coxa"],
      feminino: [],
    },
    conversao: "siri",
    densidade: ({ soma }) => densidadeThorland7(soma),
  },
  slaughter: {
    dobras: { masculino: ["triceps", "subescapular"], feminino: ["triceps", "subescapular"] },
    percentual: ({ soma, sexo }) => percentualSlaughter(soma, sexo),
  },
  faulkner: {
    dobras: {
      masculino: ["triceps", "subescapular", "suprailiaca", "abdominal"],
      feminino: ["triceps", "subescapular", "suprailiaca", "abdominal"],
    },
    percentual: ({ soma }) => percentualFaulkner(soma),
  },
};

// ─── RCQ ────────────────────────────────────────────────────────────────

export function calcularRCQ(
  circunferencias: { nome: string; valor: string }[],
): number | null {
  const buscar = (nome: string) => {
    const m = circunferencias.find((c) => c.nome === nome);
    if (!m) return null;
    const n = parseFloat(m.valor.replace(",", ".").replace(/[^\d.\-]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const cintura = buscar("Cintura");
  const quadril = buscar("Quadril");
  if (!cintura || !quadril) return null;
  return cintura / quadril;
}

export function classificarRCQ(rcq: number | null, sexo: Sexo | null): string | null {
  if (rcq === null || !sexo) return null;
  const corte = sexo === "masculino" ? 0.9 : 0.85;
  return rcq >= corte ? "Risco aumentado" : "Baixo risco";
}

// ─── Resultado principal ────────────────────────────────────────────────

export interface ResultadoCalculo {
  imc: number | null;
  classificacaoIMC: string | null;
  pesoIdealMin: number | null;
  pesoIdealMax: number | null;
  percentualGordura: number | null;
  massaGorda: number | null;
  massaMagra: number | null;
  somaDobras: number | null;
  rcq: number | null;
  classificacaoRCQ: string | null;
  avisos: string[];
}

/**
 * Calcula tudo que dá para calcular a partir dos dados preenchidos.
 *
 * A soma de dobras é a do protocolo escolhido, com os campos certos para o
 * sexo. A densidade usa a equação do autor, e a conversão também.
 */
export function calcularTudo(params: {
  protocoloId: string | null;
  sexo: Sexo | null;
  peso: number | null;
  altura: number | null;
  idade: number | null;
  dobras: { nome: string; valor: string }[];
  circunferencias: { nome: string; valor: string }[];
}): ResultadoCalculo {
  const { protocoloId, sexo, peso, altura, idade, dobras, circunferencias } = params;
  const avisos: string[] = [];

  const imcVal = calcularIMC(peso, altura);
  const classIMC = classificarIMC(imcVal);
  const ideal = pesoIdeal(altura);

  const rcqVal = calcularRCQ(circunferencias);
  const classRCQ = classificarRCQ(rcqVal, sexo);

  const valorDobra = (chaveCalculo: string): number | null => {
    const nomeCentral = Object.entries(MAPA_DOBRAS).find(([, v]) => v === chaveCalculo)?.[0];
    if (!nomeCentral) return null;
    const m = dobras.find((d) => d.nome === nomeCentral);
    if (!m) return null;
    const n = parseFloat(m.valor.replace(",", ".").replace(/[^\d.\-]/g, ""));
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  let percentualGordura: number | null = null;
  let massaGordaVal: number | null = null;
  let massaMagraVal: number | null = null;
  let somaDobras: number | null = null;

  if (protocoloId && protocoloId !== "outro" && sexo) {
    const proto = PROTOCOLOS_CALCULO[protocoloId];
    if (proto) {
      const dobrasDoProtocolo = proto.dobras[sexo];
      if (dobrasDoProtocolo.length === 0) {
        avisos.push("Este protocolo não tem equação publicada para este sexo.");
      } else {
        const valores: Record<string, number> = {};
        let todasPreenchidas = true;
        for (const chave of dobrasDoProtocolo) {
          const v = valorDobra(chave);
          if (v !== null) {
            valores[chave] = v;
          } else {
            todasPreenchidas = false;
          }
        }

        if (todasPreenchidas) {
          const soma = Object.values(valores).reduce((a, b) => a + b, 0);
          somaDobras = Math.round(soma * 10) / 10;

          if (proto.percentual) {
            percentualGordura = proto.percentual({ soma, sexo });
          } else if (proto.densidade && proto.conversao) {
            const d = proto.densidade({
              soma,
              idade: idade ?? 0,
              sexo,
              valores,
            });
            if (d !== null && d > 0) {
              percentualGordura = CONVERSOES[proto.conversao](d);
            } else if (proto.usaIdade && !idade) {
              avisos.push("Preencha a idade — este protocolo precisa dela para o cálculo.");
            }
          }

          if (percentualGordura !== null) {
            percentualGordura = Math.round(percentualGordura * 100) / 100;
            if (peso) {
              massaGordaVal = Math.round((peso * percentualGordura) / 100 * 10) / 10;
              massaMagraVal = Math.round((peso - massaGordaVal) * 10) / 10;
            }
          }
        }
      }
    }
  }

  return {
    imc: imcVal !== null ? Math.round(imcVal * 100) / 100 : null,
    classificacaoIMC: classIMC,
    pesoIdealMin: ideal ? Math.round(ideal.minimo * 10) / 10 : null,
    pesoIdealMax: ideal ? Math.round(ideal.maximo * 10) / 10 : null,
    percentualGordura,
    massaGorda: massaGordaVal,
    massaMagra: massaMagraVal,
    somaDobras,
    rcq: rcqVal !== null ? Math.round(rcqVal * 100) / 100 : null,
    classificacaoRCQ: classRCQ,
    avisos,
  };
}
