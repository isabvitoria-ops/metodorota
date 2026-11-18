/**
 * Regra de bolso (DietSystem): faixa de kcal por kg de peso ATUAL.
 *   perder peso: 20 a 25 kcal/kg;   ganhar peso: 30 a 35 kcal/kg.
 * Não é uma equação: é um intervalo de referência rápido, para conferir se o
 * plano está na ordem de grandeza certa. Exemplo (70 kg): 1.400–1.750 e 2.100–2.450.
 */
export const BOLSO = {
  perda: { min: 20, max: 25 },
  ganho: { min: 30, max: 35 },
};

export function regraDeBolso(pesoKg) {
  if (!(pesoKg > 0)) return null;
  return {
    perda: [BOLSO.perda.min * pesoKg, BOLSO.perda.max * pesoKg],
    ganho: [BOLSO.ganho.min * pesoKg, BOLSO.ganho.max * pesoKg],
  };
}
