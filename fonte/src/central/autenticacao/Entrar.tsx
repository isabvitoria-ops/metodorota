import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { rotas } from "@/central/rotas";
import { useSessao } from "./SessaoContexto";
import { CampoTexto, TelaConta } from "./TelaConta";

/**
 * Entrada do paciente.
 *
 * Dois caminhos: senha, para quem já definiu uma, e código de 6 números por
 * e-mail, para quem nunca definiu ou esqueceu. O código existe porque o link
 * do e-mail é de uso único e é gasto por quem o abre antes da paciente (a
 * prévia do WhatsApp, verificadores de e-mail); o código não é aberto por ninguém.
 */
export function Entrar() {
  const { acesso, entrarComSenha, enviarLink, entrarComCodigo, pronto } = useSessao();
  const navegar = useNavigate();
  const [email, definirEmail] = useState("");
  const [senha, definirSenha] = useState("");
  const [erro, definirErro] = useState<string | null>(null);
  const [aviso, definirAviso] = useState<string | null>(null);
  const [enviando, definirEnviando] = useState(false);
  const [codigoPedido, definirCodigoPedido] = useState(false);
  const [codigo, definirCodigo] = useState("");

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
      definirErro("Escreva seu e-mail para receber o código.");
      return;
    }
    definirEnviando(true);
    try {
      await enviarLink(email);
      definirCodigoPedido(true);
      definirCodigo("");
      definirAviso("Enviamos um código de 6 números para o seu e-mail. Digite o código abaixo.");
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não foi possível enviar o código.");
    } finally {
      definirEnviando(false);
    }
  }

  async function confirmarCodigo(evento: FormEvent) {
    evento.preventDefault();
    definirErro(null);
    definirAviso(null);
    if (codigo.replace(/\s+/g, "").length < 6) {
      definirErro("Digite os 6 números do código.");
      return;
    }
    definirEnviando(true);
    try {
      await entrarComCodigo(email, codigo);
      // Quem entra pelo código escolhe uma senha em seguida, como no convite.
      navegar(rotas.definirSenha, { replace: true });
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não foi possível entrar com o código.");
    } finally {
      definirEnviando(false);
    }
  }

  if (codigoPedido) {
    return (
      <TelaConta
        titulo="Digite o código"
        descricao={`Enviamos 6 números para ${email.trim()}. Abra o e-mail mais recente.`}
        aoEnviar={confirmarCodigo}
        erro={erro}
        aviso={aviso}
        rodape={
          <>
            <button type="button" className="c-link" onClick={porLink} disabled={enviando}>
              Pedir outro código
            </button>
            <button type="button" className="c-link" onClick={() => definirCodigoPedido(false)}>
              Voltar
            </button>
          </>
        }
      >
        <CampoTexto
          id="codigo"
          rotulo="Código do e-mail"
          valor={codigo}
          aoMudar={definirCodigo}
          placeholder="000000"
          autoComplete="one-time-code"
          modoEntrada="numeric"
        />
        <button type="submit" className="c-botao" disabled={enviando}>
          {enviando ? "Entrando…" : "Entrar com o código"}
        </button>
      </TelaConta>
    );
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
            Entrar com código por e-mail
          </button>
          <button type="button" className="c-link" onClick={() => navegar(rotas.recuperarSenha)}>
            Esqueci minha senha
          </button>
          <button type="button" className="c-link" onClick={() => navegar(rotas.privacidade)}>
            Privacidade
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
