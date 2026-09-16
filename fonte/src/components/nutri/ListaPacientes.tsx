import { Tag } from "@/components/ui/Tag";
import { SkeletonCard, EstadoErro } from "@/components/ui/EstadoAsync";
import { usePacientes } from "@/hooks/usePacientes";
import { useToast } from "@/hooks/useToast";

export function ListaPacientes({ abrir }: { abrir: (pacienteId: string) => void }) {
  const { estado, filtrados, busca, setBusca, incluirInativos, setIncluirInativos } = usePacientes();
  const avisar = useToast();

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

  const pendentes = estado.dado.filter(({ paciente, resumo }) => paciente.ativo && (resumo?.pendencias.length ?? 0) > 0);

  return (
    <div className="wrap">
      <div style={{ padding: "26px 0 18px" }}>
        <div className="eyebrow">Painel</div>
        <h1 className="disp" style={{ fontSize: 32, fontWeight: 600, margin: "10px 0 0" }}>Seus pacientes</h1>
      </div>

      {pendentes.length > 0 && (
        <div className="card" style={{ borderLeft: "3px solid var(--gold)", marginBottom: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Precisa de você hoje</div>
          {pendentes.map(({ paciente, resumo }) => (
            <button
              key={paciente.id} onClick={() => abrir(paciente.id)}
              style={{ display: "flex", width: "100%", gap: 10, alignItems: "center", background: "none", border: 0, borderTop: "1px solid var(--line)", padding: "10px 0", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
            >
              <span style={{ fontSize: 14.5, fontWeight: 600, flexShrink: 0 }}>{paciente.nome}</span>
              <span style={{ fontSize: 13.5, color: "var(--ink-2)", flex: 1 }}>{resumo?.pendencias[0]}</span>
              <span style={{ color: "var(--plum)" }}>→</span>
            </button>
          ))}
        </div>
      )}

      <div className="row" style={{ marginBottom: 14, flexWrap: "wrap" }}>
        <input className="input" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar paciente" style={{ flex: 1, minWidth: 180 }} />
        <button className={`chip ${incluirInativos ? "on" : ""}`} onClick={() => setIncluirInativos((v) => !v)}>Mostrar inativos</button>
        <button className="btn" onClick={() => avisar("Formulário de cadastro abriria aqui.")}>Novo paciente</button>
      </div>

      <div className="grid2">
        {filtrados.map(({ paciente, resumo }) => (
          <button
            key={paciente.id} onClick={() => abrir(paciente.id)} className="card"
            style={{ border: 0, cursor: "pointer", textAlign: "left", fontFamily: "inherit", opacity: paciente.ativo ? 1 : 0.6 }}
          >
            <div className="row" style={{ marginBottom: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 13, background: "var(--plum-wash)", display: "grid", placeItems: "center", color: "var(--plum)", fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, flexShrink: 0 }}>
                {paciente.apelidoFeed}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{paciente.nome}</div>
                <div style={{ fontSize: 13, color: "var(--ink-2)" }}>{paciente.objetivo}</div>
              </div>
              {!paciente.ativo && <Tag cor="#B0503C">INATIVA</Tag>}
            </div>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <span className="mono" style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
                {paciente.alimentosLiberadosCodigoTaco.length} ALIMENTOS LIBERADOS
              </span>
              {paciente.ativo && resumo && (
                <span className="mono" style={{ fontSize: 11.5, color: resumo.adesaoPercentual >= 70 ? "var(--sage)" : "var(--gold)" }}>
                  ADESÃO {resumo.adesaoPercentual}%
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {estado.status === "pronto" && filtrados.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 28 }}>
          <p style={{ fontSize: 14.5, color: "var(--ink-2)", margin: 0, lineHeight: 1.5 }}>
            {busca.trim()
              ? `Nenhum paciente encontrado para "${busca.trim()}".`
              : "Nenhum paciente por aqui ainda."}
          </p>
          {busca.trim() && !incluirInativos && (
            <button className="chip" style={{ marginTop: 14 }} onClick={() => setIncluirInativos(true)}>
              Incluir inativos na busca
            </button>
          )}
        </div>
      )}
    </div>
  );
}
