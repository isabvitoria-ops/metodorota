import "@/styles/global.css";
import { useState } from "react";
import { Toast } from "@/components/ui/Toast";
import { Dashboard } from "@/components/nutri/Dashboard";
import { ListaPacientes } from "@/components/nutri/ListaPacientes";
import { PainelBase } from "@/components/nutri/PainelBase";
import { PainelFeed } from "@/components/nutri/PainelFeed";
import { PainelBiblioteca } from "@/components/nutri/PainelBiblioteca";
import { FichaPaciente } from "@/components/nutri/ficha/FichaPaciente";
import { useAsync } from "@/hooks/useAsync";
import { pacienteService } from "@/services";

type Secao = "dashboard" | "pacientes" | "base" | "feed" | "biblioteca";
const SECOES: [Secao, string][] = [
  ["dashboard", "Dashboard"], ["pacientes", "Pacientes"], ["base", "Base"], ["feed", "Feed"], ["biblioteca", "Biblioteca"],
];

export function AppNutri({ nutricionistaId }: { nutricionistaId: string }) {
  const [secao, setSecao] = useState<Secao>("dashboard");
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [estadoAtivos] = useAsync(() => pacienteService.listarPacientesComResumo(), []);

  const irPara = (s: Secao) => {
    setSecao(s);
    setAbertoId(null);
  };
  const abrirPaciente = (id: string) => setAbertoId(id);

  const ativos = estadoAtivos.status === "pronto" ? estadoAtivos.dado.filter((x) => x.paciente.ativo).length : null;

  return (
    <div className="root">
      <nav className="nav">
        <div className="navin">
          <div className="disp" style={{ fontSize: 17, fontWeight: 700, marginRight: 8 }}>Painel</div>
          {SECOES.map(([id, l]) => (
            <button key={id} className={`seg ${secao === id && !abertoId ? "on" : ""}`} onClick={() => irPara(id)}>{l}</button>
          ))}
          <div style={{ flex: 1 }} />
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{ativos ?? "…"} ATIVOS</div>
        </div>
      </nav>

      {abertoId ? (
        <FichaPaciente pacienteId={abertoId} nutricionistaId={nutricionistaId} voltar={() => setAbertoId(null)} />
      ) : (
        <>
          {secao === "dashboard" && <Dashboard nutricionistaId={nutricionistaId} abrirPaciente={abrirPaciente} />}
          {secao === "pacientes" && <ListaPacientes abrir={abrirPaciente} />}
          {secao === "base" && <PainelBase />}
          {secao === "feed" && <PainelFeed nutricionistaId={nutricionistaId} />}
          {secao === "biblioteca" && <PainelBiblioteca />}
        </>
      )}

      <Toast />
    </div>
  );
}
