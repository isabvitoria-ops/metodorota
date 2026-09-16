import type { Equivalencia } from "@/central/types";

/**
 * Equivalências cadastradas explicitamente.
 *
 * Só é preciso escrever uma linha aqui quando a troca **não** sai da razão
 * entre as porções dos dois alimentos — por exemplo quando a lista de
 * substituição traz um valor próprio para aquele par, ou quando a relação
 * não é linear (use `tipo: "tabela"`).
 *
 * Dentro de um grupo com `trocaPorPorcao: true`, qualquer par de alimentos
 * com porção cadastrada já é calculado automaticamente (ver
 * `utils/calculoTroca.ts`) — não repita esses pares aqui.
 *
 * COMO ACRESCENTAR UMA EQUIVALÊNCIA
 * ---------------------------------
 *   {
 *     id: "pao-para-tapioca",
 *     origemAlimentoId: "pao",
 *     destinoAlimentoId: "tapioca",
 *     regra: {
 *       tipo: "proporcional",
 *       de: { quantidade: 50, unidadeId: "g" },
 *       para: { quantidade: 40, unidadeId: "g" },
 *     },
 *     bidirecional: true,
 *     fonte: "Lista de substituição",
 *     observacao: null,
 *   }
 *
 * Para uma troca que não escala em linha reta, troque a regra por:
 *   regra: {
 *     tipo: "tabela",
 *     unidadeOrigemId: "g",
 *     unidadeDestinoId: "unidade",
 *     pontos: [ { de: 50, para: 1 }, { de: 120, para: 2 } ],
 *   }
 * O sistema interpola entre os pontos e nunca extrapola além deles.
 */
export const EQUIVALENCIAS: Equivalencia[] = [
  {
    id: "arroz-para-macarrao",
    origemAlimentoId: "arroz-cozido",
    destinoAlimentoId: "macarrao-cozido",
    regra: {
      tipo: "proporcional",
      de: { quantidade: 100, unidadeId: "g" },
      para: { quantidade: 80, unidadeId: "g" },
    },
    bidirecional: true,
    fonte: "Lista de substituição",
    observacao: null,
    ativo: true,
  },
];
