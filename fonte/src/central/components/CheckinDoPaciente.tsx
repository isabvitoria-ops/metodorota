import { Fragment, useEffect, useState } from "react";
import type { QuestionarioDoPaciente } from "@/central/types/questionario";
import { Link } from "react-router-dom";
import { repositorio } from "@/central/dados/repositorio";
import { rotas } from "@/central/rotas";
import { valorNaEscala, pontuacaoDoEnvio, pontuacaoPorEixo } from "@/central/utils/pontuacaoQuestionario";
import { carinhaDe, setaDaVariacao } from "@/central/utils/carinhaDaResposta";
import { GraficoDaPergunta } from "./GraficoDaPergunta";

/**
 * O histórico longitudinal de check-in, no prontuário.
 *
 * CARD POR SEMANA em vez de tabela, porque os modelos novos (Estética,
 * Intestino, GLP-1) usam emoji, escolha e número — tipos que não cabiam
 * em colunas de uma tabela rasa. Cada card mostra:
 *   1. Score geral com barra colorida + variação
 *   2. Quebra por eixo sempre visível (sono, digestão…)
 *   3. "Ver respostas" expande todas as perguntas com a resposta exata
 *   4. Texto livre da paciente embaixo
 *
 * A CARINHA MOSTRA O VALOR JÁ INVERTIDO. Em "quanta dor", 2 é semana boa e
 * aparece como rosto contente.
 *
 * NENHUM VEREDITO. O card mostra "75%" e "+25", nunca "melhorou".
 *
 * AS MAIS NOVAS EM CIMA.
 */
function diaCurto(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : iso;
}

export function CheckinDoPaciente({ pacienteId }: { pacienteId: string }) {
  const [lista, definirLista] = useState<QuestionarioDoPaciente[]>([]);
  const [carregando, definirCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    definirCarregando(true);
    void (async () => {
      try {
        const qs = await repositorio.questionariosDoPaciente(pacienteId);
        if (vivo) definirLista(qs);
      } catch {
        if (vivo) definirLista([]);
      } finally {
        if (vivo) definirCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [pacienteId]);

  const comResposta = lista.filter((q) => q.envios.length > 0);
  if (carregando) return <p className="c-contagem">Carregando os questionários…</p>;

  return (
    <>
      <ModelosDaPaciente
        pacienteId={pacienteId}
        lista={lista}
        aoMudar={(id, atribuido, ocultas) =>
          definirLista((atual) =>
            atual.map((q) =>
              q.id === id
                ? { ...q, atribuido, ...(ocultas !== undefined ? { perguntasOcultas: ocultas } : {}) }
                : q,
            ),
          )
        }
      />
      {comResposta.map((q) => (
        <TabelaDoQuestionario key={q.id} questionario={q} />
      ))}
    </>
  );
}

/**
 * Qual modelo de check-in esta paciente responde — escolhido daqui mesmo.
 *
 * É o caminho de "entrou paciente nova e ela se encaixa naquele modelo":
 * ela já está no prontuário, marca o modelo e pronto, sem ir a outra tela
 * procurar o nome numa lista. Mostra os modelos ligados e, dos desligados,
 * só o que esta paciente ainda tem marcado (para poder desmarcar).
 */
function ModelosDaPaciente({
  pacienteId,
  lista,
  aoMudar,
}: {
  pacienteId: string;
  lista: QuestionarioDoPaciente[];
  aoMudar: (id: string, atribuido: boolean, ocultas?: string[]) => void;
}) {
  const [aviso, definirAviso] = useState<string | null>(null);
  const [erro, definirErro] = useState<string | null>(null);
  const [ocupado, definirOcupado] = useState<string | null>(null);
  const [expandido, definirExpandido] = useState<string | null>(null);
  const visiveis = lista.filter((q) => q.ativo || q.atribuido);

  async function alternar(q: QuestionarioDoPaciente) {
    definirOcupado(q.id);
    definirErro(null);
    try {
      const estado = await repositorio.definirQuestionarioDoPaciente(q.id, pacienteId, !q.atribuido);
      aoMudar(q.id, estado);
      if (!estado) definirExpandido(null);
      definirAviso(estado ? `"${q.titulo}" liberado para ela.` : `"${q.titulo}" desligado para ela.`);
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui mudar.");
    } finally {
      definirOcupado(null);
    }
  }

  async function alternarPergunta(q: QuestionarioDoPaciente, codigo: string) {
    const ocultas = q.perguntasOcultas ?? [];
    const novas = ocultas.includes(codigo)
      ? ocultas.filter((c) => c !== codigo)
      : [...ocultas, codigo];
    definirOcupado(q.id);
    definirErro(null);
    try {
      await repositorio.ocultarPerguntasCheckin(q.id, pacienteId, novas);
      aoMudar(q.id, q.atribuido, novas);
      definirAviso(null);
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      definirOcupado(null);
    }
  }

  const perguntasComCodigo = (q: QuestionarioDoPaciente) =>
    q.perguntas.filter((p) => p.codigo && p.ativa !== false);

  return (
    <section className="c-secao">
      <h2 className="c-secao-titulo">Check-in</h2>
      {visiveis.length === 0 ? (
        <p className="c-dica" style={{ marginTop: 0 }}>
          Nenhum modelo de check-in criado ainda.{" "}
          <Link to={rotas.adminQuestionarios}>Criar um modelo</Link>
        </p>
      ) : (
        <>
          <p className="c-dica" style={{ marginTop: 0 }}>
            Marque o modelo que ela responde. Vale na hora. Para criar ou mudar um modelo,{" "}
            <Link to={rotas.adminQuestionarios}>vá em Check-in</Link>.
          </p>
          {visiveis.map((q) => {
            const comCodigo = perguntasComCodigo(q);
            const ocultas = q.perguntasOcultas ?? [];
            const aberto = expandido === q.id;
            return (
              <Fragment key={q.id}>
                <label className="c-acesso-linha">
                  <input
                    type="checkbox"
                    checked={q.atribuido}
                    disabled={ocupado === q.id}
                    onChange={() => void alternar(q)}
                  />
                  <span>
                    {q.titulo}
                    <span className="c-dica" style={{ display: "block", margin: 0 }}>
                      {q.periodicidade === "semanal" ? "Toda semana" : "Uma vez só"} ·{" "}
                      {q.perguntas.length} {q.perguntas.length === 1 ? "pergunta" : "perguntas"}
                      {ocultas.length > 0 && ` · ${ocultas.length} oculta${ocultas.length > 1 ? "s" : ""}`}
                      {!q.ativo && " · modelo desligado"}
                    </span>
                  </span>
                </label>
                {q.atribuido && comCodigo.length > 0 && (
                  <div style={{ marginLeft: "1.75rem", marginBottom: "0.5rem" }}>
                    <button
                      type="button"
                      className="c-botao-texto"
                      onClick={() => definirExpandido(aberto ? null : q.id)}
                    >
                      {aberto ? "Fechar perguntas" : "Personalizar perguntas"}
                    </button>
                    {aberto && (
                      <div style={{ marginTop: "0.5rem" }}>
                        <p className="c-dica" style={{ margin: "0 0 0.5rem" }}>
                          Desmarque as perguntas que esta paciente não precisa responder.
                        </p>
                        {comCodigo.map((p) => {
                          const oculta = ocultas.includes(p.codigo!);
                          return (
                            <label
                              key={p.codigo}
                              className="c-acesso-linha"
                              style={{ fontSize: "0.875rem" }}
                            >
                              <input
                                type="checkbox"
                                checked={!oculta}
                                disabled={ocupado === q.id}
                                onChange={() => void alternarPergunta(q, p.codigo!)}
                              />
                              <span>
                                <strong>{p.codigo}</strong> {p.texto}
                                {p.modulo && (
                                  <span className="c-dica" style={{ display: "inline", marginLeft: "0.25rem" }}>
                                    ({p.modulo})
                                  </span>
                                )}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </Fragment>
            );
          })}
        </>
      )}
      {(aviso || erro) && (
        <div className={`c-aviso ${erro ? "c-aviso-erro" : "c-aviso-ok"}`} role="status">
          <span>{erro ?? aviso}</span>
        </div>
      )}
    </section>
  );
}

/* -----------------------------------------------------------------------
   Helpers da visualização
   ----------------------------------------------------------------------- */

function respostaTexto(
  tipo: string,
  r: { numero: number | null; texto: string | null } | undefined,
): string {
  if (!r) return "—";
  switch (tipo) {
    case "escala":
      return r.numero !== null ? `${r.numero}/10` : "—";
    case "sim_nao":
      return r.numero !== null ? (r.numero > 0 ? "Sim" : "Não") : "—";
    case "emoji":
    case "escolha":
    case "multipla_escolha":
      return r.texto || "—";
    case "numero":
    case "metrica":
      return r.numero !== null ? String(r.numero) : "—";
    case "estrelas": {
      if (r.numero === null) return "—";
      const n = Math.max(0, Math.min(Math.round(r.numero), 5));
      return "★".repeat(n) + "☆".repeat(5 - n);
    }
    case "texto":
      return r.texto || "—";
    default:
      return "—";
  }
}

function classeDaNota(nota: number): string {
  if (nota <= 20) return "nota-critica";
  if (nota <= 40) return "nota-baixa";
  if (nota <= 60) return "nota-media";
  if (nota <= 80) return "nota-alta";
  return "nota-otima";
}

/* -----------------------------------------------------------------------
   Card por semana
   ----------------------------------------------------------------------- */

function TabelaDoQuestionario({ questionario }: { questionario: QuestionarioDoPaciente }) {
  const [revisados, definirRevisados] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(questionario.envios.map((e) => [e.id, e.revisado])),
  );
  const [erro, definirErro] = useState<string | null>(null);
  const [expandido, definirExpandido] = useState<string | null>(null);

  const cronologica = [...questionario.envios].sort((a, b) =>
    a.periodo.localeCompare(b.periodo),
  );
  const notas = new Map(
    cronologica.map((e) => [e.id, pontuacaoDoEnvio(questionario.perguntas, e)]),
  );
  const variacoes = new Map<string, number | null>();
  let anterior: number | null = null;
  for (const e of cronologica) {
    const nota = notas.get(e.id) ?? null;
    variacoes.set(e.id, nota !== null && anterior !== null ? nota - anterior : null);
    if (nota !== null) anterior = nota;
  }

  const linhas = [...cronologica].reverse();
  const semanal = questionario.periodicidade === "semanal";

  const perguntasVisiveis = questionario.perguntas.filter(
    (p) => p.tipo !== "texto" && p.ativa !== false,
  );
  const perguntasTexto = questionario.perguntas.filter(
    (p) => p.tipo === "texto" && p.ativa !== false,
  );

  async function alternarRevisado(envioId: string) {
    const novo = !revisados[envioId];
    definirRevisados({ ...revisados, [envioId]: novo });
    try {
      const estado = await repositorio.marcarRevisado(envioId, novo);
      definirRevisados((atual) => ({ ...atual, [envioId]: estado }));
    } catch (e) {
      definirRevisados((atual) => ({ ...atual, [envioId]: !novo }));
      definirErro(e instanceof Error ? e.message : "Não consegui marcar.");
    }
  }

  return (
    <section className="c-secao">
      <h2 className="c-secao-titulo">{questionario.titulo}</h2>

      {!questionario.atribuido && (
        <p className="c-dica" style={{ marginTop: 0 }}>
          Este questionário não está mais atribuído a ela. O histórico continua aqui.
        </p>
      )}

      {erro && (
        <div className="c-aviso c-aviso-erro" role="status">
          <span>{erro}</span>
        </div>
      )}

      <div className="c-checkin-cards">
        {linhas.map((envio) => {
          const nota = notas.get(envio.id) ?? null;
          const variacao = variacoes.get(envio.id) ?? null;
          const eixos = pontuacaoPorEixo(questionario.perguntas, envio).filter(
            (e) => e.nota !== null,
          );
          const aberto = expandido === envio.id;
          const porId = new Map(envio.respostas.map((r) => [r.perguntaId, r]));
          const respondidas = envio.respostas.filter(
            (r) => r.numero !== null || (r.texto ?? "") !== "",
          ).length;
          const total = perguntasVisiveis.length + perguntasTexto.length;

          const textos = perguntasTexto
            .map((p) => ({ p, texto: (porId.get(p.id)?.texto ?? "").trim() }))
            .filter((x) => x.texto !== "");

          return (
            <div key={envio.id} className="c-checkin-card">
              <div className="c-checkin-card-cabecalho">
                <span className="c-checkin-card-data">
                  {semanal ? `Sem. ${diaCurto(envio.periodo)}` : diaCurto(envio.periodo)}
                </span>
                <label className="c-checkin-revisado-label">
                  <input
                    type="checkbox"
                    checked={revisados[envio.id] ?? false}
                    onChange={() => void alternarRevisado(envio.id)}
                  />
                  <span>Revisado</span>
                </label>
              </div>

              {nota !== null && (
                <div className="c-checkin-score">
                  <div className="c-checkin-score-cabecalho">
                    <strong className="c-checkin-score-numero">{nota}%</strong>
                    {variacao !== null && (
                      <span className="c-checkin-score-variacao">
                        {setaDaVariacao(variacao)}
                      </span>
                    )}
                  </div>
                  <div className="c-checkin-barra">
                    <div
                      className={`c-checkin-barra-preencher ${classeDaNota(nota)}`}
                      style={{ width: `${nota}%` }}
                    />
                  </div>
                </div>
              )}

              {eixos.length > 1 && (
                <div className="c-checkin-eixos">
                  {eixos.map((e) => (
                    <div key={e.eixoId ?? "sem"} className="c-checkin-eixo-linha">
                      <div className="c-checkin-eixo-rotulo">
                        <span>{e.eixoNome}</span>
                        <strong>{e.nota}%</strong>
                      </div>
                      <div className="c-checkin-barra c-checkin-barra-mini">
                        <div
                          className={`c-checkin-barra-preencher ${classeDaNota(e.nota!)}`}
                          style={{ width: `${e.nota}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                className="c-botao-texto c-checkin-expandir"
                onClick={() => definirExpandido(aberto ? null : envio.id)}
                aria-expanded={aberto}
              >
                {aberto
                  ? "▾ Fechar respostas"
                  : `▸ Respostas (${respondidas} de ${total})`}
              </button>

              {aberto && (
                <div className="c-checkin-respostas">
                  {perguntasVisiveis.map((p) => {
                    const r = porId.get(p.id);
                    const texto = respostaTexto(p.tipo, r);
                    const valor = valorNaEscala(
                      {
                        id: p.id, tipo: p.tipo, peso: p.peso || 1,
                        invertida: p.invertida, opcoes: p.opcoes,
                        pontosOpcoes: p.pontosOpcoes,
                      },
                      r ? { perguntaId: r.perguntaId, numero: r.numero, texto: r.texto } : undefined,
                    );
                    const carinha = carinhaDe(valor);
                    const semResposta = texto === "—";
                    return (
                      <div
                        key={p.id}
                        className={`c-checkin-qa${semResposta ? " c-checkin-qa-vazia" : ""}`}
                      >
                        <div className="c-checkin-qa-topo">
                          {carinha && (
                            <span
                              className={`c-carinha-mini nivel-${carinha.nivel}`}
                              title={carinha.descricao}
                            >
                              {carinha.rosto}
                            </span>
                          )}
                          <span className="c-checkin-qa-pergunta">
                            {p.codigo && (
                              <span className="c-checkin-qa-codigo">{p.codigo}</span>
                            )}
                            {p.texto}
                          </span>
                        </div>
                        <div className="c-checkin-qa-valor">{texto}</div>
                      </div>
                    );
                  })}
                  {textos.map(({ p, texto }) => (
                    <div key={p.id} className="c-checkin-qa c-checkin-qa-livre">
                      <div className="c-checkin-qa-pergunta">
                        {p.codigo && (
                          <span className="c-checkin-qa-codigo">{p.codigo}</span>
                        )}
                        {p.texto}
                      </div>
                      <div className="c-checkin-qa-valor c-checkin-qa-texto-livre">
                        &ldquo;{texto}&rdquo;
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!aberto && textos.length > 0 && (
                <div className="c-checkin-textos">
                  {textos.map(({ p, texto }) => (
                    <p key={p.id} className="c-checkin-texto-item">
                      <strong>{p.texto}</strong> {texto}
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <GraficoDaPergunta questionario={questionario} />
    </section>
  );
}
