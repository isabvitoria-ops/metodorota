import type { DashboardResumo } from "@/types";
import { alertaRepository, chatRepository, pacienteRepository, questionarioRepository } from "@/repositories";

/** Intervalo da semana corrente (segunda 00:00 → domingo 23:59:59) na hora local. */
function semanaCorrente(agora = new Date()): { inicio: Date; fim: Date } {
  const inicio = new Date(agora);
  const diaDaSemana = (inicio.getDay() + 6) % 7; // segunda = 0
  inicio.setDate(inicio.getDate() - diaDaSemana);
  inicio.setHours(0, 0, 0, 0);
  const fim = new Date(inicio);
  fim.setDate(fim.getDate() + 7);
  return { inicio, fim };
}

/**
 * Tela nova (briefing §15) — não existe protótipo para portar. Todo o
 * agregado é calculado aqui, nunca na tela: o componente só renderiza
 * `DashboardResumo`.
 */
export async function buscarResumoDashboard(nutricionistaId: string): Promise<DashboardResumo> {
  const [pacientes, resumos, respostasPendentes, alertas] = await Promise.all([
    pacienteRepository.listarPacientes(),
    pacienteRepository.listarResumosAdesao(),
    questionarioRepository.listarRespostasAguardandoLeitura(nutricionistaId),
    alertaRepository.listarAlertasNaoLidos(nutricionistaId),
  ]);

  const nomePorId = new Map(pacientes.map((p) => [p.id, p.nome]));
  const ativos = pacientes.filter((p) => p.ativo);

  const conversasComPendencia = await Promise.all(
    ativos.map(async (p) => {
      const conversa = await chatRepository.buscarConversaDoPaciente(p.id);
      if (!conversa || conversa.naoLidasParaNutricionista === 0) return null;
      const mensagens = await chatRepository.listarMensagens(conversa.id);
      const ultima = mensagens[mensagens.length - 1];
      return ultima
        ? { pacienteId: p.id, nome: p.nome, ultimaMensagem: ultima.texto, quando: ultima.enviadaEm }
        : null;
    }),
  );

  const checkinsPendentes = resumos
    .filter((r) => ativos.some((p) => p.id === r.pacienteId))
    .filter((r) => r.pendencias.some((p) => p.toLowerCase().includes("check-in")))
    .map((r) => ({ pacienteId: r.pacienteId, nome: nomePorId.get(r.pacienteId) ?? "", ultimoCheckin: r.ultimoCheckinRotulo }));

  // "Esta semana" precisa de data, não do rótulo livre: contar qualquer
  // paciente com consulta marcada punha "dia 20" e "próxima terça" dentro
  // do número da semana corrente.
  const { inicio, fim } = semanaCorrente();

  return {
    pacientesAtivos: ativos.length,
    consultasSemana: ativos
      .filter((p) => {
        if (!p.proximaConsultaEm) return false;
        const quando = new Date(p.proximaConsultaEm).getTime();
        return quando >= inicio.getTime() && quando < fim.getTime();
      })
      .sort((a, b) => a.proximaConsultaEm!.localeCompare(b.proximaConsultaEm!))
      .map((p) => ({ pacienteId: p.id, nome: p.nome, quando: p.proximaConsultaRotulo ?? "" })),
    mensagensPendentes: conversasComPendencia.filter((c): c is NonNullable<typeof c> => c !== null),
    checkinsPendentes,
    questionariosAguardandoLeitura: respostasPendentes.map((r) => ({
      pacienteId: r.pacienteId,
      nome: nomePorId.get(r.pacienteId) ?? "",
      templateTitulo: "Como foi o seu mês",
    })),
    alertasClinicos: alertas.map((a) => ({ ...a, pacienteNome: nomePorId.get(a.pacienteId) ?? "" })),
    ultimosAtualizados: [...pacientes]
      .sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm))
      .slice(0, 5)
      .map((p) => ({ pacienteId: p.id, nome: p.nome, quando: p.atualizadoEm })),
  };
}
