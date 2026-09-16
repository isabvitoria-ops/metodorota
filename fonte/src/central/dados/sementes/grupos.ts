import type { GrupoAlimentar } from "@/central/types";

/**
 * Grupos alimentares (§11) — cadastrados como dado, não como enum, para que
 * um grupo novo seja uma linha aqui e nada mais.
 *
 * A regra de "vegetais livres" (§12) vem do material da nutricionista:
 * quantidade livre, com porção mínima de 150 g no almoço e no jantar.
 */
export const GRUPOS: GrupoAlimentar[] = [
  {
    id: "carboidratos",
    nome: "Carboidratos",
    descricao: "Arroz, massas, tubérculos, pães e raízes.",
    ordem: 1,
    regra: { tipo: "porcoes" },
    trocaPorPorcao: true,
    // Do material: 1 porção de carboidrato equivale a 1 porção de fruta.
    // Só neste sentido — ver o comentário do grupo das frutas.
    trocaParaGrupos: ["frutas"],
    tags: ["carboidrato", "massa", "arroz", "pao", "tuberculo"],
  },
  {
    id: "proteinas",
    nome: "Proteínas",
    descricao: "Carnes, ovos, peixes e outras fontes proteicas.",
    ordem: 2,
    regra: { tipo: "porcoes" },
    trocaPorPorcao: true,
    trocaParaGrupos: [],
    tags: ["proteina", "carne", "ovo", "peixe", "frango"],
  },
  {
    id: "gorduras",
    nome: "Gorduras",
    descricao: "Azeites, oleaginosas, abacate e similares.",
    ordem: 3,
    regra: { tipo: "porcoes" },
    trocaPorPorcao: true,
    trocaParaGrupos: [],
    tags: ["gordura", "azeite", "castanha", "abacate"],
  },
  {
    id: "frutas",
    nome: "Frutas",
    descricao: "Frutas in natura e suas porções.",
    ordem: 4,
    regra: { tipo: "porcoes" },
    trocaPorPorcao: true,
    // Vazio de propósito: fruta não substitui carboidrato. A regra do
    // material vale num sentido só, e é o campo do carboidrato que a diz.
    trocaParaGrupos: [],
    tags: ["fruta"],
  },
  {
    id: "vegetais-livres",
    nome: "Vegetais livres",
    descricao: "Quantidade livre, respeitando a porção mínima das refeições principais.",
    ordem: 5,
    regra: {
      tipo: "livre",
      minimos: [
        { refeicao: "Almoço", medida: { quantidade: 150, unidadeId: "g" } },
        { refeicao: "Jantar", medida: { quantidade: 150, unidadeId: "g" } },
      ],
      texto: "Quantidade livre. No almoço e no jantar, a porção mínima é de 150 g.",
    },
    // Não há troca por porção aqui: o grupo não trabalha em porções fechadas.
    trocaPorPorcao: false,
    trocaParaGrupos: [],
    tags: ["vegetal", "legume", "verdura", "salada", "livre"],
  },
  {
    id: "outros",
    nome: "Outros",
    descricao: "Itens que não se encaixam nos grupos acima.",
    ordem: 6,
    regra: null,
    trocaPorPorcao: false,
    trocaParaGrupos: [],
    tags: ["outros"],
  },
];

export const GRUPO_POR_ID: ReadonlyMap<string, GrupoAlimentar> = new Map(GRUPOS.map((g) => [g.id, g]));
