/**
 * Planos de acompanhamento (§37 do briefing).
 *
 * `duracaoDias` é o que a tela de renovação usa para sugerir a nova data de
 * fim — a nutricionista sempre pode ajustar a data na mão. Não há cobrança
 * nem gateway: o controle financeiro é externo, e aqui só existe o período
 * de acesso.
 */
export interface Plano {
  id: string;
  nome: string;
  duracaoDias: number;
  descricao: string | null;
  ordem: number;
}

export const PLANOS: Plano[] = [
  { id: "mensal", nome: "Mensal", duracaoDias: 30, descricao: "Acesso por 30 dias.", ordem: 1 },
  { id: "trimestral", nome: "Trimestral", duracaoDias: 90, descricao: "Acesso por 90 dias.", ordem: 2 },
  { id: "semestral", nome: "Semestral", duracaoDias: 180, descricao: "Acesso por 180 dias.", ordem: 3 },
  { id: "anual", nome: "Anual", duracaoDias: 365, descricao: "Acesso por 365 dias.", ordem: 4 },
];
