import { useCallback } from "react";
import type { AdesaoId } from "@/types";
import { diarioService } from "@/services";
import { paraISODate } from "@/utils/datas";
import { useAsync } from "./useAsync";

export function useDiario(pacienteId: string) {
  const hojeISO = paraISODate(new Date());
  const [estado, recarregar] = useAsync(() => diarioService.listarRegistrosDoDia(pacienteId, hojeISO), [pacienteId, hojeISO]);

  const registrar = useCallback(
    async (nutricionistaId: string, refeicaoId: string, adesao: AdesaoId, nota?: string, fotoUrl?: string) => {
      await diarioService.registrarAdesao(nutricionistaId, pacienteId, refeicaoId, hojeISO, adesao, nota, fotoUrl);
      recarregar();
    },
    [pacienteId, hojeISO, recarregar],
  );

  const registrarTroca = useCallback(
    async (nutricionistaId: string, refeicaoId: string, descricao: string) => {
      await diarioService.registrarTrocaComoAdesao(nutricionistaId, pacienteId, refeicaoId, hojeISO, descricao);
      recarregar();
    },
    [pacienteId, hojeISO, recarregar],
  );

  return { estado, registrar, registrarTroca, recarregar };
}
