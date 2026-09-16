import { useEffect } from "react";
import { sincronizarFilaPendente } from "@/services/checkinSyncService";

/**
 * Dispara a sincronização da fila local ao abrir o app e sempre que a
 * conexão volta (evento `online`) — o fallback manual do briefing §16 para
 * navegadores sem Background Sync API real.
 */
export function useSincronizacaoOffline() {
  useEffect(() => {
    sincronizarFilaPendente();
    const aoVoltarOnline = () => {
      sincronizarFilaPendente();
    };
    window.addEventListener("online", aoVoltarOnline);
    return () => window.removeEventListener("online", aoVoltarOnline);
  }, []);
}
