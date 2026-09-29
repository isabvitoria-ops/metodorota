/**
 * Questionários e check-in semanal.
 *
 * Um check-in semanal É um questionário que volta toda segunda — o que muda
 * é a `periodicidade`. Ver o cabeçalho da migração 0041 para por que os dois
 * compartilham um motor só.
 */

export type TipoDePergunta = "escala" | "sim_nao" | "numero" | "texto" | "escolha";
export type PeriodicidadeQuestionario = "unica" | "semanal";

/** Um eixo do check-in (intestino, sono…). Lista reusada nas perguntas. */
export interface EixoCheckin {
  id: string;
  nome: string;
  ordem: number;
}

/** Como a nutricionista vê a pergunta: com a régua da pontuação. */
export interface PerguntaQuestionario {
  id: string | null;
  texto: string;
  tipo: TipoDePergunta;
  obrigatoria: boolean;
  opcoes: string[];
  peso: number;
  /** Em "quanta dor", 10 é ruim. Ver `utils/pontuacaoQuestionario.ts`. */
  invertida: boolean;
  /** O eixo a que a pergunta pertence, ou `null`. */
  eixoId: string | null;
  /** Só para 'escolha': pontos (0–10) de cada opção, alinhado com `opcoes`. */
  pontosOpcoes: number[];
  /** Já respondida por alguém — então apagar não é possível sem perder dado. */
  respondida: boolean;
}

export interface Questionario {
  id: string;
  titulo: string;
  descricao: string | null;
  periodicidade: PeriodicidadeQuestionario;
  ativo: boolean;
  /** Se a paciente vê a nota. Nasce falso — a nota é da nutricionista. */
  mostraPontuacao: boolean;
  criadoEm: string;
  /** Quantas pacientes respondem este. */
  pacientes: number;
  /** Quantos envios já entraram. */
  respostas: number;
  perguntas: PerguntaQuestionario[];
}

/**
 * Como a PACIENTE vê a pergunta.
 *
 * Sem `peso` e sem `invertida`, e não é descuido: são a régua com que a
 * nutricionista pontua, e saber que uma pergunta "vale mais" muda a
 * resposta. A função `meus_questionarios()` não devolve esses campos.
 */
export interface PerguntaParaResponder {
  id: string;
  texto: string;
  tipo: TipoDePergunta;
  obrigatoria: boolean;
  opcoes: string[];
  /**
   * A régua só chega aqui quando o questionário mostra a nota para a
   * paciente (`mostraPontuacao`); senão vem `null`/vazio, como antes.
   */
  peso?: number | null;
  invertida?: boolean | null;
  pontosOpcoes?: number[];
  eixoId?: string | null;
}

export interface RespostaEnviada {
  perguntaId: string;
  numero: number | null;
  texto: string | null;
}

/**
 * A régua fotografada num envio (congela a nota). O campo é `id` (e não
 * `perguntaId`) de propósito: assim a foto é usável direto como
 * `PerguntaPontuavel` pelo `utils/pontuacaoQuestionario.ts`, sem conversão.
 */
export interface ReguaDePergunta {
  id: string;
  tipo: TipoDePergunta;
  peso: number;
  invertida: boolean;
  opcoes: string[];
  pontosOpcoes: number[];
  eixoId: string | null;
  eixoNome: string | null;
}

export interface EnvioDeQuestionario {
  periodo: string;
  respondidoEm: string;
  respostas: RespostaEnviada[];
  reguaSnapshot?: ReguaDePergunta[] | null;
}

export interface MeuQuestionario {
  id: string;
  titulo: string;
  descricao: string | null;
  periodicidade: PeriodicidadeQuestionario;
  mostraPontuacao: boolean;
  /** A semana (segunda-feira) ou o dia a que a resposta de agora pertence. */
  periodo: string;
  pendente: boolean;
  perguntas: PerguntaParaResponder[];
  enviados: EnvioDeQuestionario[];
}

/** O que a nutricionista lê no prontuário de uma paciente. */
export interface QuestionarioDoPaciente {
  id: string;
  titulo: string;
  periodicidade: PeriodicidadeQuestionario;
  ativo: boolean;
  mostraPontuacao: boolean;
  atribuido: boolean;
  perguntas: {
    id: string;
    texto: string;
    tipo: TipoDePergunta;
    peso: number;
    invertida: boolean;
    opcoes: string[];
    eixoId: string | null;
    pontosOpcoes: number[];
  }[];
  envios: {
    id: string;
    periodo: string;
    respondidoEm: string;
    /** Marca da nutricionista. A paciente não vê e não é avisada. */
    revisado: boolean;
    respostas: RespostaEnviada[];
    reguaSnapshot?: ReguaDePergunta[] | null;
  }[];
}
