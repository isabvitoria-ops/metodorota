import "@/styles/global.css";
import { Hoje } from "@/components/patient/Hoje";
import { Plano } from "@/components/patient/Plano";
import { Diario } from "@/components/patient/Diario";
import { Evolucao } from "@/components/patient/Evolucao";
import { Feed } from "@/components/patient/Feed";
import { CheckIn, type DadosCheckIn } from "@/modals/patient/CheckIn";
import { Montador } from "@/modals/patient/Montador";
import { Chat } from "@/modals/patient/Chat";
import { Fotos } from "@/modals/patient/Fotos";
import { Perfil, type DestinoPerfil } from "@/modals/patient/Perfil";
import { Biblioteca } from "@/modals/patient/Biblioteca";
import { Questionario } from "@/modals/patient/Questionario";
import { Lembretes } from "@/modals/patient/Lembretes";
import { Ficha } from "@/modals/patient/Ficha";
import { Toast } from "@/components/ui/Toast";
import { useUiPacienteStore, type AbaPaciente } from "@/store/uiPacienteStore";
import { usePaciente } from "@/hooks/usePaciente";
import { useCheckin } from "@/hooks/useCheckin";
import { useDiario } from "@/hooks/useDiario";
import { useNaoLidasChatInicial } from "@/hooks/useChat";
import { useQuestionarioPendenteInicial } from "@/hooks/useQuestionario";
import { useToast } from "@/hooks/useToast";
import { useSincronizacaoOffline } from "@/hooks/useSincronizacaoOffline";
import { descricaoParaDiario } from "@/services/montadorService";
import { formatarDataLonga } from "@/utils/datas";
import type { ItemMontadorResolvido } from "@/services/montadorService";
import type { SintomaId } from "@/types";

const ABAS: [AbaPaciente, string][] = [
  ["hoje", "Hoje"],
  ["plano", "Plano"],
  ["diario", "Diário"],
  ["evolucao", "Evolução"],
  ["feed", "Feed"],
];

export function AppPaciente({ pacienteId, nutricionistaId }: { pacienteId: string; nutricionistaId: string }) {
  const ui = useUiPacienteStore();
  const { estado: estadoPaciente } = usePaciente(pacienteId);
  const { estado: estadoCheckin, salvar: salvarCheckin } = useCheckin(pacienteId);
  const { registrarTroca } = useDiario(pacienteId);
  const avisar = useToast();
  useSincronizacaoOffline();
  useNaoLidasChatInicial(pacienteId);
  useQuestionarioPendenteInicial(pacienteId);

  const feitoHoje = estadoCheckin.status === "pronto" ? estadoCheckin.dado : null;

  const abrirDoPerfil = (destino: DestinoPerfil) => {
    ui.fecharPerfil();
    if (destino === "biblioteca") ui.abrirBiblioteca();
    if (destino === "questionario") ui.abrirQuestionario();
    if (destino === "lembretes") ui.abrirLembretes();
    if (destino === "privacidade") avisar("Pedido de cópia dos seus dados registrado.");
  };

  const handleSalvarCheckin = async (dados: DadosCheckIn) => {
    const resultado = await salvarCheckin(nutricionistaId, dados);
    ui.fecharCheckin();
    if (resultado.avisoSangue) {
      avisar("Check-in salvo. Sua nutri foi avisada.");
    } else if (resultado.pendente) {
      // Offline-first (briefing §10): nunca trava esperando rede — salva no aparelho e sincroniza sozinho depois.
      avisar("Check-in salvo neste aparelho. Sincroniza sozinho quando a conexão voltar.");
    } else {
      avisar("Check-in salvo. Até amanhã.");
    }
    ui.irPara("hoje");
  };

  const handleUsarMontador = async (resolvidos: ItemMontadorResolvido[]) => {
    ui.fecharMontador();
    // Regra #5: usar o montador nunca conta como desvio — sempre "troquei".
    // Não há um refeicaoId específico aqui (é uma refeição livre montada
    // pelo paciente); usa um marcador fixo dedicado a esse fluxo.
    await registrarTroca(nutricionistaId, "refeicao-montada", descricaoParaDiario(resolvidos));
    avisar("Refeição montada e registrada no diário.");
    ui.irPara("diario");
  };

  if (estadoPaciente.status === "carregando") {
    return (
      <div className="app-root">
        <div className="phone" style={{ display: "grid", placeItems: "center" }}>
          <p style={{ color: "var(--ink-2)" }}>Carregando…</p>
        </div>
      </div>
    );
  }
  if (estadoPaciente.status === "erro" || !estadoPaciente.dado) {
    return (
      <div className="app-root">
        <div className="phone" style={{ display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
          <p style={{ color: "var(--ink-2)" }}>Não conseguimos carregar seus dados agora. Tente novamente em instantes.</p>
        </div>
      </div>
    );
  }
  const paciente = estadoPaciente.dado;

  return (
    <div className="app-root">
      <div className="phone">
        <header className="topbar">
          <div style={{ minWidth: 0 }}>
            <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", letterSpacing: ".08em" }}>
              {formatarDataLonga(new Date()).toUpperCase()}
            </div>
            <div className="disp" style={{ fontSize: 18, fontWeight: 600, marginTop: 3 }}>Olá, {paciente.nome.split(" ")[0]}</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button
              onClick={ui.abrirChat} aria-label="Conversar com a nutri"
              style={{ position: "relative", width: 36, height: 36, borderRadius: 12, border: 0, background: "var(--plum)", color: "#fff", cursor: "pointer", fontSize: 15 }}
            >
              ✉
              {ui.naoLidasChat > 0 && (
                <span style={{ position: "absolute", top: -3, right: -3, width: 14, height: 14, borderRadius: 99, background: "var(--gold)", border: "2px solid var(--paper)" }} />
              )}
            </button>
            <button
              onClick={ui.abrirPerfil} aria-label="Abrir meu perfil"
              style={{ position: "relative", width: 36, height: 36, borderRadius: 12, border: 0, background: "var(--plum-wash)", color: "var(--plum)", cursor: "pointer", fontFamily: "'IBM Plex Mono',monospace", fontSize: 11 }}
            >
              {paciente.apelidoFeed}
              {ui.questionarioPendente && (
                <span style={{ position: "absolute", top: -3, right: -3, width: 14, height: 14, borderRadius: 99, background: "var(--gold)", border: "2px solid var(--paper)" }} />
              )}
            </button>
          </div>
        </header>

        {ui.aba === "hoje" && <Hoje pacienteId={pacienteId} irPara={ui.irPara} preferenciaUnidade={paciente.preferenciaUnidade} />}
        {ui.aba === "plano" && <Plano pacienteId={pacienteId} preferenciaUnidade={paciente.preferenciaUnidade} />}
        {ui.aba === "diario" && <Diario pacienteId={pacienteId} nutricionistaId={nutricionistaId} />}
        {ui.aba === "evolucao" && <Evolucao pacienteId={pacienteId} nutricionistaId={nutricionistaId} />}
        {ui.aba === "feed" && <Feed pacienteId={pacienteId} />}

        <Toast bottom={92} />

        <nav className="tabs">
          {ABAS.map(([id, label]) => (
            <button key={id} className={`tab ${ui.aba === id ? "on" : ""}`} onClick={() => ui.irPara(id)}>
              <span className="dot" />{label}
            </button>
          ))}
        </nav>
      </div>

      {ui.checkinAberto && <CheckIn inicial={feitoHoje} onFechar={ui.fecharCheckin} onSalvar={handleSalvarCheckin} />}
      {ui.montadorAberto && <Montador pacienteId={pacienteId} onFechar={ui.fecharMontador} onUsar={handleUsarMontador} />}
      {ui.chatAberto && <Chat pacienteId={pacienteId} nutricionistaId={nutricionistaId} onFechar={ui.fecharChat} />}
      {ui.fotosAberto && <Fotos pacienteId={pacienteId} nutricionistaId={nutricionistaId} onFechar={ui.fecharFotos} />}
      {ui.perfilAberto && <Perfil paciente={paciente} questionarioPendente={ui.questionarioPendente} onFechar={ui.fecharPerfil} abrir={abrirDoPerfil} />}
      {ui.bibliotecaAberta && (
        <Biblioteca sintomasHoje={feitoHoje ? (Object.keys(feitoHoje.sintomas) as SintomaId[]) : []} onFechar={ui.fecharBiblioteca} />
      )}
      {ui.questionarioAberto && (
        <Questionario
          pacienteId={pacienteId} nutricionistaId={nutricionistaId} onFechar={ui.fecharQuestionario}
          onEnviado={() => { ui.fecharQuestionario(); avisar("Questionário enviado para sua nutri."); }}
        />
      )}
      {ui.lembretesAberto && <Lembretes pacienteId={pacienteId} onFechar={ui.fecharLembretes} />}
      {ui.fichaAlimentoAberta !== null && (
        <Ficha codigoTaco={ui.fichaAlimentoAberta.codigoTaco} nomeExibicao={ui.fichaAlimentoAberta.nomeExibicao} onFechar={ui.fecharFicha} />
      )}
    </div>
  );
}
