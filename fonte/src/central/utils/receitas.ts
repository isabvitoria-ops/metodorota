/**
 * As contas da Cozinha. Puras: quem traz o valor de cada nutriente é quem
 * chama (no cadastro, a base de alimentos dos Cálculos), para isto poder ser
 * testado sem baixar tabela nenhuma.
 *
 * AUSÊNCIA NUNCA VIRA ZERO — a mesma regra das tabelas (nutri/dados/LEIA-ME):
 * ingrediente cuja tabela não traz fibra fica fora da soma de fibra, e a tela
 * avisa que aquele número está por baixo.
 */
import type {
  CategoriaReceita,
  ChaveNutriente,
  IngredienteReceita,
  NumerosDaReceita,
  Receita,
} from "@/central/types/receita";
import { NUTRIENTES_DA_RECEITA } from "@/central/types/receita";

export type ValorDoNutriente = (alimentoId: string, chave: ChaveNutriente) => number | null;

export function calcularNumeros(
  ingredientes: IngredienteReceita[],
  valor: ValorDoNutriente,
  agora: Date = new Date(),
): NumerosDaReceita | null {
  const contam = ingredientes.filter((i) => i.alimentoId && i.gramas !== null && i.gramas > 0);
  if (!contam.length) return null;
  const total = {} as Record<ChaveNutriente, number | null>;
  const faltando: Partial<Record<ChaveNutriente, string[]>> = {};
  for (const { chave } of NUTRIENTES_DA_RECEITA) {
    let soma: number | null = null;
    for (const i of contam) {
      const v = valor(i.alimentoId as string, chave);
      if (v === null || !Number.isFinite(v)) {
        (faltando[chave] ??= []).push(i.alimentoNome ?? i.texto);
        continue;
      }
      soma = (soma ?? 0) + (v * (i.gramas as number)) / 100;
    }
    total[chave] = soma;
  }
  const fontes = [...new Set(contam.map((i) => i.fonte).filter((f): f is string => !!f))];
  return { total, faltando, fontes, calculadoEm: agora.toISOString() };
}

/** Um nutriente dividido pelas porções. */
export function porPorcao(valor: number | null | undefined, porcoes: number): number | null {
  if (valor === null || valor === undefined || !(porcoes > 0)) return null;
  return valor / porcoes;
}

const NOME_DA_FONTE: Record<string, string> = {
  taco: "TACO 4ª ed. (NEPA/UNICAMP)",
  ibge: "IBGE (POF 2008-2009)",
  usda: "USDA FoodData Central",
  meu: "Meus alimentos (rótulo cadastrado pela nutricionista)",
  importada: "tabela importada pela nutricionista",
};

export function textoDasFontes(fontes: string[]): string {
  if (!fontes.length) return "";
  return fontes.map((f) => NOME_DA_FONTE[f] ?? f).join(" · ");
}

/** A refeição do protocolo → a categoria de receita que cabe nela. */
export function categoriaDaRefeicao(nomeDaRefeicao: string): CategoriaReceita | null {
  const n = nomeDaRefeicao
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  if (/cafe|desjejum/.test(n)) return "cafe";
  if (/almoco|jantar|janta/.test(n)) return "almoco_jantar";
  if (/lanche|colacao|ceia/.test(n)) return "lanche";
  if (/sobremesa|doce/.test(n)) return "doce";
  return null;
}

const semAcento = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Busca por nome OU ingrediente, sem acento, todas as palavras. */
export function receitaCombina(r: Receita, busca: string): boolean {
  const palavras = semAcento(busca).split(/\s+/).filter(Boolean);
  if (!palavras.length) return true;
  const alvo = semAcento([r.titulo, ...r.ingredientes.map((i) => `${i.texto} ${i.alimentoNome ?? ""}`)].join(" "));
  return palavras.every((p) => alvo.includes(p));
}

/** Arredonda para a tela: kcal sem casa, gramas com uma. */
export function formatarNutriente(v: number | null | undefined, chave: ChaveNutriente): string {
  if (v === null || v === undefined) return "—";
  if (chave === "energia_kcal") return Math.round(v).toLocaleString("pt-BR");
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 0 });
}
