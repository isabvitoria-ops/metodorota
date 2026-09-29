import type {
  Conduta,
  CondutaPendente,
  ModeloDeConduta,
  StatusDaConduta,
  TarefaParaAplicar,
} from "@/central/types/conduta";
import { diasEntre, somarDias } from "./situacao";
import { normalizar } from "./texto";

/**
 * As contas das condutas. Ficam aqui, fora da tela, porque são elas que
 * decidem a data que vai para o banco — e data errada em conduta é tarefa
 * esquecida.
 */

/**
 * "Dia 0, dia 7, dia 14" a partir do dia em que ela aplica. As datas que
 * saem daqui são SUGESTÃO: a tela deixa editar cada uma antes de gravar, e o
 * banco guarda a data confirmada, não os dias.
 */
export function tarefasDoModelo(modelo: ModeloDeConduta, dataInicial: string): TarefaParaAplicar[] {
  return modelo.etapas
    .filter((e) => e.titulo.trim() !== "")
    .map((e) => ({
      titulo: e.titulo.trim(),
      descricao: e.descricao?.trim() || null,
      prazo: somarDias(dataInicial, Math.max(0, Math.round(e.dias || 0))),
    }));
}

export type SituacaoDoPrazo = "concluida" | "sem_prazo" | "atrasada" | "hoje" | "em_breve" | "no_prazo";

/** "Em breve" = até 3 dias. Mais que isso, ela não precisa ser lembrada. */
export function situacaoDoPrazo(
  conduta: Pick<Conduta, "prazo" | "status">,
  hoje: string,
): SituacaoDoPrazo {
  if (conduta.status === "concluida") return "concluida";
  if (!conduta.prazo) return "sem_prazo";
  const faltam = diasEntre(hoje, conduta.prazo);
  if (faltam < 0) return "atrasada";
  if (faltam === 0) return "hoje";
  if (faltam <= 3) return "em_breve";
  return "no_prazo";
}

export function rotuloDoPrazo(conduta: Pick<Conduta, "prazo" | "status">, hoje: string): string {
  const s = situacaoDoPrazo(conduta, hoje);
  if (s === "sem_prazo") return "Sem prazo";
  if (s === "concluida") return "Concluída";
  const faltam = diasEntre(hoje, conduta.prazo as string);
  if (s === "hoje") return "Vence hoje";
  if (s === "atrasada") return faltam === -1 ? "Atrasada 1 dia" : `Atrasada ${-faltam} dias`;
  return faltam === 1 ? "Amanhã" : `Em ${faltam} dias`;
}

/** Prazo mais cedo primeiro; sem prazo no fim; empate, a mais antiga. */
export function ordenarCondutas<T extends Pick<Conduta, "prazo" | "criadoEm">>(lista: T[]): T[] {
  return [...lista].sort((a, b) => {
    if (a.prazo && b.prazo && a.prazo !== b.prazo) return a.prazo.localeCompare(b.prazo);
    if (a.prazo && !b.prazo) return -1;
    if (!a.prazo && b.prazo) return 1;
    return a.criadoEm.localeCompare(b.criadoEm);
  });
}

export function porColuna(lista: Conduta[]): Record<StatusDaConduta, Conduta[]> {
  const colunas: Record<StatusDaConduta, Conduta[]> = { a_fazer: [], andamento: [], concluida: [] };
  for (const c of ordenarCondutas(lista)) colunas[c.status].push(c);
  return colunas;
}

export interface FiltroDePendentes {
  busca: string;
  status: "todas" | "a_fazer" | "andamento";
  /** Só o que venceu ou vence hoje. */
  soAtrasadas: boolean;
}

export function filtrarPendentes(
  lista: CondutaPendente[],
  filtro: FiltroDePendentes,
  hoje: string,
): CondutaPendente[] {
  const termo = normalizar(filtro.busca.trim());
  return ordenarCondutas(
    lista.filter((c) => {
      if (c.status === "concluida") return false;
      if (filtro.status !== "todas" && c.status !== filtro.status) return false;
      if (filtro.soAtrasadas) {
        const s = situacaoDoPrazo(c, hoje);
        if (s !== "atrasada" && s !== "hoje") return false;
      }
      if (!termo) return true;
      return normalizar(`${c.pacienteNome} ${c.titulo} ${c.descricao ?? ""} ${c.modeloNome ?? ""}`).includes(termo);
    }),
  );
}
