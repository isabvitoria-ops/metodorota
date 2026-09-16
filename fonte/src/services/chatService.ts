import type { AutorMensagem, Conversa, Mensagem } from "@/types";
import { chatRepository } from "@/repositories";

export async function buscarConversaDoPaciente(pacienteId: string): Promise<Conversa | null> {
  return chatRepository.buscarConversaDoPaciente(pacienteId);
}

export async function listarMensagens(conversaId: string): Promise<Mensagem[]> {
  return chatRepository.listarMensagens(conversaId);
}

export async function enviarMensagem(
  nutricionistaId: string,
  conversaId: string,
  autor: AutorMensagem,
  texto: string,
): Promise<Mensagem> {
  const limpo = texto.trim();
  if (!limpo) throw new Error("Mensagem vazia.");
  return chatRepository.enviarMensagem(nutricionistaId, conversaId, autor, limpo);
}

export async function retratarMensagem(mensagemId: string): Promise<Mensagem> {
  return chatRepository.retratarMensagem(mensagemId);
}

export async function marcarComoLidas(conversaId: string, leitor: AutorMensagem): Promise<void> {
  return chatRepository.marcarComoLidas(conversaId, leitor);
}
