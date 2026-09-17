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
 * Faulkner (1968) — percentual direto, sem passar por densidade.
 *
 * Soma de tríceps, subescapular, supra-ilíaca e abdominal.
 * %G = (soma × 0,153) + 5,783
 */
export function faulkner(soma) {
  if (!soma) return null;
  return soma * 0.153 + 5.783;
}

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
