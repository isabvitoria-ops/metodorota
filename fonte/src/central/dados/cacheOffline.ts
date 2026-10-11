import { db } from "@/lib/db";
import type { DadosCatalogo } from "./repositorio";
import type { Acesso, Paciente } from "@/central/types";
import type { ResumoProtocolo } from "@/central/types/protocolo";

const CHAVE_CATALOGO = "catalogo";
const CHAVE_PACIENTES = "pacientes";
const CHAVE_PROTOCOLOS = "protocolos";
const CHAVE_ACESSO = "acesso";

export async function salvarCatalogoNoCache(dados: DadosCatalogo): Promise<void> {
  try {
    await db.cache.put({
      chave: CHAVE_CATALOGO,
      dados,
      atualizadoEm: new Date().toISOString(),
    });
  } catch {
    /* IndexedDB cheio ou bloqueado — a app continua igual */
  }
}

export async function lerCatalogoDoCache(): Promise<DadosCatalogo | null> {
  try {
    const entrada = await db.cache.get(CHAVE_CATALOGO);
    return (entrada?.dados as DadosCatalogo) ?? null;
  } catch {
    return null;
  }
}

export async function salvarPacientesNoCache(lista: Paciente[]): Promise<void> {
  try {
    await db.cache.put({
      chave: CHAVE_PACIENTES,
      dados: lista,
      atualizadoEm: new Date().toISOString(),
    });
  } catch {
    /* idem */
  }
}

export async function lerPacientesDoCache(): Promise<Paciente[] | null> {
  try {
    const entrada = await db.cache.get(CHAVE_PACIENTES);
    return (entrada?.dados as Paciente[]) ?? null;
  } catch {
    return null;
  }
}

export async function salvarProtocolosNoCache(lista: ResumoProtocolo[]): Promise<void> {
  try {
    await db.cache.put({
      chave: CHAVE_PROTOCOLOS,
      dados: lista,
      atualizadoEm: new Date().toISOString(),
    });
  } catch {
    /* idem */
  }
}

export async function lerProtocolosDoCache(): Promise<ResumoProtocolo[] | null> {
  try {
    const entrada = await db.cache.get(CHAVE_PROTOCOLOS);
    return (entrada?.dados as ResumoProtocolo[]) ?? null;
  } catch {
    return null;
  }
}

export async function salvarAcessoNoCache(acesso: Acesso): Promise<void> {
  try {
    await db.cache.put({
      chave: CHAVE_ACESSO,
      dados: acesso,
      atualizadoEm: new Date().toISOString(),
    });
  } catch {
    /* idem */
  }
}

export async function lerAcessoDoCache(): Promise<Acesso | null> {
  try {
    const entrada = await db.cache.get(CHAVE_ACESSO);
    return (entrada?.dados as Acesso) ?? null;
  } catch {
    return null;
  }
}

export function estaOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}
