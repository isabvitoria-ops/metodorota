import { useCallback, useEffect, useState } from "react";
import type { AutorMensagem, Conversa, Mensagem } from "@/types";
import { chatService } from "@/services";
import { useUiPacienteStore } from "@/store/uiPacienteStore";

export function useChat(pacienteId: string, nutricionistaId: string) {
  const [conversa, setConversa] = useState<Conversa | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const definirNaoLidasChat = useUiPacienteStore((s) => s.definirNaoLidasChat);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const c = await chatService.buscarConversaDoPaciente(pacienteId);
    setConversa(c);
    if (c) {
      const msgs = await chatService.listarMensagens(c.id);
      setMensagens(msgs);
      definirNaoLidasChat(c.naoLidasParaPaciente);
    }
    setCarregando(false);
  }, [pacienteId, definirNaoLidasChat]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const enviar = useCallback(
    async (texto: string, autor: AutorMensagem = "paciente") => {
      if (!conversa) return;
      const msg = await chatService.enviarMensagem(nutricionistaId, conversa.id, autor, texto);
      setMensagens((m) => [...m, msg]);
    },
    [conversa, nutricionistaId],
  );

  const marcarLidas = useCallback(
    async (leitor: AutorMensagem) => {
      if (!conversa) return;
      await chatService.marcarComoLidas(conversa.id, leitor);
      if (leitor === "paciente") definirNaoLidasChat(0);
    },
    [conversa, definirNaoLidasChat],
  );

  return { conversa, mensagens, carregando, enviar, marcarLidas, recarregar: carregar };
}

/**
 * Só o contador de não lidas — usado no topbar (badge do envelope) sem
 * precisar montar o modal de chat inteiro. Sem isto, o badge só aparecia
 * depois que o paciente abria o chat pela primeira vez (o protótipo
 * inicializava `naoLidas` direto em 1; aqui o valor real vem do backend).
 */
export function useNaoLidasChatInicial(pacienteId: string) {
  const definirNaoLidasChat = useUiPacienteStore((s) => s.definirNaoLidasChat);
  useEffect(() => {
    let ativo = true;
    chatService.buscarConversaDoPaciente(pacienteId).then((c) => {
      if (ativo && c) definirNaoLidasChat(c.naoLidasParaPaciente);
    });
    return () => {
      ativo = false;
    };
  }, [pacienteId, definirNaoLidasChat]);
}
