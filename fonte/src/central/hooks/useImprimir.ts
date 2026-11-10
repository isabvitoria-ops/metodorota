import { useCallback, useState } from "react";

/**
 * Monta um documento e manda imprimir — nessa ordem, e só desmonta depois.
 *
 * É a mesma regra da tela de Documentos, num lugar só para as outras telas
 * usarem. DOIS DETALHES, e os dois produzem FOLHA EM BRANCO quando ignorados:
 *
 *   * `window.print()` no mesmo quadro em que o documento é montado abre o
 *     diálogo antes de o navegador ter desenhado. Daí os dois quadros de
 *     espera — um para o React aplicar a mudança, outro para desenhar;
 *   * `window.print()` não espera o diálogo fechar em vários navegadores (no
 *     Safari do iPhone ele volta na hora). Quem avisa que acabou é o evento
 *     `afterprint`; o prazo de 60 s é a rede de segurança.
 *
 * `preparar` roda antes de montar (baixar as fotos, por exemplo).
 */
export function useImprimir() {
  const [imprimindo, definirImprimindo] = useState(false);
  const [preparando, definirPreparando] = useState(false);

  const imprimir = useCallback(async (preparar?: () => Promise<void>) => {
    definirPreparando(true);
    try {
      await preparar?.();
    } finally {
      definirPreparando(false);
    }
    definirImprimindo(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        let jaSaiu = false;
        const limpar = () => {
          if (jaSaiu) return;
          jaSaiu = true;
          window.removeEventListener("afterprint", limpar);
          clearTimeout(prazo);
          definirImprimindo(false);
        };
        const prazo = setTimeout(limpar, 60_000);
        window.addEventListener("afterprint", limpar);
        window.print();
      });
    });
  }, []);

  return { imprimindo, preparando, imprimir };
}
