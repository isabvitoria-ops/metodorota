/**
 * O protocolo alimentar de uma paciente.
 *
 * O formato segue o que a nutricionista já escreve no Google Docs: refeições
 * com uma tabela de três colunas (alimento, quantidade, substituição), as
 * observações soltas entre elas, e os textos de rotina no fim. Nada aqui
 * inventa estrutura que ela não use — quem manda é o documento dela.
 *
 * O app NÃO calcula nada a partir disto. Não há caloria, nem macro, nem
 * porção: o cálculo é feito por ela, fora, como ela pediu. Estas telas
 * registram e mostram o que ela decidiu.
 */

export interface ItemProtocolo {
  /** "Pão de forma" */
  alimento: string;
  /** "3 fatias - 75g" — texto livre, do jeito que ela escreveu. */
  quantidade: string;
  /** "Tapioca - 70g", "Pão francês - 1,5 unidade", … */
  substituicoes: string[];
}

/**
 * Uma opção da refeição.
 *
 * É o "JANTAR - HAMBÚRGUER" dela: mesma refeição, outro jeito de fazer. Com
 * uma opção só, a tela não mostra rótulo nenhum — a paciente nem percebe que
 * existe o conceito.
 */
export interface OpcaoProtocolo {
  rotulo: string;
  itens: ItemProtocolo[];
  /** O chá pós-refeição, a suplementação, o modo de preparo, os vegetais. */
  notas: string[];
}

export interface RefeicaoProtocolo {
  nome: string;
  opcoes: OpcaoProtocolo[];
}

/** "ACORDE CEDO (ANTES DAS 9H)" e o texto embaixo. */
export interface SecaoProtocolo {
  titulo: string;
  paragrafos: string[];
}

export interface ConteudoProtocolo {
  orientacoes: string[];
  refeicoes: RefeicaoProtocolo[];
  secoes: SecaoProtocolo[];
}

export interface Protocolo {
  id: string;
  pacienteId: string;
  titulo: string;
  conteudo: ConteudoProtocolo;
  /** Recado curto em cima do protocolo, para ajuste de uma semana. */
  ajustes: string | null;
  situacao: "rascunho" | "publicado" | "arquivado";
  versao: number;
  atualizadoEm: string;
  publicadoEm: string | null;
}

export const CONTEUDO_VAZIO: ConteudoProtocolo = { orientacoes: [], refeicoes: [], secoes: [] };

/** Uma linha da lista de pacientes na tela dela. */
export interface ResumoProtocolo {
  pacienteId: string;
  nome: string;
  /** "publicado" ou "sem". */
  situacao: "publicado" | "sem";
  temRascunho: boolean;
  publicadoEm: string | null;
}

/** Uma versão anterior, guardada. */
export interface VersaoProtocolo {
  id: string;
  titulo: string;
  versao: number;
  publicadoEm: string | null;
  atualizadoEm: string;
}

/** Tudo que a tela de edição precisa, numa chamada só. */
export interface FichaProtocolo {
  rascunho: Protocolo | null;
  publicado: Protocolo | null;
  historico: VersaoProtocolo[];
}
