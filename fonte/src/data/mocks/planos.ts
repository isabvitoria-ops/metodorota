import type { Plano, VersaoPlanoResumo } from "@/types";
import { COD } from "./fichasAlimento";
import { NUTRICIONISTA_ID, PACIENTE_MARINA_ID } from "./ids";

/**
 * Plano ativo de Marina (paciente "p1"), portado do protótipo (constantes
 * `PLANO` + `TROCAS` do app-paciente.jsx). Cores de refeição atribuídas por
 * ordem (regra #6) via `corRefeicaoPorOrdem` no momento de renderizar —
 * aqui só guardamos o `corId` já resolvido para o mock ficar estável.
 */
export const PLANO_MARINA: Plano = {
  id: "plano-marina-v3",
  nutricionistaId: NUTRICIONISTA_ID,
  pacienteId: PACIENTE_MARINA_ID,
  versao: 3,
  ativa: true,
  notaVersao: "Ajuste do jantar após relato de refluxo",
  faseRotulo: "Fase 1 · Restrição · dia 12 de 28",
  publicadoEm: "2026-07-28T09:00:00.000Z",
  criadoEm: "2026-06-22T09:00:00.000Z",
  atualizadoEm: "2026-07-28T09:00:00.000Z",
  refeicoes: [
    {
      id: "refeicao-cafe",
      planoId: "plano-marina-v3",
      nome: "Café da manhã",
      horario: "07:00",
      corId: "plum",
      ordem: 0,
      observacao: "Sente para comer. Sem líquido junto — beba 30 min antes ou depois.",
      opcoes: [
        {
          id: "opcao-cafe-unica",
          refeicaoId: "refeicao-cafe",
          ordem: 0,
          itens: [
            {
              id: "item-cafe-carb",
              opcaoId: "opcao-cafe-unica",
              slot: "Carboidrato",
              ordem: 0,
              alimentoCodigoTaco: COD.pao,
              nomeExibicao: "Pão francês",
              quantidade: { valor: 1, unidade: "unidade" },
              substituicoes: [],
            },
            {
              id: "item-cafe-prot",
              opcaoId: "opcao-cafe-unica",
              slot: "Proteína",
              ordem: 1,
              alimentoCodigoTaco: COD.ovo,
              nomeExibicao: "Ovo cozido",
              quantidade: { valor: 2, unidade: "unidades" },
              substituicoes: [],
            },
            {
              id: "item-cafe-fruta",
              opcaoId: "opcao-cafe-unica",
              slot: "Fruta",
              ordem: 2,
              alimentoCodigoTaco: COD.banana,
              nomeExibicao: "Banana prata",
              quantidade: { valor: 1, unidade: "unidade média" },
              substituicoes: [],
            },
          ],
        },
      ],
    },
    {
      id: "refeicao-almoco",
      planoId: "plano-marina-v3",
      nome: "Almoço",
      horario: "12:30",
      corId: "sage",
      ordem: 1,
      observacao: "Mastigue devagar. Tente demorar pelo menos 20 minutos.",
      regraVegetais: {
        ativa: true,
        minimoGramas: 100,
        itensLiberados: [
          { alimentoCodigoTaco: COD.abobrinha, nomeExibicao: "Abobrinha refogada" },
          { alimentoCodigoTaco: COD.cenoura, nomeExibicao: "Cenoura cozida" },
        ],
      },
      opcoes: [
        {
          id: "opcao-almoco-unica",
          refeicaoId: "refeicao-almoco",
          ordem: 0,
          itens: [
            {
              id: "item-almoco-carb",
              opcaoId: "opcao-almoco-unica",
              slot: "Carboidrato",
              ordem: 0,
              alimentoCodigoTaco: COD.arroz,
              nomeExibicao: "Arroz branco cozido",
              quantidade: { valor: 4, unidade: "colheres de sopa" },
              substituicoes: [
                {
                  id: "sub-almoco-carb-batata",
                  itemPlanoId: "item-almoco-carb",
                  alimentoCodigoTaco: COD.batata,
                  nomeExibicao: "Batata inglesa cozida",
                  quantidade: { valor: 2, unidade: "unidades pequenas" },
                },
                {
                  id: "sub-almoco-carb-aveia",
                  itemPlanoId: "item-almoco-carb",
                  alimentoCodigoTaco: COD.aveia,
                  nomeExibicao: "Aveia em flocos",
                  quantidade: { valor: 3, unidade: "colheres de sopa" },
                },
                {
                  id: "sub-almoco-carb-pao",
                  itemPlanoId: "item-almoco-carb",
                  alimentoCodigoTaco: COD.pao,
                  nomeExibicao: "Pão francês",
                  quantidade: { valor: 1, unidade: "unidade" },
                  aviso: "Contém glúten e fermenta mais que as outras opções desta fase.",
                },
              ],
            },
            {
              id: "item-almoco-prot",
              opcaoId: "opcao-almoco-unica",
              slot: "Proteína",
              ordem: 1,
              alimentoCodigoTaco: COD.frango,
              nomeExibicao: "Frango grelhado",
              quantidade: { valor: 1, unidade: "filé médio" },
              substituicoes: [
                {
                  id: "sub-almoco-prot-ovo",
                  itemPlanoId: "item-almoco-prot",
                  alimentoCodigoTaco: COD.ovo,
                  nomeExibicao: "Ovo cozido",
                  quantidade: { valor: 2, unidade: "unidades" },
                },
              ],
            },
            {
              id: "item-almoco-legum",
              opcaoId: "opcao-almoco-unica",
              slot: "Leguminosa",
              ordem: 2,
              alimentoCodigoTaco: COD.feijao,
              nomeExibicao: "Feijão carioca cozido",
              quantidade: { valor: 1, unidade: "concha rasa" },
              substituicoes: [],
            },
          ],
        },
      ],
    },
    {
      id: "refeicao-lanche",
      planoId: "plano-marina-v3",
      nome: "Lanche da tarde",
      horario: "16:00",
      corId: "gold",
      ordem: 2,
      opcoes: [
        {
          id: "opcao-lanche-unica",
          refeicaoId: "refeicao-lanche",
          ordem: 0,
          itens: [
            {
              id: "item-lanche-fibra",
              opcaoId: "opcao-lanche-unica",
              slot: "Fibra",
              ordem: 0,
              alimentoCodigoTaco: COD.aveia,
              nomeExibicao: "Aveia em flocos",
              quantidade: { valor: 3, unidade: "colheres de sopa" },
              substituicoes: [],
            },
            {
              id: "item-lanche-fruta",
              opcaoId: "opcao-lanche-unica",
              slot: "Fruta",
              ordem: 1,
              alimentoCodigoTaco: COD.banana,
              nomeExibicao: "Banana prata",
              quantidade: { valor: 1, unidade: "unidade média" },
              substituicoes: [],
            },
          ],
        },
      ],
    },
    {
      id: "refeicao-jantar",
      planoId: "plano-marina-v3",
      nome: "Jantar",
      horario: "19:30",
      corId: "clay",
      ordem: 3,
      observacao: "Termine pelo menos 2 h antes de deitar — ajuda no refluxo.",
      opcoes: [
        {
          id: "opcao-jantar-unica",
          refeicaoId: "refeicao-jantar",
          ordem: 0,
          itens: [
            {
              id: "item-jantar-carb",
              opcaoId: "opcao-jantar-unica",
              slot: "Carboidrato",
              ordem: 0,
              alimentoCodigoTaco: COD.batata,
              nomeExibicao: "Batata inglesa cozida",
              quantidade: { valor: 2, unidade: "unidades pequenas" },
              substituicoes: [],
            },
            {
              id: "item-jantar-prot",
              opcaoId: "opcao-jantar-unica",
              slot: "Proteína",
              ordem: 1,
              alimentoCodigoTaco: COD.ovo,
              nomeExibicao: "Ovo cozido",
              quantidade: { valor: 2, unidade: "unidades" },
              substituicoes: [],
            },
          ],
        },
      ],
    },
  ],
};

/** Histórico de versões (aba "Plano" do painel), portado do protótipo (`versoes` do AbaPlano). */
export const HISTORICO_VERSOES_MARINA: VersaoPlanoResumo[] = [
  { planoId: "plano-marina-v3", versao: 3, publicadoEm: "2026-07-28T09:00:00.000Z", nota: "Ajuste do jantar após relato de refluxo", ativa: true },
  { planoId: "plano-marina-v2", versao: 2, publicadoEm: "2026-07-10T09:00:00.000Z", nota: "Inclusão do lanche da tarde", ativa: false },
  { planoId: "plano-marina-v1", versao: 1, publicadoEm: "2026-06-22T09:00:00.000Z", nota: "Plano inicial", ativa: false },
];
