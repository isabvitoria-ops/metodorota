/**
 * As dobras e circunferências, com os mesmos nomes da ferramenta de cálculo.
 *
 * POR QUE A LISTA MORA AQUI, e não nas duas telas: ela mede na ferramenta e
 * lança na Central. Nomes diferentes nos dois lugares fariam "Axilar média"
 * e "Axilar" virarem medidas distintas no histórico da mesma paciente, e a
 * evolução entre uma consulta e outra se partiria ao meio sem avisar.
 */

export interface CampoDeMedida {
  nome: string;
  unidade: "mm" | "cm";
}

export const DOBRAS: CampoDeMedida[] = [
  { nome: "Bíceps", unidade: "mm" },
  { nome: "Tríceps", unidade: "mm" },
  { nome: "Peitoral / tórax", unidade: "mm" },
  { nome: "Subescapular", unidade: "mm" },
  { nome: "Axilar média", unidade: "mm" },
  { nome: "Supra-ilíaca", unidade: "mm" },
  { nome: "Abdominal", unidade: "mm" },
  { nome: "Coxa", unidade: "mm" },
  { nome: "Panturrilha", unidade: "mm" },
];

export const CIRCUNFERENCIAS: CampoDeMedida[] = [
  { nome: "Peitoral", unidade: "cm" },
  { nome: "Cintura", unidade: "cm" },
  { nome: "Abdômen", unidade: "cm" },
  { nome: "Quadril", unidade: "cm" },
  { nome: "Braço direito", unidade: "cm" },
  { nome: "Braço contraído", unidade: "cm" },
  { nome: "Coxa direita", unidade: "cm" },
  { nome: "Coxa esquerda", unidade: "cm" },
  { nome: "Panturrilha direita", unidade: "cm" },
  { nome: "Panturrilha esquerda", unidade: "cm" },
];

/**
 * Só o número de um valor guardado.
 *
 * As avaliações lançadas antes destes campos guardam "9,6 mm" no mesmo
 * lugar onde agora vai "9,6". Ler as duas formas é o que impede uma
 * avaliação antiga de aparecer vazia na hora de editar.
 */
export function numeroDaMedida(valor: string | undefined): string {
  if (!valor) return "";
  const achado = valor.trim().match(/-?\d+(?:[.,]\d+)?/);
  return achado ? achado[0].replace(".", ",") : "";
}

/** O que a paciente lê: "9,6 mm". Vazio quando não foi medido. */
export function valorComUnidade(numero: string, unidade: string): string {
  const limpo = numero.trim();
  return limpo ? `${limpo} ${unidade}` : "";
}

/**
 * Monta a lista para guardar, deixando de fora o que ela não mediu.
 *
 * "Os que eu não preencher, tipo sei lá não peguei dobra do peitoral, nem
 * precisa aparecer pro paciente." Campo em branco não vira medida: some da
 * lista em vez de virar uma linha sem número.
 */
export function medidasPreenchidas(
  campos: CampoDeMedida[],
  valores: Record<string, string>,
): { nome: string; valor: string }[] {
  return campos
    .map((c) => ({ nome: c.nome, valor: valorComUnidade(valores[c.nome] ?? "", c.unidade) }))
    .filter((m) => m.valor !== "");
}

/** O caminho de volta: da lista guardada para os campos da tela. */
export function valoresDeMedidas(
  medidas: { nome: string; valor: string }[] | undefined,
): Record<string, string> {
  const saida: Record<string, string> = {};
  for (const m of medidas ?? []) saida[m.nome] = numeroDaMedida(m.valor);
  return saida;
}
