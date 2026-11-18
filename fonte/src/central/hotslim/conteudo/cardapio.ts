/**
 * Hot Slim — cardápio da Etapa 1 (dias 1 a 7, repouso digestivo).
 *
 * Cada item é { alimento, g }: o id da base (alimentos.ts) e o peso, do
 * jeito que a pessoa pesa (cozido para carnes e carboidratos, cru para grãos
 * secos como aveia, tapioca e flocão). As calorias NÃO são escritas aqui:
 * são calculadas da base, então nunca ficam desatualizadas.
 *
 * O teste confere, para toda opção:
 * - todos os alimentos existem e estão liberados na semana;
 * - nenhum passa do limite de FODMAP da porção;
 * - as calorias ficam a ±5% da meta da refeição;
 * - proteína e fibra ficam acima do mínimo da refeição.
 */

import type { MetaRefeicao } from "./regras.ts";

export interface ItemCardapio {
  alimento: string;
  g: number;
}

export interface OpcaoCardapio {
  id: string;
  nome: string;
  itens: ItemCardapio[];
  preparo?: string;
}

export type CardapioEtapa = Record<MetaRefeicao["id"], OpcaoCardapio[]>;

export const CARDAPIO_ETAPA_1: CardapioEtapa = {
  cafe: [
    { id: "c1", nome: "Ovos com tapioca e mamão", itens: [{ alimento: "ovo", g: 100 }, { alimento: "tapioca", g: 35 }, { alimento: "chia", g: 10 }, { alimento: "mamao", g: 140 }, { alimento: "colageno", g: 10 }], preparo: "Ovos mexidos sem óleo na frigideira antiaderente. Chia por cima do mamão. Colágeno no café ou na água." },
    { id: "c2", nome: "Crepioca com muçarela e kiwi", itens: [{ alimento: "ovo", g: 100 }, { alimento: "tapioca", g: 35 }, { alimento: "mucarela", g: 25 }, { alimento: "kiwi", g: 150 }], preparo: "Bata os ovos com a tapioca, doure dos dois lados e recheie com a muçarela." },
    { id: "c3", nome: "Mingau de aveia com morango", itens: [{ alimento: "aveia", g: 40 }, { alimento: "leite-sl", g: 200 }, { alimento: "colageno", g: 15 }, { alimento: "morango", g: 65 }, { alimento: "chia", g: 10 }, { alimento: "pasta-amendoim", g: 8 }], preparo: "Cozinhe a aveia no leite sem lactose por 3 minutos. Desligue, misture o colágeno e finalize com morango, chia e pasta de amendoim." },
    { id: "c4", nome: "Cuscuz com ovos e kiwi", itens: [{ alimento: "flocao", g: 35 }, { alimento: "ovo", g: 100 }, { alimento: "azeite", g: 3 }, { alimento: "kiwi", g: 150 }, { alimento: "colageno", g: 10 }], preparo: "Hidrate o flocão com água e sal e cozinhe no vapor. Ovos cozidos ou mexidos." },
    { id: "c5", nome: "Iogurte com aveia e mirtilo", itens: [{ alimento: "iogurte-sl", g: 170 }, { alimento: "aveia", g: 40 }, { alimento: "colageno", g: 10 }, { alimento: "mirtilo", g: 100 }, { alimento: "chia", g: 5 }, { alimento: "pasta-amendoim", g: 8 }] },
  ],
  almoco: [
    { id: "a1", nome: "Frango, arroz e legumes", itens: [{ alimento: "frango-peito", g: 130 }, { alimento: "arroz", g: 140 }, { alimento: "abobrinha", g: 65 }, { alimento: "cenoura", g: 100 }, { alimento: "vagem", g: 75 }, { alimento: "azeite", g: 6 }] },
    { id: "a2", nome: "Peixe com batata e cabotiá", itens: [{ alimento: "peixe-branco", g: 170 }, { alimento: "batata", g: 250 }, { alimento: "cabotia", g: 150 }, { alimento: "berinjela", g: 70 }, { alimento: "azeite", g: 10 }], preparo: "Tudo assado na mesma forma, com limão, sal e ervas." },
    { id: "a3", nome: "Salmão com mandioca e arroz", itens: [{ alimento: "salmao", g: 110 }, { alimento: "mandioca", g: 75 }, { alimento: "arroz", g: 50 }, { alimento: "cenoura", g: 100 }, { alimento: "abobrinha", g: 65 }, { alimento: "azeite", g: 3 }] },
    { id: "a4", nome: "Sobrecoxa com quinoa e couve", itens: [{ alimento: "frango-sobrecoxa", g: 110 }, { alimento: "quinoa", g: 150 }, { alimento: "pimentao", g: 60 }, { alimento: "couve", g: 60 }, { alimento: "azeite", g: 3 }], preparo: "Couve refogada até murchar bem (na Etapa 1 nada vai cru)." },
  ],
  lanche: [
    { id: "l1", nome: "Pipoca com creme de cacau", itens: [{ alimento: "pipoca", g: 30 }, { alimento: "iogurte-sl", g: 130 }, { alimento: "colageno", g: 15 }, { alimento: "cacau", g: 5 }], preparo: "Pipoca estourada sem óleo (micro-ondas em vasilha de vidro tampada, ou pipoqueira). Misture iogurte, colágeno e cacau." },
    { id: "l2", nome: "Panqueca de banana", itens: [{ alimento: "banana", g: 75 }, { alimento: "ovo", g: 50 }, { alimento: "aveia", g: 20 }, { alimento: "colageno", g: 10 }], preparo: "Amasse a banana, misture o ovo, a aveia e o colágeno, e doure em frigideira antiaderente. Canela à vontade." },
    { id: "l3", nome: "Biscoito de arroz com pasta de amendoim", itens: [{ alimento: "biscoito-arroz", g: 18 }, { alimento: "pasta-amendoim", g: 12 }, { alimento: "chia", g: 5 }, { alimento: "morango", g: 65 }, { alimento: "iogurte-sl", g: 130 }] },
    { id: "l4", nome: "Vitamina de morango e banana", itens: [{ alimento: "morango", g: 65 }, { alimento: "banana", g: 100 }, { alimento: "leite-amendoa", g: 200 }, { alimento: "colageno", g: 15 }, { alimento: "chia", g: 10 }] },
  ],
  jantar: [
    { id: "j1", nome: "Frango com purê de cabotiá", itens: [{ alimento: "frango-peito", g: 110 }, { alimento: "cabotia", g: 200 }, { alimento: "abobrinha", g: 65 }, { alimento: "arroz", g: 80 }, { alimento: "azeite", g: 6 }] },
    { id: "j2", nome: "Omelete com frango, batata e cenoura", itens: [{ alimento: "ovo", g: 100 }, { alimento: "frango-peito", g: 50 }, { alimento: "espinafre", g: 60 }, { alimento: "batata", g: 200 }, { alimento: "cenoura", g: 100 }, { alimento: "azeite", g: 9 }], preparo: "Espinafre refogado dentro da omelete." },
    { id: "j3", nome: "Macarrão de arroz com camarão", itens: [{ alimento: "camarao", g: 200 }, { alimento: "macarrao-arroz", g: 145 }, { alimento: "abobrinha", g: 65 }, { alimento: "tomate", g: 65 }, { alimento: "cenoura", g: 60 }, { alimento: "azeite", g: 9 }], preparo: "Tomate e legumes refogados no azeite com manjericão. Sem molho pronto." },
    { id: "j4", nome: "Peixe com arroz, cenoura e vagem", itens: [{ alimento: "peixe-branco", g: 150 }, { alimento: "arroz", g: 110 }, { alimento: "cenoura", g: 80 }, { alimento: "vagem", g: 75 }, { alimento: "azeite", g: 8 }] },
  ],
};
