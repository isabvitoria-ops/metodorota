import { create } from "zustand";

/**
 * Invalidação compartilhada entre componentes que buscam o mesmo dado por
 * hooks independentes.
 *
 * O caso concreto: `Evolucao` e o modal `Fotos` chamam `useSessoesFoto` cada
 * um na sua instância, com `useAsync` próprio. Sem isto, salvar ou apagar uma
 * sessão dentro do modal só atualizava a cópia do modal — o card "N sessões
 * guardadas" atrás dele continuava com o número velho até a tela remontar.
 *
 * Quem grava chama `invalidar("chave")`; quem lê coloca `versaoDe("chave")`
 * nas deps do `useAsync` e volta a buscar sozinho.
 */
interface RevalidacaoState {
  versoes: Record<string, number>;
  invalidar: (chave: string) => void;
}

export const useRevalidacaoStore = create<RevalidacaoState>((set) => ({
  versoes: {},
  invalidar: (chave) =>
    set((s) => ({ versoes: { ...s.versoes, [chave]: (s.versoes[chave] ?? 0) + 1 } })),
}));

/** Versão atual de uma chave — use nas deps do `useAsync` para refazer a busca. */
export function useVersaoDe(chave: string): number {
  return useRevalidacaoStore((s) => s.versoes[chave] ?? 0);
}

export function invalidar(chave: string): void {
  useRevalidacaoStore.getState().invalidar(chave);
}

export const chaves = {
  sessoesFoto: (pacienteId: string) => `sessoesFoto:${pacienteId}`,
  diario: (pacienteId: string) => `diario:${pacienteId}`,
  checkin: (pacienteId: string) => `checkin:${pacienteId}`,
};
