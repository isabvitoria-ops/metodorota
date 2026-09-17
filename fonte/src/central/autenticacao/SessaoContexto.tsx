import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Acesso, Configuracoes } from "@/central/types";
import { MODO_DEMONSTRACAO, supabase } from "@/central/supabase/cliente";
import { repositorio } from "@/central/dados/repositorio";
import { hidratar } from "@/central/dados/catalogo";
import { invalidarIndice } from "@/central/dados/indiceBusca";
import { CONFIGURACOES_PADRAO } from "@/central/dados/mapeadores";
import { urlDaRota } from "@/central/utils/enderecos";
import { useFavoritos } from "@/central/hooks/useFavoritos";

/**
 * Quem está usando o app, e o que pode ver.
 *
 * A resposta vem inteira do banco, de uma função só (`meu_acesso()`), que é
 * a mesma que as políticas de acesso usam para decidir o que entregar. O
 * frontend não recalcula a regra: ele pergunta e obedece. Assim não existe
 * a possibilidade de a tela achar que há acesso e o banco achar que não.
 *
 * Em modo demonstração (sem Supabase configurado) o acesso é liberado com
 * papel de nutricionista, para que dê para percorrer as duas áreas antes de
 * criar conta em qualquer serviço.
 */

const ACESSO_DEMONSTRACAO: Acesso = {
  autenticado: true,
  perfilId: "demonstracao",
  papel: "admin",
  nome: "Demonstração",
  email: null,
  temAcesso: true,
  situacao: "admin",
  dataInicio: null,
  dataFim: null,
  diasRestantes: null,
  plano: null,
  // Na demonstração tudo fica visível, para dar para percorrer o app inteiro.
  rastreio: true,
  protocolo: true,
  avaliacao: true,
};

const ACESSO_VAZIO: Acesso = {
  autenticado: false,
  perfilId: null,
  papel: "paciente",
  nome: null,
  email: null,
  temAcesso: false,
  situacao: "sem_cadastro",
  rastreio: false,
  protocolo: false,
  avaliacao: false,
  dataInicio: null,
  dataFim: null,
  diasRestantes: null,
  plano: null,
};

interface ValorSessao {
  /** Verdadeiro só enquanto a primeira resolução não terminou. */
  carregando: boolean;
  /** Verdadeiro depois da primeira resposta — mesmo que venha "sem acesso". */
  pronto: boolean;
  acesso: Acesso;
  configuracoes: Configuracoes;
  modoDemonstracao: boolean;
  entrarComSenha(email: string, senha: string): Promise<void>;
  enviarLink(email: string): Promise<void>;
  definirSenha(senha: string): Promise<void>;
  enviarRecuperacao(email: string): Promise<void>;
  sair(): Promise<void>;
  recarregar(): Promise<void>;
}

const Contexto = createContext<ValorSessao | null>(null);

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [carregando, definirCarregando] = useState(true);
  // A primeira resolução mostra tela de carregamento; as seguintes (salvar
  // uma configuração, renovar o token, voltar de outra aba) acontecem por
  // baixo. Sem esta separação, qualquer recarga apagava a tela que a pessoa
  // estava usando e devolvia ela para o começo — inclusive perdendo o
  // formulário meio preenchido.
  const [pronto, definirPronto] = useState(false);
  const [acesso, definirAcesso] = useState<Acesso>(MODO_DEMONSTRACAO ? ACESSO_DEMONSTRACAO : ACESSO_VAZIO);
  const [configuracoes, definirConfiguracoes] = useState<Configuracoes>(CONFIGURACOES_PADRAO);

  const resolver = useCallback(async () => {
    definirCarregando(true);
    try {
      let atual = ACESSO_DEMONSTRACAO;

      if (!MODO_DEMONSTRACAO && supabase) {
        const { data: sessao } = await supabase.auth.getSession();
        if (!sessao.session) {
          definirAcesso(ACESSO_VAZIO);
          definirCarregando(false);
          definirPronto(true);
          return;
        }
        const { data, error } = await supabase.rpc("meu_acesso");
        if (error) throw error;
        atual = data as Acesso;
      }

      definirAcesso(atual);

      // O catálogo é carregado sempre: quem não tem acesso recebe listas
      // vazias do banco (é a política agindo), e a tela de "acesso
      // encerrado" ainda precisa do WhatsApp que vem junto.
      const dados = await repositorio.carregarCatalogo();
      hidratar(dados);
      invalidarIndice();
      definirConfiguracoes(dados.configuracoes);

      if (atual.temAcesso) {
        void useFavoritos.getState().carregar();
        if (!MODO_DEMONSTRACAO) void repositorio.registrarAcesso();
      } else {
        useFavoritos.getState().limpar();
      }
    } catch {
      definirAcesso(MODO_DEMONSTRACAO ? ACESSO_DEMONSTRACAO : ACESSO_VAZIO);
    } finally {
      definirCarregando(false);
      definirPronto(true);
    }
  }, []);

  useEffect(() => {
    void resolver();
    if (MODO_DEMONSTRACAO || !supabase) return;
    const { data } = supabase.auth.onAuthStateChange((evento) => {
      // TOKEN_REFRESHED não muda quem é a pessoa nem o que ela pode ver;
      // recarregar o catálogo a cada renovação de token seria desperdício.
      if (evento === "TOKEN_REFRESHED") return;
      void resolver();
    });
    return () => data.subscription.unsubscribe();
  }, [resolver]);

  const valor = useMemo<ValorSessao>(
    () => ({
      carregando,
      pronto,
      acesso,
      configuracoes,
      modoDemonstracao: MODO_DEMONSTRACAO,

      async entrarComSenha(email, senha) {
        if (!supabase) return;
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password: senha,
        });
        if (error) throw new Error(traduzir(error.message));
      },

      async enviarLink(email) {
        if (!supabase) return;
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim().toLowerCase(),
          options: { emailRedirectTo: urlDaRota("/definir-senha") },
        });
        if (error) throw new Error(traduzir(error.message));
      },

      async definirSenha(senha) {
        if (!supabase) return;
        const { error } = await supabase.auth.updateUser({ password: senha });
        if (error) throw new Error(traduzir(error.message));
      },

      async enviarRecuperacao(email) {
        if (!supabase) return;
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
          redirectTo: urlDaRota("/definir-senha"),
        });
        if (error) throw new Error(traduzir(error.message));
      },

      async sair() {
        if (!supabase) return;
        await supabase.auth.signOut();
        definirAcesso(ACESSO_VAZIO);
      },

      recarregar: resolver,
    }),
    [acesso, carregando, pronto, configuracoes, resolver],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSessao(): ValorSessao {
  const valor = useContext(Contexto);
  if (!valor) throw new Error("useSessao precisa estar dentro de <ProvedorSessao>.");
  return valor;
}

/** As mensagens do Supabase chegam em inglês; a paciente não tem que lidar com isso. */
function traduzir(mensagem: string): string {
  const texto = mensagem.toLowerCase();
  if (texto.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (texto.includes("email not confirmed")) return "Confirme o e-mail pelo link que enviamos.";
  if (texto.includes("user already registered")) return "Já existe uma conta com este e-mail.";
  if (texto.includes("password should be at least")) return "A senha precisa ter pelo menos 6 caracteres.";
  if (texto.includes("rate limit") || texto.includes("too many")) {
    return "Muitas tentativas seguidas. Espere alguns minutos e tente de novo.";
  }
  if (texto.includes("for security purposes")) return "Espere um minuto antes de pedir outro e-mail.";
  return mensagem;
}
