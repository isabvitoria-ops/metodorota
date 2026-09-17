import {
  densidadeDurnin,
  densidadeDurninRahaman,
  densidadeGuedes,
  densidadeKatch,
  densidadeLean,
  densidadePetroski,
  densidadePollock3,
  densidadePollock4,
  densidadePollock7,
  densidadeThorland3,
  densidadeThorland7,
  faulkner,
  slaughter,
} from "./calculos.mjs";

/**
 * As equações de composição corporal, uma linha da tabela por entrada.
 *
 * Cada protocolo guarda: quais dobras ele soma (por sexo), a conta de
 * densidade do autor, a CONVERSÃO que aquele autor usou, a faixa etária em
 * que foi validado e se a equação precisa da idade.
 *
 * A conversão anda junto com a equação, e não é detalhe: Petroski e Lean
 * fecham com (498/D) − 453, Katch & McArdle com Brozek, o resto com Siri.
 * Aplicar Siri em cima de todas seria trocar a conta do autor pela minha —
 * uma fração de ponto percentual de diferença, pequena demais para
 * alguém estranhar olhando a tela — que é o que a torna perigosa.
 *
 * `dobras: []` para um sexo significa "não há equação publicada para este
 * sexo". A tela avisa, em vez de reaproveitar a fórmula do outro — que
 * daria número errado sem parecer errado.
 */
export const PROTOCOLOS = {
  pollock3: {
    rotulo: "Jackson & Pollock — 3 dobras",
    nota: "Adultos. 18 a 61 anos.",
    dobras: { masculino: ["peitoral", "abdominal", "coxa"], feminino: ["triceps", "suprailiaca", "coxa"] },
    conversao: "siri",
    usaIdade: true,
    densidade: ({ soma, idade, sexo }) => densidadePollock3(soma, idade, sexo),
  },
  pollock7: {
    rotulo: "Jackson, Pollock & Ward — 7 dobras",
    nota: "Adultos. 18 a 61 anos.",
    dobras: {
      masculino: ["peitoral", "axilar", "triceps", "subescapular", "abdominal", "suprailiaca", "coxa"],
      feminino: ["peitoral", "axilar", "triceps", "subescapular", "abdominal", "suprailiaca", "coxa"],
    },
    conversao: "siri",
    usaIdade: true,
    densidade: ({ soma, idade, sexo }) => densidadePollock7(soma, idade, sexo),
  },
  pollock4: {
    rotulo: "Jackson, Pollock & Ward — 4 dobras (mulheres)",
    nota: "Mulheres, 18 a 55 anos. Publicada só para mulheres.",
    dobras: { masculino: [], feminino: ["triceps", "abdominal", "suprailiaca", "coxa"] },
    conversao: "siri",
    usaIdade: true,
    densidade: ({ soma, idade }) => densidadePollock4(soma, idade),
  },
  durnin: {
    rotulo: "Durnin & Womersley — 4 dobras",
    nota: "17 a 72 anos, por faixa etária.",
    dobras: {
      masculino: ["biceps", "triceps", "subescapular", "suprailiaca"],
      feminino: ["biceps", "triceps", "subescapular", "suprailiaca"],
    },
    conversao: "siri",
    usaIdade: true,
    densidade: ({ soma, idade, sexo }) => densidadeDurnin(soma, idade, sexo),
  },
  durninRahaman: {
    rotulo: "Durnin & Rahaman — 4 dobras",
    nota: "18 a 33 anos.",
    dobras: {
      masculino: ["biceps", "triceps", "subescapular", "suprailiaca"],
      feminino: ["biceps", "triceps", "subescapular", "suprailiaca"],
    },
    conversao: "siri",
    densidade: ({ soma }) => densidadeDurninRahaman(soma),
  },
  lean: {
    rotulo: "Lean et al. — 4 dobras",
    nota: "17 a 65 anos.",
    dobras: {
      masculino: ["biceps", "triceps", "subescapular", "suprailiaca"],
      feminino: ["biceps", "triceps", "subescapular", "suprailiaca"],
    },
    conversao: "lohman",
    usaIdade: true,
    densidade: ({ soma, idade }) => densidadeLean(soma, idade),
  },
  petroski: {
    rotulo: "Petroski — 4 dobras",
    nota: "Brasileiros, 18 a 66 anos.",
    dobras: {
      masculino: ["subescapular", "triceps", "suprailiaca", "panturrilha"],
      feminino: ["subescapular", "triceps", "suprailiaca", "panturrilha"],
    },
    conversao: "lohman",
    usaIdade: true,
    densidade: ({ soma, idade }) => densidadePetroski(soma, idade),
  },
  guedes: {
    rotulo: "Guedes — 3 dobras",
    nota: "Universitários brasileiros, 17 a 27 anos.",
    dobras: {
      masculino: ["triceps", "suprailiaca", "abdominal"],
      feminino: ["triceps", "suprailiaca", "abdominal"],
    },
    conversao: "siri",
    densidade: ({ soma }) => densidadeGuedes(soma),
  },
  katch: {
    rotulo: "Katch & McArdle — 3 dobras",
    nota: "Universitários. Cada dobra entra com o seu próprio coeficiente — esta não soma.",
    dobras: {
      masculino: ["triceps", "subescapular", "abdominal"],
      feminino: ["triceps", "subescapular", "abdominal"],
    },
    conversao: "brozek",
    // A única da tabela que não usa somatório. Somar as três antes daria
    // outro número, e é por isso que ela recebe as dobras separadas.
    densidade: ({ valores }) => densidadeKatch(valores.triceps, valores.subescapular, valores.abdominal),
  },
  thorland3: {
    rotulo: "Thorland — 3 dobras (atletas)",
    nota: "Atletas de 14 a 19 anos.",
    dobras: {
      masculino: ["triceps", "subescapular", "axilar"],
      feminino: ["triceps", "subescapular", "axilar"],
    },
    conversao: "siri",
    densidade: ({ soma }) => densidadeThorland3(soma),
  },
  thorland7: {
    rotulo: "Thorland — 7 dobras (atletas)",
    nota: "Atletas de 14 a 19 anos.",
    dobras: {
      masculino: ["peitoral", "axilar", "triceps", "subescapular", "abdominal", "suprailiaca", "coxa"],
      feminino: ["peitoral", "axilar", "triceps", "subescapular", "abdominal", "suprailiaca", "coxa"],
    },
    conversao: "siri",
    densidade: ({ soma }) => densidadeThorland7(soma),
  },
  slaughter: {
    rotulo: "Slaughter — 2 dobras",
    nota: "Estudantes de 16 a 18 anos. Devolve o percentual direto, sem densidade.",
    dobras: { masculino: ["triceps", "subescapular"], feminino: ["triceps", "subescapular"] },
    // Sem conversão: o percentual é a saída da própria equação.
    percentual: ({ soma }) => slaughter(soma),
  },
  faulkner: {
    rotulo: "Faulkner — 4 dobras",
    nota: "Devolve o percentual direto, sem densidade.",
    dobras: {
      masculino: ["triceps", "subescapular", "suprailiaca", "abdominal"],
      feminino: ["triceps", "subescapular", "suprailiaca", "abdominal"],
    },
    percentual: ({ soma }) => faulkner(soma),
  },
};
