import { useCallback, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { authService, mfaService } from "@/services";
import { idDoDispositivo } from "@/utils/deviceId";

/**
 * Login + sessão persistente (briefing §5) com a exceção deliberada de MFA
 * para a nutricionista em dispositivo novo. `sessao` só fica preenchida
 * depois que o MFA (quando exigido) é confirmado — até lá, `aguardandoMfa`
 * é true e nenhuma rota protegida deve considerar o usuário autenticado.
 */
export function useAuth() {
  const { sessao, carregando, erro, aguardandoMfa, sessaoPendente, definirSessao, definirCarregando, definirErro, definirAguardandoMfa, definirSessaoPendente } = useAuthStore();

  useEffect(() => {
    let ativo = true;
    (async () => {
      const s = await authService.sessaoAtual();
      if (!ativo) return;
      if (s && s.papel === "nutricionista") {
        const precisa = await mfaService.precisaMfa(idDoDispositivo());
        if (!ativo) return;
        if (precisa) {
          definirSessaoPendente(s);
          definirAguardandoMfa(true);
          definirCarregando(false);
          return;
        }
      }
      definirSessao(s);
      definirCarregando(false);
    })();
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const entrar = useCallback(
    async (email: string, senha: string) => {
      definirErro(null);
      const s = await authService.login(email, senha);
      if (s.papel === "nutricionista") {
        const precisa = await mfaService.precisaMfa(idDoDispositivo());
        if (precisa) {
          definirSessaoPendente(s);
          definirAguardandoMfa(true);
          return s;
        }
      }
      definirSessao(s);
      return s;
    },
    [definirErro, definirAguardandoMfa, definirSessao, definirSessaoPendente],
  );

  const confirmarMfa = useCallback(
    async (codigo: string, confiarNesteDispositivo: boolean) => {
      const ok = await mfaService.verificarCodigo(codigo);
      if (!ok) throw new Error("Código inválido. Confira os 6 dígitos e tente de novo.");
      if (confiarNesteDispositivo) await mfaService.confiarDispositivo(idDoDispositivo());
      if (sessaoPendente) {
        definirSessao(sessaoPendente);
        definirSessaoPendente(null);
      }
      definirAguardandoMfa(false);
    },
    [sessaoPendente, definirSessao, definirAguardandoMfa, definirSessaoPendente],
  );

  const sair = useCallback(async () => {
    await authService.logout();
    definirSessao(null);
    definirAguardandoMfa(false);
    definirSessaoPendente(null);
  }, [definirSessao, definirAguardandoMfa, definirSessaoPendente]);

  return { sessao, carregando, erro, aguardandoMfa, entrar, confirmarMfa, sair };
}
