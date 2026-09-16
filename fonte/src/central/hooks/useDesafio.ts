import { useCallback, useEffect, useState } from "react";
import type { MeuDesafio } from "@/central/types";
import { repositorio } from "@/central/dados/repositorio";

/**
 * O estado da tela do desafio.
 *
 * Recarrega inteiro depois de cada ação em vez de remendar o objeto na mão:
 * pontos, posição e ranking são calculados pelo banco, e recalcular no
 * navegador seria justamente o erro que o §55 dela pede para não cometer.
 */
export function useDesafio() {
  const [dados, definirDados] = useState<MeuDesafio | null>(null);
  const [carregando, definirCarregando] = useState(true);
  const [erro, definirErro] = useState<string | null>(null);
  const [ocupado, definirOcupado] = useState(false);
  const [festejando, definirFestejando] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    try {
      definirDados(await repositorio.meuDesafio());
      definirErro(null);
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui carregar o desafio.");
    } finally {
      definirCarregando(false);
    }
  }, []);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  /** Roda uma ação que muda o estado e recarrega. Devolve se deu certo. */
  const comRecarga = useCallback(
    async (acao: () => Promise<void>, celebracao?: string) => {
      definirOcupado(true);
      definirErro(null);
      try {
        await acao();
        await recarregar();
        if (celebracao) {
          definirFestejando(celebracao);
          window.setTimeout(() => definirFestejando(null), 2600);
        }
        return true;
      } catch (e) {
        definirErro(e instanceof Error ? e.message : "Não consegui salvar.");
        return false;
      } finally {
        definirOcupado(false);
      }
    },
    [recarregar],
  );

  return { dados, carregando, erro, ocupado, festejando, recarregar, comRecarga, definirErro };
}
