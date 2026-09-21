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

export interface Treino {
  id: string;
  nome: string;
  observacao: string | null;
  /** Só um treino fica ativo por paciente. É o que ela vê para registrar. */
  ativo: boolean;
  exercicios: ExercicioPlanejado[];
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
