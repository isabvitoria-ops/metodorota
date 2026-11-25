import type { SerieParaSalvar, Treino } from "@/central/types/treino";
import { naoEntendido, numeroDeTexto } from "@/central/utils/numero";

/**
 * As cargas da primeira vez.
 *
 * Quem escreve o treino pela primeira vez geralmente está NA academia,
 * fazendo o treino. Sem isto, ela escrevia tudo, salvava e só depois
 * conseguia lançar as cargas. Agora cada exercício do primeiro treino já
 * traz "carga × repetições de hoje", e o salvar grava o treino e, logo em
 * seguida, a sessão de hoje com o que ela preencheu.
 *
 * As regras são as mesmas do "Registrar treino": a série conta quando tem
 * repetições; a carga pode ficar em branco (peso do corpo); o que não dá
 * para entender é recusado com o nome do exercício, nunca descartado calado.
 */
export interface SerieDeHoje {
  carga: string;
  repeticoes: string;
}

export interface ExercicioComHoje {
  nome: string;
  hoje: SerieDeHoje[];
}

/** Quantas linhas de "hoje" o exercício começa tendo: as séries que ela escreveu (1 a 20), ou 1. */
export function linhasIniciais(seriesPlanejadas: string): number {
  const n = numeroDeTexto(seriesPlanejadas);
  return n !== null && Number.isInteger(n) && n >= 1 ? Math.min(n, 20) : 1;
}

/** Confere o que ela preencheu. Devolve a mensagem do primeiro problema, ou null. */
export function conferirHoje(exercicios: ExercicioComHoje[]): string | null {
  for (const e of exercicios) {
    const nome = e.nome.trim();
    if (!nome) continue;
    for (const [i, s] of e.hoje.entries()) {
      const qual = `${nome}, série ${i + 1}`;
      const temCarga = s.carga.trim() !== "";
      const temReps = s.repeticoes.trim() !== "";
      if (!temCarga && !temReps) continue;
      if (!temReps) return `Faltou o número de repetições em ${qual}. Sem ele, a carga não fica guardada.`;
      if (naoEntendido(s.carga)) return `Não entendi a carga "${s.carga}" em ${qual}. Escreva só o número, como 22,5.`;
      const reps = numeroDeTexto(s.repeticoes);
      if (reps === null || !Number.isInteger(reps) || reps <= 0) {
        return `As repetições em ${qual} precisam ser um número inteiro, como 12.`;
      }
    }
  }
  return null;
}

/**
 * As séries de hoje já ligadas aos exercícios do treino recém-salvo. O
 * exercício é achado pela posição (o banco guarda na ordem em que foram
 * escritos) e conferido pelo nome; se não bater, vai pelo nome só.
 */
export function seriesDeHoje(exercicios: ExercicioComHoje[], salvo: Treino): SerieParaSalvar[] {
  const doBanco = [...salvo.exercicios].sort((a, b) => a.ordem - b.ordem);
  const escritos = exercicios.filter((e) => e.nome.trim() !== "");
  const saida: SerieParaSalvar[] = [];
  escritos.forEach((e, i) => {
    const nome = e.nome.trim();
    const naPosicao = doBanco[i];
    const plano =
      naPosicao && naPosicao.nome.trim() === nome ? naPosicao : doBanco.find((x) => x.nome.trim() === nome) ?? null;
    for (const s of e.hoje) {
      if (s.repeticoes.trim() === "") continue;
      saida.push({
        exercicioId: plano?.id ?? null,
        exercicioNome: plano?.nome ?? nome,
        numero: saida.length + 1,
        carga: s.carga.trim(),
        repeticoes: s.repeticoes.trim(),
        observacao: "",
      });
    }
  });
  return saida;
}
