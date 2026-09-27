import type { Consulta, ConsultaParaSalvar } from "@/central/types/consulta";

/** Hora de agora no fuso dela, "HH:MM". */
export function horaSaoPaulo(agora = new Date()): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(agora);
}

/** "24/09/2026 às 16:28" — ou só a data, quando ela não marcou hora. */
export function dataEHora(c: Pick<Consulta, "data" | "hora">): string {
  const [ano, mes, dia] = c.data.split("-");
  const data = `${dia}/${mes}/${ano}`;
  return c.hora ? `${data} às ${c.hora.slice(0, 5)}` : data;
}

/**
 * As consultas que já aconteceram, da mais nova para a mais antiga.
 *
 * Agendada no futuro não é "anterior". Faltou e cancelada ficam, porque a
 * anotação de uma falta também é histórico.
 */
export function consultasAnteriores(consultas: Consulta[], hoje: string): Consulta[] {
  return consultas
    .filter((c) => c.status !== "agendada" || c.data < hoje || (c.data === hoje && !!c.observacoes))
    .sort((a, b) => {
      if (a.data !== b.data) return a.data < b.data ? 1 : -1;
      return (b.hora ?? "").localeCompare(a.hora ?? "");
    });
}

/**
 * O que "Salvar consulta" grava.
 *
 * Se já havia um retorno AGENDADO para hoje, a anotação conclui esse
 * retorno em vez de criar outro: senão a linha do tempo mostraria duas
 * consultas no mesmo dia, uma "agendada" para sempre.
 */
export function anotacaoDeHoje(
  consultas: Consulta[],
  texto: string,
  hoje: string,
  hora: string,
): { id: string | null; dados: ConsultaParaSalvar } {
  const agendadaHoje = consultas.find((c) => c.data === hoje && c.status === "agendada");
  const jaTeveConsulta = consultas.some((c) => c.status === "concluida");

  if (agendadaHoje) {
    const anterior = agendadaHoje.observacoes?.trim();
    return {
      id: agendadaHoje.id,
      dados: {
        data: hoje,
        hora: agendadaHoje.hora ?? hora,
        tipo: agendadaHoje.tipo,
        status: "concluida",
        resumo: agendadaHoje.resumo ?? "",
        observacoes: anterior ? `${anterior}\n\n${texto.trim()}` : texto.trim(),
      },
    };
  }

  return {
    id: null,
    dados: {
      data: hoje,
      hora,
      tipo: jaTeveConsulta ? "retorno" : "primeira",
      status: "concluida",
      resumo: "",
      observacoes: texto.trim(),
    },
  };
}

/** A mesma consulta, só com a anotação trocada — o resto fica como estava. */
export function comNovaAnotacao(c: Consulta, texto: string): ConsultaParaSalvar {
  return {
    data: c.data,
    hora: c.hora ? c.hora.slice(0, 5) : "",
    tipo: c.tipo,
    status: c.status,
    resumo: c.resumo ?? "",
    observacoes: texto.trim(),
  };
}
