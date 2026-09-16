import { useEffect, useState } from "react";
import { NOME_GRUPO } from "@/constants/alimentos";
import { alimentoService } from "@/services";
import type { Alimento } from "@/types";

export function PainelBase() {
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<Alimento[]>([]);
  const [sel, setSel] = useState<Alimento | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    alimentoService.contarTotal().then(setTotal);
  }, []);

  useEffect(() => {
    let ativo = true;
    if (q.trim()) {
      alimentoService.buscar(q, 30).then((r) => {
        if (ativo) setResultados(r.map((x) => x.alimento));
      });
    } else {
      alimentoService.listarPorGrupo("carb").then((r) => {
        if (ativo) setResultados(r.slice(0, 30));
      });
    }
    return () => {
      ativo = false;
    };
  }, [q]);

  return (
    <div className="wrap">
      <div style={{ padding: "26px 0 18px" }}>
        <div className="eyebrow">Base interna · TACO 4ª edição</div>
        <h1 className="disp" style={{ fontSize: 32, fontWeight: 600, margin: "10px 0 8px" }}>{total} alimentos</h1>
        <p style={{ fontSize: 14.5, color: "var(--ink-2)", margin: 0, lineHeight: 1.55 }}>
          Valores por 100 g de parte comestível. Nenhum paciente enxerga esta tela — ela existe para você conferir a composição antes de liberar um alimento.
        </p>
      </div>

      <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar — ex.: feijão preto, patinho, aveia" style={{ marginBottom: 12 }} />

      <div className="lista" style={{ maxHeight: 400 }}>
        {resultados.map((b) => (
          <button key={b.codigoTaco} className="li" onClick={() => setSel(b)}>
            <span style={{ flex: 1 }}>{b.nome}</span>
            <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)", flexShrink: 0 }}>{Math.round(b.kcal)} kcal</span>
          </button>
        ))}
      </div>

      {sel && (
        <>
          <div style={{ height: 14 }} />
          <div className="card">
            <div className="row" style={{ marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <div className="disp" style={{ fontSize: 19, fontWeight: 600 }}>{sel.nome}</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>
                  TACO {sel.codigoTaco} · {NOME_GRUPO[sel.grupo].toUpperCase()} · POR 100 G
                </div>
              </div>
              <button className="chip sm" onClick={() => setSel(null)}>fechar</button>
            </div>
            <div className="grid2">
              {([
                ["Energia", sel.kcal, "kcal"], ["Proteína", sel.proteina, "g"], ["Gordura", sel.lipideos, "g"],
                ["Carboidrato", sel.carboidrato, "g"], ["Fibra", sel.fibra, "g"], ["Cálcio", sel.calcio, "mg"],
                ["Ferro", sel.ferro, "mg"], ["Sódio", sel.sodio, "mg"],
              ] as const).map(([l, v, u]) => (
                <div key={l} className="row" style={{ padding: "7px 0", borderTop: "1px solid var(--line)" }}>
                  <span style={{ flex: 1, fontSize: 14, color: "var(--ink-2)" }}>{l}</span>
                  <span className="mono" style={{ fontSize: 14 }}>{v} {u}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
