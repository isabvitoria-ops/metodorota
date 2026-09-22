/**
 * Contas, planos e validade de acesso (§22 a §33 do briefing).
 *
 * A regra que governa tudo:
 *   acesso = conta autenticada + paciente vinculado + não suspenso
 *            + hoje dentro do período
 *
 * Ela é decidida no banco (`tem_acesso()`); estes tipos só carregam a
 * resposta até a tela.
 */

export type Papel = "admin" | "paciente";

/**
 * Situação de um paciente. Só as três primeiras são gravadas — as outras
 * saem da comparação das datas com o dia de hoje, toda vez que alguém
 * pergunta. É isso que faz o acesso vencer sozinho, sem rotina diária.
 */
export type SituacaoPaciente =
  | "convite_pendente"
  | "ativo"
  | "suspenso"
  | "nao_iniciado"
  | "expirado"
  | "proximo_do_vencimento";

export interface Plano {
  id: string;
  nome: string;
  duracaoDias: number;
  descricao: string | null;
  ordem: number;
  ativo: boolean;
}

export interface Paciente {
  id: string;
  perfilId: string | null;
  email: string;
  nome: string;
  telefone: string | null;
  planoId: string | null;
  planoNome: string | null;
  dataInicio: string;
  dataFim: string;
  /** O que está gravado: convite_pendente, ativo ou suspenso. */
  status: "convite_pendente" | "ativo" | "suspenso";
  /** O que vale de fato hoje, já considerando as datas. */
  situacao: SituacaoPaciente;
  diasRestantes: number | null;
  observacoes: string | null;
  ultimoAcesso: string | null;
  conviteEnviadoEm: string | null;
  criadoEm: string;
}

export interface EventoHistorico {
  id: string;
  pacienteId: string | null;
  evento: string;
  detalhe: Record<string, unknown>;
  criadoEm: string;
}

/** O que o app sabe sobre quem está usando, resolvido no carregamento. */
export interface Acesso {
  autenticado: boolean;
  perfilId: string | null;
  papel: Papel;
  nome: string | null;
  email: string | null;
  temAcesso: boolean;
  situacao: SituacaoPaciente | "admin" | "sem_cadastro";
  dataInicio: string | null;
  dataFim: string | null;
  diasRestantes: number | null;
  plano: string | null;
  /**
   * Se a Rastreabilidade alimentar está ligada para esta paciente.
   *
   * Nem toda paciente faz rastreamento. Desligado, o atalho não aparece e a
   * tela não abre — o módulo simplesmente não existe para ela.
   */
  rastreio: boolean;
  /**
   * Se esta paciente já tem protocolo alimentar publicado.
   *
   * Sem protocolo, o atalho não aparece na home: um "Protocolo Alimentar"
   * que abre vazio faz a paciente achar que perdeu alguma coisa.
   */
  protocolo: boolean;
  /** Se ela já tem avaliação física publicada. */
  avaliacao: boolean;
  /**
   * Se há treino ativo ou alguma sessão já registrada.
   *
   * Sem nenhum dos dois o atalho não aparece: uma tela de evolução de
   * treino aberta vazia não ensina nada, e ainda sugere que algo se perdeu.
   */
  treino: boolean;
  /**
   * Se a nutricionista já combinou alguma meta com ela.
   *
   * Mesma regra dos outros atalhos: uma tela de metas aberta vazia não
   * ensina nada e ainda sugere que algo se perdeu.
   */
  metas: boolean;
}

export interface Configuracoes {
  nomeCentral: string;
  fraseHome: string;
  /** Frase curta de identidade, exibida na tela inicial. */
  lema: string;
  /** Frase no topo de Comer fora. Vazia = não aparece. */
  comerForaIntroducao: string;
  whatsapp: string;
  nomeNutricionista: string;
  alertaVencimentoDias: number;
}

export interface NovoPaciente {
  nome: string;
  email: string;
  telefone?: string | null;
  planoId: string | null;
  dataInicio: string;
  dataFim: string;
  observacoes?: string | null;
}
