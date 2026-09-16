import type { Quantidade, UnidadeExibicao } from "@/types";

/** Fração legível: 0.5 → "½", 1.5 → "1 e ½". Portado literalmente do protótipo (fmtN). */
export function formatarNumero(n: number): string {
  const inteiro = Math.floor(n);
  const meio = n - inteiro >= 0.5;
  if (inteiro === 0) return "½";
  return meio ? `${inteiro} e ½` : `${inteiro}`;
}

/** Plural simples de unidade quando a quantidade cai para meio. Portado literalmente (fmtQtd). */
export function formatarQuantidade(valor: number, unidade: string): string {
  if (valor <= 0.5) {
    const singular = unidade
      .replace("colheres", "colher")
      .replace("unidades", "unidade")
      .replace("pequenas", "pequena")
      .replace("médias", "média");
    return `½ ${singular}`;
  }
  return `${formatarNumero(valor)} ${unidade}`;
}

export function textoQuantidade(q: Quantidade): string {
  return formatarQuantidade(q.valor, q.unidade);
}

/**
 * Regra #7: a unidade de exibição é decisão da nutricionista por paciente —
 * nunca automática. Se não houver `quantidadeCaseira` cadastrada, cai para
 * grama mesmo com preferência "caseira" (mesmo comportamento do protótipo
 * do painel: "quem não tiver equivalência cadastrada continua aparecendo em grama").
 */
export function resolverQuantidadeExibicao(
  quantidade: Quantidade,
  quantidadeCaseira: Quantidade | undefined,
  preferencia: UnidadeExibicao,
): string {
  if (preferencia === "caseira" && quantidadeCaseira) {
    return textoQuantidade(quantidadeCaseira);
  }
  return textoQuantidade(quantidade);
}
