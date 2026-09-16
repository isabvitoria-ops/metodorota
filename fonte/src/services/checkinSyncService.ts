import type { CheckIn, CheckInRascunho } from "@/types";
import { checkinRepository } from "@/repositories";
import { db, type FilaCheckinEntrada } from "@/lib/db";
import { avaliarOrigensDeAlerta, dispararAlertas } from "./alertaService";

/**
 * Offline-first (briefing §10): grava no IndexedDB primeiro, nunca bloqueia
 * esperando rede — o paciente registra o check-in no banheiro, onde o
 * sinal costuma ser pior. Tenta sincronizar na hora se `navigator.onLine`;
 * senão fica na fila até a próxima chamada de `sincronizarFilaPendente`
 * (chamada ao reabrir o app e no evento `online` — fallback manual porque
 * nem todo navegador tem Background Sync API real).
 */
export async function salvarComFilaOffline(
  nutricionistaId: string,
  rascunho: CheckInRascunho,
): Promise<{ checkin: CheckIn | null; pendente: boolean; avisoSangue: boolean }> {
  const entrada: FilaCheckinEntrada = {
    chaveIdempotente: rascunho.chaveIdempotente,
    nutricionistaId,
    payload: rascunho,
    criadoEm: new Date().toISOString(),
    sincronizadoEm: null,
    tentativas: 0,
    ultimoErro: null,
  };
  await db.filaCheckin.put(entrada);

  const avisoSangue = rascunho.flags.includes("sangue");

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { checkin: null, pendente: true, avisoSangue };
  }

  try {
    const checkin = await sincronizarUm(entrada);
    return { checkin, pendente: false, avisoSangue };
  } catch {
    return { checkin: null, pendente: true, avisoSangue };
  }
}

async function sincronizarUm(entrada: FilaCheckinEntrada): Promise<CheckIn> {
  const historicoRecente = await checkinRepository.listarHistorico(entrada.payload.pacienteId, 3);
  const origens = avaliarOrigensDeAlerta(entrada.payload, historicoRecente);
  const gerouAlertaClinico = origens.length > 0;

  const checkin = await checkinRepository.salvarCheckin(entrada.nutricionistaId, entrada.payload, gerouAlertaClinico);
  if (gerouAlertaClinico) {
    await dispararAlertas(entrada.nutricionistaId, entrada.payload.pacienteId, checkin.id, origens);
  }

  await db.filaCheckin.update(entrada.chaveIdempotente, { sincronizadoEm: new Date().toISOString() });
  return checkin;
}

/** Chamada ao reabrir o app e no evento `online` — o fallback manual descrito no briefing §16. */
export async function sincronizarFilaPendente(): Promise<number> {
  const pendentes = await db.filaCheckin.filter((e) => e.sincronizadoEm === null).toArray();
  let sincronizados = 0;
  for (const entrada of pendentes) {
    try {
      await sincronizarUm(entrada);
      sincronizados += 1;
    } catch (erro) {
      await db.filaCheckin.update(entrada.chaveIdempotente, {
        tentativas: entrada.tentativas + 1,
        ultimoErro: erro instanceof Error ? erro.message : "Erro desconhecido",
      });
    }
  }
  return sincronizados;
}

export async function contarPendentes(): Promise<number> {
  return db.filaCheckin.filter((e) => e.sincronizadoEm === null).count();
}
