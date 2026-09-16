import { create } from "zustand";
import type { Favorito, TipoFavorito } from "@/central/types";
import { repositorio } from "@/central/dados/repositorio";

/**
 * Favoritos do paciente (§21 do briefing).
 *
 * Saíram do localStorage e passaram a viver no banco: assim o que a paciente
 * salva no celular aparece também no computador, e continua lá se ela trocar
 * de aparelho. Quem guarda é o repositório — em modo demonstração ele volta
 * a usar o navegador, e esta camada não percebe diferença.
 *
 * A tela é atualizada antes da resposta do servidor (e desfeita se der
 * errado): tocar no coração e esperar meio segundo para ver o efeito é a
 * diferença entre parecer app e parecer site.
 */
export function idFavorito(tipo: TipoFavorito, refId: string): string {
  return `${tipo}:${refId}`;
}

export type NovoFavorito = Omit<Favorito, "id" | "salvoEm">;

interface EstadoFavoritos {
  itens: Favorito[];
  carregado: boolean;
  carregar(): Promise<void>;
  alternar(novo: NovoFavorito): Promise<void>;
  remover(id: string): Promise<void>;
  limpar(): void;
}

export const useFavoritos = create<EstadoFavoritos>((set, get) => ({
  itens: [],
  carregado: false,

  async carregar() {
    try {
      const itens = await repositorio.listarFavoritos();
      // A tela de grupos saiu da Central. O que ficou salvo continua no banco
      // (não apago o que a paciente guardou), mas não aparece mais na lista —
      // um cartão que não abre nada é pior do que um cartão a menos.
      set({ itens: itens.filter((f) => f.tipo !== "grupo"), carregado: true });
    } catch {
      set({ carregado: true });
    }
  },

  async alternar(novo) {
    const id = idFavorito(novo.tipo, novo.refId);
    const antes = get().itens;
    const jaSalvo = antes.some((f) => f.id === id);
    const favorito: Favorito = { ...novo, id, salvoEm: new Date().toISOString() };

    set({ itens: jaSalvo ? antes.filter((f) => f.id !== id) : [favorito, ...antes] });

    try {
      if (jaSalvo) await repositorio.removerFavorito(id);
      else await repositorio.salvarFavorito(favorito);
    } catch {
      set({ itens: antes });
    }
  },

  async remover(id) {
    const antes = get().itens;
    set({ itens: antes.filter((f) => f.id !== id) });
    try {
      await repositorio.removerFavorito(id);
    } catch {
      set({ itens: antes });
    }
  },

  limpar() {
    set({ itens: [], carregado: false });
  },
}));

/** Assina só o "está salvo?" deste item — não redesenha a tela a cada favorito alheio. */
export function useEstaSalvo(tipo: TipoFavorito, refId: string): boolean {
  const id = idFavorito(tipo, refId);
  return useFavoritos((estado) => estado.itens.some((f) => f.id === id));
}
