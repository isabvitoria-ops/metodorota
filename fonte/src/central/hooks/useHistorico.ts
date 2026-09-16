import { create } from "zustand";
import type { TrocaRecente } from "@/central/types";
import { armazenamentoLocal } from "@/central/utils/armazenamento";

const armazenamento = armazenamentoLocal<TrocaRecente>("central:trocas-recentes:v1");

/** Quantas trocas recentes guardar — o suficiente para uma fileira de atalhos. */
const LIMITE = 8;

interface EstadoHistorico {
  itens: TrocaRecente[];
  registrar(troca: Omit<TrocaRecente, "id" | "em">): void;
  limpar(): void;
}

/**
 * Trocas recentes (§24). O briefing não exigia na V1, mas é o que faz a
 * calculadora parecer que conhece o paciente: quem trocou arroz por macarrão
 * ontem repete o gesto em um toque.
 */
export const useHistorico = create<EstadoHistorico>((set, get) => ({
  itens: armazenamento.ler(),

  registrar(troca) {
    const id = `${troca.origemAlimentoId}>${troca.destinoAlimentoId}`;
    const itens = [
      { ...troca, id, em: new Date().toISOString() },
      ...get().itens.filter((t) => t.id !== id),
    ].slice(0, LIMITE);
    armazenamento.escrever(itens);
    set({ itens });
  },

  limpar() {
    armazenamento.escrever([]);
    set({ itens: [] });
  },
}));
