import { useCallback, useEffect, useRef, useState } from "react";
import { repositorioHotSlim, type ChecklistDia } from "../dados/repositorioHotSlim";
import { hojeSaoPaulo } from "@/central/utils/situacao";

type Campo = keyof Omit<ChecklistDia, "dia" | "notas">;

const ITENS: { campo: Campo; texto: string }[] = [
  { campo: "intestino_regulou", texto: "Intestino regulou?" },
  { campo: "sem_gases", texto: "Sem gases?" },
  { campo: "dormiu_bem", texto: "Dormiu bem?" },
  { campo: "barriga_desinchada", texto: "Barriga desinchada?" },
  { campo: "sem_compulsao", texto: "Menos compulsão?" },
  { campo: "energia_boa", texto: "Energia boa?" },
  { campo: "humor_estavel", texto: "Humor estável?" },
];

const CAMPOS: Campo[] = ITENS.map((i) => i.campo);

function contarMarcados(valores: Record<Campo, boolean>): number {
  return CAMPOS.filter((c) => valores[c]).length;
}

function hoje(): string {
  const iso = hojeSaoPaulo();
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function HotSlimChecklist() {
  const [valores, setValores] = useState<Record<Campo, boolean>>(() => {
    const v: Record<string, boolean> = {};
    for (const c of CAMPOS) v[c] = false;
    return v as Record<Campo, boolean>;
  });
  const [notas, setNotas] = useState("");
  const [historico, setHistorico] = useState<ChecklistDia[]>([]);
  const [erroSalvar, setErroSalvar] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    repositorioHotSlim.carregarChecklistHoje().then((data) => {
      if (!data) return;
      const v: Record<string, boolean> = {};
      for (const c of CAMPOS) v[c] = Boolean(data[c]);
      setValores(v as Record<Campo, boolean>);
      setNotas(data.notas ?? "");
    }).catch(() => {});

    repositorioHotSlim.carregarHistoricoChecklist().then(setHistorico).catch(() => {});
  }, []);

  const salvar = useCallback(
    (novo: Record<Campo, boolean>, notasVal: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setErroSalvar(false);
      timerRef.current = setTimeout(() => {
        repositorioHotSlim
          .salvarChecklist({ ...novo, notas: notasVal || null })
          .catch(() => setErroSalvar(true));
      }, 500);
    },
    [],
  );

  function alternar(campo: Campo) {
    setValores((prev) => {
      const novo = { ...prev, [campo]: !prev[campo] };
      salvar(novo, notas);
      return novo;
    });
  }

  function mudarNotas(valor: string) {
    setNotas(valor);
    salvar(valores, valor);
  }

  const marcados = contarMarcados(valores);

  return (
    <div className="hs-pagina">
      <h1 className="hs-titulo">Checklist Diário</h1>
      <p className="hs-texto" style={{ textTransform: "capitalize" }}>{hoje()}</p>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "16px 0 12px" }}>
        <span className="hs-label">Como você está hoje?</span>
        <span className={`hs-tag ${marcados >= 5 ? "hs-tag-green" : "hs-tag-gold"}`}>
          {marcados} de 7
        </span>
      </div>

      {ITENS.map((item) => (
        <div
          key={item.campo}
          className={`hs-toggle-row ${valores[item.campo] ? "ativo" : ""}`}
          onClick={() => alternar(item.campo)}
          role="checkbox"
          aria-checked={valores[item.campo]}
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); alternar(item.campo); } }}
        >
          <span className="hs-toggle-text">{item.texto}</span>
          <span className="hs-toggle-check">
            {valores[item.campo] ? "✓" : ""}
          </span>
        </div>
      ))}

      {erroSalvar && (
        <div className="hs-dica" style={{ marginTop: 12, borderColor: "var(--hs-accent)", color: "var(--hs-accent)" }}>
          <strong>Não consegui salvar.</strong> Verifique sua conexão e tente novamente.
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <label className="hs-label" htmlFor="hs-notas" style={{ display: "block", marginBottom: 6 }}>
          Anotações do dia
        </label>
        <textarea
          id="hs-notas"
          className="hs-textarea"
          placeholder="Anotações do dia... (opcional)"
          value={notas}
          onChange={(e) => mudarNotas(e.target.value)}
        />
      </div>

      {historico.length > 0 && (
        <div className="c-secao" style={{ marginTop: 28 }}>
          <h2 className="c-secao-titulo">Histórico recente</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {historico.slice(0, 7).map((dia) => {
              const total = CAMPOS.filter((c) => Boolean(dia[c as keyof ChecklistDia])).length;
              const cor = total >= 5 ? "var(--hs-green)" : total >= 3 ? "var(--hs-gold)" : "var(--hs-border)";
              const dataFormatada = new Date(dia.dia + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
              return (
                <div key={dia.dia} style={{ textAlign: "center" }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: cor,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: total >= 3 ? "white" : "var(--hs-fg-soft)",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {total}
                  </div>
                  <span style={{ fontSize: 10, color: "var(--hs-fg-soft)" }}>{dataFormatada}</span>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: 11, color: "var(--hs-fg-soft)", marginTop: 8 }}>
            Verde: 5+ marcados — Dourado: 3–4 marcados — Cinza: {"<"}3 marcados
          </p>
        </div>
      )}
    </div>
  );
}
