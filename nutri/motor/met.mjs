/**
 * O gasto de uma atividade física pelo MET (Compêndio de Atividades Físicas).
 *
 * LÍQUIDO POR PADRÃO. Um MET é o gasto em repouso. Quando o gasto basal (GEB)
 * já está na conta, somar `MET × peso × horas` conta o repouso de novo durante
 * o exercício. Por isso o padrão é (MET − 1): só o que passa do repouso. A
 * versão bruta (a que o DietSystem usa) fica disponível, mas é escolha
 * explícita.
 *
 * kcal/dia = (MET − 1) × peso × (minutos ÷ 60) × (vezes por semana ÷ 7)
 *
 * Teste (spec): MET 8, 77,05 kg, 60 min, 3×/semana → bruto 264,2 kcal/dia;
 * líquido (8 − 1) = 231,2 kcal/dia.
 */
export function kcalDeAtividade({ met, pesoKg, minutos, vezesPorSemana, liquido = true }) {
  if (![met, pesoKg, minutos, vezesPorSemana].every((n) => Number.isFinite(n) && n > 0)) return null;
  if (vezesPorSemana > 7 * 6) return null;
  const base = liquido ? met - 1 : met;
  if (base <= 0) return 0;
  return base * pesoKg * (minutos / 60) * (vezesPorSemana / 7);
}

/** Soma uma lista de atividades; devolve o total e as linhas com o resultado de cada. */
export function totalDeAtividades(atividades, pesoKg, liquido = true) {
  const linhas = atividades.map((a) => ({
    ...a,
    kcal: kcalDeAtividade({ met: a.met, pesoKg, minutos: a.minutos, vezesPorSemana: a.vezes, liquido }),
  }));
  return { total: linhas.reduce((s, l) => s + (l.kcal ?? 0), 0), linhas };
}
