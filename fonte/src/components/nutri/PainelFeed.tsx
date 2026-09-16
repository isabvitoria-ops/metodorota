import { useState } from "react";
import { Tag } from "@/components/ui/Tag";
import { corPorId } from "@/constants/cores";
import { tempoRelativo } from "@/utils/tempoRelativo";
import { useFeedPosts } from "@/hooks/useFeed";
import { useToast } from "@/hooks/useToast";
import { feedService } from "@/services";
import type { DestinoPost, TipoPost } from "@/types";

const TIPOS: TipoPost[] = ["Aviso", "Dica rápida", "Receita", "Novidade", "Vídeo"];

export function PainelFeed({ nutricionistaId }: { nutricionistaId: string }) {
  const { estado, recarregar } = useFeedPosts();
  const [tipo, setTipo] = useState<TipoPost>("Dica rápida");
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [destinoId, setDestinoId] = useState<"todos" | "intestinal" | "emagrecimento" | "selecionados">("todos");
  const avisar = useToast();

  const publicar = async () => {
    const destino: DestinoPost = destinoId === "todos" ? { tipo: "todos" } : destinoId === "selecionados" ? { tipo: "selecionados", pacientesId: [] } : { tipo: "objetivo", objetivo: destinoId };
    await feedService.publicarPost(nutricionistaId, tipo, titulo, texto, destino, "plum");
    setTitulo("");
    setTexto("");
    avisar("Publicado no feed.");
    recarregar();
  };

  return (
    <div className="wrap">
      <div style={{ padding: "26px 0 18px" }}>
        <div className="eyebrow">Comunicação</div>
        <h1 className="disp" style={{ fontSize: 32, fontWeight: 600, margin: "10px 0 0" }}>Feed</h1>
      </div>
      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 10 }}>Tipo</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 16 }}>
          {TIPOS.map((t) => (
            <button key={t} className={`chip ${tipo === t ? "on" : ""}`} onClick={() => setTipo(t)}>{t}</button>
          ))}
        </div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Título</div>
        <input className="input" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Marmita não precisa ser sofisticada" style={{ marginBottom: 14 }} />
        <div className="eyebrow" style={{ marginBottom: 8 }}>Texto</div>
        <textarea className="input" rows={4} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escreva do seu jeito. Curto funciona melhor." style={{ marginBottom: 14 }} />
        <div className="eyebrow" style={{ marginBottom: 8 }}>Quem vê</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 16 }}>
          {([["todos", "Todos os ativos"], ["intestinal", "Saúde intestinal"], ["emagrecimento", "Emagrecimento"], ["selecionados", "Escolher pacientes"]] as const).map(([id, l]) => (
            <button key={id} className={`chip ${destinoId === id ? "on" : ""}`} onClick={() => setDestinoId(id)}>{l}</button>
          ))}
        </div>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <button className="btn" onClick={publicar} disabled={!titulo.trim()}>Publicar agora</button>
          <button className="btn ghost" onClick={() => avisar("Agendamento abriria aqui.")}>Agendar</button>
        </div>
      </div>
      <hr className="hair" />
      <div className="eyebrow" style={{ marginBottom: 10 }}>Publicados</div>
      {estado.status === "carregando" && <p style={{ color: "var(--ink-2)" }}>Carregando…</p>}
      {estado.status === "erro" && <p style={{ color: "var(--clay)" }}>Não deu pra carregar o feed agora.</p>}
      {estado.status === "pronto" && (
        <div style={{ display: "grid", gap: 8 }}>
          {estado.dado.map(({ post }) => (
            <div key={post.id} className="card" style={{ padding: 14 }}>
              <div className="row">
                <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)", flexShrink: 0 }}>
                  {post.tipo.toUpperCase()} · {tempoRelativo(post.publicadoEm).toUpperCase()}
                </span>
                <Tag cor={corPorId(post.corId)}>{post.destino.tipo === "todos" ? "TODOS" : post.destino.tipo.toUpperCase()}</Tag>
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, marginTop: 6 }}>{post.titulo}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
