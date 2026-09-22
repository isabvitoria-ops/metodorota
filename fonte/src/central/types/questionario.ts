/**
 * Questionários e check-in semanal.
 *
 * Um check-in semanal É um questionário que volta toda segunda — o que muda
 * é a `periodicidade`. Ver o cabeçalho da migração 0041 para por que os dois
 * compartilham um motor só.
 */

export type TipoDePergunta = "escala" | "sim_nao" | "numero" | "texto" | "escolha";
export type PeriodicidadeQuestionario = "unica" | "semanal";

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
  /** Já respondida por alguém — então apagar não é possível sem perder dado. */
  respondida: boolean;
}

export interface Questionario {
  id: string;
  titulo: string;
  descricao: string | null;
  periodicidade: PeriodicidadeQuestionario;
  ativo: boolean;
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
}

export interface RespostaEnviada {
  perguntaId: string;
  numero: number | null;
  texto: string | null;
}

export interface EnvioDeQuestionario {
  periodo: string;
  respondidoEm: string;
  respostas: RespostaEnviada[];
}

export interface MeuQuestionario {
  id: string;
  titulo: string;
  descricao: string | null;
  periodicidade: PeriodicidadeQuestionario;
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
  atribuido: boolean;
  perguntas: {
    id: string;
    texto: string;
    tipo: TipoDePergunta;
    peso: number;
    invertida: boolean;
    opcoes: string[];
  }[];
  envios: {
    id: string;
    periodo: string;
    respondidoEm: string;
    /** Marca da nutricionista. A paciente não vê e não é avisada. */
    revisado: boolean;
    respostas: RespostaEnviada[];
  }[];
}
