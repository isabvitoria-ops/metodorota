import type { Alimento, Medida, Unidade } from "@/central/types";
import { catalogo } from "@/central/dados/catalogo";

/**
 * Conversão de unidades **dentro de um alimento**.
 *
 * Não existe tabela universal de "1 colher de sopa = X g": isso depende do
 * alimento e é cadastrado por ele (§5). Toda conversão passa pela unidade
 * base do alimento; se a unidade pedida não estiver cadastrada ali, a função
 * devolve `null` e quem chamou decide o que dizer ao paciente — nunca um
 * número aproximado.
 */

/** Quantidade expressa na unidade base do alimento. `null` = unidade não cadastrada. */
export function paraBase(alimento: Alimento, medida: Medida): number | null {
  if (medida.unidadeId === alimento.unidadeBaseId) return medida.quantidade;
  const cadastrada = alimento.medidas.find((m) => m.unidadeId === medida.unidadeId);
  if (!cadastrada || cadastrada.equivalenteNaBase === null) return null;
  return medida.quantidade * cadastrada.equivalenteNaBase;
}

/** Caminho inverso: um valor na unidade base, expresso na unidade pedida. */
export function daBase(alimento: Alimento, valorBase: number, unidadeId: string): number | null {
  if (unidadeId === alimento.unidadeBaseId) return valorBase;
  const cadastrada = alimento.medidas.find((m) => m.unidadeId === unidadeId);
  if (!cadastrada || !cadastrada.equivalenteNaBase) return null;
  return valorBase / cadastrada.equivalenteNaBase;
}

export function converter(alimento: Alimento, medida: Medida, paraUnidadeId: string): number | null {
  const base = paraBase(alimento, medida);
  if (base === null) return null;
  return daBase(alimento, base, paraUnidadeId);
}

/**
 * Unidades que o seletor deve oferecer para este alimento (§5): a base mais
 * as medidas caseiras que já têm equivalência medida. Uma medida cadastrada
 * sem equivalência fica de fora — ela existe no cadastro, mas ainda não dá
 * para calcular com ela.
 */
export function unidadesDoAlimento(alimento: Alimento): Unidade[] {
  const ids = [
    alimento.unidadeBaseId,
    ...alimento.medidas.filter((m) => m.equivalenteNaBase !== null).map((m) => m.unidadeId),
  ];
  const vistos = new Set<string>();
  const resultado: Unidade[] = [];
  for (const id of ids) {
    if (vistos.has(id)) continue;
    vistos.add(id);
    const unidade = catalogo.unidade(id);
    if (unidade) resultado.push(unidade);
  }
  return resultado;
}

/**
 * Arredondamento de exibição.
 *
 * Unidade contínua (g, ml) não precisa de casa decimal acima de 10 — "72 g"
 * é mais legível que "72,0 g" e mais honesto que "71,96 g". Unidade discreta
 * vai para o meio mais próximo, porque meia fatia existe e 0,37 fatia não.
 */
export function arredondarExibicao(valor: number, unidade: Unidade | null): number {
  if (unidade && !unidade.continua) {
    return Math.max(0.5, Math.round(valor * 2) / 2);
  }
  if (valor >= 10) return Math.round(valor);
  return Math.round(valor * 10) / 10;
}

/** Rótulo da unidade já no singular/plural certo para a quantidade. */
export function rotuloUnidade(quantidade: number, unidade: Unidade | null, unidadeId: string): string {
  if (!unidade) return unidadeId;
  return quantidade <= 1 ? unidade.singular : unidade.abreviacao;
}

/** "72 g", "2 colheres de sopa", "1 fatia". */
export function textoMedida(medida: Medida, unidade: Unidade | null): string {
  const formatado = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(medida.quantidade);
  return `${formatado} ${rotuloUnidade(medida.quantidade, unidade, medida.unidadeId)}`;
}
