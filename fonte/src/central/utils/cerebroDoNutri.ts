/**
 * Utilitários do Cérebro do Nutri.
 *
 * A extração de PDF em si acontece no navegador com pdf.js, e o cliente é
 * quem manda o texto pronto para o banco (a Edge Function ficaria cara e
 * lenta para isso). Este arquivo cuida das partes que precisam de
 * exatidão e teste:
 *
 *   * partir o texto em trechos de tamanho controlado, com sobreposição
 *     (senão a frase que cai na fronteira some da busca);
 *   * escolher o caminho do PDF no balde, com carimbo de tempo;
 *   * dizer por que um arquivo não serve (mesma cortesia dos exames).
 *
 * O tamanho do trecho é escolhido de propósito: ~800 palavras cabem em
 * uma janela pequena de LLM, sobra espaço para umas oito citações na
 * hora da pergunta, e os embeddings do voyage-3-large lidam bem com esse
 * comprimento. Aumentar demais dilui o significado; diminuir demais
 * quebra a ideia da frase.
 */

/** 20 MB — o mesmo do balde. */
export const TAMANHO_MAXIMO = 20 * 1024 * 1024;

/** Quantas palavras por trecho, com sobreposição para não perder fronteira. */
export const PALAVRAS_POR_TRECHO = 800;
export const SOBREPOSICAO = 100;

export function tamanhoBonito(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

export function porQueNaoServe(arquivo: { name: string; size: number; type: string }): string | null {
  if (arquivo.size === 0) return "Este arquivo está vazio.";
  if (arquivo.size > TAMANHO_MAXIMO) {
    return `Este PDF tem ${tamanhoBonito(arquivo.size)} e o limite é ${tamanhoBonito(TAMANHO_MAXIMO)}.`;
  }
  const tipo = arquivo.type || (arquivo.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "");
  if (tipo !== "application/pdf") {
    return "O Cérebro só aceita PDF. Se for texto colado, use a outra caixa.";
  }
  return null;
}

/**
 * Higieniza o texto extraído do PDF.
 *
 * pdf.js devolve frases com quebras estranhas ("meta-\n bolismo"), múltiplos
 * espaços e "\f" no fim de página. Isso ficaria embutido nos trechos e
 * viraria trigrama sem sentido — melhor limpar aqui, uma vez, e não em
 * cada busca.
 */
export function normalizarTexto(texto: string): string {
  return texto
    // Palavras cortadas na quebra de linha: "diabé-\n ticos" -> "diabéticos".
    .replace(/-\s*\n\s*/g, "")
    // Uma quebra de linha simples costuma ser quebra de parágrafo visual em
    // PDF, mas dentro do parágrafo. Vira espaço.
    .replace(/\n(?!\n)/g, " ")
    // Formfeed que vem entre páginas.
    .replace(/\f/g, "\n\n")
    // Espaços redundantes.
    .replace(/[ \t]+/g, " ")
    // Vários \n viram um só, para não gastar palavras à toa.
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Parte o texto em trechos de ~PALAVRAS_POR_TRECHO com sobreposição.
 *
 * A sobreposição existe por um caso concreto: a definição de "dieta de
 * baixo FODMAP" caindo no fim de um trecho e a explicação do que é
 * caindo no começo do seguinte. Sem sobreposição a busca acharia um dos
 * dois e a resposta ficaria pela metade.
 */
export function partirEmTrechos(texto: string): string[] {
  const limpo = normalizarTexto(texto);
  if (limpo.length === 0) return [];

  const palavras = limpo.split(/\s+/).filter((p) => p.length > 0);
  if (palavras.length === 0) return [];
  if (palavras.length <= PALAVRAS_POR_TRECHO) return [palavras.join(" ")];

  const trechos: string[] = [];
  const passo = PALAVRAS_POR_TRECHO - SOBREPOSICAO;
  for (let inicio = 0; inicio < palavras.length; inicio += passo) {
    const fim = Math.min(inicio + PALAVRAS_POR_TRECHO, palavras.length);
    const trecho = palavras.slice(inicio, fim).join(" ").trim();
    if (trecho.length > 0) trechos.push(trecho);
    if (fim === palavras.length) break;
  }
  return trechos;
}

/**
 * O caminho do PDF dentro do balde do Cérebro.
 *
 * SEM PASTA POR PACIENTE — a base é da nutricionista. Só o carimbo de
 * tempo e o nome higienizado, para que dois "diabetes.pdf" não se
 * sobreponham.
 */
export function caminhoDoPdf(nomeOriginal: string): string {
  const limpo = nomeOriginal
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/-\./g, ".")
    .replace(/^[-.]+|[-]+$/g, "")
    .slice(-80);
  return `${Date.now()}-${limpo || "documento.pdf"}`;
}
