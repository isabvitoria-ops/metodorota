import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { rotas } from "@/central/rotas";
import { useSessao } from "./SessaoContexto";
import { CampoTexto, TelaConta } from "./TelaConta";

export function RecuperarSenha() {
  const { enviarRecuperacao } = useSessao();
  const navegar = useNavigate();
  const [email, definirEmail] = useState("");
  const [erro, definirErro] = useState<string | null>(null);
  const [aviso, definirAviso] = useState<string | null>(null);
  const [enviando, definirEnviando] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    definirErro(null);
    definirAviso(null);
    definirEnviando(true);
    try {
      await enviarRecuperacao(email);
      // A mensagem é a mesma exista ou não conta com este e-mail: dizer
      // "não encontramos" contaria a um estranho quem é paciente daqui.
      definirAviso("Se houver uma conta com este e-mail, o link de recuperação já está a caminho.");
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não foi possível enviar o e-mail.");
    } finally {
      definirEnviando(false);
    }
  }

  return (
    <TelaConta
      titulo="Recuperar senha"
      descricao="Enviamos um link para você criar uma senha nova."
      aoEnviar={enviar}
      erro={erro}
      aviso={aviso}
      rodape={
        <button type="button" className="c-link" onClick={() => navegar(rotas.entrar)}>
          Voltar para a entrada
        </button>
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
      <button type="submit" className="c-botao" disabled={enviando}>
        {enviando ? "Enviando…" : "Enviar link"}
      </button>
    </TelaConta>
  );
}
