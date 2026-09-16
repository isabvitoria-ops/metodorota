import { useCallback } from "react";
import type { PreferenciasNotificacao } from "@/types";
import { preferenciasService } from "@/services";
import { useAsync } from "./useAsync";

export function usePreferencias(pacienteId: string) {
  const [estado, recarregar] = useAsync(() => preferenciasService.buscarPreferencias(pacienteId), [pacienteId]);

  const salvar = useCallback(
    async (preferencias: PreferenciasNotificacao) => {
      await preferenciasService.salvarPreferencias(preferencias);
      recarregar();
    },
    [recarregar],
  );

  return { estado, salvar, recarregar };
}
