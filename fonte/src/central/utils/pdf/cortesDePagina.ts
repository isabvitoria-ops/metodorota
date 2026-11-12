/**
 * Onde o documento é cortado em páginas.
 *
 * O PDF é montado fatiando um documento comprido em folhas A4. Cortar a cada
 * "altura de folha" partiria linhas de tabela e frases ao meio; aqui o corte
 * sobe até o último ponto que não atravessa nada que deva ficar inteiro.
 *
 * Tudo em pixels do documento, de cima para baixo. Sem tela e sem navegador:
 * a função recebe as medidas e devolve os cortes, e por isso é testável.
 */
export interface MedidasDoDocumento {
  /** Altura total do conteúdo. */
  altura: number;
  /** Altura útil da primeira folha e das seguintes. */
  alturaDaPrimeira: number;
  alturaDasDemais: number;
  /** Blocos que não podem ser partidos: [topo, base]. */
  inteiros: [number, number][];
  /** Pontos onde a folha TEM de virar (capa, "nova página antes de…"). */
  quebrasForcadas: number[];
}

/** Uma folha: de onde até onde ela mostra o documento. */
export interface FatiaDePagina {
  inicio: number;
  fim: number;
}

export function cortesDePagina(m: MedidasDoDocumento): FatiaDePagina[] {
  const fatias: FatiaDePagina[] = [];
  const forcadas = [...m.quebrasForcadas].sort((a, b) => a - b);
  // Menos de um pixel de sobra não vira folha nova.
  const FOLGA = 1;
  let inicio = 0;

  while (inicio < m.altura - FOLGA) {
    const cabe = fatias.length === 0 ? m.alturaDaPrimeira : m.alturaDasDemais;
    let fim = Math.min(inicio + cabe, m.altura);

    const forcada = forcadas.find((q) => q > inicio + FOLGA && q <= fim);
    if (forcada !== undefined) {
      fim = forcada;
    } else if (fim < m.altura) {
      // Sobe o corte enquanto ele atravessar um bloco inteiro. Um bloco mais
      // alto que a folha não tem para onde ir: é cortado onde a folha acaba.
      const limite = fim;
      let mexeu = true;
      while (mexeu) {
        mexeu = false;
        for (const [topo, base] of m.inteiros) {
          if (topo < fim - FOLGA && base > fim + FOLGA && topo > inicio + FOLGA) {
            fim = topo;
            mexeu = true;
          }
        }
      }
      if (fim <= inicio + FOLGA) fim = limite;
    }

    fatias.push({ inicio, fim });
    inicio = fim;
  }
  return fatias;
}
