import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { apagarCopiasDoAparelho } from "@/central/utils/copiasNoAparelho";
import type { Acesso, Configuracoes, EstadoDoTermo } from "@/central/types";
import { MODO_DEMONSTRACAO, supabase } from "@/central/supabase/cliente";
import { repositorio } from "@/central/dados/repositorio";
import { hidratar } from "@/central/dados/catalogo";
import { invalidarIndice } from "@/central/dados/indiceBusca";
import { salvarAcessoNoCache, lerAcessoDoCache, lerCatalogoDoCache, limparCacheDaConta, estaOnline } from "@/central/dados/cacheOffline";
import { CONFIGURACOES_PADRAO } from "@/central/dados/mapeadores";
import { urlDaRota } from "@/central/utils/enderecos";
import { useFavoritos } from "@/central/hooks/useFavoritos";
import { dentroDoPrazo, idDaContaGuardadaNoAparelho, pareceFalhaDeRede, pareceLoginVencido } from "./conexao";

/** Quanto a abertura espera a internet antes de usar o que ficou guardado. */
const PRAZO_DA_REDE_MS = 6000;
/** Enquanto aberto sem conexão, de quanto em quanto tempo tenta o banco de novo. */
const NOVA_TENTATIVA_MS = 60_000;

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
  treino: true,
  metas: true,
  restricoes: true,
  fodmap: true,
  viagem: true,
  hotslim: true,
  hotslimFases: [1, 2, 3, 4],
  hotslimDiaAtual: 1,
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
  treino: false,
  metas: false,
  restricoes: false,
  fodmap: false,
  viagem: false,
  hotslim: false,
  hotslimFases: [],
  hotslimDiaAtual: null,
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
  /**
   * O aceite do termo de uso. `null` = não se sabe (demonstração, nutricionista
   * ou o banco não respondeu): nesses casos a paciente NÃO é barrada. Barrar por
   * um erro de rede trancaria todo mundo para fora por causa de um aviso.
   */
  termo: EstadoDoTermo | null;
  modoDemonstracao: boolean;
  aceitarTermo(): Promise<void>;
  /** Registra que a paciente viu as boas-vindas. Nunca volta a aparecer. */
  concluirBoasVindas(): Promise<void>;
  entrarComSenha(email: string, senha: string): Promise<void>;
  enviarLink(email: string): Promise<void>;
  /** Entra com o código de 6 números que veio no e-mail. */
  entrarComCodigo(email: string, codigo: string): Promise<void>;
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
  const [termo, definirTermo] = useState<EstadoDoTermo | null>(null);

  // Ligado quando a tela abriu com o que estava guardado no aparelho porque a
  // internet falhou. Enquanto estiver ligado, a volta da conexão (ou a
  // renovação do login, que só acontece com rede) refaz a consulta ao banco.
  const semConexaoRef = useRef(false);

  /**
   * Abre com a última resposta guardada neste aparelho, se ela for da conta
   * que continua logada aqui. Devolve falso quando não há o que usar.
   */
  const abrirComOQueFicouGuardado = useCallback(async (): Promise<boolean> => {
    const acessoSalvo = await lerAcessoDoCache();
    const contaGuardada = idDaContaGuardadaNoAparelho();
    if (!acessoSalvo || !contaGuardada || acessoSalvo.perfilId !== contaGuardada) return false;
    definirAcesso(acessoSalvo);
    const catalogoSalvo = await lerCatalogoDoCache();
    if (catalogoSalvo) {
      hidratar(catalogoSalvo);
      invalidarIndice();
      definirConfiguracoes(catalogoSalvo.configuracoes);
    }
    semConexaoRef.current = true;
    return true;
  }, []);

  const resolver = useCallback(async () => {
    definirCarregando(true);
    try {
      let atual = ACESSO_DEMONSTRACAO;

      if (!MODO_DEMONSTRACAO && supabase) {
        // Com o login vencido, ler a sessão significa renovar pela internet —
        // e, com sinal ruim, a biblioteca insiste por até meio minuto, com a
        // tela parada em "Carregando…". Passado o prazo, abre com o que ficou
        // guardado e deixa a renovação terminar por baixo.
        const pedidoDaSessao = supabase.auth.getSession();
        const leituraRapida = await dentroDoPrazo(pedidoDaSessao, PRAZO_DA_REDE_MS);
        if (leituraRapida === null && (await abrirComOQueFicouGuardado())) return;
        const { data: sessao, error: erroDaSessao } = leituraRapida ?? (await pedidoDaSessao);
        if (!sessao.session) {
          // Sem sessão pode ser "saiu da conta" ou "o login venceu e não deu
          // para renovar porque a internet falhou" (viagem, roaming, sinal
          // fraco). No segundo caso a conta continua guardada no aparelho, e
          // mandar a paciente para a tela de login — onde ela também não
          // consegue entrar sem internet — era o mesmo que trancar o app.
          if ((pareceFalhaDeRede(erroDaSessao) || !estaOnline()) && (await abrirComOQueFicouGuardado())) return;
          definirAcesso(ACESSO_VAZIO);
          return;
        }
        const pedidoDoAcesso = Promise.resolve(supabase.rpc("meu_acesso"));
        const respostaRapida = await dentroDoPrazo(pedidoDoAcesso, PRAZO_DA_REDE_MS);
        if (respostaRapida === null && (await abrirComOQueFicouGuardado())) return;
        let { data, error } = respostaRapida ?? (await pedidoDoAcesso);
        if (error && pareceLoginVencido(error)) {
          // O token venceu entre a leitura da sessão e a consulta: renova e
          // tenta uma vez mais, em vez de devolver a paciente ao login.
          await supabase.auth.refreshSession();
          ({ data, error } = await supabase.rpc("meu_acesso"));
        }
        if (error) throw error;
        atual = data as Acesso;
      }

      semConexaoRef.current = false;
      definirAcesso(atual);
      if (!MODO_DEMONSTRACAO) void salvarAcessoNoCache(atual);

      // O catálogo é carregado sempre: quem não tem acesso recebe listas
      // vazias do banco (é a política agindo), e a tela de "acesso
      // encerrado" ainda precisa do WhatsApp que vem junto.
      const dados = await repositorio.carregarCatalogo();
      hidratar(dados);
      invalidarIndice();
      definirConfiguracoes(dados.configuracoes);

      if (atual.temAcesso && atual.papel !== "admin" && !MODO_DEMONSTRACAO) {
        try {
          definirTermo(await repositorio.meuTermo());
        } catch {
          definirTermo(null);
        }
      } else {
        definirTermo(null);
      }

      if (atual.temAcesso) {
        void useFavoritos.getState().carregar();
        if (!MODO_DEMONSTRACAO) void repositorio.registrarAcesso();
      } else {
        useFavoritos.getState().limpar();
      }
    } catch (erro) {
      if (MODO_DEMONSTRACAO) {
        definirAcesso(ACESSO_DEMONSTRACAO);
      } else if (pareceFalhaDeRede(erro) || !estaOnline()) {
        // A internet caiu no meio do caminho (o celular pode até dizer que
        // está conectado: Wi-Fi de hotel, roaming, sinal fraco). Abre com o
        // que ficou guardado; sem nada guardado, só resta a tela de entrar.
        // Se a tela já estava aberta assim, continua como está.
        if (!semConexaoRef.current && !(await abrirComOQueFicouGuardado())) definirAcesso(ACESSO_VAZIO);
      } else if (!semConexaoRef.current) {
        definirAcesso(ACESSO_VAZIO);
      }
    } finally {
      definirCarregando(false);
      definirPronto(true);
    }
  }, [abrirComOQueFicouGuardado]);

  useEffect(() => {
    void resolver();
    if (MODO_DEMONSTRACAO || !supabase) return;
    const { data } = supabase.auth.onAuthStateChange((evento) => {
      // TOKEN_REFRESHED não muda quem é a pessoa nem o que ela pode ver;
      // recarregar o catálogo a cada renovação de token seria desperdício.
      // A exceção é quando a tela abriu sem conexão: a renovação só acontece
      // com internet, então é a hora de buscar o que está atualizado.
      if (evento === "TOKEN_REFRESHED" && !semConexaoRef.current) return;
      void resolver();
    });
    // Aberto sem conexão: tenta de novo quando a internet volta, quando ela
    // volta para o app e, enquanto isso, a cada minuto — uma tentativa por vez.
    let tentando = false;
    const tentarDeNovo = () => {
      if (!semConexaoRef.current || tentando) return;
      tentando = true;
      void resolver().finally(() => {
        tentando = false;
      });
    };
    const aoVoltarParaATela = () => {
      if (document.visibilityState === "visible") tentarDeNovo();
    };
    window.addEventListener("online", tentarDeNovo);
    document.addEventListener("visibilitychange", aoVoltarParaATela);
    const relogio = window.setInterval(tentarDeNovo, NOVA_TENTATIVA_MS);
    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener("online", tentarDeNovo);
      document.removeEventListener("visibilitychange", aoVoltarParaATela);
      window.clearInterval(relogio);
    };
  }, [resolver]);

  const valor = useMemo<ValorSessao>(
    () => ({
      carregando,
      pronto,
      acesso,
      configuracoes,
      termo,
      modoDemonstracao: MODO_DEMONSTRACAO,

      async aceitarTermo() {
        if (!termo) return;
        definirTermo(await repositorio.aceitarTermo(termo.versao));
      },

      async concluirBoasVindas() {
        // Some da tela primeiro: se a rede falhar, ela não fica presa nas
        // boas-vindas. Pior caso, aparecem de novo no próximo acesso.
        definirTermo((atual) => (atual ? { ...atual, boasVindasVistas: true } : atual));
        try {
          await repositorio.concluirBoasVindas();
        } catch {
          /* tenta de novo no próximo acesso */
        }
      },

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

      async entrarComCodigo(email, codigo) {
        if (!supabase) return;
        const { error } = await supabase.auth.verifyOtp({
          email: email.trim().toLowerCase(),
          token: codigo.replace(/\s+/g, ""),
          type: "email",
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
        apagarCopiasDoAparelho();
        await limparCacheDaConta();
        definirAcesso(ACESSO_VAZIO);
      },

      recarregar: resolver,
    }),
    [acesso, carregando, pronto, configuracoes, termo, resolver],
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
  if (texto.includes("token has expired") || texto.includes("otp_expired") || texto.includes("invalid or has expired")) {
    return "Código errado ou vencido. Confira os 6 números ou peça um novo.";
  }
  if (texto.includes("for security purposes")) return "Espere um minuto antes de pedir outro e-mail.";
  if (texto.includes("should be different from the old password")) return "A nova senha precisa ser diferente da anterior.";
  return mensagem;
}

