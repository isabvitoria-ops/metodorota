import { useEffect, useState } from "react";
import { repositorio } from "@/central/dados/repositorio";
import type { MinhaCozinha } from "@/central/types/receita";

/**
 * A Cozinha da paciente, buscada uma vez por sessão do app.
 *
 * Três telas leem a mesma coisa (Início decide se mostra o atalho, a Cozinha
 * lista, a receita abre uma) — e o Protocolo aponta receitas por refeição.
 * Sem a lembrança, cada uma faria a mesma consulta de novo.
 */
let lembranca: Promise<MinhaCozinha> | null = null;

export function esquecerCozinha(): void {
  lembranca = null;
}

export function useMinhaCozinha(): { cozinha: MinhaCozinha | null; carregando: boolean; erro: boolean } {
  const [estado, definirEstado] = useState<{ cozinha: MinhaCozinha | null; carregando: boolean; erro: boolean }>({
    cozinha: null,
    carregando: true,
    erro: false,
  });
  useEffect(() => {
    let vivo = true;
    if (!lembranca) {
      lembranca = repositorio.minhaCozinha().catch((e) => {
        lembranca = null;
        throw e;
      });
    }
    lembranca.then(
      (cozinha) => vivo && definirEstado({ cozinha, carregando: false, erro: false }),
      () => vivo && definirEstado({ cozinha: null, carregando: false, erro: true }),
    );
    return () => {
      vivo = false;
    };
  }, []);
  return estado;
}
