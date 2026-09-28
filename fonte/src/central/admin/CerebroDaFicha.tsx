import { useCallback, useEffect, useMemo, useState } from "react";
import { repositorio } from "@/central/dados/repositorio";
import type { SugestaoDoCerebro, TrechoCitado } from "@/central/types/cerebro";
import { AreaTexto, Campo, Texto } from "./componentes/Campos";

/**
 * A aba "Cérebro" da ficha da paciente.
 *
 * Fluxo por sugestão:
 *   1. A nutri escreve a pergunta sobre a paciente.
 *   2. O app busca no Cérebro e traz os trechos que se parecem.
 *   3. Sem chave de LLM configurada, os trechos vão para a tela como
 *      material de consulta — a nutri redige a conduta a partir deles.
 *      Com chave, uma resposta bruta também aparece (implementado no
 *      lote 40, das Edge Functions).
 *   4. Ela aceita, edita (grava a conduta ajustada) ou rejeita (com
 *      motivo). A decisão fica no histórico da paciente.
 *
 * O ponto de tudo isto é a MEMÓRIA ENTRE CONSULTAS: dois meses depois,
 * abrir a ficha e ver "já discutimos isto — a conduta foi X" vale por
 * meia consulta relida.
 */
export function CerebroDaFicha({ pacienteId }: { pacienteId: string }) {
  const [pergunta, definirPergunta] = useState("");
  const [buscando, definirBuscando] = useState(false);
  const [trechos, definirTrechos] = useState<TrechoCitado[]>([]);
  const [ultimaPergunta, definirUltimaPergunta] = useState("");
  const [conduta, definirConduta] = useState("");
  const [salvando, definirSalvando] = useState(false);
  const [aviso, definirAviso] = useState<string | null>(null);
  const [sugestoes, definirSugestoes] = useState<SugestaoDoCerebro[]>([]);

  const carregarHistorico = useCallback(async () => {
    try {
      definirSugestoes(await repositorio.sugestoesDoPaciente(pacienteId));
    } catch (e) {
      definirAviso((e as Error).message);
    }
  }, [pacienteId]);

  useEffect(() => {
    void carregarHistorico();
  }, [carregarHistorico]);

  async function buscar() {
    if (!pergunta.trim()) return;
    definirAviso(null);
    definirBuscando(true);
    try {
      const t = await repositorio.buscarNoCerebro(pergunta);
      definirTrechos(t);
      definirUltimaPergunta(pergunta);
      if (t.length === 0) {
        definirAviso("O Cérebro não achou nada sobre isto. Talvez ainda não tenha material dessa área.");
      }
    } catch (e) {
      definirAviso((e as Error).message);
    } finally {
      definirBuscando(false);
    }
  }

  async function salvarConduta(feedback: "aceita" | "editada" | "rejeitada") {
    if (!ultimaPergunta.trim()) {
      definirAviso("Faça a pergunta antes de salvar a conduta.");
      return;
    }
    if (feedback !== "rejeitada" && !conduta.trim()) {
      definirAviso("Escreva a conduta antes de salvar.");
      return;
    }
    definirSalvando(true);
    try {
      // Sem LLM ainda, `resposta` fica nula: a conduta escrita por ela é o
      // que vale. Quando a Edge Function de LLM entrar, registrará a
      // resposta bruta antes desta chamada, e a nutri dá feedback sobre ela.
      const id = await repositorio.registrarSugestao(
        pacienteId,
        ultimaPergunta,
        null,
        trechos,
      );
      const motivo = feedback === "rejeitada" ? conduta.trim() || null : null;
      const condutaFinal = feedback === "rejeitada" ? null : conduta.trim();
      await repositorio.darFeedbackSugestao(id, feedback, condutaFinal, motivo);

      definirPergunta("");
      definirConduta("");
      definirTrechos([]);
      definirUltimaPergunta("");
      definirAviso("Guardado.");
      await carregarHistorico();
    } catch (e) {
      definirAviso((e as Error).message);
    } finally {
      definirSalvando(false);
    }
  }

  const historicoOrdenado = useMemo(
    () => [...sugestoes].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)),
    [sugestoes],
  );

  return (
    <>
      <section className="c-bloco">
        <h2>Pergunta ao Cérebro</h2>
        <p className="c-dica" style={{ marginTop: -6 }}>
          O que você quer decidir sobre esta paciente? O Cérebro busca no seu
          material e traz o que citar. Nada do que você escreve aqui aparece
          para ela.
        </p>

        <div style={{ maxWidth: 720 }}>
          <Campo rotulo="Pergunta">
            <Texto
              valor={pergunta}
              aoMudar={definirPergunta}
              placeholder="Ex.: conduta para SII com constipação e má tolerância a fibra"
            />
          </Campo>
          <button
            type="button"
            className="c-botao"
            onClick={() => void buscar()}
            disabled={buscando || !pergunta.trim()}
          >
            {buscando ? "Buscando…" : "Buscar no Cérebro"}
          </button>
        </div>

        {aviso && (
          <div
            className={`c-aviso ${aviso === "Guardado." ? "c-aviso-ok" : "c-aviso-erro"}`}
            role="status"
          >
            <span>{aviso}</span>
          </div>
        )}

        {trechos.length > 0 && (
          <>
            <h3 style={{ marginTop: 20 }}>Trechos do seu material</h3>
            <ol style={{ paddingLeft: 20 }}>
              {trechos.map((t) => (
                <li key={t.id} style={{ marginBottom: 12 }}>
                  <strong>{t.titulo}</strong>
                  {t.fonte && <span className="c-dica"> — {t.fonte}</span>}
                  <p style={{ marginTop: 4 }}>{t.trecho}</p>
                </li>
              ))}
            </ol>

            <h3 style={{ marginTop: 20 }}>Sua conduta</h3>
            <p className="c-dica" style={{ marginTop: -6 }}>
              Escreva o que você decidiu. Aceite se saiu igual, edite se ajustou,
              rejeite se o Cérebro não ajudou.
            </p>
            <div style={{ maxWidth: 720 }}>
              <Campo rotulo="Conduta">
                <AreaTexto
                  valor={conduta}
                  aoMudar={definirConduta}
                  placeholder="Ex.: baixo FODMAP por 4 semanas, dose de fibra solúvel gradual…"
                  linhas={5}
                />
              </Campo>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="c-botao"
                  onClick={() => void salvarConduta("aceita")}
                  disabled={salvando}
                >
                  Aceitar como está
                </button>
                <button
                  type="button"
                  className="c-botao c-botao-secundario"
                  onClick={() => void salvarConduta("editada")}
                  disabled={salvando}
                >
                  Salvar como editada
                </button>
                <button
                  type="button"
                  className="c-botao c-botao-secundario"
                  onClick={() => void salvarConduta("rejeitada")}
                  disabled={salvando}
                >
                  Rejeitar (motivo no campo acima)
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      <section className="c-bloco" style={{ marginTop: 18 }}>
        <h2>O que já foi discutido</h2>
        {historicoOrdenado.length === 0 ? (
          <p className="c-dica">Nada ainda. A primeira pergunta abre esta lista.</p>
        ) : (
          <ol style={{ paddingLeft: 20 }}>
            {historicoOrdenado.map((s) => (
              <li key={s.id} style={{ marginBottom: 16 }}>
                <p style={{ margin: 0 }}>
                  <strong>{s.pergunta}</strong>{" "}
                  <span className="c-dica">— {formatarData(s.criadoEm)}</span>
                </p>
                {s.feedback === "aceita" || s.feedback === "editada" ? (
                  <>
                    <p style={{ margin: "4px 0 0" }}>
                      <em>Conduta</em> ({s.feedback}): {s.condutaFinal}
                    </p>
                    {s.citacoes.length > 0 && (
                      <p className="c-dica" style={{ marginTop: 2 }}>
                        Citações: {s.citacoes.map((c) => c.titulo).join(" · ")}
                      </p>
                    )}
                  </>
                ) : s.feedback === "rejeitada" ? (
                  <p style={{ margin: "4px 0 0" }} className="c-dica">
                    Rejeitada: {s.motivo}
                  </p>
                ) : (
                  <p style={{ margin: "4px 0 0" }} className="c-dica">
                    Aguardando conduta.
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}

function formatarData(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
