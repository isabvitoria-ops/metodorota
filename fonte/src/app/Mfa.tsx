import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

/**
 * Regra §5 (exceção deliberada): MFA obrigatório no primeiro login da
 * nutricionista em cada dispositivo novo, com opção de "confiar neste
 * dispositivo" para não pedir de novo por 90 dias. Paciente nunca vê esta
 * tela — só existe no fluxo de login da nutricionista.
 */
export function Mfa() {
  const { confirmarMfa } = useAuth();
  const [codigo, setCodigo] = useState("");
  const [confiar, setConfiar] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await confirmarMfa(codigo, confiar);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível confirmar.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="root" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
      <div className="card" style={{ width: "100%", maxWidth: 400, padding: 28 }}>
        <div className="eyebrow">Dispositivo novo</div>
        <h1 className="disp" style={{ fontSize: 26, fontWeight: 600, margin: "10px 0 6px" }}>Confirme sua identidade</h1>
        <p style={{ fontSize: 14, color: "var(--ink-2)", margin: "0 0 22px", lineHeight: 1.5 }}>
          Você acessa dados de saúde de vários pacientes — por isso pedimos um código extra sempre que
          entrar de um aparelho que ainda não conhecemos. Enviamos um código de 6 dígitos para o seu e-mail.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Código de verificação</div>
          <input
            className="input" inputMode="numeric" pattern="\d{6}" maxLength={6} required
            value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
            placeholder="000000" style={{ marginBottom: 14, textAlign: "center", fontFamily: "'IBM Plex Mono',monospace", fontSize: 20, letterSpacing: "0.3em" }}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: "var(--ink-2)", marginBottom: 18, cursor: "pointer" }}>
            <input type="checkbox" checked={confiar} onChange={(e) => setConfiar(e.target.checked)} />
            Confiar neste dispositivo por 90 dias
          </label>
          {erro && <p style={{ color: "var(--clay)", fontSize: 13.5, margin: "0 0 14px" }}>{erro}</p>}
          <button className="btn full" type="submit" disabled={enviando || codigo.length !== 6}>{enviando ? "Confirmando…" : "Confirmar"}</button>
        </form>
      </div>
    </div>
  );
}
