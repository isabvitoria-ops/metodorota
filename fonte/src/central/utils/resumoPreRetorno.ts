/** As contas do resumo pré-retorno (N28). Puras, testadas. */

const somar = (iso: string, d: number) => {
  const x = new Date(`${iso}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + d);
  return x.toISOString().slice(0, 10);
};

/**
 * Os trechos de 3 dias ou mais sem nenhum registro, entre o dia seguinte à
 * consulta e ontem (hoje ainda está acontecendo).
 */
export function lacunas(diasComRegistro: string[], desde: string, hoje: string, minimo = 3): { de: string; ate: string; dias: number }[] {
  const com = new Set(diasComRegistro);
  const saida: { de: string; ate: string; dias: number }[] = [];
  let inicio: string | null = null;
  let n = 0;
  for (let d = somar(desde, 1); d < hoje; d = somar(d, 1)) {
    if (com.has(d)) {
      if (inicio && n >= minimo) saida.push({ de: inicio, ate: somar(d, -1), dias: n });
      inicio = null;
      n = 0;
    } else {
      inicio = inicio ?? d;
      n += 1;
    }
  }
  if (inicio && n >= minimo) saida.push({ de: inicio, ate: somar(hoje, -1), dias: n });
  return saida;
}

/** O tipo de Bristol que mais apareceu (o menor, no empate) e quantas vezes. */
export function bristolMaisFrequente(bristol: Record<string, number>): { tipo: number; vezes: number } | null {
  const pares = Object.entries(bristol).map(([t, n]) => ({ tipo: Number(t), vezes: n }));
  if (!pares.length) return null;
  return pares.sort((a, b) => b.vezes - a.vezes || a.tipo - b.tipo)[0]!;
}

export const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/**
 * A nota do check-in antes e depois do marco: a última respondida até o dia
 * da consulta e a última depois dela. Respostas atrasadas já chegam com nota
 * nula e ficam de fora, como na ficha.
 */
export function notaAntesEAgora(
  envios: { data: string; nota: number | null }[],
  desde: string,
): { antes: { data: string; nota: number } | null; agora: { data: string; nota: number } | null } {
  const validos = envios
    .filter((e): e is { data: string; nota: number } => e.nota !== null)
    .sort((a, b) => a.data.localeCompare(b.data));
  const antes = validos.filter((e) => e.data <= desde).slice(-1)[0] ?? null;
  const agora = validos.filter((e) => e.data > desde).slice(-1)[0] ?? null;
  return { antes, agora };
}
