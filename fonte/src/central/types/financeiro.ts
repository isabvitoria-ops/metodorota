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

export type FormaDePagamento =
  | "pix"
  | "cartao"
  | "transferencia"
  | "dinheiro"
  | "boleto"
  | "outro";

/**
 * Uma entrada do livro-caixa.
 *
 * É a ÚNICA fonte do que entrou. Baixa de cobrança cria uma linha aqui —
 * não existe soma paralela, e por isso contar duas vezes é impossível por
 * construção. Ver o cabeçalho da migração 0046.
 */
export interface Recebimento {
  id: string;
  pacienteId: string | null;
  /** Nulo quando a entrada não vem de paciente (palestra, material). */
  paciente: string | null;
  cobrancaId: string | null;
  /** Nasceu de uma cobrança: não se edita nem se apaga por aqui. */
  deCobranca: boolean;
  descricao: string | null;
  valor: number;
  data: string;
  forma: FormaDePagamento;
  observacao: string | null;
}

export interface MesDoBalanco {
  mes: string;
  total: number;
  entradas: number;
}

export interface TotalPorForma {
  forma: FormaDePagamento;
  total: number;
  entradas: number;
}

export interface Balanco {
  meses: MesDoBalanco[];
  porForma: TotalPorForma[];
  totais: {
    noPeriodo: number;
    noMes: number;
    mesPassado: number;
    /** Exclui o mês em curso, que ainda está acontecendo. */
    mediaMensal: number;
  };
  recebimentos: Recebimento[];
}
