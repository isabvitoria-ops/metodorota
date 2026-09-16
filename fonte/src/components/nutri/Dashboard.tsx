import { Tag } from "@/components/ui/Tag";
import { SkeletonCard, EstadoErro } from "@/components/ui/EstadoAsync";
import { tempoRelativo } from "@/utils/tempoRelativo";
import { useDashboard } from "@/hooks/useDashboard";

const ORIGEM_ALERTA_ROTULO: Record<string, string> = {
  sangue_nas_fezes: "Sangue nas fezes",
  dor_alta_sequencial: "Dor alta em dias seguidos",
  sem_checkin_prolongado: "Sem check-in há muito tempo",
};

/** Tela nova (briefing §15) — não existe no protótipo. Todo o agregado vem de dashboardService. */
export function Dashboard({ nutricionistaId, abrirPaciente }: { nutricionistaId: string; abrirPaciente: (id: string) => void }) {
  const { estado } = useDashboard(nutricionistaId);

  if (estado.status === "carregando") {
    return (
      <div className="wrap">
        <SkeletonCard />
      </div>
    );
  }
  if (estado.status === "erro") {
    return (
      <div className="wrap">
        <EstadoErro mensagem={estado.erro} />
      </div>
    );
  }
  const d = estado.dado;

  return (
    <div className="wrap">
      <div style={{ padding: "26px 0 18px" }}>
        <div className="eyebrow">Visão geral</div>
        <h1 className="disp" style={{ fontSize: 32, fontWeight: 600, margin: "10px 0 0" }}>Bom te ver de novo</h1>
      </div>

      <div className="grid2" style={{ marginBottom: 14 }}>
        <div className="card">
          <div className="eyebrow" style={{ marginBottom: 8 }}>Pacientes ativos</div>
          <div className="disp" style={{ fontSize: 30, fontWeight: 600 }}>{d.pacientesAtivos}</div>
        </div>
        <div className="card">
          <div className="eyebrow" style={{ marginBottom: 8 }}>Consultas esta semana</div>
          <div className="disp" style={{ fontSize: 30, fontWeight: 600 }}>{d.consultasSemana.length}</div>
        </div>
      </div>

      {d.alertasClinicos.length > 0 && (
        <div className="card" style={{ borderLeft: "3px solid var(--clay)", marginBottom: 14 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Alertas clínicos</div>
          {d.alertasClinicos.map((a) => (
            <button
              key={a.id} onClick={() => abrirPaciente(a.pacienteId)}
              style={{ display: "flex", width: "100%", gap: 10, alignItems: "center", background: "none", border: 0, borderTop: "1px solid var(--line)", padding: "10px 0", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
            >
              <span style={{ fontSize: 14.5, fontWeight: 600, flexShrink: 0 }}>{a.pacienteNome}</span>
              <span style={{ fontSize: 13.5, color: "var(--clay)", flex: 1 }}>{ORIGEM_ALERTA_ROTULO[a.origem] ?? a.origem}</span>
              <span style={{ color: "var(--plum)" }}>→</span>
            </button>
          ))}
        </div>
      )}

      <div className="grid2" style={{ marginBottom: 14 }}>
        <div className="card">
          <div className="eyebrow" style={{ marginBottom: 10 }}>Mensagens pendentes</div>
          {d.mensagensPendentes.length === 0 && <p style={{ fontSize: 13.5, color: "var(--ink-2)", margin: 0 }}>Nenhuma mensagem esperando resposta.</p>}
          {d.mensagensPendentes.map((m) => (
            <button
              key={m.pacienteId} onClick={() => abrirPaciente(m.pacienteId)}
              style={{ display: "block", width: "100%", background: "none", border: 0, borderTop: "1px solid var(--line)", padding: "10px 0", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
            >
              <div style={{ fontSize: 14, fontWeight: 600 }}>{m.nome}</div>
              <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 2 }}>{m.ultimaMensagem}</div>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", marginTop: 3 }}>{tempoRelativo(m.quando).toUpperCase()}</div>
            </button>
          ))}
        </div>

        <div className="card">
          <div className="eyebrow" style={{ marginBottom: 10 }}>Check-ins pendentes</div>
          {d.checkinsPendentes.length === 0 && <p style={{ fontSize: 13.5, color: "var(--ink-2)", margin: 0 }}>Todo mundo com check-in em dia.</p>}
          {d.checkinsPendentes.map((c) => (
            <button
              key={c.pacienteId} onClick={() => abrirPaciente(c.pacienteId)}
              style={{ display: "flex", width: "100%", gap: 10, background: "none", border: 0, borderTop: "1px solid var(--line)", padding: "10px 0", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{c.nome}</span>
              <Tag cor="#B98B2E">{c.ultimoCheckin.toUpperCase()}</Tag>
            </button>
          ))}
        </div>
      </div>

      <div className="grid2" style={{ marginBottom: 14 }}>
        <div className="card">
          <div className="eyebrow" style={{ marginBottom: 10 }}>Questionários aguardando leitura</div>
          {d.questionariosAguardandoLeitura.length === 0 && <p style={{ fontSize: 13.5, color: "var(--ink-2)", margin: 0 }}>Nada novo por aqui.</p>}
          {d.questionariosAguardandoLeitura.map((q) => (
            <button
              key={q.pacienteId} onClick={() => abrirPaciente(q.pacienteId)}
              style={{ display: "block", width: "100%", background: "none", border: 0, borderTop: "1px solid var(--line)", padding: "10px 0", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
            >
              <div style={{ fontSize: 14, fontWeight: 600 }}>{q.nome}</div>
              <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 2 }}>{q.templateTitulo}</div>
            </button>
          ))}
        </div>

        <div className="card">
          <div className="eyebrow" style={{ marginBottom: 10 }}>Consultas da semana</div>
          {d.consultasSemana.length === 0 && <p style={{ fontSize: 13.5, color: "var(--ink-2)", margin: 0 }}>Nenhuma consulta marcada.</p>}
          {d.consultasSemana.map((c) => (
            <button
              key={c.pacienteId} onClick={() => abrirPaciente(c.pacienteId)}
              style={{ display: "flex", width: "100%", gap: 10, background: "none", border: 0, borderTop: "1px solid var(--line)", padding: "10px 0", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{c.nome}</span>
              <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{c.quando.toUpperCase()}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 10 }}>Últimos pacientes atualizados</div>
        {d.ultimosAtualizados.map((p) => (
          <button
            key={p.pacienteId} onClick={() => abrirPaciente(p.pacienteId)}
            style={{ display: "flex", width: "100%", gap: 10, background: "none", border: 0, borderTop: "1px solid var(--line)", padding: "10px 0", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
          >
            <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{p.nome}</span>
            <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{tempoRelativo(p.quando).toUpperCase()}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
