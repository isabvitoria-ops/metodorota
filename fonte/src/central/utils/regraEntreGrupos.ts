import type { GrupoAlimentar } from "@/central/types";

/**
 * A frase da regra de mão única entre grupos.
 *
 * No material: 1 porção de carboidrato equivale a 1 porção de fruta, mas
 * fruta não vira carboidrato. É uma regra fácil de esquecer e fácil de
 * aplicar ao contrário, então ela é dita na tela dos dois grupos — e é
 * derivada de `trocaParaGrupos`, não escrita à mão: mudar o dado muda a
 * frase, e não existe o caso de a tela prometer uma coisa e o cálculo fazer
 * outra.
 */
export function fraseDeMaoUnica(grupo: GrupoAlimentar, grupos: GrupoAlimentar[]): string | null {
  const nome = (id: string) => grupos.find((g) => g.id === id)?.nome.toLowerCase() ?? null;

  const destino = grupo.trocaParaGrupos.map(nome).filter((n): n is string => n !== null);
  if (destino.length > 0) {
    return `Sabia? Uma porção de ${grupo.nome.toLowerCase()} pode virar uma porção de ${destino.join(" ou de ")} — mas nunca o contrário.`;
  }

  const origem = grupos
    .filter((g) => g.trocaParaGrupos.includes(grupo.id))
    .map((g) => g.nome.toLowerCase());
  if (origem.length > 0) {
    return `Sabia? Uma porção de ${origem.join(" ou de ")} pode virar uma porção de ${grupo.nome.toLowerCase()} — mas nunca o contrário.`;
  }

  return null;
}
