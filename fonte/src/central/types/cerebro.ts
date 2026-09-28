/**
 * Cérebro do Nutri — a base de conhecimento privada da nutricionista.
 *
 * O material que ela guarda: PDFs de artigo, capítulo de livro, texto que
 * ela mesma escreveu. Ao atender uma paciente, o app busca aqui e propõe
 * uma conduta com citação. Ela aceita, edita ou rejeita, e a decisão
 * volta para a ficha.
 *
 * BASE PRIVADA. A paciente nunca vê nada disto — nem a base, nem a
 * pergunta, nem a resposta bruta. Só a conduta final, se e quando ela
 * escolher gravar.
 */

/** Um documento inteiro no Cérebro: um PDF ou um texto colado. */
export interface FonteDoCerebro {
  id: string;
  titulo: string;
  fonte: string | null;
  tipo: "pdf" | "texto";
  /** Caminho no balde para PDF; nulo para texto colado. */
  caminho: string | null;
  tamanho: number;
  /** Quantos pedaços buscáveis a fonte gerou. */
  trechos: number;
  /**
   * Quantos desses pedaços já têm embedding. Diferente de `trechos`
   * significa que a Edge Function ainda está indexando, ou que a chave
   * de embeddings não está configurada.
   */
  comEmbedding: number;
  criadoEm: string;
}

/** Um pedaço da base que casou com a busca. */
export interface TrechoCitado {
  id: string;
  fonteId: string;
  titulo: string;
  fonte: string | null;
  ordem: number;
  trecho: string;
  /** Distância coseno (busca por embedding) ou peso do tsvector (textual). */
  distancia?: number;
  peso?: number;
}

/**
 * Uma pergunta que a nutri fez ao Cérebro sobre uma paciente, e o que
 * saiu do laço aceita/edita/rejeita.
 */
export interface SugestaoDoCerebro {
  id: string;
  pergunta: string;
  resposta: string | null;
  citacoes: TrechoCitado[];
  feedback: "aceita" | "editada" | "rejeitada" | null;
  condutaFinal: string | null;
  motivo: string | null;
  criadoEm: string;
  respondidoEm: string | null;
}

/** Quanto ainda falta indexar. Alimenta o aviso na tela do Cérebro. */
export interface PendenciasDoCerebro {
  total: number;
  pendentes: number;
  fontes: number;
}
