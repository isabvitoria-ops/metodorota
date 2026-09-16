import type { Alimento } from "./alimento";
import type { Medida } from "./unidade";

/**
 * Regras de equivalência (§9 e §10).
 *
 * O briefing é explícito: **não presuma que toda troca é linear**. Por isso
 * `Equivalencia` não guarda um número, guarda uma `RegraEquivalencia` — hoje
 * há três formatos e acrescentar um quarto é somar um membro à união e um
 * `case` em `aplicarRegra`, sem tocar em tela nenhuma.
 */

/**
 * Proporcional — o caso do briefing: 100 g de arroz = 80 g de macarrão,
 * escalando linearmente (90 g → 72 g).
 */
export interface RegraProporcional {
  tipo: "proporcional";
  de: Medida;
  para: Medida;
}

/**
 * Tabela de pontos — para trocas que **não** escalam em linha reta. Entre
 * dois pontos cadastrados o sistema interpola; fora dos extremos ele trava
 * no extremo mais próximo em vez de extrapolar um número que ninguém mediu.
 */
export interface RegraTabela {
  tipo: "tabela";
  unidadeOrigemId: string;
  unidadeDestinoId: string;
  pontos: { de: number; para: number }[];
}

/**
 * Fixa — a quantidade de destino não depende da quantidade informada
 * ("qualquer porção deste grupo equivale a 1 unidade").
 */
export interface RegraFixa {
  tipo: "fixa";
  para: Medida;
}

export type RegraEquivalencia = RegraProporcional | RegraTabela | RegraFixa;

export interface Equivalencia {
  id: string;
  origemAlimentoId: string;
  destinoAlimentoId: string;
  regra: RegraEquivalencia;
  /**
   * Se a relação vale nos dois sentidos. Verdadeiro por padrão numa
   * proporcional (80 g de macarrão voltam a ser 100 g de arroz); tabelas e
   * regras fixas só são invertidas quando quem cadastrou marcar isso.
   */
  bidirecional: boolean;
  fonte: string | null;
  observacao: string | null;
  /** Desativar tira a troca do ar sem apagar o que foi cadastrado. */
  ativo: boolean;
}

/** O que a calculadora recebe. */
export interface EntradaTroca {
  alimentoOrigem: Alimento;
  alimentoDestino: Alimento;
  medida: Medida;
  /** Contexto para uma futura regra por refeição (§8) — hoje só informativo. */
  refeicao?: string | null;
}

/** Como o número foi obtido — a tela mostra isso para o paciente confiar no resultado. */
export type OrigemCalculo = "regra-direta" | "regra-invertida" | "porcoes";

export interface TrocaCalculada {
  ok: true;
  entrada: Medida;
  saida: Medida;
  /** Valor exato antes do arredondamento de exibição, para histórico e conferência. */
  saidaExata: number;
  alimentoOrigem: Alimento;
  alimentoDestino: Alimento;
  /** Equivalente em porções, quando os dois alimentos têm porção cadastrada. */
  porcoes: number | null;
  origem: OrigemCalculo;
  observacoes: string[];
}

export type MotivoFalha =
  | "mesmo-alimento"
  | "quantidade-invalida"
  | "unidade-nao-cadastrada"
  | "porcao-nao-cadastrada"
  | "quantidade-livre"
  | "sentido-nao-permitido"
  | "sem-equivalencia";

export interface TrocaSemResultado {
  ok: false;
  motivo: MotivoFalha;
  mensagem: string;
}

export type ResultadoTroca = TrocaCalculada | TrocaSemResultado;
