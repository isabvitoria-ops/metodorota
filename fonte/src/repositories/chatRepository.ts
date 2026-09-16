import type { AutorMensagem, Conversa, Mensagem } from "@/types";
import { agoraISO, atraso, db, gerarId } from "./mockDb";

export async function buscarConversaDoPaciente(pacienteId: string): Promise<Conversa | null> {
  await atraso();
  return db.conversas.find((c) => c.pacienteId === pacienteId) ?? null;
}

export async function listarMensagens(conversaId: string): Promise<Mensagem[]> {
  await atraso();
  return db.mensagens.filter((m) => m.conversaId === conversaId).sort((a, b) => a.enviadaEm.localeCompare(b.enviadaEm));
}

/** Regra #12: append-only — esta é a única forma de gravar mensagem, não existe editarMensagem(). */
export async function enviarMensagem(
  nutricionistaId: string,
  conversaId: string,
  autor: AutorMensagem,
  texto: string,
): Promise<Mensagem> {
  await atraso(250);
  const agora = agoraISO();
  const msg: Mensagem = {
    id: gerarId("msg"),
    nutricionistaId,
    criadoEm: agora,
    atualizadoEm: agora,
    conversaId,
    autor,
    texto,
    enviadaEm: agora,
    lidaEm: null,
    retractedEm: null,
  };
  db.mensagens.push(msg);
  const conversa = db.conversas.find((c) => c.id === conversaId);
  if (conversa) {
    if (autor === "paciente") conversa.naoLidasParaNutricionista += 1;
    else conversa.naoLidasParaPaciente += 1;
    conversa.atualizadoEm = agora;
  }
  return msg;
}

/** Retração preserva o texto original em `texto` — só marca `retractedEm` (regra #12). */
export async function retratarMensagem(mensagemId: string): Promise<Mensagem> {
  await atraso();
  const msg = db.mensagens.find((m) => m.id === mensagemId);
  if (!msg) throw new Error(`Mensagem ${mensagemId} não encontrada`);
  msg.retractedEm = agoraISO();
  return msg;
}

export async function marcarComoLidas(conversaId: string, leitor: AutorMensagem): Promise<void> {
  await atraso(80);
  const conversa = db.conversas.find((c) => c.id === conversaId);
  if (!conversa) return;
  if (leitor === "paciente") conversa.naoLidasParaPaciente = 0;
  else conversa.naoLidasParaNutricionista = 0;
}
