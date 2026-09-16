import type { ItemMontador } from "@/types";
import { COD } from "./fichasAlimento";

/**
 * Catálogo do "Montar uma refeição" de Marina, portado do protótipo
 * (constante `POOL`). `quantidadeBase` é a porção cheia quando o alimento
 * vem sozinho no grupo — a divisão entre irmãos do mesmo grupo acontece em
 * services/montadorService, não aqui.
 */
export const MONTADOR_POOL_MARINA: ItemMontador[] = [
  { alimentoCodigoTaco: COD.arroz, nomeExibicao: "Arroz branco cozido", grupo: "carb", quantidadeBase: { valor: 4, unidade: "colheres de sopa" } },
  { alimentoCodigoTaco: COD.batata, nomeExibicao: "Batata inglesa cozida", grupo: "carb", quantidadeBase: { valor: 2, unidade: "unidades pequenas" } },
  { alimentoCodigoTaco: COD.aveia, nomeExibicao: "Aveia em flocos", grupo: "carb", quantidadeBase: { valor: 3, unidade: "colheres de sopa" } },
  {
    alimentoCodigoTaco: COD.pao,
    nomeExibicao: "Pão francês",
    grupo: "carb",
    quantidadeBase: { valor: 1, unidade: "unidade" },
    aviso: "Fermenta mais que as outras opções desta fase.",
  },
  { alimentoCodigoTaco: COD.frango, nomeExibicao: "Frango grelhado", grupo: "prot", quantidadeBase: { valor: 1, unidade: "filé médio" } },
  { alimentoCodigoTaco: COD.ovo, nomeExibicao: "Ovo cozido", grupo: "prot", quantidadeBase: { valor: 2, unidade: "unidades" } },
  {
    alimentoCodigoTaco: COD.feijao,
    nomeExibicao: "Feijão carioca cozido",
    grupo: "legum",
    quantidadeBase: { valor: 1, unidade: "concha rasa" },
    aviso: "Uma concha rasa é o limite desta fase.",
  },
  { alimentoCodigoTaco: COD.banana, nomeExibicao: "Banana prata", grupo: "fruta", quantidadeBase: { valor: 1, unidade: "unidade média" } },
  { alimentoCodigoTaco: COD.maca, nomeExibicao: "Maçã", grupo: "fruta", bloqueado: "Fora do cardápio na fase 1. Volta na reintrodução." },
  { alimentoCodigoTaco: COD.leite, nomeExibicao: "Leite integral", grupo: "prot", bloqueado: "Contém lactose. Fora nesta fase." },
  { alimentoCodigoTaco: COD.abobrinha, nomeExibicao: "Abobrinha refogada", grupo: "vegetal", livre: true },
  { alimentoCodigoTaco: COD.cenoura, nomeExibicao: "Cenoura cozida", grupo: "vegetal", livre: true },
  { alimentoCodigoTaco: COD.azeite, nomeExibicao: "Azeite de oliva", grupo: "gordura", quantidadeBase: { valor: 1, unidade: "colher de sopa" } },
];
