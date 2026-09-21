/**
 * O treino: o que foi PLANEJADO e o que foi REALIZADO.
 *
 * São duas coisas, e ficam separadas de propósito. "Agachamento, 3 séries,
 * 8 a 10 repetições" é o plano de quem programou o treino. "Série 1: 60 kg
 * × 8; série 2: 60 kg × 9; série 3: 60 kg × 7" é o que aconteceu no dia.
 * Juntando os dois, a sétima repetição da terceira série viraria uma
 * alteração do plano — e a profissional perderia o que ela programou.
 *
 * A nutricionista NÃO é personal trainer: nada aqui prescreve, sugere carga
 * ou monta treino. O aplicativo registra, compara e mostra.
 */

export interface ExercicioPlanejado {
  id: string;
  nome: string;
  ordem: number;
  seriesPlanejadas: number | null;
  /**
   * A faixa que ela programou: 8 a 10. NULA quando não há faixa — e sem
   * faixa não existe "topo da faixa". Inventar um seria prescrever.
   */
  repeticoesMin: number | null;
  repeticoesMax: number | null;
  observacao: string | null;
}

/**
 * Quem escreveu o treino.
 *
 * Não é enfeite de tela: é o que decide se a paciente pode mexer. Sem esta
 * distinção, "treino da paciente" e "plano prescrito" seriam a mesma linha,
 * e a única forma de saber qual é qual seria adivinhar pelo texto.
 */
export type OrigemDoTreino = "nutricionista" | "paciente";

export interface Treino {
  id: string;
  nome: string;
  observacao: string | null;
  /** Só um treino fica ativo por paciente. É o que ela vê para registrar. */
  ativo: boolean;
  origem: OrigemDoTreino;
  /**
   * Quem responde isto é o BANCO, não a tela. A tela usa para decidir se
   * mostra o botão de editar; quem recusa a gravação é `salvar_treino`. Se a
   * regra morasse só aqui, bastaria abrir o console do navegador para editar
   * o plano que a nutricionista prescreveu.
   */
  podeEditar: boolean;
  exercicios: ExercicioPlanejado[];
}

/**
 * Se a paciente pode escrever um treino agora — e por que não, quando não.
 *
 * Vem do banco pelo mesmo motivo de `podeEditar`, e por um segundo: o botão
 * e a regra não podem discordar. No dia em que a tela achar que pode e o
 * banco achar que não, quem digitou dez minutos de treino perde os dez
 * minutos na hora de salvar.
 */
export interface PermissaoDeTreino {
  pode: boolean;
  motivo: "sem_cadastro" | "nao_liberado" | "treino_da_nutricionista" | null;
  /** O treino que ela escreveu, se existe — mesmo desativado. */
  meuTreinoId: string | null;
}

export interface SerieDaSessao {
  id: string;
  /** Aponta para o exercício do plano, quando o registro veio de lá. */
  exercicioId: string | null;
  /**
   * O nome fica gravado na série também. Sem isto, apagar um exercício do
   * plano deixaria o histórico com "—, 62 kg × 7", sem dizer de quê.
   */
  exercicioNome: string;
  numero: number;
  /** Quilos. Nulo em exercício sem carga (prancha, abdominal) — nunca zero. */
  carga: number | null;
  repeticoes: number | null;
  observacao: string | null;
}

export interface SessaoDeTreino {
  id: string;
  data: string;
  treinoId: string | null;
  observacao: string | null;
  series: SerieDaSessao[];
}

/** O que vai para `salvar_treino`. Campos de texto: é o que a tela tem. */
export interface ExercicioParaSalvar {
  nome: string;
  seriesPlanejadas: string;
  repeticoesMin: string;
  repeticoesMax: string;
  observacao: string;
}

export interface SerieParaSalvar {
  exercicioId: string | null;
  exercicioNome: string;
  numero: number;
  carga: string;
  repeticoes: string;
  observacao: string;
}

// ----------------------------------------------------------------- cardio

/**
 * Uma sessão de cardio registrada pela paciente.
 *
 * Distância e intensidade são NULAS quando não se aplicam: bicicleta
 * ergométrica não tem distância na maioria dos aparelhos, e nem toda
 * paciente tem zona de intensidade definida. Zero diria que ela andou zero
 * quilômetro, que é afirmação diferente de "não dá para medir aqui".
 */
export interface CardioSessao {
  id: string;
  data: string;
  tipo: string;
  duracaoMin: number | null;
  distanciaKm: number | null;
  intensidade: string | null;
  observacao: string | null;
}

// ---------------------------------------------------------- metas semanais

export type TipoDeMeta = "treino" | "cardio";

/**
 * Uma meta que a PROFISSIONAL definiu para aquela semana.
 *
 * O aplicativo não cria meta, não ajusta meta e não sugere meta. "4 treinos
 * por semana" é decisão clínica dela, tomada olhando para a paciente.
 *
 * O progresso NÃO mora aqui: é contado a partir das sessões, na hora. Ver
 * `utils/metasSemanais.ts`.
 */
export interface MetaSemanal {
  id: string;
  /** A segunda-feira da semana. */
  semanaInicio: string;
  tipo: TipoDeMeta;
  alvo: number;
  /** "treinos", "minutos" — o que aparece ao lado do número. */
  unidade: string;
}
