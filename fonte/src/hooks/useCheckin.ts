import { useCallback, useEffect, useMemo, useState } from "react";
import type { CheckIn, CheckInRascunho, Estado } from "@/types";
import { checkinService } from "@/services";
import { paraISODate } from "@/utils/datas";
import { useCheckinHojeStore } from "@/store/checkinHojeStore";
import { useAsync } from "./useAsync";

/**
 * Todas as instâncias de `useCheckin(pacienteId)` — Hoje, o modal de
 * check-in, etc. — compartilham o mesmo valor via `checkinHojeStore`, para
 * que uma atualização otimista feita em uma tela apareça imediatamente nas
 * outras (ver nota na store).
 */
export function useCheckin(pacienteId: string) {
  const hojeISO = paraISODate(new Date());
  const [estadoServidor, recarregarServidor] = useAsync(() => checkinService.buscarCheckinDoDia(pacienteId, hojeISO), [pacienteId, hojeISO]);
  const [salvando, setSalvando] = useState(false);
  const valorNaStore = useCheckinHojeStore((s) => s.porPaciente[pacienteId]);
  const definirNaStore = useCheckinHojeStore((s) => s.definir);

  // Propaga o resultado do fetch pra store só na primeira vez que ele chega
  // (se já tiver algo otimista/mais novo lá, não sobrescreve).
  useEffect(() => {
    if (estadoServidor.status === "pronto" && valorNaStore === undefined) {
      definirNaStore(pacienteId, estadoServidor.dado);
    }
  }, [estadoServidor, pacienteId, valorNaStore, definirNaStore]);

  const estado: Estado<CheckIn | null> = useMemo(() => {
    if (valorNaStore !== undefined) return { status: "pronto", dado: valorNaStore };
    return estadoServidor;
  }, [valorNaStore, estadoServidor]);

  const recarregar = useCallback(() => {
    definirNaStore(pacienteId, undefined as unknown as CheckIn | null);
    recarregarServidor();
  }, [pacienteId, definirNaStore, recarregarServidor]);

  const salvar = useCallback(
    async (nutricionistaId: string, dados: Omit<CheckInRascunho, "pacienteId" | "data" | "chaveIdempotente">) => {
      setSalvando(true);
      try {
        const rascunho: CheckInRascunho = {
          ...dados,
          pacienteId,
          data: hojeISO,
          chaveIdempotente: `${pacienteId}-${hojeISO}`,
        };
        const resultado = await checkinService.salvarCheckin(nutricionistaId, rascunho);
        if (resultado.checkin) {
          definirNaStore(pacienteId, resultado.checkin);
        } else {
          // Offline-first (briefing §10): a tela não espera a rede — mostra
          // o check-in como salvo com um registro local até a sincronização confirmar.
          const agora = new Date().toISOString();
          definirNaStore(pacienteId, {
            id: `local-${rascunho.chaveIdempotente}`,
            nutricionistaId,
            criadoEm: agora,
            atualizadoEm: agora,
            gerouAlertaClinico: false,
            ...rascunho,
          });
        }
        return resultado;
      } finally {
        setSalvando(false);
      }
    },
    [pacienteId, hojeISO, definirNaStore],
  );

  return { estado, salvando, salvar, recarregar };
}

export function useHistoricoCheckin(pacienteId: string, dias = 14) {
  const [estado, recarregar] = useAsync(() => checkinService.buscarHistorico(pacienteId, dias), [pacienteId, dias]);
  return { estado, recarregar };
}

export type { CheckIn };
