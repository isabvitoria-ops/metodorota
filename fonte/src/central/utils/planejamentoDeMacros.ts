/**
 * Planejamento de macros e meta de peso — as mesmas contas da aba "Macros e
 * gasto" da ferramenta de cálculo dela (nutri/calculos.mjs e
 * nutri/motor/bolso.mjs), trazidas para a aba de cálculos da avaliação.
 *
 * Nenhum número aqui é novo: cada constante cita de onde veio.
 */

export type Macro = "carboidrato" | "proteina" | "lipideo";
export type Percentuais = Record<Macro, number>;

/** Fatores de Atwater, os mesmos de `calculoEnergia.ts`. */
export const KCAL_POR_GRAMA: Record<Macro, number> = { carboidrato: 4, proteina: 4, lipideo: 9 };

/**
 * Faixas de distribuição de macronutrientes, em percentual das calorias.
 * Tabela 29 do manual do CEPRAN/UNESP. Servem para conferir a divisão, não
 * para impor nada: é ela quem prescreve.
 */
export const FAIXAS_MACROS: { chave: string; rotulo: string; faixas: Record<Macro, [number, number]> }[] = [
  { chave: "dri2005", rotulo: "DRIs (2005)", faixas: { carboidrato: [45, 65], proteina: [10, 35], lipideo: [20, 35] } },
  { chave: "who2003", rotulo: "WHO (2003)", faixas: { carboidrato: [55, 75], proteina: [10, 15], lipideo: [15, 30] } },
  { chave: "sban1990", rotulo: "SBAN (1990)", faixas: { carboidrato: [60, 70], proteina: [10, 12], lipideo: [20, 25] } },
];

/** Os três atalhos de divisão da ferramenta (carboidrato / proteína / gordura). */
export const DIVISOES_PRONTAS: Percentuais[] = [
  { carboidrato: 40, proteina: 40, lipideo: 20 },
  { carboidrato: 25, proteina: 40, lipideo: 35 },
  { carboidrato: 50, proteina: 25, lipideo: 25 },
];

export interface MacroPlanejado {
  kcal: number;
  gramas: number;
  /** g por kg de peso; `null` sem peso. */
  porQuilo: number | null;
}

/** Do total de calorias e da divisão em percentual, quantos gramas de cada. */
export function macrosPorPercentual(
  kcalTotal: number | null,
  percentuais: Percentuais,
  pesoKg: number | null,
): Record<Macro, MacroPlanejado> | null {
  if (!kcalTotal || kcalTotal <= 0) return null;
  const um = (macro: Macro): MacroPlanejado => {
    const kcal = (kcalTotal * percentuais[macro]) / 100;
    const gramas = kcal / KCAL_POR_GRAMA[macro];
    return { kcal, gramas, porQuilo: pesoKg && pesoKg > 0 ? gramas / pesoKg : null };
  };
  return { carboidrato: um("carboidrato"), proteina: um("proteina"), lipideo: um("lipideo") };
}

/** A frase de conferência da soma, igual à da ferramenta. */
export function mensagemDaSoma(percentuais: Percentuais): { fechado: boolean; texto: string } {
  const soma = percentuais.carboidrato + percentuais.proteina + percentuais.lipideo;
  if (Math.abs(soma - 100) < 1e-9) return { fechado: true, texto: "Soma 100% — fechado." };
  const diferenca = Math.round(Math.abs(100 - soma));
  const pontos = `${diferenca} ${diferenca === 1 ? "ponto" : "pontos"}`;
  const somaTexto = Math.round(soma).toLocaleString("pt-BR");
  return soma > 100
    ? { fechado: false, texto: `Soma ${somaTexto}%. ${diferenca === 1 ? "Sobra" : "Sobram"} ${pontos} para fechar 100%.` }
    : { fechado: false, texto: `Soma ${somaTexto}%. ${diferenca === 1 ? "Falta" : "Faltam"} ${pontos} para fechar 100%.` };
}

export interface ConferenciaDeFaixa {
  rotulo: string;
  itens: { macro: Macro; valor: number; minimo: number; maximo: number; dentro: boolean }[];
}

/** Como a divisão se compara com cada faixa publicada. */
export function conferirFaixas(percentuais: Percentuais): ConferenciaDeFaixa[] {
  const ordem: Macro[] = ["carboidrato", "proteina", "lipideo"];
  return FAIXAS_MACROS.map((f) => ({
    rotulo: f.rotulo,
    itens: ordem.map((macro) => {
      const [minimo, maximo] = f.faixas[macro];
      const valor = percentuais[macro];
      return { macro, valor, minimo, maximo, dentro: valor >= minimo && valor <= maximo };
    }),
  }));
}

/**
 * Regra de bolso (DietSystem): faixa de kcal por kg de peso ATUAL.
 *   perder peso: 20 a 25 kcal/kg;   ganhar peso: 30 a 35 kcal/kg.
 * Não é uma equação: é um intervalo para conferir a ordem de grandeza.
 */
export function regraDeBolso(pesoKg: number | null): { perda: [number, number]; ganho: [number, number] } | null {
  if (!pesoKg || pesoKg <= 0) return null;
  return { perda: [20 * pesoKg, 25 * pesoKg], ganho: [30 * pesoKg, 35 * pesoKg] };
}

export interface MetaDePeso {
  /** kcal por dia; positivo = déficit (perder), negativo = superávit (ganhar). */
  venta: number;
  kgPorSemana: number;
  /** Mais de 1 kg por semana: o ritmo costuma ser inviável. */
  ritmoAlto: boolean;
}

/**
 * VENTA — o ajuste calórico para chegar a um peso em um prazo.
 * VENTA = (peso atual − peso desejado) × 7700 ÷ dias. O consumo vira
 * GET − VENTA. 7700 kcal por quilo é a equivalência de Wishnofsky (1958).
 * O peso desejado não entra no gasto: o gasto é estimado com o peso de hoje.
 */
export function metaDePeso(pesoAtual: number | null, pesoDesejado: number | null, dias: number | null): MetaDePeso | null {
  if (!pesoAtual || !pesoDesejado || !dias) return null;
  if (pesoAtual < 0 || pesoDesejado < 0 || dias < 0) return null;
  const venta = ((pesoAtual - pesoDesejado) * 7700) / dias;
  const kgPorSemana = (Math.abs(pesoAtual - pesoDesejado) / dias) * 7;
  return { venta, kgPorSemana, ritmoAlto: kgPorSemana > 1 };
}

/** A divisão atual em percentual, a partir dos gramas (para começar o modo percentual). */
export function percentuaisDosGramas(ptnG: number | null, lipG: number | null, choG: number | null): Percentuais | null {
  if (ptnG === null || lipG === null || choG === null || ptnG < 0 || lipG < 0 || choG < 0) return null;
  const kcal = { proteina: ptnG * 4, lipideo: lipG * 9, carboidrato: choG * 4 };
  const total = kcal.proteina + kcal.lipideo + kcal.carboidrato;
  if (total <= 0) return null;
  const proteina = Math.round((kcal.proteina / total) * 100);
  const lipideo = Math.round((kcal.lipideo / total) * 100);
  return { proteina, lipideo, carboidrato: 100 - proteina - lipideo };
}
