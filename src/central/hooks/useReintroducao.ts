import { useCallback, useEffect, useState } from "react";
import type { Reintroducao } from "@/central/types";
import { repositorio } from "@/central/dados/repositorio";

/**
 * O estado da tela de rastreabilidade.
 *
 * Recarrega inteiro depois de cada mudança em vez de remendar o objeto na
 * mão: a semana de cada registro é calculada pelo banco, e recalcular no
 * navegador seria criar uma segunda verdade sobre o mesmo dado.
 */
export function useReintroducao(pacienteId?: string | null) {
  const [dados, definirDados] = useState<Reintroducao | null>(null);
  const [carregando, definirCarregando] = useState(true);
  const [erro, definirErro] = useState<string | null>(null);
  const [ocupado, definirOcupado] = useState(false);

  const recarregar = useCallback(async () => {
    try {
      definirDados(
        pacienteId
          ? await repositorio.reintroducaoDoPaciente(pacienteId)
          : await repositorio.minhaReintroducao(),
      );
      definirErro(null);
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui carregar.");
    } finally {
      definirCarregando(false);
    }
  }, [pacienteId]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  /** Roda uma ação que muda o estado e recarrega. Devolve se deu certo. */
  const comRecarga = useCallback(
    async (acao: () => Promise<void>) => {
      definirOcupado(true);
      definirErro(null);
      try {
        await acao();
        await recarregar();
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

  return { dados, carregando, erro, ocupado, recarregar, comRecarga, definirErro };
}
