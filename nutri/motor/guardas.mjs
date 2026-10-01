/**
 * Guardas clínicas: AVISAM quando a equação está fora da faixa para a qual foi
 * validada. Nunca bloqueiam (a nutricionista decide), e nunca deixam passar em
 * silêncio um número que parece certo e não vale para aquele paciente.
 */
export function imc(pesoKg, alturaCm) {
  if (!pesoKg || !alturaCm) return null;
  const m = alturaCm / 100;
  return pesoKg / (m * m);
}

export function avisosDaEquacao(equacao, entrada) {
  const avisos = [];
  const { idade, peso, alturaCm } = entrada;
  const [min, max] = equacao.idade ?? [0, 120];
  if (idade && (idade < min || idade > max)) {
    avisos.push(
      `${equacao.nome} foi desenvolvida para ${min === 0 ? "até" : "de"} ${max >= 120 ? `${min} anos em diante` : `${min} a ${max} anos`}; a idade informada é ${idade}. A conta sai, mas pode não valer para este paciente.`,
    );
  }
  const indice = imc(peso, alturaCm);
  if (indice && equacao.validadeImc) {
    const [a, b] = equacao.validadeImc;
    if (indice < a || indice > b) {
      avisos.push(
        `Esta equação vale para IMC de ${a} a ${b >= 120 ? "em diante" : b}; o IMC deste paciente é ${indice.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}.`,
      );
    }
  }
  if (indice && indice >= 35 && !equacao.validadeImc && equacao.categoria === "geral" && equacao.resultado === "geb") {
    avisos.push("IMC a partir de 35: considere a Horie-Waitzberg-Gonzalez (categoria Sobrepeso e obesidade).");
  }
  return avisos;
}

/** Resultado absurdo nunca aparece sem aviso. */
export function avisosDoResultado(kcal) {
  if (!Number.isFinite(kcal)) return [];
  if (kcal < 600 || kcal > 6000) {
    return [`${Math.round(kcal)} kcal/dia está fora de uma faixa plausível (600 a 6000). Confira os dados digitados.`];
  }
  return [];
}
