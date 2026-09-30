/**
 * Conversa por refeição (migração 0058): uma conversa entre a paciente e a
 * nutricionista para cada refeição do plano.
 */
export interface MensagemDaRefeicao {
  id: string;
  autor: "paciente" | "nutri";
  texto: string;
  criadoEm: string;
  /** A outra ponta já abriu a conversa e viu esta mensagem. */
  lida: boolean;
}

/** Uma linha por refeição que já tem conversa. */
export interface ResumoDaConversa {
  refeicao: string;
  total: number;
  /** Mensagens da OUTRA ponta que ainda não foram abertas por quem pergunta. */
  naoLidas: number;
  ultimaEm: string;
  ultimoAutor: "paciente" | "nutri";
}
