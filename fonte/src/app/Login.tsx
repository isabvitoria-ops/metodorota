import { useState } from "react";
import "@/styles/global.css";
import { useAuth } from "@/hooks/useAuth";

export function Login() {
  const { entrar, aguardandoMfa } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (aguardandoMfa) return null; // App.tsx troca pra <Mfa/> quando isso fica true

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await entrar(email, senha);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível entrar.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="root" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
      <div className="card" style={{ width: "100%", maxWidth: 400, padding: 28 }}>
        <div className="eyebrow">Consultório</div>
        <h1 className="disp" style={{ fontSize: 26, fontWeight: 600, margin: "10px 0 6px" }}>Entrar</h1>
        <p style={{ fontSize: 14, color: "var(--ink-2)", margin: "0 0 22px", lineHeight: 1.5 }}>
          Sua sessão fica salva neste aparelho — você não vai precisar digitar de novo toda vez que abrir.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>E-mail</div>
          <input
            className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com" style={{ marginBottom: 14 }} autoComplete="username"
          />
          <div className="eyebrow" style={{ marginBottom: 8 }}>Senha</div>
          <input
            className="input" type="password" required value={senha} onChange={(e) => setSenha(e.target.value)}
            placeholder="••••••••" style={{ marginBottom: 18 }} autoComplete="current-password"
          />
          {erro && <p style={{ color: "var(--clay)", fontSize: 13.5, margin: "0 0 14px" }}>{erro}</p>}
          <button className="btn full" type="submit" disabled={enviando}>{enviando ? "Entrando…" : "Entrar"}</button>
        </form>
        <p style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 18, lineHeight: 1.5 }}>
          Não tem conta? O acesso do paciente é só por convite — fale com sua nutricionista.
        </p>
      </div>
    </div>
  );
}
