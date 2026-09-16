import { create } from "zustand";
import { repositorio } from "@/central/dados/repositorio";
import { hidratar } from "@/central/dados/catalogo";
import { invalidarIndice } from "@/central/dados/indiceBusca";

/**
 * Recarga do catálogo depois de uma edição administrativa.
 *
 * O catálogo mora em memória (ver dados/catalogo.ts) e as telas o leem de
 * forma síncrona, então o React não tem como saber sozinho que ele mudou.
 * `versao` existe só para isso: quem depende do catálogo assina esse número
 * e volta a desenhar quando ele muda.
 */
interface EstadoCatalogo {
  versao: number;
  salvando: boolean;
  erro: string | null;
  recarregar(): Promise<void>;
  comSalvamento(acao: () => Promise<void>): Promise<boolean>;
}

export const useCatalogo = create<EstadoCatalogo>((set, get) => ({
  versao: 0,
  salvando: false,
  erro: null,

  async recarregar() {
    const dados = await repositorio.carregarCatalogo();
    hidratar(dados);
    invalidarIndice();
    set({ versao: get().versao + 1 });
  },

  /** Salva, recarrega e devolve se deu certo — o padrão de todo formulário do admin. */
  async comSalvamento(acao) {
    set({ salvando: true, erro: null });
    try {
      await acao();
      await get().recarregar();
      set({ salvando: false });
      return true;
    } catch (e) {
      set({ salvando: false, erro: e instanceof Error ? e.message : "Não foi possível salvar." });
      return false;
    }
  },
}));

/** Transforma "Batata-doce cozida" em "batata-doce-cozida". */
export function gerarIdentificador(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
