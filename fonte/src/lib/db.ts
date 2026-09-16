import Dexie, { type Table } from "dexie";
import type { CheckInRascunho } from "@/types";

/**
 * IndexedDB local do paciente (briefing §10) — equivalente ao SQLite/
 * WatermelonDB do documento antigo, adaptado pra PWA. Hoje só a fila de
 * check-in usa isto (é o único fluxo com requisito explícito de "nunca
 * bloqueia esperando rede" — o paciente registra no banheiro, onde o sinal
 * costuma ser pior), mas a base está pronta para outras filas (diário,
 * fotos) se precisarem do mesmo padrão depois.
 */
export interface FilaCheckinEntrada {
  /** Chave idempotente gerada no cliente — evita duplicar se a sincronização rodar duas vezes (briefing §10). */
  chaveIdempotente: string;
  nutricionistaId: string;
  payload: CheckInRascunho;
  criadoEm: string;
  sincronizadoEm: string | null;
  tentativas: number;
  ultimoErro: string | null;
}

class DietAppDB extends Dexie {
  filaCheckin!: Table<FilaCheckinEntrada, string>;

  constructor() {
    super("diet-app");
    this.version(1).stores({
      // Fila costuma ter poucos itens (no máximo dias sem sincronizar), então
      // um scan com .filter() pra achar pendentes é suficiente — sem índice extra.
      filaCheckin: "chaveIdempotente",
    });
  }
}

export const db = new DietAppDB();
