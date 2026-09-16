import { useMemo } from "react";
import type { Plano } from "@/types";
import type { Estado } from "@/types";
import { planoService } from "@/services";
import { useAsync } from "./useAsync";

export function usePlano(pacienteId: string): { estado: Estado<Plano | null>; recarregar: () => void } {
  const [estado, recarregar] = useAsync(() => planoService.buscarPlanoAtivo(pacienteId), [pacienteId]);
  return useMemo(() => ({ estado, recarregar }), [estado, recarregar]);
}
