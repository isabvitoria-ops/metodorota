import { useCallback } from "react";
import type { PoseFoto } from "@/types";
import { evolucaoService } from "@/services";
import { chaves, invalidar, useVersaoDe } from "@/store/revalidacaoStore";
import { useAsync } from "./useAsync";

/**
 * `Evolucao` (card "N sessões guardadas") e o modal `Fotos` montam este hook
 * separadamente. A chave de revalidação é o que faz uma gravação feita
 * dentro do modal chegar no card atrás dele.
 */
export function useSessoesFoto(pacienteId: string, nutricionistaId: string) {
  const versao = useVersaoDe(chaves.sessoesFoto(pacienteId));
  const [estado, recarregar] = useAsync(
    () => evolucaoService.listarSessoesFoto(pacienteId),
    [pacienteId, versao],
  );

  const salvar = useCallback(
    async (data: string, storagePathPorPose: Partial<Record<PoseFoto, string>>) => {
      await evolucaoService.salvarSessaoFoto(nutricionistaId, pacienteId, data, storagePathPorPose);
      invalidar(chaves.sessoesFoto(pacienteId));
    },
    [pacienteId, nutricionistaId],
  );

  const apagar = useCallback(
    async (sessaoId: string) => {
      await evolucaoService.apagarSessaoFoto(sessaoId);
      invalidar(chaves.sessoesFoto(pacienteId));
    },
    [pacienteId],
  );

  return { estado, salvar, apagar, recarregar };
}
