export type Papel = "nutricionista" | "paciente";

/**
 * Sessão local — espelha o que vem do Supabase Auth (briefing §5, §11).
 * `precisaMfa` só é verdadeiro para nutricionista em dispositivo não confiável.
 */
export interface Sessao {
  userId: string;
  papel: Papel;
  /** ID do Paciente ou da Nutricionista — resolvido depois do login pela tabela correspondente. */
  perfilId: string;
  email: string;
  expiraEm: string;
}

export interface EstadoAuth {
  sessao: Sessao | null;
  carregando: boolean;
  erro: string | null;
}
