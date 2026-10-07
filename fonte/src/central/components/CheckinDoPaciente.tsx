import { Fragment, useEffect, useState } from "react";
import type { QuestionarioDoPaciente } from "@/central/types/questionario";
import { Link } from "react-router-dom";
import { repositorio } from "@/central/dados/repositorio";
import { rotas } from "@/central/rotas";
import { pontuacaoDoEnvio, pontuacaoPorEixo } from "@/central/utils/pontuacaoQuestionario";
import { setaDaVariacao } from "@/central/utils/carinhaDaResposta";
import { GraficoDaPergunta } from "./GraficoDaPergunta";

/**
 * Tabela de check-in no estilo DietSystem: uma coluna por pergunta, uma
 * linha por data. A resposta aparece direto na célula, sem precisar
 * expandir. Clicar na célula abre um popup com pergunta e resposta
 * inteiras. AS MAIS NOVAS EM CIMA.
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
   Tabela por semana (estilo DietSystem)
   ----------------------------------------------------------------------- */

function TabelaDoQuestionario({ questionario }: { questionario: QuestionarioDoPaciente }) {
  const [revisados, definirRevisados] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(questionario.envios.map((e) => [e.id, e.revisado])),
  );
  const [erro, definirErro] = useState<string | null>(null);
  const [filtro, definirFiltro] = useState<"todas" | "pendentes" | "revisadas">("todas");
  const [detalhe, definirDetalhe] = useState<
    | { tipo: "celula"; pergunta: string; resposta: string }
    | { tipo: "nota"; nota: number; variacao: number | null; eixos: { nome: string; nota: number }[] }
    | null
  >(null);

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

  const colunas = questionario.perguntas.filter((p) => p.ativa !== false);
  const temNota = cronologica.some((e) => (notas.get(e.id) ?? null) !== null);

  const todasLinhas = [...cronologica].reverse();
  const linhas = todasLinhas.filter((e) => {
    if (filtro === "pendentes") return !(revisados[e.id] ?? false);
    if (filtro === "revisadas") return revisados[e.id] ?? false;
    return true;
  });
  const pendentes = todasLinhas.filter((e) => !(revisados[e.id] ?? false)).length;

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

  async function revisarTudo() {
    const ids = todasLinhas.filter((e) => !(revisados[e.id] ?? false)).map((e) => e.id);
    if (ids.length === 0) return;
    const novos = { ...revisados };
    for (const id of ids) novos[id] = true;
    definirRevisados(novos);
    try {
      for (const id of ids) await repositorio.marcarRevisado(id, true);
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui marcar todas.");
    }
  }

  return (
    <section className="c-secao">
      <div className="c-checkin-topo">
        <h2 className="c-secao-titulo" style={{ margin: 0 }}>{questionario.titulo}</h2>
        <div className="c-checkin-filtros">
          {(["todas", "pendentes", "revisadas"] as const).map((f) => (
            <button
              key={f}
              type="button"
              className="c-checkin-filtro"
              aria-pressed={filtro === f}
              onClick={() => definirFiltro(f)}
            >
              {f === "todas" ? "Todas" : f === "pendentes" ? "Pendentes" : "Revisadas"}
            </button>
          ))}
          {pendentes > 0 && (
            <button
              type="button"
              className="c-checkin-revisar-tudo"
              onClick={() => void revisarTudo()}
            >
              ✓ Revisar tudo
            </button>
          )}
        </div>
      </div>

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

      {linhas.length === 0 ? (
        <p className="c-dica">
          {filtro === "pendentes"
            ? "Nenhuma resposta pendente."
            : filtro === "revisadas"
              ? "Nenhuma resposta revisada."
              : "Nenhuma resposta enviada."}
        </p>
      ) : (
        <div className="c-checkin-scroll">
          <table className="c-checkin-tabela">
            <thead>
              <tr>
                <th className="c-checkin-th-fixo">Data</th>
                {temNota && <th className="c-checkin-th-nota">Nota</th>}
                {colunas.map((p) => (
                  <th key={p.id} title={p.texto}>{p.texto}</th>
                ))}
                <th className="c-checkin-th-rev">Revisado</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((envio) => {
                const nota = notas.get(envio.id) ?? null;
                const variacao = variacoes.get(envio.id) ?? null;
                const porId = new Map(envio.respostas.map((r) => [r.perguntaId, r]));
                const eixos = pontuacaoPorEixo(questionario.perguntas, envio)
                  .filter((e) => e.nota !== null)
                  .map((e) => ({ nome: e.eixoNome, nota: e.nota! }));

                return (
                  <tr key={envio.id}>
                    <td className="c-checkin-td-fixo">{diaCurto(envio.periodo)}</td>
                    {temNota && (
                      <td
                        className={`c-checkin-td-nota${nota !== null ? ` ${classeDaNota(nota)}` : ""}`}
                        onClick={() =>
                          nota !== null &&
                          definirDetalhe({ tipo: "nota", nota, variacao, eixos })
                        }
                      >
                        {nota !== null && (
                          <>
                            <strong>{nota}%</strong>
                            {variacao !== null && (
                              <span className="c-checkin-variacao">
                                {setaDaVariacao(variacao)}
                              </span>
                            )}
                          </>
                        )}
                      </td>
                    )}
                    {colunas.map((p) => {
                      const r = porId.get(p.id);
                      const texto = respostaTexto(p.tipo, r);
                      const vazio = texto === "—";
                      return (
                        <td
                          key={p.id}
                          className={`c-checkin-td${vazio ? " c-checkin-td-vazia" : ""}`}
                          title={vazio ? undefined : texto}
                          onClick={() =>
                            !vazio &&
                            definirDetalhe({ tipo: "celula", pergunta: p.texto, resposta: texto })
                          }
                        >
                          {vazio ? "" : texto}
                        </td>
                      );
                    })}
                    <td className="c-checkin-td-rev">
                      <input
                        type="checkbox"
                        checked={revisados[envio.id] ?? false}
                        onChange={() => void alternarRevisado(envio.id)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {detalhe && (
        <div className="c-checkin-popup-fundo" onClick={() => definirDetalhe(null)}>
          <div
            className="c-checkin-popup"
            role="dialog"
            onClick={(e) => e.stopPropagation()}
          >
            {detalhe.tipo === "celula" ? (
              <>
                <p className="c-checkin-popup-rotulo">Pergunta</p>
                <p className="c-checkin-popup-titulo">{detalhe.pergunta}</p>
                <p className="c-checkin-popup-rotulo">Resposta</p>
                <p className="c-checkin-popup-valor">{detalhe.resposta}</p>
              </>
            ) : (
              <>
                <p className="c-checkin-popup-rotulo">Nota geral</p>
                <p className="c-checkin-popup-titulo">
                  {detalhe.nota}%
                  {detalhe.variacao !== null && (
                    <span className="c-checkin-variacao" style={{ marginLeft: 8 }}>
                      {setaDaVariacao(detalhe.variacao)}
                    </span>
                  )}
                </p>
                {detalhe.eixos.length > 0 && (
                  <>
                    <p className="c-checkin-popup-rotulo">Por eixo</p>
                    {detalhe.eixos.map((e) => (
                      <div key={e.nome} className="c-checkin-popup-eixo">
                        <span>{e.nome}</span>
                        <strong>{e.nota}%</strong>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
            <button
              type="button"
              className="c-checkin-popup-fechar"
              onClick={() => definirDetalhe(null)}
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      <GraficoDaPergunta questionario={questionario} />
    </section>
  );
}
