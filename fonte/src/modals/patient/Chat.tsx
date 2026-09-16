import { useEffect, useRef, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Chip } from "@/components/ui/Chip";
import { AVISO_CHAT_EMERGENCIA, SLA_CHAT } from "@/constants/textos";
import { tempoRelativo } from "@/utils/tempoRelativo";
import { useChat } from "@/hooks/useChat";
import { useToast } from "@/hooks/useToast";

const RESPOSTAS_RAPIDAS = ["Meus dias estão mais soltos", "Tive muita dor ontem", "Posso trocar um alimento?", "Dúvida sobre o preparo"];

export function Chat({ pacienteId, nutricionistaId, onFechar }: { pacienteId: string; nutricionistaId: string; onFechar: () => void }) {
  const { conversa, mensagens, carregando, enviar, marcarLidas } = useChat(pacienteId, nutricionistaId);
  const [texto, setTexto] = useState("");
  const fimRef = useRef<HTMLDivElement>(null);
  const avisar = useToast();
  const jaMarcouLidas = useRef(false);

  useEffect(() => {
    // `conversa` só fica disponível depois que useChat termina de carregar
    // (é assíncrono) — marcar como lida precisa esperar por isso, senão o
    // guard `if (!conversa) return` dentro de marcarLidas vira um no-op.
    if (conversa && !jaMarcouLidas.current) {
      jaMarcouLidas.current = true;
      marcarLidas("paciente");
    }
  }, [conversa, marcarLidas]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  const handleEnviar = async (t: string) => {
    const msg = t.trim();
    if (!msg) return;
    await enviar(msg, "paciente");
    setTexto("");
    avisar("Mensagem enviada.");
  };

  return (
    <Sheet onFechar={onFechar} titulo="Conversa com a nutri" cheia>
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 12, paddingBottom: 14, borderBottom: "1px solid var(--line)" }}>
        <div style={{ width: 38, height: 38, borderRadius: 12, background: "var(--plum)", color: "#fff", display: "grid", placeItems: "center", fontFamily: "'IBM Plex Mono',monospace", fontSize: 13 }}>N</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15.5, fontWeight: 600 }}>Nutri</div>
          <div style={{ fontSize: 12.5, color: "var(--ink-2)" }}>{SLA_CHAT}</div>
        </div>
        <Chip tamanho="sm" onClick={onFechar}>Fechar</Chip>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 0", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ background: "var(--plum-wash)", color: "var(--plum)", padding: 13, borderRadius: 13, fontSize: 13, lineHeight: 1.5, textAlign: "center" }}>
          {AVISO_CHAT_EMERGENCIA}
        </div>

        {carregando && <p style={{ color: "var(--ink-2)", textAlign: "center" }}>Carregando conversa…</p>}

        {mensagens.map((m) => (
          <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: m.autor === "paciente" ? "flex-end" : "flex-start" }}>
            <div className={`bubble ${m.autor === "paciente" ? "me" : "nutri"}`}>
              {m.retractedEm ? <em>Mensagem retratada · {m.texto}</em> : m.texto}
            </div>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", margin: "5px 4px 0" }}>
              {tempoRelativo(m.enviadaEm)}{m.autor === "paciente" ? (m.lidaEm ? " · lida" : " · enviada") : ""}
            </div>
          </div>
        ))}
        <div ref={fimRef} />
      </div>

      <div style={{ flexShrink: 0, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
        <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 12 }}>
          {RESPOSTAS_RAPIDAS.map((r) => (
            <Chip key={r} onClick={() => handleEnviar(r)} style={{ fontSize: 13, whiteSpace: "nowrap", flexShrink: 0 }}>{r}</Chip>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <textarea
            className="input" rows={1} value={texto} placeholder="Escreva sua mensagem"
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEnviar(texto); } }}
          />
          <button
            type="button" className="btn" style={{ width: 58, padding: 14, flexShrink: 0 }}
            disabled={!texto.trim()} onClick={() => handleEnviar(texto)} aria-label="Enviar"
          >
            ↑
          </button>
        </div>
      </div>
    </Sheet>
  );
}
