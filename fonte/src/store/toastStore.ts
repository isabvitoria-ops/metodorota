import { create } from "zustand";

/**
 * Toast/aviso no rodapé — mesmo padrão `avisar(texto)` dos dois protótipos,
 * elevado a store porque tanto o app do paciente quanto o painel precisam
 * dele em telas/modais que não têm uma hierarquia de props em comum.
 */
interface ToastState {
  mensagem: string | null;
  avisar: (mensagem: string, duracaoMs?: number) => void;
  limpar: () => void;
}

let timeoutId: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastState>((set) => ({
  mensagem: null,
  avisar: (mensagem, duracaoMs = 3200) => {
    if (timeoutId) clearTimeout(timeoutId);
    set({ mensagem });
    timeoutId = setTimeout(() => set({ mensagem: null }), duracaoMs);
  },
  limpar: () => {
    if (timeoutId) clearTimeout(timeoutId);
    set({ mensagem: null });
  },
}));
