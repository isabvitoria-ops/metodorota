import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { rotas } from "@/central/rotas";
import { useSessao } from "./SessaoContexto";
import { useInstalacao } from "@/central/hooks/useInstalacao";
import { CampoTexto, TelaConta } from "./TelaConta";

/**
 * Onde o convite vira conta.
 *
 * O paciente chega por link do e-mail já autenticado, e aqui escolhe a
 * senha que vai usar daqui em diante. O que este passo NÃO faz é liberar
 * conteúdo: isso depende do cadastro e do período, decididos no banco. Quem
 * criar senha sem ter sido cadastrado pela nutricionista termina na tela de
 * "acesso não liberado", que é o comportamento correto.
 */
export function DefinirSenha() {
  const { acesso, definirSenha: salvar, recarregar, pronto } = useSessao();
  const navegar = useNavigate();
  const [senha, escreverSenha] = useState("");
  const [repetida, escreverRepetida] = useState("");
  const [erro, definirErro] = useState<string | null>(null);
  const [salvando, definirSalvando] = useState(false);
  const { jaInstalado } = useInstalacao();
  // O link do e-mail abre no navegador, que guarda o login separado do app
  // instalado na tela do celular. Quem já tem o app precisa entrar nele com a
  // senha nova — sem este aviso, ela abria o ícone e achava que estava sem acesso.
  const [salvaNoNavegador, definirSalvaNoNavegador] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    definirErro(null);
    if (senha.length < 6) {
      definirErro("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (senha !== repetida) {
      definirErro("As duas senhas não são iguais.");
      return;
    }
    definirSalvando(true);
    try {
      await salvar(senha);
      await recarregar();
      if (jaInstalado) navegar(rotas.home, { replace: true });
      else definirSalvaNoNavegador(true);
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não foi possível salvar a senha.");
    } finally {
      definirSalvando(false);
    }
  }

  if (salvaNoNavegador) {
    return (
      <TelaConta
        titulo="Senha salva"
        descricao="Se você já colocou o app na tela do celular, abra pelo ícone e entre lá com o seu e-mail e esta senha. O link do e-mail abre no navegador, que é separado do app."
        aoEnviar={(e) => {
          e.preventDefault();
          navegar(rotas.home, { replace: true });
        }}
      >
        <button type="submit" className="c-botao">
          Continuar aqui
        </button>
      </TelaConta>
    );
  }

  if (pronto && !acesso.autenticado) {
    return (
      <TelaConta
        titulo="Link expirado"
        descricao="Este link já foi usado ou passou de 1 hora. Peça um novo na tela de entrada e abra pelo e-mail, não por mensagem de WhatsApp."
        aoEnviar={(e) => {
          e.preventDefault();
          navegar(rotas.entrar);
        }}
      >
        <button type="submit" className="c-botao">
          Ir para a entrada
        </button>
      </TelaConta>
    );
  }

  return (
    <TelaConta
      titulo="Criar sua senha"
      descricao="Escolha uma senha para entrar na Central das próximas vezes."
      aoEnviar={enviar}
      erro={erro}
    >
      <CampoTexto
        id="senha"
        rotulo="Nova senha"
        tipo="password"
        valor={senha}
        aoMudar={escreverSenha}
        autoComplete="new-password"
        dica="Pelo menos 6 caracteres."
      />
      <CampoTexto
        id="repetida"
        rotulo="Repita a senha"
        tipo="password"
        valor={repetida}
        aoMudar={escreverRepetida}
        autoComplete="new-password"
      />
      <button type="submit" className="c-botao" disabled={salvando}>
        {salvando ? "Salvando…" : "Salvar e entrar"}
      </button>
    </TelaConta>
  );
}
