/**
 * A carinha que representa uma resposta de 0 a 10.
 *
 * Veio da referência que ela mandou: no histórico longitudinal, cada
 * resposta aparece como rosto, e não como número. O ganho é real — cinco
 * semanas de rostos se leem de relance, e cinco semanas de "7, 6, 8, 4, 9"
 * exigem parar e comparar.
 *
 * A CARINHA MOSTRA O VALOR JÁ INVERTIDO, e essa é a decisão que importa.
 * Em "quanta dor você sentiu", 2 é uma semana BOA — e tem que aparecer como
 * rosto contente. Mostrar o rosto do número cru faria a coluna de dor ficar
 * vermelha na melhor semana da paciente, e a tabela inteira mentiria de
 * relance, que é justamente quando ninguém confere.
 *
 * Por isso esta função recebe o valor JÁ NORMALIZADO por
 * `valorNaEscala()` — o mesmo que entra na pontuação. Uma segunda régua
 * aqui acabaria discordando da nota um dia.
 */

export interface Carinha {
  /** O desenho. */
  rosto: string;
  /** Para quem usa leitor de tela, e para o `title` no passar do mouse. */
  descricao: string;
  /** Para pintar a célula. */
  nivel: "muito-baixo" | "baixo" | "medio" | "alto" | "muito-alto";
}

const FAIXAS: { ate: number; carinha: Carinha }[] = [
  { ate: 2, carinha: { rosto: "😞", descricao: "muito ruim", nivel: "muito-baixo" } },
  { ate: 4, carinha: { rosto: "😕", descricao: "ruim", nivel: "baixo" } },
  { ate: 6, carinha: { rosto: "😐", descricao: "mais ou menos", nivel: "medio" } },
  { ate: 8, carinha: { rosto: "🙂", descricao: "bom", nivel: "alto" } },
  { ate: 10, carinha: { rosto: "😄", descricao: "muito bom", nivel: "muito-alto" } },
];

/**
 * `valor` é o resultado de `valorNaEscala()`: de 0 a 10, inversão já
 * aplicada. `null` é "não respondeu", e não uma carinha triste — as duas
 * coisas são diferentes e a tabela não pode confundi-las.
 */
export function carinhaDe(valor: number | null): Carinha | null {
  if (valor === null || Number.isNaN(valor)) return null;
  const preso = Math.min(Math.max(valor, 0), 10);
  return FAIXAS.find((f) => preso <= f.ate)?.carinha ?? null;
}

/**
 * A seta de variação em relação à semana anterior, como na referência.
 *
 * Igual devolve "=", e não "0": zero parece uma medida, "=" se lê como
 * "continua igual". E nenhum dos dois diz se é bom ou ruim.
 */
export function setaDaVariacao(variacao: number | null): string {
  if (variacao === null) return "";
  if (variacao === 0) return "=";
  return variacao > 0 ? `+${variacao}` : `−${Math.abs(variacao)}`;
}
