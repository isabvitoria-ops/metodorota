import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Conexão com o Supabase.
 *
 * O app roda com ou sem ela. Sem as duas variáveis de ambiente, a Central
 * entra em MODO DEMONSTRAÇÃO: os dados vêm dos arquivos de semente, o que
 * for salvo fica só no navegador e não há login. É o que permite abrir o
 * projeto e ver tudo funcionando antes de criar conta em serviço nenhum — e
 * é o modo em que a bateria de testes de interface roda.
 *
 * Com as variáveis preenchidas, tudo passa a vir do banco, com login e com
 * as políticas de acesso valendo.
 */
const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const chaveAnonima = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const temSupabase = Boolean(url && chaveAnonima);

export const supabase: SupabaseClient | null = temSupabase
  ? createClient(url as string, chaveAnonima as string, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

/** Usar onde a ausência do cliente seria erro de programação, não do usuário. */
export function exigirSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error("Supabase não configurado: preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
  }
  return supabase;
}

export const MODO_DEMONSTRACAO = !temSupabase;
