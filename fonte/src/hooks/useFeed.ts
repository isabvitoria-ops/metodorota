import { useCallback } from "react";
import { feedService } from "@/services";
import { useAsync } from "./useAsync";

export function useFeed(pacienteId: string) {
  const [estado, recarregar, aplicar] = useAsync(() => feedService.listarFeed(pacienteId), [pacienteId]);

  /**
   * Curtir corrige a lista já carregada em vez de recarregá-la: um
   * `recarregar()` aqui devolvia a tela ao estado "carregando" e a lista
   * inteira piscava como skeleton por ~220 ms a cada toque.
   */
  const curtir = useCallback(
    async (postId: string) => {
      aplicar((itens) =>
        itens.map((i) =>
          i.post.id === postId
            ? { ...i, curtidoPorMim: !i.curtidoPorMim, curtidas: i.curtidas + (i.curtidoPorMim ? -1 : 1) }
            : i,
        ),
      );
      const curtidasReais = await feedService.alternarCurtida(postId, pacienteId);
      // Reconcilia com o número que o servidor devolveu (se divergir do palpite otimista).
      aplicar((itens) => itens.map((i) => (i.post.id === postId ? { ...i, curtidas: curtidasReais } : i)));
    },
    [pacienteId, aplicar],
  );

  return { estado, curtir, recarregar };
}

/**
 * Feed do painel — a nutricionista vê o que foi publicado, sem o estado de
 * "eu curti" (que é por paciente e não faz sentido aqui).
 */
export function useFeedPosts() {
  const [estado, recarregar] = useAsync(() => feedService.listarPostsPublicados(), []);
  return { estado, recarregar };
}
