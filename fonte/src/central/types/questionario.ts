/**
 * Questionários e check-in semanal.
 *
 * Um check-in semanal É um questionário que volta toda segunda — o que muda
 * é a `periodicidade`. Ver o cabeçalho da migração 0041 para por que os dois
 * compartilham um motor só.
 */

export type TipoDePergunta =
  | "escala"
  | "sim_nao"
  | "numero"
  | "texto"
  | "escolha"
  | "emoji"
  | "estrelas"
  | "multipla_escolha"
  | "metrica";

export type PeriodicidadeQuestionario = "unica" | "semanal";
export type CadenciaPergunta = "semanal" | "quinzenal" | "mensal";

/**
 * Regra de exibição condicional: mostra a pergunta só quando outra pergunta
 * (identificada por código) teve determinada resposta.
 */
export interface RegraExibicao {
  perguntaCodigo: string;
  operador: "igual" | "diferente" | "inclui" | "nao_inclui";
  valor: string;
}

/**
 * Faixa de nota para perguntas numéricas (B02, B03, I05…). Cada faixa
 * mapeia um intervalo de valor para uma nota de −2 a +2.
 */
export interface FaixaDeNota {
  de: number | null;
  ate: number | null;
  nota: number;
}

export interface NotasPorFaixa {
  relativaAMeta?: string;
  faixas: FaixaDeNota[];
}

/** Alerta vinculado a uma opção de resposta. */
export interface AlertaOpcao {
  codigo: string;
  nivel: "vermelho" | "amarelo";
}

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
  /** Código estável (B01, I05, G07…) para comparação entre versões. */
  codigo: string | null;
  /** Cadência da pergunta dentro do check-in semanal. */
  cadencia: CadenciaPergunta;
  /** Regra condicional: mostra só se outra pergunta teve determinada resposta. */
  regraExibicao: RegraExibicao | null;
  /** Módulo a que pertence: BASE, ESTETICA, INTESTINO, GLP1, ACOMPANHAMENTO. */
  modulo: string | null;
  /** Versões que incluem esta pergunta (["V1","V2","V3"]). Null = todas. */
  versoes: string[] | null;
  /** Texto "pedir explicação" por opção, alinhado com `opcoes`. Null = sem pedido. */
  explicacaoOpcoes: (string | null)[];
  /** Texto de ajuda que aparece sob a pergunta. */
  textoAjuda: string | null;
  /** Faixas de nota para perguntas numéricas. */
  notasPorFaixa: NotasPorFaixa | null;
  /** Alerta por opção, alinhado com `opcoes`. Null = sem alerta. */
  alertasOpcoes: (AlertaOpcao | null)[];
  /** Pergunta ativa ou desativada (soft-delete). */
  ativa: boolean;
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
  codigo?: string | null;
  cadencia?: CadenciaPergunta;
  regraExibicao?: RegraExibicao | null;
  modulo?: string | null;
  versoes?: string[] | null;
  explicacaoOpcoes?: (string | null)[];
  textoAjuda?: string | null;
  notasPorFaixa?: NotasPorFaixa | null;
  alertasOpcoes?: (AlertaOpcao | null)[];
  ativa?: boolean;
}

export interface RespostaEnviada {
  perguntaId: string;
  numero: number | null;
  texto: string | null;
  json?: unknown | null;
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
  codigo?: string | null;
  notasPorFaixa?: NotasPorFaixa | null;
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
  /** Versão atribuída à paciente (V1, V2, V3). */
  versao?: string | null;
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
  versao?: string | null;
  perguntas: {
    id: string;
    texto: string;
    tipo: TipoDePergunta;
    peso: number;
    invertida: boolean;
    opcoes: string[];
    eixoId: string | null;
    pontosOpcoes: number[];
    codigo?: string | null;
    cadencia?: CadenciaPergunta;
    modulo?: string | null;
    versoes?: string[] | null;
    regraExibicao?: RegraExibicao | null;
    explicacaoOpcoes?: (string | null)[];
    notasPorFaixa?: NotasPorFaixa | null;
    alertasOpcoes?: (AlertaOpcao | null)[];
    ativa?: boolean;
  }[];
  envios: {
    id: string;
    periodo: string;
    respondidoEm: string;
    /** Marca da nutricionista. A paciente não vê e não é avisada. */
    revisado: boolean;
    respostas: RespostaEnviada[];
    reguaSnapshot?: ReguaDePergunta[] | null;
    alertas?: AlertaCheckin[];
  }[];
}

/** Alerta clínico disparado por um envio de check-in. */
export interface AlertaCheckin {
  id: string;
  codigo: string;
  nivel: "vermelho" | "amarelo";
  perguntaCodigo: string | null;
  status: "novo" | "visto" | "contatado" | "resolvido";
  notaNutri: string | null;
  criadoEm: string;
}

/** Configuração de um alerta (limiar editável). */
export interface AlertaCheckinConfig {
  codigo: string;
  nivel: "vermelho" | "amarelo";
  descricao: string;
  mensagemPaciente: string;
  ativo: boolean;
  limiar: Record<string, unknown> | null;
}

/** Alerta resumido para a paciente ver após enviar o check-in. */
export interface AlertaParaPaciente {
  codigo: string;
  nivel: "vermelho" | "amarelo";
  mensagem: string;
}

/** Alerta pendente no painel da nutricionista. */
export interface AlertaPendente {
  id: string;
  codigo: string;
  nivel: "vermelho" | "amarelo";
  pacienteId: string;
  pacienteNome: string;
  envioId: string;
  perguntaCodigo: string | null;
  status: "novo" | "visto" | "contatado" | "resolvido";
  notaNutri: string | null;
  criadoEm: string;
  descricao: string;
}
