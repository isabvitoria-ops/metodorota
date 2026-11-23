import { useEffect, useState } from "react";
import { repositorio } from "@/central/dados/repositorio";
import { useAvisoDaLixeira } from "@/central/utils/avisoDaLixeira";

/**
 * O "Desfazer" logo depois de apagar (lixeira de 30 dias, 0102).
 *
 * Quem apaga chama `avisarLixeira(...)` (utils/avisoDaLixeira.ts); o aviso aparece embaixo por alguns
 * segundos. Desfazer devolve o item na hora e chama `aoVoltar` para a tela
 * recarregar. Só existe na área da nutricionista.
 */
export function AvisoDaLixeira() {
  const { aviso, definir } = useAvisoDaLixeira();
  const [estado, definirEstado] = useState<"parado" | "voltando" | "voltou" | "erro">("parado");

  useEffect(() => {
    if (!aviso) return;
    definirEstado("parado");
    const t = window.setTimeout(() => definir(null), 10000);
    return () => window.clearTimeout(t);
  }, [aviso, definir]);

  useEffect(() => {
    if (estado !== "voltou") return;
    const t = window.setTimeout(() => definir(null), 2500);
    return () => window.clearTimeout(t);
  }, [estado, definir]);

  if (!aviso) return null;

  async function desfazer() {
    if (!aviso) return;
    definirEstado("voltando");
    try {
      const id = await repositorio.lixeiraDoRegistro(aviso.registroId);
      if (!id) throw new Error();
      await repositorio.restaurarDaLixeira(id);
      await aviso.aoVoltar?.();
      definirEstado("voltou");
    } catch {
      definirEstado("erro");
    }
  }

  return (
    <div className="c-lixeira-aviso" role="status">
      <span>
        {estado === "voltou"
          ? "Voltou."
          : estado === "erro"
            ? "Não consegui desfazer. Restaure em Configurações › Lixeira."
            : aviso.texto}
      </span>
      {(estado === "parado" || estado === "voltando") && (
        <button type="button" disabled={estado === "voltando"} onClick={() => void desfazer()}>
          {estado === "voltando" ? "Voltando…" : "Desfazer"}
        </button>
      )}
    </div>
  );
}
