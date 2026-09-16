import { useCallback, useEffect, useRef, useState } from "react";
import type { Estado } from "@/types";

/**
 * Base de toda busca de dado nas telas — converte uma Promise em `Estado<T>`
 * (briefing §7, §18) e reexecuta quando `deps` muda. `recarregar()` é
 * exposto para os botões "Tentar de novo" do `EstadoErro`.
 *
 * O terceiro elemento (`aplicar`) permite corrigir o dado já carregado sem
 * passar por "carregando" — é o que evita a lista inteira sumir e voltar
 * como skeleton por causa de uma curtida.
 */
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: unknown[],
): [Estado<T>, () => void, (atualizar: (dado: T) => T) => void] {
  const [estado, setEstado] = useState<Estado<T>>({ status: "carregando" });
  const versao = useRef(0);

  const aplicar = useCallback((atualizar: (dado: T) => T) => {
    setEstado((e) => (e.status === "pronto" ? { status: "pronto", dado: atualizar(e.dado) } : e));
  }, []);

  const executar = useCallback(() => {
    const minhaVersao = ++versao.current;
    setEstado({ status: "carregando" });
    fn()
      .then((dado) => {
        if (versao.current === minhaVersao) setEstado({ status: "pronto", dado });
      })
      .catch((erro: unknown) => {
        if (versao.current === minhaVersao) {
          setEstado({ status: "erro", erro: erro instanceof Error ? erro.message : "Erro inesperado." });
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    executar();
  }, [executar]);

  return [estado, executar, aplicar];
}
