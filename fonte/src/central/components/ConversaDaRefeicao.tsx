import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Modal } from "@/central/admin/componentes/Modal";
import { useSessao } from "@/central/autenticacao/SessaoContexto";
import { repositorio } from "@/central/dados/repositorio";
import type { MensagemDaRefeicao } from "@/central/types/conversaDaRefeicao";
import {
  enderecoDaRastreabilidade,
  sintomasMencionados,
} from "@/central/utils/conversaDaRefeicao";

/**
 * A conversa de UMA refeição, nos dois lados.
 *
 * `pacienteId` nulo: sou a paciente. Preenchido: é a nutricionista, na
 * conversa daquela paciente.
 *
 * O ATALHO DA RASTREABILIDADE. Quando a paciente escreve algo como "me deu
 * inchaço", a frase sozinha ficaria solta na conversa — texto que ninguém
 * soma nem compara. O modal então oferece, embaixo da mensagem dela, os
 * alimentos DAQUELA refeição: tocar num deles abre a Rastreabilidade já com
 * aquele alimento, o sintoma e o texto preenchidos, para ela só conferir e
 * salvar. É ela quem escolhe o alimento — o sistema não adivinha qual foi o
 * culpado — e nada é gravado sem o toque final dela.
 */
export function ConversaDaRefeicao({
  refeicao,
  pacienteId,
  alimentos = [],
  aoFechar,
  aoMudar,
}: {
  refeicao: string;
  pacienteId: string | null;
  /** Os alimentos da refeição, para o atalho da Rastreabilidade (só da paciente). */
  alimentos?: string[];
  aoFechar: () => void;
  /** Avisa a tela de trás que as "não lidas" podem ter mudado. */
  aoMudar?: () => void;
}) {
  const souNutricionista = pacienteId !== null;
  const { acesso } = useSessao();
  const navegar = useNavigate();
  const [mensagens, definirMensagens] = useState<MensagemDaRefeicao[]>([]);
  const [carregando, definirCarregando] = useState(true);
  const [texto, definirTexto] = useState("");
  const [enviando, definirEnviando] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);
  const fim = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async () => {
    try {
      definirMensagens(await repositorio.conversaDaRefeicao(pacienteId, refeicao));
      await repositorio.marcarConversaLida(pacienteId, refeicao);
      aoMudar?.();
      definirErro(null);
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui carregar a conversa.");
    } finally {
      definirCarregando(false);
    }
  }, [pacienteId, refeicao, aoMudar]);

  useEffect(() => {
    void carregar();
    // Sem tempo real: enquanto a conversa está aberta, olha de novo a cada 20 s.
    const rel = window.setInterval(() => void carregar(), 20_000);
    return () => window.clearInterval(rel);
  }, [carregar]);

  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [mensagens.length]);

  async function enviar() {
    const t = texto.trim();
    if (!t || enviando) return;
    definirEnviando(true);
    definirErro(null);
    try {
      await repositorio.enviarMensagemDeRefeicao(pacienteId, refeicao, t);
      definirTexto("");
      await carregar();
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui enviar.");
    } finally {
      definirEnviando(false);
    }
  }

  // O atalho aparece só para a última mensagem DELA, quando ela cita sintoma.
  const ultimaDela = useMemo(
    () => [...mensagens].reverse().find((m) => m.autor === "paciente") ?? null,
    [mensagens],
  );
  const sintomas = useMemo(
    () => (ultimaDela ? sintomasMencionados(ultimaDela.texto) : []),
    [ultimaDela],
  );
  const oferecerAtalho =
    !souNutricionista && sintomas.length > 0 && alimentos.length > 0 && acesso.rastreio;

  return (
    <Modal titulo={`Conversa · ${refeicao}`} aoFechar={aoFechar}>
      <p className="c-dica" style={{ marginTop: 0 }}>
        {souNutricionista
          ? "Só esta refeição e só esta paciente. Ela vê o que você escrever aqui."
          : "Tire dúvidas ou conte como foi só desta refeição. Sua nutricionista responde por aqui."}
      </p>

      <div className="c-conversa" role="log" aria-live="polite">
        {carregando && <p className="c-dica">Carregando…</p>}
        {!carregando && mensagens.length === 0 && (
          <p className="c-dica">Ainda não há mensagens nesta refeição.</p>
        )}
        {mensagens.map((m) => {
          const minha = souNutricionista ? m.autor === "nutri" : m.autor === "paciente";
          return (
            <div key={m.id} className={`c-conversa-msg ${minha ? "c-conversa-minha" : "c-conversa-outra"}`}>
              <span className="c-conversa-quem">
                {m.autor === "nutri" ? "Nutricionista" : souNutricionista ? "Paciente" : "Você"}
                {" · "}
                {new Date(m.criadoEm).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <p>{m.texto}</p>
            </div>
          );
        })}
        <div ref={fim} />
      </div>

      {oferecerAtalho && (
        <div className="c-aviso" role="status" style={{ display: "block" }}>
          <p style={{ margin: "0 0 8px" }}>
            Isso foi um sintoma? Registre na Rastreabilidade — qual alimento foi?
          </p>
          <div className="c-chips">
            {alimentos.map((a) => (
              <button
                key={a}
                type="button"
                className="c-chip"
                onClick={() =>
                  navegar(
                    enderecoDaRastreabilidade({
                      alimento: a,
                      sintomas,
                      observacao: ultimaDela?.texto ?? "",
                      refeicao,
                    }),
                  )
                }
              >
                {a}
              </button>
            ))}
          </div>
        </div>
      )}

      {erro && (
        <div className="c-aviso c-aviso-erro" role="alert">
          <span>{erro}</span>
        </div>
      )}

      <label className="c-campo" style={{ display: "block", marginTop: 12 }}>
        <span className="c-rotulo">{souNutricionista ? "Sua resposta" : "Sua mensagem"}</span>
        <textarea
          className="c-textarea"
          rows={3}
          maxLength={1000}
          value={texto}
          onChange={(e) => definirTexto(e.target.value)}
          placeholder={souNutricionista ? "Escreva para a paciente…" : "Ex.: me deu inchaço depois do arroz"}
        />
      </label>
      <div className="c-modal-acoes">
        <button type="button" className="c-botao c-botao-secundario" onClick={aoFechar}>
          Fechar
        </button>
        <button
          type="button"
          className="c-botao"
          disabled={enviando || !texto.trim()}
          onClick={() => void enviar()}
        >
          {enviando ? "Enviando…" : "Enviar"}
        </button>
      </div>
    </Modal>
  );
}
