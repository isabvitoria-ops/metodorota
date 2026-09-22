/**
 * Cobrança.
 *
 * NÃO é gateway de pagamento: o dinheiro entra por PIX ou maquininha, fora
 * do aplicativo. Isto é o controle — quem deve, quanto, desde quando.
 * Ver o cabeçalho da migração 0043.
 */

export type StatusCobranca = "aberta" | "paga" | "cancelada";

/** O que a tela mostra. "atrasada" e "vencendo" são CONTA, não coluna. */
export type SituacaoCobranca = "aberta" | "vencendo" | "atrasada" | "paga" | "cancelada";

export interface Cobranca {
  id: string;
  pacienteId: string;
  paciente: string;
  telefone: string | null;
  /** O primeiro dia do mês a que a cobrança se refere. */
  competencia: string;
  valor: number;
  vencimento: string;
  status: StatusCobranca;
  situacao: SituacaoCobranca;
  pagoEm: string | null;
  forma: string | null;
  observacao: string | null;
}

export interface TotaisFinanceiros {
  aberto: number;
  atrasado: number;
  recebidoNoMes: number;
  previstoNoMes: number;
}

export interface PainelFinanceiro {
  cobrancas: Cobranca[];
  totais: TotaisFinanceiros;
}

export interface ValorDoPaciente {
  id: string;
  nome: string;
  telefone: string | null;
  situacao: string;
  valorMensal: number | null;
  diaDeVencimento: number | null;
}
