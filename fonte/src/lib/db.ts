import Dexie, { type Table } from "dexie";
import type { CheckInRascunho } from "@/types";

export interface FilaCheckinEntrada {
  chaveIdempotente: string;
  nutricionistaId: string;
  payload: CheckInRascunho;
  criadoEm: string;
  sincronizadoEm: string | null;
  tentativas: number;
  ultimoErro: string | null;
}

export interface CacheEntrada {
  chave: string;
  dados: unknown;
  atualizadoEm: string;
}

class DietAppDB extends Dexie {
  filaCheckin!: Table<FilaCheckinEntrada, string>;
  cache!: Table<CacheEntrada, string>;

  constructor() {
    super("diet-app");
    this.version(1).stores({
      filaCheckin: "chaveIdempotente",
    });
    this.version(2).stores({
      filaCheckin: "chaveIdempotente",
      cache: "chave",
    });
  }
}

export const db = new DietAppDB();
