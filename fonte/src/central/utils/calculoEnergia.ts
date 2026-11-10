/**
 * GET, VET e macronutrientes a partir do que está nos campos da avaliação.
 *
 * As contas são as que a aba de cálculos já fazia ao "usar os valores":
 *
 *   GET = TMB × fator de atividade        (arredondado para kcal inteira)
 *   VET = GET + ajuste                    (arredondado para kcal inteira)
 *   PTN e LIP em g/dia = g/kg × peso      (uma casa)
 *   CHO em g/dia = o que sobra do VET     (VET − PTN×4 − LIP×9) ÷ 4, uma casa
 *
 * Proteína e carboidrato a 4 kcal/g e gordura a 9 kcal/g (fatores de Atwater).
 * Ficam aqui, num lugar só, para a tela mostrar exatamente o que será salvo —
 * antes o resumo arredondava o VET de um jeito e o botão de outro.
 */
export interface EntradaDeEnergia {
  peso: number | null;
  tmb: number | null;
  fatorAtividade: number | null;
  ajusteEnergetico: number | null;
  /** O VET que está no campo. Preenchido, é ele que divide os macros. */
  vet: number | null;
  ptnGKg: number | null;
  lipGKg: number | null;
  ptnG: number | null;
  lipG: number | null;
  choG: number | null;
}

export interface MacroCalculado {
  sigla: "PTN" | "LIP" | "CHO";
  nome: string;
  gramas: number;
  kcal: number;
  /** Parte do VET, de 0 a 100, sem casa. */
  percentual: number;
}

export interface EnergiaCalculada {
  get: number | null;
  /** O VET que sai da conta (GET + ajuste). */
  vet: number | null;
  /** O VET que vale para os macros: o do campo; sem ele, o da conta. */
  vetUsado: number | null;
  ptnG: number | null;
  lipG: number | null;
  choG: number | null;
  macros: MacroCalculado[];
  /** Proteína e gordura, sozinhas, já passam do VET. */
  estourou: boolean;
}

const umaCasa = (n: number) => Math.round(n * 10) / 10;

export function energiaEMacros(d: EntradaDeEnergia): EnergiaCalculada {
  const get = d.tmb !== null && d.fatorAtividade !== null ? Math.round(d.tmb * d.fatorAtividade) : null;
  const vet = get !== null && d.ajusteEnergetico !== null ? Math.round(get + d.ajusteEnergetico) : null;
  const vetUsado = d.vet ?? vet;

  const ptnG = d.ptnGKg !== null && d.peso !== null ? umaCasa(d.ptnGKg * d.peso) : d.ptnG;
  const lipG = d.lipGKg !== null && d.peso !== null ? umaCasa(d.lipGKg * d.peso) : d.lipG;
  const choG =
    vetUsado !== null && ptnG !== null && lipG !== null ? umaCasa((vetUsado - ptnG * 4 - lipG * 9) / 4) : d.choG;

  const macros: MacroCalculado[] = [];
  if (vetUsado !== null && vetUsado > 0) {
    const linha = (sigla: MacroCalculado["sigla"], nome: string, gramas: number | null, kcalPorGrama: number) => {
      if (gramas === null || gramas <= 0) return;
      const kcal = Math.round(gramas * kcalPorGrama);
      macros.push({ sigla, nome, gramas, kcal, percentual: Math.round((kcal / vetUsado) * 100) });
    };
    linha("PTN", "Proteína", ptnG, 4);
    linha("LIP", "Gordura", lipG, 9);
    linha("CHO", "Carboidrato", choG, 4);
  }

  return { get, vet, vetUsado, ptnG, lipG, choG, macros, estourou: choG !== null && choG < 0 };
}
