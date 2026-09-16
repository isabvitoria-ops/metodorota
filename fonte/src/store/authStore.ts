import { create } from "zustand";
import type { Sessao } from "@/types";

/**
 * Sessão persistente (briefing §5): sobrevive a fechar/abrir o app, como
 * WhatsApp/Instagram/Netflix. A implementação real (Supabase Auth, refresh
 * token de 30–90 dias, MFA da nutricionista em dispositivo novo) fica em
 * hooks/useAuth + lib/supabaseClient; esta store só guarda o resultado.
 */
interface AuthState {
  sessao: Sessao | null;
  carregando: boolean;
  erro: string | null;
  /** true entre "login e senha corretos" e "MFA confirmado" — só se aplica à nutricionista em dispositivo novo. */
  aguardandoMfa: boolean;
  /** Sessão em espera de confirmação de MFA — compartilhada entre componentes de Login e Mfa. */
  sessaoPendente: Sessao | null;
  definirSessao: (sessao: Sessao | null) => void;
  definirCarregando: (carregando: boolean) => void;
  definirErro: (erro: string | null) => void;
  definirAguardandoMfa: (aguardando: boolean) => void;
  definirSessaoPendente: (sessao: Sessao | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  sessao: null,
  carregando: true,
  erro: null,
  aguardandoMfa: false,
  sessaoPendente: null,
  definirSessao: (sessao) => set({ sessao, erro: null }),
  definirCarregando: (carregando) => set({ carregando }),
  definirErro: (erro) => set({ erro }),
  definirAguardandoMfa: (aguardandoMfa) => set({ aguardandoMfa }),
  definirSessaoPendente: (sessaoPendente) => set({ sessaoPendente }),
}));
