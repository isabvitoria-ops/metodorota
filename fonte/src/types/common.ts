/** IDs são strings (uuid no Supabase). Aliases só para deixar as assinaturas legíveis. */
export type ID = string;

/** ISO 8601 (`toISOString()`). Nunca `Date` dentro de um tipo de domínio — conversão fica na borda (models/). */
export type ISODateString = string;

/**
 * Todo registro de domínio carrega `nutricionistaId` desde a primeira migração
 * (briefing §21) — hoje só existe um valor possível, mas a coluna já existe
 * para não custar uma migração de dado no dia em que houver mais de uma conta.
 */
export interface RegistroDominio {
  id: ID;
  nutricionistaId: ID;
  criadoEm: ISODateString;
  atualizadoEm: ISODateString;
}

/**
 * Estado de carregamento explícito — nenhuma tela deve assumir dado síncrono
 * (briefing §7, §18). "Vazio" (ex.: paciente sem plano ainda) é uma leitura
 * do próprio `dado` pelo componente, não um status à parte — evita ambiguidade
 * entre "ainda não chegou" e "chegou e não tem nada".
 */
export type Estado<T> =
  | { status: "carregando" }
  | { status: "erro"; erro: string }
  | { status: "pronto"; dado: T };

export type UnidadeExibicao = "g" | "caseira";
