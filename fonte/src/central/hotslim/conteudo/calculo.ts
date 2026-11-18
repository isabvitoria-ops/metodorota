/**
 * Hot Slim — contas feitas a partir da base. Nenhuma tela escreve número à
 * mão: calorias, macros, trocas e lista de compras saem daqui.
 */

import { ALIMENTOS, alimento, type AlimentoHS, type SecaoCompra } from "./alimentos.ts";
import type { CardapioEtapa, ItemCardapio, OpcaoCardapio } from "./cardapio.ts";

export interface Macros {
  kcal: number;
  proteina: number;
  carboidrato: number;
  gordura: number;
  fibra: number;
}

export function macrosDoItem(item: ItemCardapio): Macros {
  const [kcal, proteina, carboidrato, gordura, fibra] = alimento(item.alimento).por100;
  const f = item.g / 100;
  return { kcal: kcal * f, proteina: proteina * f, carboidrato: carboidrato * f, gordura: gordura * f, fibra: fibra * f };
}

export function macrosDaOpcao(opcao: OpcaoCardapio): Macros {
  return opcao.itens.map(macrosDoItem).reduce(
    (s, m) => ({ kcal: s.kcal + m.kcal, proteina: s.proteina + m.proteina, carboidrato: s.carboidrato + m.carboidrato, gordura: s.gordura + m.gordura, fibra: s.fibra + m.fibra }),
    { kcal: 0, proteina: 0, carboidrato: 0, gordura: 0, fibra: 0 },
  );
}

/** "130 g", "200 ml", ou a medida caseira quando ajuda. */
export function textoDaQuantidade(item: ItemCardapio): string {
  const a = alimento(item.alimento);
  const liquido = a.grupo === "laticinio" && (a.id.startsWith("leite") || a.id.startsWith("bebida"));
  return `${Math.round(item.g)} ${liquido ? "ml" : "g"}`;
}

/** Alimentos liberados numa semana do desafio. */
export function liberadosNaSemana(semana: number): AlimentoHS[] {
  return ALIMENTOS.filter((a) => a.semana <= semana);
}

/**
 * Trocas: quanto de outro alimento do mesmo grupo dá as mesmas calorias.
 * Se a troca passaria do limite de FODMAP, ela não aparece — a tela nunca
 * sugere uma porção que o próprio desafio proíbe.
 */
export interface Troca {
  alimento: AlimentoHS;
  g: number;
}

export function trocasDe(item: ItemCardapio, semana: number): Troca[] {
  const base = alimento(item.alimento);
  if (base.grupo === "gordura" || base.grupo === "laticinio") return [];
  const kcalAlvo = macrosDoItem(item).kcal;
  return liberadosNaSemana(semana)
    .filter((a) => a.grupo === base.grupo && a.id !== base.id && a.por100[0] > 0)
    .map((a) => ({ alimento: a, g: Math.round(((kcalAlvo / a.por100[0]) * 100) / 5) * 5 }))
    .filter((t) => t.g > 0 && (t.alimento.limiteG === null || t.g <= t.alimento.limiteG));
}

/**
 * A lista de compras é o cardápio: só entra o que alguma opção usa. Assim a
 * lista nunca manda comprar o que o cardápio não usa (era uma das
 * contradições do material antigo).
 */
export function listaDeCompras(cardapio: CardapioEtapa): { secao: SecaoCompra; itens: AlimentoHS[] }[] {
  const usados = new Set<string>();
  for (const opcoes of Object.values(cardapio)) for (const o of opcoes) for (const i of o.itens) usados.add(i.alimento);
  const ordem: SecaoCompra[] = ["Proteínas", "Sem lactose e bebidas vegetais", "Carboidratos", "Frutas", "Legumes e verduras", "Gorduras e sementes"];
  return ordem
    .map((secao) => ({ secao, itens: ALIMENTOS.filter((a) => a.secao === secao && usados.has(a.id)) }))
    .filter((s) => s.itens.length > 0);
}
