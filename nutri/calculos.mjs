/**
 * As contas da ferramenta de nutrição.
 *
 * Tudo que é fórmula publicada mora aqui, separado da tela, por dois
 * motivos: dá para testar, e dá para conferir contra o livro sem precisar
 * ler HTML.
 *
 * REGRA QUE VALE PARA O ARQUIVO INTEIRO: nenhuma fórmula foi inventada,
 * adaptada ou "melhorada". Cada uma está com o nome de quem publicou, para
 * ela poder conferir contra a referência dela. Onde o dado não existe, a
 * conta devolve `null` — nunca zero, nunca um chute.
 */

// ---------------------------------------------------------------------------
// Composição corporal
// ---------------------------------------------------------------------------

/** Índice de massa corporal. Peso em kg, altura em metros. */
export function imc(pesoKg, alturaM) {
  if (!pesoKg || !alturaM) return null;
  return pesoKg / (alturaM * alturaM);
}

/**
 * Densidade corporal por Jackson & Pollock, 3 dobras.
 *
 * Homens: peitoral, abdominal e coxa.
 * Mulheres: tríceps, supra-ilíaca e coxa.
 *
 * Jackson AS, Pollock ML. Generalized equations for predicting body density
 * of men. Br J Nutr, 1978. / Jackson AS, Pollock ML, Ward A. Generalized
 * equations for predicting body density of women. Med Sci Sports Exerc, 1980.
 */
export function densidadePollock3(soma, idade, sexo) {
  if (!soma || !idade) return null;
  if (sexo === "masculino") {
    return 1.10938 - 0.0008267 * soma + 0.0000016 * soma * soma - 0.0002574 * idade;
  }
  return 1.0994921 - 0.0009929 * soma + 0.0000023 * soma * soma - 0.0001392 * idade;
}

/**
 * Densidade corporal por Jackson & Pollock, 7 dobras.
 *
 * Peitoral, axilar média, tríceps, subescapular, abdominal, supra-ilíaca e
 * coxa — para os dois sexos, mudando só os coeficientes.
 */
export function densidadePollock7(soma, idade, sexo) {
  if (!soma || !idade) return null;
  if (sexo === "masculino") {
    return 1.112 - 0.00043499 * soma + 0.00000055 * soma * soma - 0.00028826 * idade;
  }
  return 1.097 - 0.00046971 * soma + 0.00000056 * soma * soma - 0.00012828 * idade;
}

/**
 * Coeficientes de Durnin & Womersley (1974), por sexo e faixa de idade.
 *
 * DC = c − m × log10(soma das 4 dobras: bíceps, tríceps, subescapular e
 * supra-ilíaca).
 *
 * Conferidos contra o Quadro 4 do "Manual de Avaliação da Composição
 * Corporal" (São Camilo), que ela mandou — os dez coeficientes batem um a
 * um. O manual traz ainda uma linha "todas as idades" com erro de digitação
 * ("11765" e "11567", sem a vírgula); essa linha ficou de fora até ela
 * confirmar, porque o valor certo é adivinhação minha e não leitura dela.
 */
const DURNIN = {
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

export function densidadeDurnin(soma, idade, sexo) {
  if (!soma || !idade) return null;
  const faixas = DURNIN[sexo] ?? DURNIN.feminino;
  const faixa = faixas.find(([ate]) => idade <= ate) ?? faixas[faixas.length - 1];
  const [, c, m] = faixa;
  return c - m * Math.log10(soma);
}

/**
 * Jackson, Pollock & Ward (1980) — 4 dobras, só para mulheres.
 *
 * Tríceps, abdominal, supra-ilíaca e coxa.
 * DC = 1,0960950 − 0,0006952(Σ4) + 0,0000011(Σ4)² − 0,0000714(idade)
 *
 * Do Quadro 5 do manual que ela mandou. Não há versão masculina publicada
 * nessa tabela, e por isso a tela não oferece essa opção para homem em vez
 * de reaproveitar a fórmula feminina.
 */
export function densidadePollock4(soma, idade) {
  if (!soma || !idade) return null;
  return 1.096095 - 0.0006952 * soma + 0.0000011 * soma * soma - 0.0000714 * idade;
}

/**
 * Percentual de gordura a partir da densidade corporal.
 *
 * Siri WE. Body composition from fluid spaces and density. 1961.
 * %G = (495 / DC) − 450
 */
export function siri(densidade) {
  if (!densidade) return null;
  return 495 / densidade - 450;
}

/**
 * Brozek et al. (1963) — a outra conversão de densidade em percentual.
 *
 * %G = (4,57 / DC − 4,142) × 100. Dá um pouco menos que Siri em gordura
 * alta e um pouco mais em gordura baixa; qual usar é escolha dela, e por
 * isso as duas estão aqui em vez de eu decidir.
 */
export function brozek(densidade) {
  if (!densidade) return null;
  return (4.57 / densidade - 4.142) * 100;
}

/**
 * Faulkner (1968) — percentual direto, sem passar por densidade.
 *
 * Soma de tríceps, subescapular, supra-ilíaca e abdominal.
 * %G = (soma × 0,153) + 5,783
 */
export function faulkner(soma) {
  if (!soma) return null;
  return soma * 0.153 + 5.783;
}

// ---------------------------------------------------------------------------
// Os modelos da Tabela 2 que ela mandou (Páscoa, com a fonte de cada autor)
//
// Cada linha daquela tabela traz a equação de densidade E a conversão em
// percentual que o autor usou. Não são intercambiáveis: Petroski e Lean
// fecham com (498/D) − 453, Katch & McArdle com Brozek, e o resto com Siri.
// Aplicar Siri em cima de todas seria trocar a conta do autor pela minha.
// ---------------------------------------------------------------------------

/** Guedes (1985) — universitários, 17 a 27 anos. Tríceps, supra-ilíaca e abdominal. */
export function densidadeGuedes(soma) {
  if (!soma) return null;
  return 1.17136 - 0.06706 * Math.log10(soma);
}

/**
 * Petroski (1995) — 18 a 66 anos.
 * Subescapular, tríceps, supra-ilíaca e panturrilha medial.
 */
export function densidadePetroski(soma, idade) {
  if (!soma || !idade) return null;
  return 1.10726863 - 0.00081201 * soma + 0.00000212 * soma * soma - 0.00041761 * idade;
}

/** Durnin & Rahaman (1967) — 18 a 33. Bíceps, tríceps, subescapular e supra-ilíaca. */
export function densidadeDurninRahaman(soma) {
  if (!soma) return null;
  return 1.161 - 0.0632 * Math.log10(soma);
}

/** Lean et al. (1996) — 17 a 65. Bíceps, tríceps, subescapular e supra-ilíaca. */
export function densidadeLean(soma, idade) {
  if (!soma || !idade) return null;
  return 1.1862 - 0.0684 * Math.log10(soma) - 0.000601 * idade;
}

/** Thorland (1984), atletas de 14 a 19 — 3 dobras: tríceps, subescapular e axilar. */
export function densidadeThorland3(soma) {
  if (!soma) return null;
  return 1.1136 - 0.00154 * soma + 0.00000516 * soma * soma;
}

/** Thorland (1984), atletas de 14 a 19 — 7 dobras. */
export function densidadeThorland7(soma) {
  if (!soma) return null;
  return 1.1091 - 0.00052 * soma + 0.00000032 * soma * soma;
}

/**
 * Katch & McArdle (1973) — universitários.
 *
 * Única da tabela que NÃO usa somatório: cada dobra entra com o seu próprio
 * coeficiente. Somar as três antes daria outro número.
 */
export function densidadeKatch(triceps, subescapular, abdominal) {
  if (!triceps || !subescapular || !abdominal) return null;
  return 1.09665 - 0.00103 * triceps - 0.00056 * subescapular - 0.00054 * abdominal;
}

/**
 * Slaughter (1988) — estudantes de 16 a 18. Tríceps e subescapular.
 *
 * Devolve o percentual direto; a densidade é derivada dele, não o contrário.
 */
export function slaughter(soma) {
  if (!soma) return null;
  return 1.21 * soma - 0.008 * soma * soma - 5.5;
}

/**
 * As três conversões de densidade em percentual que a tabela usa.
 *
 * `siri` e `lohman` só parecem a mesma coisa: 495/D − 450 contra 498/D −
 * 453. A diferença entre elas é 3 × (1 − D) / D — entre 0,05 e 0,3 ponto
 * percentual num corpo comum, e maior justamente nas pacientes mais
 * magras. Pequena demais para alguém estranhar olhando a tela, que é
 * exatamente o motivo de cada autor precisar ficar com a sua.
 */
export const CONVERSOES = {
  siri: { rotulo: "Siri", calcular: (d) => (4.95 / d - 4.5) * 100 },
  lohman: { rotulo: "(498/D) − 453", calcular: (d) => 498 / d - 453 },
  brozek: { rotulo: "Brozek", calcular: (d) => (4.57 / d - 4.142) * 100 },
};

/** Massa de gordura em kg, a partir do percentual. */
export function massaGorda(pesoKg, percentual) {
  if (!pesoKg || percentual === null || percentual === undefined) return null;
  return (pesoKg * percentual) / 100;
}

/** Massa livre de gordura (massa magra) em kg. */
export function massaMagra(pesoKg, percentual) {
  const gorda = massaGorda(pesoKg, percentual);
  if (gorda === null) return null;
  return pesoKg - gorda;
}

// ---------------------------------------------------------------------------
// Gasto energético
// ---------------------------------------------------------------------------

/**
 * Mifflin-St Jeor (1990) — taxa metabólica basal.
 *
 * Peso em kg, altura em cm, idade em anos.
 */
export function mifflin(pesoKg, alturaCm, idade, sexo) {
  if (!pesoKg || !alturaCm || !idade) return null;
  const base = 10 * pesoKg + 6.25 * alturaCm - 5 * idade;
  return sexo === "masculino" ? base + 5 : base - 161;
}

/**
 * Harris-Benedict revisada por Roza & Shizgal (1984).
 */
export function harrisBenedict(pesoKg, alturaCm, idade, sexo) {
  if (!pesoKg || !alturaCm || !idade) return null;
  return sexo === "masculino"
    ? 88.362 + 13.397 * pesoKg + 4.799 * alturaCm - 5.677 * idade
    : 447.593 + 9.247 * pesoKg + 3.098 * alturaCm - 4.33 * idade;
}

/**
 * Cunningham (1980) — usa a massa magra, não o peso total.
 *
 * É a que faz sentido quando a composição corporal foi medida, que é o caso
 * aqui: duas pessoas de 70 kg com massa magra diferente não gastam igual.
 */
export function cunningham(massaMagraKg) {
  if (!massaMagraKg) return null;
  return 500 + 22 * massaMagraKg;
}

/**
 * FAO/OMS (1985) — taxa metabólica basal a partir do peso.
 *
 * Do manual do CEPRAN/UNESP que ela mandou (Tabela 24). A única entrada é o
 * peso; a faixa de idade escolhe os coeficientes.
 */
const FAO = {
  masculino: [
    [30, 15.3, 679],
    [60, 11.6, 879],
    [200, 13.5, 487],
  ],
  feminino: [
    [30, 14.7, 496],
    [60, 8.7, 829],
    [200, 10.5, 596],
  ],
};

export function faoOms(pesoKg, idade, sexo) {
  if (!pesoKg || !idade) return null;
  const faixas = FAO[sexo] ?? FAO.feminino;
  const faixa = faixas.find(([ate]) => idade <= ate) ?? faixas[faixas.length - 1];
  const [, coeficiente, constante] = faixa;
  return coeficiente * pesoKg + constante;
}

/**
 * Fator atividade da FAO/OMS (1985), Tabela 25 do mesmo manual.
 *
 * Muda com a idade e com o sexo — e é por isso que ele não pode ser um
 * número solto na tela: a mesma "atividade moderada" vale 1,80 para um homem
 * de 40 e 1,65 para uma mulher de 40.
 */
export function fatorFao(atividade, idade, sexo) {
  const ate65 = { leve: [1.55, 1.55], moderada: [1.8, 1.65], intensa: [2.1, 1.8] };
  const acima = { leve: [1.4, 1.4], moderada: [1.6, 1.6], intensa: [1.9, 1.8] };
  const tabela = idade > 65 ? acima : ate65;
  const par = tabela[atividade];
  if (!par) return null;
  return sexo === "masculino" ? par[0] : par[1];
}

/**
 * Faixas de distribuição de macronutrientes, em percentual das calorias.
 *
 * Tabela 29 do manual do CEPRAN. Servem para conferir a divisão que ela
 * escolheu, não para impor nada: é ela quem prescreve.
 */
export const FAIXAS_MACROS = {
  dri2005: { rotulo: "DRIs (2005)", carboidrato: [45, 65], proteina: [10, 35], lipideo: [20, 35] },
  who2003: { rotulo: "WHO (2003)", carboidrato: [55, 75], proteina: [10, 15], lipideo: [15, 30] },
  sban1990: { rotulo: "SBAN (1990)", carboidrato: [60, 70], proteina: [10, 12], lipideo: [20, 25] },
};

/** Fatores de atividade clássicos, para multiplicar a taxa basal. */
export const ATIVIDADE = [
  { chave: "sedentario", rotulo: "Sedentário", fator: 1.2 },
  { chave: "leve", rotulo: "Leve (1 a 3 dias por semana)", fator: 1.375 },
  { chave: "moderado", rotulo: "Moderado (3 a 5 dias)", fator: 1.55 },
  { chave: "intenso", rotulo: "Intenso (6 a 7 dias)", fator: 1.725 },
  { chave: "muito_intenso", rotulo: "Muito intenso (2x por dia, trabalho físico)", fator: 1.9 },
];

// ---------------------------------------------------------------------------
// Dieta
// ---------------------------------------------------------------------------

/**
 * Quanto de um nutriente há em N gramas do alimento.
 *
 * A TACO é por 100 g de parte comestível. Valor ausente devolve `null` e
 * NÃO entra como zero na soma — o total passa a dizer "parcial", que é
 * honesto, em vez de mostrar um número inventado.
 */
export function porGramas(valorPor100g, gramas) {
  if (valorPor100g === null || valorPor100g === undefined) return null;
  return (valorPor100g * gramas) / 100;
}

/**
 * Soma uma lista de valores que pode ter buracos.
 *
 * Devolve { total, faltando } — quantos itens não tinham dado. Quem mostra
 * decide o que dizer, mas ninguém pode fingir que o buraco era zero.
 */
export function somar(valores) {
  let total = 0;
  let faltando = 0;
  for (const v of valores) {
    if (v === null || v === undefined) faltando += 1;
    else total += v;
  }
  return { total, faltando };
}

/** Distribuição de macros em percentual das calorias totais. */
export function distribuicao(carboidratoG, proteinaG, lipideoG) {
  const kcal = carboidratoG * 4 + proteinaG * 4 + lipideoG * 9;
  if (!kcal) return null;
  return {
    kcal,
    carboidrato: ((carboidratoG * 4) / kcal) * 100,
    proteina: ((proteinaG * 4) / kcal) * 100,
    lipideo: ((lipideoG * 9) / kcal) * 100,
  };
}

/** Gramas por quilo de peso — a leitura que ela usa para prescrever. */
export function porQuilo(gramas, pesoKg) {
  if (!pesoKg) return null;
  return gramas / pesoKg;
}


// ---------------------------------------------------------------------------
// Índices e faixas de referência
// ---------------------------------------------------------------------------

/**
 * Relação cintura/quadril.
 *
 * Os pontos de corte são os da OMS (2008): risco aumentado a partir de 0,85
 * na mulher e 0,90 no homem.
 */
export function relacaoCinturaQuadril(cinturaCm, quadrilCm) {
  if (!cinturaCm || !quadrilCm) return null;
  return cinturaCm / quadrilCm;
}

export function riscoRCQ(rcq, sexo) {
  if (rcq === null) return null;
  const corte = sexo === "masculino" ? 0.9 : 0.85;
  return rcq >= corte ? "Risco aumentado" : "Baixo risco";
}

/**
 * Circunferência da cintura, pontos de corte da OMS (2008) para risco
 * metabólico: 80 cm na mulher, 94 cm no homem.
 */
export function riscoCintura(cinturaCm, sexo) {
  if (!cinturaCm) return null;
  const corte = sexo === "masculino" ? 94 : 80;
  return cinturaCm < corte ? "Adequada" : "Aumentada";
}

/** Classificação do IMC para adultos, OMS. */
export function classificarIMC(valor) {
  if (!valor) return null;
  if (valor < 18.5) return "Baixo peso";
  if (valor < 25) return "Eutrófico";
  if (valor < 30) return "Sobrepeso";
  if (valor < 35) return "Obesidade grau I";
  if (valor < 40) return "Obesidade grau II";
  return "Obesidade grau III";
}

/** A faixa de peso que corresponde ao IMC 18,5 – 24,9 naquela altura. */
export function pesoIdeal(alturaM) {
  if (!alturaM) return null;
  return { minimo: 18.5 * alturaM * alturaM, maximo: 24.9 * alturaM * alturaM };
}

// ---------------------------------------------------------------------------
// Planejamento de macros
// ---------------------------------------------------------------------------

export const KCAL_POR_GRAMA = { carboidrato: 4, proteina: 4, lipideo: 9 };

/**
 * Do total de calorias e da divisão em percentual, quantos gramas de cada.
 *
 * Devolve também o g/kg quando o peso é informado, que é a leitura que ela
 * usa para conferir se a proteína está onde ela quer.
 */
export function macrosPorPercentual(kcalTotal, percentuais, pesoKg) {
  if (!kcalTotal) return null;
  const saida = {};
  for (const [macro, pct] of Object.entries(percentuais)) {
    const kcal = (kcalTotal * pct) / 100;
    const gramas = kcal / KCAL_POR_GRAMA[macro];
    saida[macro] = { kcal, gramas, porQuilo: pesoKg ? gramas / pesoKg : null };
  }
  return saida;
}

/**
 * VENTA — o ajuste calórico para chegar a um peso em um prazo.
 *
 * VENTA = (peso atual − peso desejado) × 7700 ÷ dias, e o consumo vira
 * GET − VENTA. O peso desejado NÃO entra no gasto: o gasto continua sendo
 * estimado com o peso de hoje, que é o que a pessoa carrega hoje.
 *
 * 7700 kcal por quilo é a equivalência clássica de Wishnofsky (1958).
 */
export function venta(pesoAtual, pesoDesejado, dias) {
  if (!pesoAtual || !pesoDesejado || !dias) return null;
  return ((pesoAtual - pesoDesejado) * 7700) / dias;
}
