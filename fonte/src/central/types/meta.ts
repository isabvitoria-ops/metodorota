/**
 * As metas do acompanhamento.
 *
 * "As metas são individuais e devem ser criadas pelo nutricionista de acordo
 * com cada paciente. Não utilizar uma lista fixa. As metas precisam ser
 * totalmente personalizáveis."
 *
 * Por isso `titulo`, `categoria` e `unidade` são texto livre: quem escreve é
 * ela, e qualquer lista que eu fechasse aqui seria a lista que faltou no dia
 * em que ela precisou de outra coisa.
 *
 * NÃO CONFUNDIR COM `MetaSemanal` (types/treino.ts). Aquela é "4 treinos
 * nesta semana", contada sozinha das sessões registradas. Esta é "beber 2
 * litros por dia", marcada pela paciente. As duas aparecem juntas na tela;
 * no banco e na conta são coisas diferentes.
 */

/** O período em que o alvo é contado. Não muda mais nada. */
export type FrequenciaDaMeta = "diaria" | "semanal";

export type StatusDaMeta = "ativa" | "pausada" | "concluida" | "cancelada";

export interface RegistroDeMeta {
  id: string;
  data: string;
  /**
   * Quanto, na unidade da meta. NULO em meta de "fez ou não fez" — e nulo
   * não é zero: zero diria que ela bebeu zero litro, que é o contrário de
   * "marquei que bebi".
   */
  quantidade: number | null;
  observacao: string | null;
}

export interface Meta {
  id: string;
  titulo: string;
  descricao: string | null;
  categoria: string | null;
  frequencia: FrequenciaDaMeta;
  /** Quanto, por período. Nulo em meta de "fez ou não fez". */
  alvo: number | null;
  unidade: string | null;
  inicio: string;
  prazo: string | null;
  status: StatusDaMeta;
  registros: RegistroDeMeta[];
}

/** O que a tela manda para `salvar_meta`. Texto, porque é o que ela digitou. */
export interface MetaParaSalvar {
  titulo: string;
  descricao: string;
  categoria: string;
  frequencia: FrequenciaDaMeta;
  alvo: string;
  unidade: string;
  inicio: string;
  prazo: string;
  status: StatusDaMeta;
}
