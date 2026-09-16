import { useCallback, useEffect, useMemo, useState } from "react";
import type { Estado, Paciente } from "@/types";
import { pacienteService } from "@/services";
import { useAsync } from "./useAsync";

export function usePaciente(pacienteId: string) {
  const [estadoServidor, recarregar] = useAsync(() => pacienteService.buscarPacientePorId(pacienteId), [pacienteId]);
  const [override, setOverride] = useState<Paciente | null>(null);

  useEffect(() => {
    setOverride(null);
  }, [pacienteId]);

  const estado: Estado<Paciente | null> = useMemo(() => {
    if (override) return { status: "pronto", dado: override };
    return estadoServidor;
  }, [override, estadoServidor]);

  const [erroGravacao, setErroGravacao] = useState<string | null>(null);

  const atualizar = useCallback(
    async (paciente: Paciente) => {
      // Atualiza a tela na hora — a gravação já aconteceu (ou está
      // acontecendo) no service; não há por que voltar pra "carregando" e
      // fazer as 6 abas da ficha piscarem por causa de um switch.
      const anterior = override;
      setOverride(paciente);
      setErroGravacao(null);
      try {
        await pacienteService.atualizarPaciente(paciente);
      } catch (e) {
        // Sem isto a tela seguia mostrando um dado que o servidor recusou.
        setOverride(anterior);
        setErroGravacao(e instanceof Error ? e.message : "Não foi possível salvar a alteração.");
        throw e;
      }
    },
    [override],
  );

  return { estado, atualizar, recarregar, erroGravacao };
}
