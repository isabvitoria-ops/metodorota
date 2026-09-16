import type { Sessao } from "@/types";
import { pacienteRepository } from "@/repositories";
import { NUTRICIONISTA } from "@/data/mocks/pacientes";
import { atraso } from "@/repositories/mockDb";

const CHAVE_SESSAO = "diet-app:sessao";

/**
 * Login real hoje é Supabase Auth (briefing §11) — `lib/supabaseClient.ts`
 * troca o corpo destas duas funções por chamadas a
 * `supabase.auth.signInWithPassword` / `getSession` sem mudar a assinatura.
 * Sessão persistente (§5): grava em localStorage para sobreviver a fechar o
 * navegador, do mesmo jeito que o refresh token faria.
 */
export async function login(email: string, senha: string): Promise<Sessao> {
  await atraso(400);
  if (senha.length < 4) throw new Error("Senha muito curta.");

  const emailLower = email.trim().toLowerCase();
  if (emailLower === NUTRICIONISTA.email.toLowerCase()) {
    const sessao: Sessao = {
      userId: NUTRICIONISTA.id,
      papel: "nutricionista",
      perfilId: NUTRICIONISTA.id,
      email: NUTRICIONISTA.email,
      expiraEm: new Date(Date.now() + 1000 * 60 * 60 * 24 * 60).toISOString(),
    };
    salvarSessaoLocal(sessao);
    return sessao;
  }

  const pacientes = await pacienteRepository.listarPacientes();
  const paciente = pacientes.find((p) => p.email.toLowerCase() === emailLower);
  if (!paciente) throw new Error("E-mail ou senha incorretos.");
  if (!paciente.ativo) throw new Error("Este acesso foi encerrado pela sua nutricionista. Fale com ela para reativar.");

  const sessao: Sessao = {
    userId: paciente.id,
    papel: "paciente",
    perfilId: paciente.id,
    email: paciente.email,
    expiraEm: new Date(Date.now() + 1000 * 60 * 60 * 24 * 60).toISOString(),
  };
  salvarSessaoLocal(sessao);
  return sessao;
}

export async function logout(): Promise<void> {
  await atraso(100);
  localStorage.removeItem(CHAVE_SESSAO);
}

export async function sessaoAtual(): Promise<Sessao | null> {
  await atraso(120);
  const bruto = localStorage.getItem(CHAVE_SESSAO);
  if (!bruto) return null;
  try {
    const sessao = JSON.parse(bruto) as Sessao;
    if (new Date(sessao.expiraEm).getTime() < Date.now()) {
      localStorage.removeItem(CHAVE_SESSAO);
      return null;
    }
    return sessao;
  } catch {
    return null;
  }
}

function salvarSessaoLocal(sessao: Sessao): void {
  localStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao));
}
