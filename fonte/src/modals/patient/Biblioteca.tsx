import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Btn } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Eyebrow } from "@/components/ui/Card";
import { useBiblioteca } from "@/hooks/useBiblioteca";
import type { ArtigoBiblioteca, SintomaId } from "@/types";

const CATEGORIAS = ["Todos", "Entender", "Na prática", "O caminho"] as const;

function Cartao({ artigo, destaque, onClick }: { artigo: ArtigoBiblioteca; destaque?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick} className="card"
      style={{ border: destaque ? "1.5px solid var(--plum)" : 0, textAlign: "left", cursor: "pointer", width: "100%", fontFamily: "inherit", display: "block" }}
    >
      <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: ".1em" }}>
        {artigo.categoria.toUpperCase()} · {artigo.minutosLeitura} MIN
      </div>
      <div className="disp" style={{ fontSize: 18, fontWeight: 600, margin: "8px 0 6px", lineHeight: 1.15 }}>{artigo.titulo}</div>
      <div style={{ fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.5 }}>{artigo.resumo}</div>
    </button>
  );
}

export function Biblioteca({ sintomasHoje, onFechar }: { sintomasHoje: SintomaId[]; onFechar: () => void }) {
  const { estado, sugeridos } = useBiblioteca(sintomasHoje);
  const [lendo, setLendo] = useState<ArtigoBiblioteca | null>(null);
  const [filtro, setFiltro] = useState<(typeof CATEGORIAS)[number]>("Todos");

  const lista = estado.status === "pronto" ? (filtro === "Todos" ? estado.dado : estado.dado.filter((a) => a.categoria === filtro)) : [];

  return (
    <Sheet onFechar={onFechar} titulo="Biblioteca" cheia>
      {!lendo ? (
        <>
          <div style={{ flexShrink: 0 }}>
            <Eyebrow>Biblioteca</Eyebrow>
            <h2 className="disp" style={{ fontSize: 25, fontWeight: 600, margin: "10px 0 16px" }}>Entender ajuda a seguir</h2>
            <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 14 }}>
              {CATEGORIAS.map((c) => (
                <Chip key={c} ativo={filtro === c} onClick={() => setFiltro(c)} style={{ whiteSpace: "nowrap", flexShrink: 0 }}>{c}</Chip>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {estado.status === "carregando" && <p style={{ color: "var(--ink-2)" }}>Carregando…</p>}
            {sugeridos.length > 0 && filtro === "Todos" && (
              <>
                <Eyebrow>Por causa do que você registrou hoje</Eyebrow>
                <div style={{ display: "grid", gap: 10, margin: "10px 0 20px" }}>
                  {sugeridos.map((a) => (
                    <Cartao key={a.id} artigo={a} destaque onClick={() => setLendo(a)} />
                  ))}
                </div>
                <Eyebrow>Tudo</Eyebrow>
              </>
            )}
            <div style={{ display: "grid", gap: 10, paddingBottom: 12, marginTop: 10 }}>
              {lista.map((a) => (
                <Cartao key={a.id} artigo={a} onClick={() => setLendo(a)} />
              ))}
            </div>
          </div>
          <Btn variante="ghost" style={{ flexShrink: 0, marginTop: 10 }} onClick={onFechar}>Fechar</Btn>
        </>
      ) : (
        <>
          <div style={{ flex: 1, overflowY: "auto" }}>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: ".1em" }}>
              {lendo.categoria.toUpperCase()} · {lendo.minutosLeitura} MIN DE LEITURA
            </div>
            <h2 className="disp" style={{ fontSize: 26, fontWeight: 600, margin: "12px 0 16px", lineHeight: 1.12 }}>{lendo.titulo}</h2>
            <p style={{ fontSize: 16, lineHeight: 1.65, color: "var(--ink-2)" }}>{lendo.resumo}</p>
            {lendo.corpo && <p style={{ fontSize: 16, lineHeight: 1.65, color: "var(--ink-2)" }}>{lendo.corpo}</p>}
            <div className="card" style={{ marginTop: 20, borderLeft: "3px solid var(--gold)" }}>
              <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55 }}>
                Ficou com dúvida sobre isso? Manda pra sua nutri no chat que ela responde no próximo dia útil.
              </p>
            </div>
          </div>
          <Btn variante="ghost" style={{ flexShrink: 0, marginTop: 14 }} onClick={() => setLendo(null)}>Voltar para a biblioteca</Btn>
        </>
      )}
    </Sheet>
  );
}
