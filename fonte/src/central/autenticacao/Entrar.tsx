import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { rotas } from "@/central/rotas";
import { useSessao } from "./SessaoContexto";
import { CampoTexto, TelaConta } from "./TelaConta";

/**
 * Entrada do paciente.
 *
 * Dois caminhos: senha, para quem já definiu uma, e link por e-mail, para
 * quem nunca definiu ou esqueceu. O link é o mesmo mecanismo do convite —
 * quem recebeu o convite e ainda não criou senha entra por aqui.
 */
export function Entrar() {
  const { acesso, entrarComSenha, enviarLink, pronto } = useSessao();
  const navegar = useNavigate();
  const [email, definirEmail] = useState("");
  const [senha, definirSenha] = useState("");
  const [erro, definirErro] = useState<string | null>(null);
  const [aviso, definirAviso] = useState<string | null>(null);
  const [enviando, definirEnviando] = useState(false);

  if (pronto && acesso.autenticado) return <Navigate to={rotas.home} replace />;

  async function entrar(evento: FormEvent) {
    evento.preventDefault();
    definirErro(null);
    definirAviso(null);
    if (!email.trim() || !senha) {
      definirErro("Preencha o e-mail e a senha.");
      return;
    }
    definirEnviando(true);
    try {
      await entrarComSenha(email, senha);
      navegar(rotas.home, { replace: true });
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não foi possível entrar.");
    } finally {
      definirEnviando(false);
    }
  }

  async function porLink() {
    definirErro(null);
    definirAviso(null);
    if (!email.trim()) {
      definirErro("Escreva seu e-mail para receber o link.");
      return;
    }
    definirEnviando(true);
    try {
      await enviarLink(email);
      definirAviso("Link enviado. Confira seu e-mail — ele vale por uma hora.");
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não foi possível enviar o link.");
    } finally {
      definirEnviando(false);
    }
  }

  return (
    <TelaConta
      titulo="Entrar"
      descricao="Use o e-mail que você informou para a sua nutricionista."
      aoEnviar={entrar}
      erro={erro}
      aviso={aviso}
      rodape={
        <>
          <button type="button" className="c-link" onClick={porLink} disabled={enviando}>
            Entrar por link no e-mail
          </button>
          <button type="button" className="c-link" onClick={() => navegar(rotas.recuperarSenha)}>
            Esqueci minha senha
          </button>
        </>
      }
    >
      <CampoTexto
        id="email"
        rotulo="E-mail"
        tipo="email"
        valor={email}
        aoMudar={definirEmail}
        placeholder="voce@email.com"
        autoComplete="email"
      />
      <CampoTexto
        id="senha"
        rotulo="Senha"
        tipo="password"
        valor={senha}
        aoMudar={definirSenha}
        autoComplete="current-password"
      />
      <button type="submit" className="c-botao" disabled={enviando}>
        {enviando ? "Entrando…" : "Entrar"}
      </button>
    </TelaConta>
  );
}
