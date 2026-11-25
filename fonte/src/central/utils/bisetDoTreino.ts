/**
 * O biset (0109): dois exercícios feitos um seguido do outro, no mesmo
 * cartão. Cada um continua com o próprio vídeo e as próprias faixas.
 *
 * `bisetComProximo` no primeiro junta ele ao seguinte. Só pares: o segundo
 * do par não puxa um terceiro (um "triset" sairia sem querer de duas
 * caixinhas marcadas em sequência).
 */
export function emBlocos<T>(itens: T[], juntaComProximo: (atual: T, proximo: T) => boolean): T[][] {
  const blocos: T[][] = [];
  for (let i = 0; i < itens.length; i += 1) {
    const atual = itens[i]!;
    const proximo = itens[i + 1];
    if (proximo !== undefined && juntaComProximo(atual, proximo)) {
      blocos.push([atual, proximo]);
      i += 1;
    } else {
      blocos.push([atual]);
    }
  }
  return blocos;
}

/** Na montagem: em que posição do biset o exercício está (1, 2) ou nenhuma (0). */
export function posicaoNoBiset(marcas: (boolean | undefined)[], i: number): 0 | 1 | 2 {
  let k = 0;
  while (k < marcas.length) {
    if (marcas[k] && k + 1 < marcas.length) {
      if (k === i) return 1;
      if (k + 1 === i) return 2;
      k += 2;
    } else {
      k += 1;
    }
  }
  return 0;
}
