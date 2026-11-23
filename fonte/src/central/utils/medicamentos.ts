/** As contas de medicamentos × nutrientes (N31). Puras, testadas. */
import type { EntradaDaBase, MedicamentoDaPaciente } from "@/central/types/medicamentos";
import { normalizar } from "@/central/utils/texto";

/** As entradas da base que casam com o nome que ela escreveu ("Omeprazol 20 mg" casa com IBP). */
export function entradasDoMedicamento(nome: string, base: EntradaDaBase[]): EntradaDaBase[] {
  const palavras = normalizar(nome).replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter(Boolean);
  return base.filter((e) => e.termos.some((t) => palavras.includes(normalizar(t))));
}

export interface NutrienteAAcompanhar {
  nutriente: string;
  /** Os medicamentos dela que levam a este nutriente. */
  medicamentos: string[];
  fontes: string[];
}

/**
 * O que acompanhar, juntando os medicamentos ativos dela. Só entra entrada
 * CONFERIDA pela nutricionista: o que está "para conferir" não vira lembrete
 * nem linha de PDF.
 */
export function nutrientesAAcompanhar(meds: MedicamentoDaPaciente[], base: EntradaDaBase[]): NutrienteAAcompanhar[] {
  const conferidas = base.filter((e) => e.conferidoEm);
  const porNutriente = new Map<string, NutrienteAAcompanhar>();
  for (const m of meds.filter((x) => x.ativo)) {
    for (const e of entradasDoMedicamento(m.nome, conferidas)) {
      for (const n of e.nutrientes) {
        const chave = normalizar(n.nutriente);
        const item = porNutriente.get(chave) ?? { nutriente: n.nutriente, medicamentos: [], fontes: [] };
        if (!item.medicamentos.includes(m.nome)) item.medicamentos.push(m.nome);
        if (!item.fontes.includes(n.fonte)) item.fontes.push(n.fonte);
        porNutriente.set(chave, item);
      }
    }
  }
  return [...porNutriente.values()];
}

/**
 * Os exames do pedido cujo nome traz o nome do nutriente ("Ferro" →
 * "Ferro sérico"). É só busca por nome: quem decide o pedido é ela.
 */
export function examesComONome(nutrientes: string[], exames: string[]): string[] {
  return exames.filter((ex) => nutrientes.some((n) => normalizar(ex).includes(normalizar(n))));
}

/** As linhas do PDF e a lista numerada de fontes. Só remédio ativo e só base CONFERIDA. */
export function montarPdfDeMedicamentos(
  meds: MedicamentoDaPaciente[],
  base: EntradaDaBase[],
  rotuloDoTipo: (t: MedicamentoDaPaciente["tipo"]) => string,
): {
  linhas: { nome: string; tipo: string; uso: string; acompanhar: { nutriente: string; fonte: number }[]; anotacao: string | null }[];
  fontes: string[];
} {
  const conferidas = base.filter((e) => e.conferidoEm);
  const fontes: string[] = [];
  const numero = (f: string) => {
    const i = fontes.indexOf(f);
    if (i >= 0) return i + 1;
    fontes.push(f);
    return fontes.length;
  };
  const linhas = meds
    .filter((m) => m.ativo)
    .map((m) => ({
      nome: m.nome,
      tipo: m.tipo === "medicamento" ? "" : rotuloDoTipo(m.tipo),
      uso: [m.dose && !normalizar(m.nome).includes(normalizar(m.dose)) ? m.dose : null, m.horario, m.desde ? `desde ${m.desde}` : null]
        .filter(Boolean)
        .join(" · "),
      acompanhar: entradasDoMedicamento(m.nome, conferidas).flatMap((e) =>
        e.nutrientes.map((n) => ({ nutriente: n.nutriente, fonte: numero(n.fonte) })),
      ),
      anotacao: m.anotacao,
    }));
  return { linhas, fontes };
}
