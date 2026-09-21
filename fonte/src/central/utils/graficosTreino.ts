import type { CardioSessao, SessaoDeTreino } from "@/central/types/treino";
import { melhorSerie, volumeDaSessao } from "./progressaoTreino";
import { segundaDaSemana } from "./metasSemanais";

/**
 * As séries que viram gráfico, e a frequência.
 *
 * O QUE ESTE ARQUIVO NÃO FAZ: nada de prescrever, nada de sugerir, nada de
 * julgar. Ele organiza números que já foram registrados numa ordem que dá
 * para desenhar. Um gráfico descendo não vira aviso, não vira alerta, e não
 * vira "está piorando" — é o que aconteceu, e quem lê é a profissional.
 *
 * E o VOLUME é métrica COMPLEMENTAR, como ela escreveu. Ele soma carga ×
 * repetições, e isso faz 40 kg × 20 parecer mais que 60 kg × 8. Sozinho,
 * ele mandaria a paciente que subiu de carga para baixo no desenho.
 */

export interface PontoDeTreino {
  data: string;
  valor: number;
}

export type MetricaDoGrafico = "carga" | "repeticoes" | "volume";

/**
 * A série de um exercício ao longo do tempo.
 *
 * Carga e repetições saem da MELHOR série da sessão — a mesma régua da
 * evolução em texto. Duas réguas diferentes fariam o gráfico e a mensagem
 * discordarem sobre o mesmo dia.
 */
export function serieDoExercicio(
  sessoes: SessaoDeTreino[],
  exercicio: string,
  metrica: MetricaDoGrafico,
): PontoDeTreino[] {
  const saida: PontoDeTreino[] = [];

  for (const sessao of [...sessoes].sort((a, b) => a.data.localeCompare(b.data))) {
    const series = sessao.series
      .filter((s) => s.exercicioNome === exercicio)
      .map((s) => ({ numero: s.numero, carga: s.carga, repeticoes: s.repeticoes }));
    if (series.length === 0) continue;

    if (metrica === "volume") {
      const v = volumeDaSessao(series);
      // Volume zero é exercício sem carga (prancha, abdominal): não há
      // volume a desenhar, e uma linha rente ao chão diria que ela não fez
      // nada naquele dia.
      if (v > 0) saida.push({ data: sessao.data, valor: v });
      continue;
    }

    const melhor = melhorSerie(series);
    if (!melhor) continue;
    const valor = metrica === "carga" ? melhor.carga : melhor.repeticoes;
    // Nulo não vira zero: exercício sem carga simplesmente não entra no
    // gráfico de carga, em vez de aparecer como uma sessão de zero quilo.
    if (typeof valor === "number") saida.push({ data: sessao.data, valor });
  }

  return saida;
}

export interface SemanaDeFrequencia {
  /** A segunda-feira da semana. */
  semana: string;
  treinos: number;
  cardioMin: number;
}

/**
 * Quantos DIAS de treino e quantos MINUTOS de cardio por semana.
 *
 * As mesmas duas contas das metas — dia para treino, minuto para cardio.
 * Contar sessão de treino diria que quem lançou o mesmo dia em duas partes
 * treinou duas vezes; contar sessão de cardio diria que três caminhadas de
 * dez minutos valem o mesmo que três de trinta.
 *
 * As semanas SEM NADA aparecem com zero, e é o ponto: um buraco de três
 * semanas some se só as semanas com registro entrarem, e é justamente o
 * buraco que a profissional quer enxergar.
 */
export function frequenciaPorSemana(
  treinos: SessaoDeTreino[],
  cardio: CardioSessao[],
  quantasSemanas = 8,
  hoje = new Date().toISOString().slice(0, 10),
): SemanaDeFrequencia[] {
  const diasPorSemana = new Map<string, Set<string>>();
  for (const t of treinos) {
    const semana = segundaDaSemana(t.data);
    const dias = diasPorSemana.get(semana);
    if (dias) dias.add(t.data.slice(0, 10));
    else diasPorSemana.set(semana, new Set([t.data.slice(0, 10)]));
  }

  const minutosPorSemana = new Map<string, number>();
  for (const c of cardio) {
    const semana = segundaDaSemana(c.data);
    minutosPorSemana.set(semana, (minutosPorSemana.get(semana) ?? 0) + (c.duracaoMin ?? 0));
  }

  const inicio = segundaDaSemana(hoje);
  const saida: SemanaDeFrequencia[] = [];
  for (let i = quantasSemanas - 1; i >= 0; i -= 1) {
    const d = new Date(`${inicio}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - i * 7);
    const semana = d.toISOString().slice(0, 10);
    saida.push({
      semana,
      treinos: diasPorSemana.get(semana)?.size ?? 0,
      cardioMin: minutosPorSemana.get(semana) ?? 0,
    });
  }
  return saida;
}

/** Os exercícios com histórico, do mais registrado para o menos. */
export function exerciciosComHistorico(sessoes: SessaoDeTreino[]): string[] {
  const conta = new Map<string, number>();
  for (const s of sessoes) {
    for (const nome of new Set(s.series.map((x) => x.exercicioNome))) {
      conta.set(nome, (conta.get(nome) ?? 0) + 1);
    }
  }
  return [...conta.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))
    .map(([nome]) => nome);
}

/**
 * Só o que caiu dentro do período. Nulo em qualquer ponta = sem limite.
 *
 * A comparação é de texto porque as datas são "AAAA-MM-DD": nesse formato
 * a ordem alfabética É a ordem cronológica, e passar por `Date` só traria
 * o fuso para uma comparação que não precisa dele.
 */
export function noPeriodo<T extends { data: string }>(
  lista: T[],
  de: string | null,
  ate: string | null,
): T[] {
  return lista.filter((x) => {
    const d = x.data.slice(0, 10);
    if (de && d < de) return false;
    if (ate && d > ate) return false;
    return true;
  });
}
