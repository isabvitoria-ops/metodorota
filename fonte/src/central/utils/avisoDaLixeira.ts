import { create } from "zustand";

/** O aviso "foi para a lixeira · Desfazer" (componente em components/AvisoDaLixeira.tsx). */
export interface AvisoDeLixeira {
  texto: string;
  registroId: string;
  aoVoltar?: () => void | Promise<void>;
}

export const useAvisoDaLixeira = create<{ aviso: AvisoDeLixeira | null; definir: (a: AvisoDeLixeira | null) => void }>((set) => ({
  aviso: null,
  definir: (aviso) => set({ aviso }),
}));

export function avisarLixeira(aviso: AvisoDeLixeira) {
  useAvisoDaLixeira.getState().definir(aviso);
}
