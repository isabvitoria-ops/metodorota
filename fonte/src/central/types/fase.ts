/**
 * As fases do método dela.
 *
 * O conteúdo é dela: o aplicativo guarda e ordena, não define. Ver o
 * cabeçalho da migração 0044 para por que não existe lista fixa aqui.
 */

export interface Fase {
  id: string;
  nome: string;
  descricao: string | null;
  ordem: number;
  ativa: boolean;
  /** Quantas pacientes estão NESTA fase agora. */
  pacientes: number;
  /** Já passou gente por ela — então apagar levaria o passado junto. */
  temHistorico: boolean;
}

/** Uma mudança registrada. O histórico é o produto, não a fase atual. */
export interface MudancaDeFase {
  id: string;
  faseId: string;
  fase: string;
  inicio: string;
  /** A anotação dela. Nunca chega na paciente. */
  observacao: string | null;
}

/** O que a paciente vê: o caminho inteiro, com o ponto dela marcado. */
export interface MinhaFase {
  temFase: boolean;
  atualId?: string;
  desde?: string;
  fases: {
    id: string;
    nome: string;
    descricao: string | null;
    ordem: number;
    atual: boolean;
  }[];
}
