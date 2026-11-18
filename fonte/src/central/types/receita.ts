/**
 * Cozinha (0095): as receitas da nutricionista.
 *
 * Os NÚMEROS de uma receita não são digitados: saem dos gramas de cada
 * ingrediente e da tabela de onde ele veio (TACO, IBGE, USDA, Meus alimentos),
 * no momento em que ela salva. Ficam guardados em `numeros` para a paciente
 * não precisar baixar as tabelas inteiras para ver as calorias.
 */

export type CategoriaReceita = "cafe" | "lanche" | "almoco_jantar" | "doce" | "outros";

export const CATEGORIAS_RECEITA: { valor: CategoriaReceita; rotulo: string }[] = [
  { valor: "cafe", rotulo: "Café da manhã" },
  { valor: "lanche", rotulo: "Lanche" },
  { valor: "almoco_jantar", rotulo: "Almoço e jantar" },
  { valor: "doce", rotulo: "Doce" },
  { valor: "outros", rotulo: "Outros" },
];

export function rotuloDaCategoria(c: CategoriaReceita): string {
  return CATEGORIAS_RECEITA.find((x) => x.valor === c)?.rotulo ?? "Outros";
}

/** As marcações que ela escolhe na receita. Quem decide se cabe é ela. */
export const MARCACOES_RECEITA = ["Rápida", "Leve", "Sem glúten", "Sem lactose", "Vegetariana"] as const;

export interface IngredienteReceita {
  /** Como a paciente lê: "1 cenoura média". */
  texto: string;
  /** De onde vêm os números. Nulo = ingrediente "a gosto", fora da conta. */
  alimentoId: string | null;
  alimentoNome: string | null;
  fonte: string | null;
  gramas: number | null;
}

export type ChaveNutriente = "energia_kcal" | "proteina" | "carboidrato" | "lipideos" | "fibra_alimentar";

export const NUTRIENTES_DA_RECEITA: { chave: ChaveNutriente; rotulo: string; unidade: string }[] = [
  { chave: "energia_kcal", rotulo: "Energia", unidade: "kcal" },
  { chave: "proteina", rotulo: "Proteína", unidade: "g" },
  { chave: "carboidrato", rotulo: "Carboidrato", unidade: "g" },
  { chave: "lipideos", rotulo: "Gordura", unidade: "g" },
  { chave: "fibra_alimentar", rotulo: "Fibra", unidade: "g" },
];

export interface NumerosDaReceita {
  /** Soma da receita inteira. Nulo quando nenhum ingrediente tem o valor. */
  total: Record<ChaveNutriente, number | null>;
  /** Ingredientes cuja tabela não traz o nutriente (a soma fica por baixo). */
  faltando: Partial<Record<ChaveNutriente, string[]>>;
  /** As tabelas usadas, para escrever a origem embaixo dos números. */
  fontes: string[];
  calculadoEm: string;
}

export interface Receita {
  id: string;
  titulo: string;
  categoria: CategoriaReceita;
  minutos: number | null;
  porcoes: number;
  tags: string[];
  ingredientes: IngredienteReceita[];
  preparo: string[];
  dica: string | null;
  numeros: NumerosDaReceita | null;
  publicada: boolean;
  atualizadoEm: string;
}

export interface ReceitaParaSalvar {
  id: string | null;
  titulo: string;
  categoria: CategoriaReceita;
  minutos: number | null;
  porcoes: number;
  tags: string[];
  ingredientes: IngredienteReceita[];
  preparo: string[];
  dica: string | null;
  numeros: NumerosDaReceita | null;
  publicada: boolean;
}

/** A Cozinha como a paciente vê: tudo o que ela pode abrir e o que foi mandado para ela. */
export interface MinhaCozinha {
  receitas: Receita[];
  enviadas: string[];
}

/** No cadastro: a receita e para quem ela já foi enviada. */
export interface ReceitaDaNutri extends Receita {
  enviadaPara: string[];
}
