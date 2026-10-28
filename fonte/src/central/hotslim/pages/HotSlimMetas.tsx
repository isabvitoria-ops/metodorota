import { useCallback, useEffect, useRef, useState } from "react";
import { repositorioHotSlim, type MetaSemanal } from "../dados/repositorioHotSlim";

const SEMANAS = [1, 2, 3];

export function HotSlimMetas() {
  const [semana, setSemana] = useState(1);
  const [metas, setMetas] = useState<MetaSemanal>({
    semana: 1,
    agua_litros: null,
    sono_horas: null,
    musculacao_vezes: null,
    cardio_minutos: null,
    metas_extras: [],
  });
  const [novaMeta, setNovaMeta] = useState("");
  const [erroSalvar, setErroSalvar] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    void repositorioHotSlim.carregarMetas(semana).then((d) => {
      if (d) setMetas(d);
      else setMetas({ semana, agua_litros: null, sono_horas: null, musculacao_vezes: null, cardio_minutos: null, metas_extras: [] });
    });
  }, [semana]);

  const salvar = useCallback(
    (patch: Partial<MetaSemanal>) => {
      const novo = { ...metas, ...patch };
      setMetas(novo);
      setErroSalvar(false);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void repositorioHotSlim.salvarMetas(semana, novo).catch(() => setErroSalvar(true));
      }, 600);
    },
    [metas, semana],
  );

  const adicionarExtra = () => {
    const texto = novaMeta.trim();
    if (!texto) return;
    salvar({ metas_extras: [...metas.metas_extras, texto] });
    setNovaMeta("");
  };

  const removerExtra = (idx: number) => {
    salvar({ metas_extras: metas.metas_extras.filter((_, i) => i !== idx) });
  };

  return (
    <div className="hs-pagina">
      <div style={{ marginBottom: 20 }}>
        <h1 className="hs-titulo">Minhas Metas</h1>
        <p className="hs-texto">Defina seus objetivos semanais</p>
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 20 }}>
        {SEMANAS.map((s) => (
          <button
            key={s}
            onClick={() => setSemana(s)}
            className={`hs-btn ${s === semana ? "hs-btn-accent" : "hs-btn-outline"}`}
            style={{ padding: "8px 18px", fontSize: 13 }}
          >
            Semana {s}
          </button>
        ))}
      </div>

      <div className="c-secao">
        <h2 className="c-secao-titulo">Hidratação</h2>
        <div className="hs-meta-row">
          <div className="hs-meta-info">
            <div className="hs-meta-label">Água por dia</div>
            <div className="hs-meta-hint">Meta: 40ml × seu peso (kg)</div>
          </div>
          <input
            type="number"
            className="hs-meta-input"
            placeholder="L"
            step="0.1"
            min="0"
            value={metas.agua_litros ?? ""}
            onChange={(e) => salvar({ agua_litros: e.target.value ? Number(e.target.value) : null })}
          />
        </div>
      </div>

      <div className="c-secao">
        <h2 className="c-secao-titulo">Sono</h2>
        <div className="hs-meta-row">
          <div className="hs-meta-info">
            <div className="hs-meta-label">Horas de sono</div>
            <div className="hs-meta-hint">Mínimo recomendado: 7h</div>
          </div>
          <input
            type="number"
            className="hs-meta-input"
            placeholder="h"
            step="0.5"
            min="0"
            value={metas.sono_horas ?? ""}
            onChange={(e) => salvar({ sono_horas: e.target.value ? Number(e.target.value) : null })}
          />
        </div>
      </div>

      <div className="c-secao">
        <h2 className="c-secao-titulo">Exercícios</h2>
        <div className="hs-meta-row">
          <div className="hs-meta-info">
            <div className="hs-meta-label">Musculação</div>
            <div className="hs-meta-hint">Vezes por semana</div>
          </div>
          <input
            type="number"
            className="hs-meta-input"
            placeholder="x"
            min="0"
            value={metas.musculacao_vezes ?? ""}
            onChange={(e) => salvar({ musculacao_vezes: e.target.value ? Number(e.target.value) : null })}
          />
        </div>
        <div className="hs-meta-row">
          <div className="hs-meta-info">
            <div className="hs-meta-label">Cardio</div>
            <div className="hs-meta-hint">Minutos por semana</div>
          </div>
          <input
            type="number"
            className="hs-meta-input"
            placeholder="min"
            min="0"
            value={metas.cardio_minutos ?? ""}
            onChange={(e) => salvar({ cardio_minutos: e.target.value ? Number(e.target.value) : null })}
          />
        </div>
      </div>

      <div className="c-secao">
        <h2 className="c-secao-titulo">Metas extras</h2>
        <p className="hs-texto">Adicione seus objetivos pessoais para esta semana</p>

        {metas.metas_extras.map((m, i) => (
          <div key={i} className="hs-toggle-row ativo">
            <span className="hs-toggle-text">{m}</span>
            <button
              onClick={() => removerExtra(i)}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "var(--hs-fg-soft)", padding: 4 }}
              aria-label="Remover"
            >
              ✕
            </button>
          </div>
        ))}

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input
            type="text"
            className="hs-meta-input"
            style={{ flex: 1, width: "auto", textAlign: "left" }}
            placeholder='Ex: "sem beliscos", "dormir cedo"'
            value={novaMeta}
            onChange={(e) => setNovaMeta(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && adicionarExtra()}
          />
          <button onClick={adicionarExtra} className="hs-btn hs-btn-accent" style={{ padding: "8px 16px" }}>
            +
          </button>
        </div>
      </div>

      {erroSalvar && (
        <div className="hs-dica" style={{ borderColor: "var(--hs-accent)", color: "var(--hs-accent)" }}>
          <strong>Não consegui salvar.</strong> Verifique sua conexão e tente novamente.
        </div>
      )}
    </div>
  );
}
