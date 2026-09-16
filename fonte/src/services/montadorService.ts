import type { ItemMontador } from "@/types";
import { NOME_GRUPO_CURTO } from "@/constants/alimentos";
import { formatarQuantidade } from "@/utils/quantidade";

export interface ItemMontadorResolvido extends ItemMontador {
  texto: string;
}

export interface ResultadoMontador {
  resolvidos: ItemMontadorResolvido[];
  problemas: string[];
  podeUsar: boolean;
}

/**
 * Motor do "Montar uma refeição" — porte literal da lógica do protótipo
 * (`Montador`). Divide a porção base entre os alimentos escolhidos do mesmo
 * grupo e arredonda para a fração de meio mais próxima (nunca abaixo de
 * meio). Regra #4 (inegociável): só redistribui gramas de itens que a
 * nutricionista já autorizou no pool — nunca introduz alimento novo nem
 * calcula equivalência nutricional.
 */
export function montarRefeicao(pool: ItemMontador[], codigosSelecionados: number[]): ResultadoMontador {
  const escolhidos = pool.filter((f) => codigosSelecionados.includes(f.alimentoCodigoTaco));
  const porGrupo = (g: string) => escolhidos.filter((f) => f.grupo === g);
  const contaveis = escolhidos.filter((f) => !f.livre);

  const resolvidos: ItemMontadorResolvido[] = escolhidos.map((f) => {
    if (f.livre || !f.quantidadeBase) {
      return { ...f, texto: "à vontade" };
    }
    const irmaos = porGrupo(f.grupo).filter((x) => !x.livre).length;
    const bruto = f.quantidadeBase.valor / irmaos;
    const arredondado = Math.max(0.5, Math.round(bruto * 2) / 2);
    return { ...f, texto: formatarQuantidade(arredondado, f.quantidadeBase.unidade) };
  });

  const problemas: string[] = [];
  if (porGrupo("carb").length === 0) {
    problemas.push("Falta uma fonte de energia. Escolha um carboidrato — arroz, batata ou aveia.");
  }
  if (porGrupo("prot").length === 0 && porGrupo("legum").length === 0) {
    problemas.push("Falta proteína. Escolha frango, ovo ou o feijão.");
  }
  (["carb", "prot", "fruta"] as const).forEach((g) => {
    if (porGrupo(g).filter((f) => !f.livre).length > 2) {
      problemas.push(`Escolha no máximo dois itens de ${(NOME_GRUPO_CURTO[g] ?? g).toLowerCase()} na mesma refeição.`);
    }
  });
  if (contaveis.length > 4) {
    problemas.push("Ficou pesado. Tente até quatro itens além dos vegetais.");
  }

  return {
    resolvidos,
    problemas,
    podeUsar: escolhidos.length > 0 && problemas.length === 0,
  };
}

export function descricaoParaDiario(resolvidos: ItemMontadorResolvido[]): string {
  return resolvidos.map((r) => `${r.nomeExibicao} — ${r.texto}`).join(" · ");
}
