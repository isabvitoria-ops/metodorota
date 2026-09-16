import { create } from "zustand";

export type AbaPaciente = "hoje" | "plano" | "diario" | "evolucao" | "feed";

interface UiPacienteState {
  aba: AbaPaciente;
  irPara: (aba: AbaPaciente) => void;

  checkinAberto: boolean;
  montadorAberto: boolean;
  chatAberto: boolean;
  fotosAberto: boolean;
  perfilAberto: boolean;
  bibliotecaAberta: boolean;
  questionarioAberto: boolean;
  lembretesAberto: boolean;
  abrirCheckin: () => void;
  fecharCheckin: () => void;
  abrirMontador: () => void;
  fecharMontador: () => void;
  abrirChat: () => void;
  fecharChat: () => void;
  abrirFotos: () => void;
  fecharFotos: () => void;
  abrirPerfil: () => void;
  fecharPerfil: () => void;
  abrirBiblioteca: () => void;
  fecharBiblioteca: () => void;
  abrirQuestionario: () => void;
  fecharQuestionario: () => void;
  abrirLembretes: () => void;
  fecharLembretes: () => void;

  /** Ficha educativa aberta ao tocar num alimento do plano — null quando fechada. */
  fichaAlimentoAberta: { codigoTaco: number; nomeExibicao: string } | null;
  abrirFicha: (codigoTaco: number, nomeExibicao: string) => void;
  fecharFicha: () => void;

  /**
   * Estado que cruza o topbar (badges) com telas/modais que não têm
   * hierarquia de props em comum — exatamente o prop drilling citado no
   * briefing §9 (`unidade`, `trocas`, `avisar` descendo várias camadas).
   */
  agua: number;
  definirAgua: (copos: number) => void;
  naoLidasChat: number;
  definirNaoLidasChat: (n: number) => void;
  questionarioPendente: boolean;
  definirQuestionarioPendente: (pendente: boolean) => void;
}

export const useUiPacienteStore = create<UiPacienteState>((set) => ({
  aba: "hoje",
  irPara: (aba) => set({ aba }),

  checkinAberto: false,
  montadorAberto: false,
  chatAberto: false,
  fotosAberto: false,
  perfilAberto: false,
  bibliotecaAberta: false,
  questionarioAberto: false,
  lembretesAberto: false,
  abrirCheckin: () => set({ checkinAberto: true }),
  fecharCheckin: () => set({ checkinAberto: false }),
  abrirMontador: () => set({ montadorAberto: true }),
  fecharMontador: () => set({ montadorAberto: false }),
  abrirChat: () => set({ chatAberto: true }),
  fecharChat: () => set({ chatAberto: false }),
  abrirFotos: () => set({ fotosAberto: true }),
  fecharFotos: () => set({ fotosAberto: false }),
  abrirPerfil: () => set({ perfilAberto: true }),
  fecharPerfil: () => set({ perfilAberto: false }),
  abrirBiblioteca: () => set({ bibliotecaAberta: true }),
  fecharBiblioteca: () => set({ bibliotecaAberta: false }),
  abrirQuestionario: () => set({ questionarioAberto: true }),
  fecharQuestionario: () => set({ questionarioAberto: false }),
  abrirLembretes: () => set({ lembretesAberto: true }),
  fecharLembretes: () => set({ lembretesAberto: false }),

  fichaAlimentoAberta: null,
  abrirFicha: (codigoTaco, nomeExibicao) => set({ fichaAlimentoAberta: { codigoTaco, nomeExibicao } }),
  fecharFicha: () => set({ fichaAlimentoAberta: null }),

  agua: 3,
  definirAgua: (copos) => set({ agua: copos }),
  naoLidasChat: 0,
  definirNaoLidasChat: (n) => set({ naoLidasChat: n }),
  questionarioPendente: false,
  definirQuestionarioPendente: (pendente) => set({ questionarioPendente: pendente }),
}));
