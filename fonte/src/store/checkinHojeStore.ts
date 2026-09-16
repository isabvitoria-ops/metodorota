import { create } from "zustand";
import type { CheckIn } from "@/types";

/**
 * Estado compartilhado do check-in de hoje — mais de uma tela (Hoje, o
 * próprio modal de check-in) chama `useCheckin` ao mesmo tempo; sem uma
 * store em comum, uma atualização otimista (offline-first, briefing §10)
 * feita a partir de um lugar não aparecia nos outros até recarregar.
 */
interface CheckinHojeState {
  porPaciente: Record<string, CheckIn | null | undefined>;
  definir: (pacienteId: string, checkin: CheckIn | null) => void;
}

export const useCheckinHojeStore = create<CheckinHojeState>((set) => ({
  porPaciente: {},
  definir: (pacienteId, checkin) => set((s) => ({ porPaciente: { ...s.porPaciente, [pacienteId]: checkin } })),
}));
