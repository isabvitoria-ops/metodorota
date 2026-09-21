import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * A folha onde os documentos são impressos — fora da árvore do aplicativo.
 *
 * DEFEITO QUE ISTO CONSERTA, visto na tela dela: o PDF saía com NOVE
 * páginas, e a primeira era o aplicativo — menu, cabeçalho, a tela inteira
 * — com o documento começando só na página 2.
 *
 * A regra de impressão antiga escondia `.c-conteudo > *:not(.doc)`, que
 * limpa a tela da PACIENTE e só ela. A área da nutricionista tem outra
 * casca, com outras classes, e passava inteira para o papel. E ia
 * continuar passando a cada tela nova que aparecesse: uma lista de
 * exceções nunca fica completa.
 *
 * A INVERSÃO resolve de uma vez: o documento sai da árvore do aplicativo e
 * é montado direto no `body`. Aí a folha de impressão esconde UMA coisa —
 * o aplicativo inteiro — e mostra UMA coisa: esta folha. Tela nenhuma
 * precisa ser lembrada, porque nenhuma é exceção.
 */
export function FolhaDeDocumento({
  titulo,
  children,
}: {
  /**
   * O que o navegador escreve no alto da folha quando "Cabeçalhos e
   * rodapés" está ligado.
   *
   * Ligado, ele imprime o TÍTULO DA PÁGINA e o endereço do site. O endereço
   * não dá para tirar por código — é do diálogo de impressão, não da
   * página. O título dá: em vez de "Central do Paciente" em toda folha,
   * sai "Rastreabilidade Alimentar — Daniela Carvalho", que identifica o
   * documento. E quem deixa a opção ligada ganha de brinde a numeração de
   * página do próprio navegador.
   */
  titulo: string;
  children: ReactNode;
}) {
  const [caixa, definirCaixa] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const anterior = document.title;
    const antes = () => {
      document.title = titulo;
    };
    const depois = () => {
      document.title = anterior;
    };
    window.addEventListener("beforeprint", antes);
    window.addEventListener("afterprint", depois);
    return () => {
      window.removeEventListener("beforeprint", antes);
      window.removeEventListener("afterprint", depois);
      // Restaurar na saída também: sem isto, fechar a tela no meio de uma
      // impressão deixaria a aba do navegador com o nome do documento para
      // sempre.
      document.title = anterior;
    };
  }, [titulo]);

  useEffect(() => {
    const el = document.createElement("div");
    el.className = "folha-documento";
    // `aria-hidden` porque na tela ela não existe: é a mesma informação que
    // a tela já mostra, e um leitor de tela a leria duas vezes.
    el.setAttribute("aria-hidden", "true");
    document.body.appendChild(el);
    definirCaixa(el);
    return () => {
      el.remove();
    };
  }, []);

  if (!caixa) return null;
  return createPortal(children, caixa);
}
