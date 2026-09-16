/**
 * Desafio do Mês — Ponto de Virada.
 *
 * Estes tipos descrevem o que a função `meu_desafio()` devolve. Repare no que
 * NÃO existe aqui: nenhum campo que a tela possa somar para virar ponto. O
 * app não calcula pontuação, não decide posição e não conhece a regra — ele
 * pergunta ao banco e mostra a resposta.
 */

export type StatusEnvio = "enviado" | "aprovado" | "recusado";

/** Como a ação se repete. Semanal é o caso das três ações da semana. */
export type PeriodicidadeAcao = "semanal" | "desafio" | "evento";

export type SituacaoDesafio = "rascunho" | "agendado" | "ativo" | "encerrado";

export interface EnvioDeAcao {
  id: string;
  status: StatusEnvio;
  semana: number | null;
  observacao: string | null;
  motivoRecusa: string | null;
  enviadoEm: string;
  pontosConcedidos: number;
}

export interface AcaoDoDesafio {
  id: string;
  chave: string;
  nome: string;
  descricao: string | null;
  pontos: number;
  periodicidade: PeriodicidadeAcao;
  /** Quantas vezes por semana esta ação pode ser marcada. O diário vale 2. */
  maxPorSemana: number;
  /**
   * Os envios desta semana (ou do desafio), o recusado inclusive — é no
   * cartão da ação que a paciente lê o motivo de uma recusa.
   */
  envios: EnvioDeAcao[];
  /**
   * Se ainda cabe marcar. Quem responde é o banco, que é também quem recusa
   * o envio a mais: a tela não recalcula esta conta.
   */
  podeMarcar: boolean;
  /** Quantas vezes esta ação já rendeu pontos. */
  aprovadas: number;
}

export interface LinhaDoRanking {
  posicao: number;
  nome: string;
  pontos: number;
  souEu: boolean;
}

export interface LancamentoDePontos {
  id: string;
  pontos: number;
  descricao: string;
  tipo: "acao" | "indicacao" | "ajuste" | "resgate";
  criadoEm: string;
}

export interface IndicacaoDaPaciente {
  id: string;
  nome: string;
  status: "registrada" | "iniciou" | "validada" | "recusada";
  pontos: number;
  criadoEm: string;
}

/** Um degrau da escada de indicações: 1 amiga, 2 amigas, 3, 4. */
export interface BeneficioIndicacao {
  nivel: number;
  texto: string;
  alcancado: boolean;
}

export interface Recompensa {
  id: string;
  pontos: number;
  nome: string;
  descricao: string | null;
  alcancada: boolean;
}

export interface Desafio {
  id: string;
  nome: string;
  descricao: string | null;
  lema: string | null;
  regras: string | null;
  dataInicio: string;
  dataFim: string;
  situacao: SituacaoDesafio;
  semanaAtual: number | null;
  totalDeSemanas: number;
}

/**
 * O retorno inteiro de `meu_desafio()`.
 *
 * `pontosNoMes` e `saldoAcumulado` são coisas diferentes de propósito: o
 * primeiro alimenta o ranking do mês, o segundo é o saldo do programa, que
 * não expira e não diminui quando uma recompensa é alcançada.
 */
export interface MeuDesafio {
  temDesafio: boolean;
  /**
   * A nutricionista abrindo a tela da paciente. Ela vê tudo, e não pontua
   * nada: sem cadastro de paciente não há para onde lançar ponto.
   */
  previa?: boolean;
  desafio?: Desafio;
  pontosNoMes?: number;
  saldoAcumulado: number;
  posicao?: number | null;
  /** Quantos pontos faltam para alcançar quem está logo acima. */
  pontosParaProxima?: number | null;
  acoes?: AcaoDoDesafio[];
  ranking?: LinhaDoRanking[];
  historico?: LancamentoDePontos[];
  indicacoes?: IndicacaoDaPaciente[];
  /** Total de indicações validadas de sempre — este número não zera no mês. */
  indicacoesValidadas: number;
  beneficiosIndicacao: BeneficioIndicacao[];
  recompensas: Recompensa[];
}

// ---------------------------------------------------------------- área da nutricionista

export interface EnvioPendente {
  id: string;
  pacienteNome: string;
  acaoNome: string;
  pontos: number;
  semana: number | null;
  observacao: string | null;
  enviadoEm: string;
}

export interface IndicacaoPendente {
  id: string;
  indicadoraNome: string;
  nomeIndicada: string;
  emailIndicada: string | null;
  telefoneIndicada: string | null;
  status: IndicacaoDaPaciente["status"];
  criadoEm: string;
}

/** Quem já indicou alguém, e quantas — "Alana · 1 indicação". */
export interface ResumoIndicacao {
  pacienteId: string;
  nome: string;
  validadas: number;
  emAndamento: number;
}

/** Uma ação do desafio, como a nutricionista a vê para lançar por alguém. */
export interface AcaoAdmin {
  id: string;
  chave: string;
  nome: string;
  pontos: number;
  periodicidade: PeriodicidadeAcao;
  maxPorSemana: number;
  ativo: boolean;
}

export interface PainelDoDesafio {
  elegiveis: number;
  participantes: number;
  semAcao: number;
  pendentes: number;
  indicacoesPendentes: number;
  maiorPontuacao: number;
  media: number;
  acoesMaisFeitas: { nome: string; total: number }[];
}

export interface DesafioAdmin extends Omit<Desafio, "semanaAtual" | "totalDeSemanas"> {
  status: "rascunho" | "ativo" | "encerrado";
  semanaAtual: number | null;
  totalDeSemanas: number;
}
