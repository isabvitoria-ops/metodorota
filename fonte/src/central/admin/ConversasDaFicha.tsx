import { useCallback, useEffect, useMemo, useState } from "react";
import { repositorio } from "@/central/dados/repositorio";
import { ConversaDaRefeicao } from "@/central/components/ConversaDaRefeicao";
import { Icone } from "@/central/components/Icone";
import type { ResumoDaConversa } from "@/central/types/conversaDaRefeicao";
import type { RefeicaoProtocolo } from "@/central/types/protocolo";
import { chaveDaRefeicao, mesmaRefeicao } from "@/central/utils/conversaDaRefeicao";

/**
 * A aba "Conversas" da ficha: uma conversa por refeição do plano dela.
 *
 * As refeições vêm do protocolo publicado (ou do rascunho, se ainda não há
 * publicado), para ela poder puxar assunto mesmo antes da paciente escrever.
 * Conversas de refeições que não estão mais no protocolo (renomeadas ou
 * tiradas) continuam aparecendo, marcadas como antigas — o que foi dito não
 * some.
 */
export function ConversasDaFicha({
  pacienteId,
  aoMudar,
}: {
  pacienteId: string;
  /** Avisa a ficha para atualizar a bolinha da aba. */
  aoMudar: () => void;
}) {
  const [refeicoes, definirRefeicoes] = useState<RefeicaoProtocolo[]>([]);
  const [resumo, definirResumo] = useState<ResumoDaConversa[]>([]);
  const [aberta, definirAberta] = useState<string | null>(null);
  const [carregando, definirCarregando] = useState(true);
  const [erro, definirErro] = useState<string | null>(null);

  const carregarResumo = useCallback(async () => {
    try {
      definirResumo(await repositorio.resumoDasConversas(pacienteId));
      definirErro(null);
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui carregar as conversas.");
    }
    aoMudar();
  }, [pacienteId, aoMudar]);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const ficha = await repositorio.protocoloDoPaciente(pacienteId);
        if (vivo) definirRefeicoes((ficha.publicado ?? ficha.rascunho)?.conteudo.refeicoes ?? []);
      } catch {
        /* sem protocolo: só as conversas que já existem aparecem */
      }
      await carregarResumo();
      if (vivo) definirCarregando(false);
    })();
    return () => {
      vivo = false;
    };
  }, [pacienteId, carregarResumo]);

  const linhas = useMemo(() => {
    const doProtocolo = refeicoes.map((r) => ({
      nome: r.nome,
      antiga: false,
      resumo: resumo.find((x) => mesmaRefeicao(x.refeicao, r.nome)) ?? null,
    }));
    const noProtocolo = new Set(refeicoes.map((r) => chaveDaRefeicao(r.nome)));
    const antigas = resumo
      .filter((x) => !noProtocolo.has(chaveDaRefeicao(x.refeicao)))
      .map((x) => ({ nome: x.refeicao, antiga: true, resumo: x }));
    return [...doProtocolo, ...antigas];
  }, [refeicoes, resumo]);

  return (
    <section className="c-secao">
      <h2 className="c-secao-titulo">Conversas por refeição</h2>
      <p className="c-dica" style={{ marginTop: 0 }}>
        Uma conversa para cada refeição do plano. A paciente escreve pelo botão “Conversar” no
        protocolo dela; aqui você lê e responde.
      </p>

      {erro && (
        <div className="c-aviso c-aviso-erro" role="alert">
          <span>{erro}</span>
        </div>
      )}
      {carregando && <p className="c-dica">Carregando…</p>}
      {!carregando && linhas.length === 0 && (
        <p className="c-dica">
          Esta paciente ainda não tem protocolo publicado nem conversa. Quando publicar, as
          refeições aparecem aqui.
        </p>
      )}

      {linhas.map((l) => (
        <button
          key={chaveDaRefeicao(l.nome)}
          type="button"
          className="c-lista-item"
          style={{ width: "100%", textAlign: "left" }}
          onClick={() => definirAberta(l.nome)}
        >
          <span>
            <span className="c-lista-item-nome">
              <Icone nome="conversa" tamanho={15} style={{ verticalAlign: "-2px", marginRight: 6 }} />
              {l.nome}
              {l.antiga && <span className="c-dica"> · refeição antiga</span>}
            </span>
            <span className="c-lista-item-apoio">
              {l.resumo
                ? `${l.resumo.total} ${l.resumo.total === 1 ? "mensagem" : "mensagens"}${
                    l.resumo.ultimoAutor === "paciente" ? " · a última foi dela" : ""
                  }`
                : "Sem conversa ainda"}
            </span>
          </span>
          <span className="c-lista-item-direita">
            {l.resumo && l.resumo.naoLidas > 0 ? (
              <span className="c-conversar-bolinha" aria-label={`${l.resumo.naoLidas} novas`}>
                {l.resumo.naoLidas}
              </span>
            ) : (
              "›"
            )}
          </span>
        </button>
      ))}

      {aberta && (
        <ConversaDaRefeicao
          refeicao={aberta}
          pacienteId={pacienteId}
          aoFechar={() => {
            definirAberta(null);
            void carregarResumo();
          }}
          aoMudar={carregarResumo}
        />
      )}
    </section>
  );
}
