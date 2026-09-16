import { useState } from "react";
import { FichaPacienteProvider, useFichaPaciente } from "@/contexts/FichaPacienteContext";
import { usePaciente } from "@/hooks/usePaciente";
import { AbaPlano } from "./AbaPlano";
import { AbaAlimentos } from "./AbaAlimentos";
import { AbaEquivalencias } from "./AbaEquivalencias";
import { AbaMateriais } from "./AbaMateriais";
import { AbaRegistros } from "./AbaRegistros";
import { AbaAcesso } from "./AbaAcesso";

type TabId = "plano" | "alimentos" | "equiv" | "materiais" | "registros" | "acesso";
const TABS: [TabId, string][] = [
  ["plano", "Plano"], ["alimentos", "Alimentos"], ["equiv", "Equivalências"],
  ["materiais", "Materiais"], ["registros", "Registros"], ["acesso", "Acesso"],
];

/** Uma alteração que o servidor recusou não pode passar em silêncio. */
function AvisoGravacao() {
  const { erroGravacao } = useFichaPaciente();
  if (!erroGravacao) return null;
  return (
    <div className="card" role="alert" style={{ borderLeft: "3px solid var(--clay)", marginBottom: 14 }}>
      <div style={{ fontSize: 14, color: "var(--clay)", lineHeight: 1.5 }}>{erroGravacao}</div>
    </div>
  );
}

export function FichaPaciente({ pacienteId, nutricionistaId, voltar }: { pacienteId: string; nutricionistaId: string; voltar: () => void }) {
  const { estado, atualizar } = usePaciente(pacienteId);
  const [tab, setTab] = useState<TabId>("plano");

  if (estado.status === "carregando") {
    return (
      <div className="wrap">
        <p style={{ color: "var(--ink-2)", padding: "26px 0" }}>Carregando…</p>
      </div>
    );
  }
  if (estado.status === "erro" || !estado.dado) {
    return (
      <div className="wrap">
        <button onClick={voltar} className="chip" style={{ margin: "26px 0 14px" }}>← Pacientes</button>
        <p style={{ color: "var(--clay)" }}>Não conseguimos carregar esta paciente agora.</p>
      </div>
    );
  }
  const paciente = estado.dado;

  return (
    <FichaPacienteProvider key={paciente.id} pacienteInicial={paciente} onAtualizar={atualizar}>
      <div className="wrap">
        <div style={{ padding: "22px 0 14px" }}>
          <button onClick={voltar} className="chip" style={{ marginBottom: 14 }}>← Pacientes</button>
          <div className="row" style={{ alignItems: "flex-start" }}>
            <div style={{ width: 46, height: 46, borderRadius: 15, background: "var(--plum-wash)", display: "grid", placeItems: "center", color: "var(--plum)", fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, flexShrink: 0 }}>
              {paciente.apelidoFeed}
            </div>
            <div style={{ flex: 1 }}>
              <h1 className="disp" style={{ fontSize: 26, fontWeight: 600 }}>{paciente.nome}</h1>
              <div style={{ fontSize: 13.5, color: "var(--ink-2)", marginTop: 3 }}>
                {paciente.objetivo} · consulta {paciente.proximaConsultaRotulo ?? "—"}
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 16 }}>
          {TABS.map(([id, l]) => (
            <button key={id} className={`chip ${tab === id ? "on" : ""}`} onClick={() => setTab(id)} style={{ whiteSpace: "nowrap", flexShrink: 0 }}>{l}</button>
          ))}
        </div>
        <AvisoGravacao />
        {tab === "plano" && <AbaPlano nutricionistaId={nutricionistaId} />}
        {tab === "alimentos" && <AbaAlimentos />}
        {tab === "equiv" && <AbaEquivalencias />}
        {tab === "materiais" && <AbaMateriais />}
        {tab === "registros" && <AbaRegistros />}
        {tab === "acesso" && <AbaAcesso />}
      </div>
    </FichaPacienteProvider>
  );
}
