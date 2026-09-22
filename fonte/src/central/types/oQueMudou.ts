/**
 * O resumo do período desde a última consulta, para a PACIENTE.
 *
 * `treinos` e `minutosDeCardio` são NULOS quando a aba de treino não está
 * liberada para ela — nulo quer dizer "não se aplica", e zero diria "você
 * não treinou". Cobrar zero de uma porta que ela não tem seria maldade
 * automatizada.
 *
 * `pesoAntes`/`pesoAgora` só vêm quando há avaliação dos dois lados do
 * marco: com uma ponta só não há variação, e mostrar o peso atual sozinho
 * responderia "quanto você pesa" em vez de "o que mudou".
 */
export interface OQueMudou {
  temMarco: boolean;
  desde: string | null;
  dias: number | null;
  proximaConsulta: string | null;
  pesoAntes: number | null;
  pesoAgora: number | null;
  marcacoesDeMeta: number;
  metasAtivas: number;
  registrosDeRastreio: number;
  alimentosTestados: number;
  treinos: number | null;
  minutosDeCardio: number | null;
}
