import type { RefeicaoProtocolo } from "@/central/types/protocolo";

/**
 * Minimizar as refeições enquanto ela monta o plano.
 *
 * O PROBLEMA QUE ISTO RESOLVE
 *
 * Um protocolo de seis refeições, cada uma com duas ou três opções de três
 * a cinco itens, passa de cem campos numa página só. Para mexer no jantar
 * ela rola a tela inteira, e no caminho perde de vista onde estava. Foi
 * exatamente isto que ela pediu — o mesmo recurso do DietSystem.
 *
 * MINIMIZAR É SÓ VISUAL. Nada é salvo, nada é descartado, nada muda no
 * conteúdo do protocolo. Uma refeição fechada continua inteira; ela só não
 * está ocupando tela. Isso importa porque o contrário — fechar e perder o
 * que estava escrito — seria o pior defeito possível numa tela de montar
 * plano, e é o tipo de coisa que só aparece depois de uma hora de trabalho.
 *
 * POR QUE O ESTADO FICA NO PAI, POR ÍNDICE
 *
 * Porque "minimizar todas" precisa existir: com seis refeições abertas, o
 * ganho só aparece quando ela fecha tudo de uma vez e abre a que interessa.
 * Um estado dentro de cada bloco não teria como responder a esse botão.
 *
 * O preço é que índice se desloca quando ela move uma refeição para cima ou
 * para baixo — e aí a fechada seria a vizinha, não a que ela moveu. O
 * `moverRecolhidas` acompanha a troca; sem ele o recurso funcionaria em
 * quase todos os casos e mentiria justamente quando ela reorganiza o plano.
 */

/** Fecha ou abre uma. */
export function alternar(recolhidas: ReadonlySet<number>, indice: number): Set<number> {
  const proximo = new Set(recolhidas);
  if (proximo.has(indice)) proximo.delete(indice);
  else proximo.add(indice);
  return proximo;
}

/** Todas fechadas. */
export function todas(quantas: number): Set<number> {
  const s = new Set<number>();
  for (let i = 0; i < quantas; i++) s.add(i);
  return s;
}

/**
 * Acompanha uma refeição que trocou de lugar com a vizinha.
 *
 * `de` e `para` são as duas posições que se trocaram. Quem estava fechado
 * continua fechado, no novo lugar.
 */
export function moverRecolhidas(
  recolhidas: ReadonlySet<number>,
  de: number,
  para: number,
): Set<number> {
  if (de === para) return new Set(recolhidas);
  const proximo = new Set(recolhidas);
  const tinhaDe = recolhidas.has(de);
  const tinhaPara = recolhidas.has(para);
  proximo.delete(de);
  proximo.delete(para);
  if (tinhaDe) proximo.add(para);
  if (tinhaPara) proximo.add(de);
  return proximo;
}

/**
 * Quando uma refeição é removida, todos os índices depois dela andam um
 * para trás. Sem isto, apagar o café da manhã fecharia o lanche.
 */
export function removerRecolhida(recolhidas: ReadonlySet<number>, indice: number): Set<number> {
  const proximo = new Set<number>();
  for (const i of recolhidas) {
    if (i < indice) proximo.add(i);
    else if (i > indice) proximo.add(i - 1);
  }
  return proximo;
}

/**
 * O que a refeição fechada mostra no lugar do conteúdo.
 *
 * Tem que ser suficiente para ela ACHAR a refeição sem abrir — nome e hora
 * já aparecem no cabeçalho, então o que falta é o tamanho. "2 opções · 7
 * itens" responde "é esta mesma?" sem um clique.
 *
 * Refeição sem item nenhum diz "vazia", e não "0 itens": ela está montando,
 * e uma refeição vazia é algo a terminar, não um número.
 */
export function resumoDaRefeicao(refeicao: RefeicaoProtocolo): string {
  const opcoes = refeicao.opcoes.length;
  const itens = refeicao.opcoes.reduce((total, o) => total + o.itens.length, 0);
  if (itens === 0) return "vazia";
  const partes = [`${itens} ${itens === 1 ? "item" : "itens"}`];
  if (opcoes > 1) partes.unshift(`${opcoes} opções`);
  return partes.join(" · ");
}
