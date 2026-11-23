import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { repositorio } from "@/central/dados/repositorio";
import { rotas } from "@/central/rotas";
import { Esqueleto } from "@/central/components/Esqueleto";
import { hojeSaoPaulo } from "@/central/utils/situacao";
import type { Paciente } from "@/central/types";
import type { AgendaDoPeriodo, EventoParaSalvar, TipoDeEvento } from "@/central/types/agenda";
import { REPETICOES, TIPOS_DE_EVENTO } from "@/central/types/agenda";
import type { OcorrenciaDaAgenda, Repeticao } from "@/central/types/agenda";
import {
  diaPorExtenso,
  itensDoDia,
  ocorrenciasNoPeriodo,
  rotuloDaRepeticao,
  nomeDoMes,
  periodoDaGrade,
  problemasDoEvento,
  rotuloDoTipo,
  semanasDoMes,
} from "@/central/utils/agenda";

/**
 * Agenda da nutricionista (0097). Só ela vê — nem a paciente da consulta.
 *
 * O mês em grade e, embaixo (ou ao lado, no computador), o dia escolhido.
 * As consultas que ela marca no prontuário aparecem aqui sozinhas, só para
 * leitura: quem muda consulta é o prontuário, para não existirem dois lugares
 * com a mesma informação.
 */
const DIAS = ["D", "S", "T", "Q", "Q", "S", "S"];

const novo = (data: string): EventoParaSalvar => ({
  id: null,
  titulo: "",
  tipo: "pessoal",
  data,
  horaInicio: null,
  horaFim: null,
  local: null,
  observacao: null,
  pacienteId: null,
  repete: "nao",
  diasSemana: [],
  repeteAte: null,
  excecoes: [],
});

export function Agenda() {
  const hoje = hojeSaoPaulo();
  const [ano, definirAno] = useState(() => Number(hoje.slice(0, 4)));
  const [mes, definirMes] = useState(() => Number(hoje.slice(5, 7)) - 1);
  const [dia, definirDia] = useState(hoje);
  const [agenda, definirAgenda] = useState<AgendaDoPeriodo | null>(null);
  const [erroCarga, definirErroCarga] = useState(false);
  const [pacientes, definirPacientes] = useState<Paciente[]>([]);
  const [rascunho, definirRascunho] = useState<EventoParaSalvar | null>(null);
  const [salvando, definirSalvando] = useState(false);
  const [recado, definirRecado] = useState<string | null>(null);
  // O dia da grade em que ela tocou, quando o compromisso se repete: é o dia
  // que "Apagar só este dia" tira.
  const [diaDaOcorrencia, definirDiaDaOcorrencia] = useState<string | null>(null);

  const semanas = useMemo(() => semanasDoMes(ano, mes), [ano, mes]);

  const carregar = useCallback(async () => {
    const { de, ate } = periodoDaGrade(ano, mes);
    try {
      const bruta = await repositorio.agendaDoPeriodo(de, ate);
      // Os que se repetem viram um item por dia (0099).
      definirAgenda({ ...bruta, eventos: ocorrenciasNoPeriodo(bruta.eventos, de, ate) });
      definirErroCarga(false);
    } catch {
      definirErroCarga(true);
    }
  }, [ano, mes]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    repositorio
      .listarPacientes()
      .then(definirPacientes)
      .catch(() => undefined);
  }, []);

  function andar(passo: -1 | 1) {
    const m = mes + passo;
    const a = ano + Math.floor(m / 12);
    const mm = ((m % 12) + 12) % 12;
    definirAno(a);
    definirMes(mm);
    definirDia(`${a}-${String(mm + 1).padStart(2, "0")}-01`);
    definirRascunho(null);
  }

  function irParaHoje() {
    definirAno(Number(hoje.slice(0, 4)));
    definirMes(Number(hoje.slice(5, 7)) - 1);
    definirDia(hoje);
    definirRascunho(null);
  }

  function escolher(d: string) {
    definirDia(d);
    definirRascunho(null);
    definirRecado(null);
    const m = Number(d.slice(5, 7)) - 1;
    if (m !== mes) {
      definirAno(Number(d.slice(0, 4)));
      definirMes(m);
    }
  }

  const mudar = (parte: Partial<EventoParaSalvar>) => definirRascunho((r) => (r ? { ...r, ...parte } : r));
  const falta = rascunho ? problemasDoEvento(rascunho) : [];

  async function salvar() {
    if (!rascunho || falta.length) return;
    definirSalvando(true);
    try {
      await repositorio.salvarEventoDaAgenda(rascunho);
      definirRecado("Salvo na agenda.");
      definirDia(rascunho.data);
      definirRascunho(null);
      await carregar();
    } catch (e) {
      definirRecado(e instanceof Error ? e.message : "Não consegui salvar.");
    } finally {
      definirSalvando(false);
    }
  }

  async function apagar() {
    if (!rascunho?.id) return;
    definirSalvando(true);
    try {
      await repositorio.apagarEventoDaAgenda(rascunho.id);
      definirRecado("Compromisso apagado.");
      definirRascunho(null);
      await carregar();
    } catch (e) {
      definirRecado(e instanceof Error ? e.message : "Não consegui apagar.");
    } finally {
      definirSalvando(false);
    }
  }

  async function apagarSoEsteDia() {
    if (!rascunho?.id || !diaDaOcorrencia) return;
    definirSalvando(true);
    try {
      await repositorio.salvarEventoDaAgenda({ ...rascunho, excecoes: [...rascunho.excecoes, diaDaOcorrencia] });
      definirRecado("Apagado só neste dia. Os outros continuam.");
      definirRascunho(null);
      await carregar();
    } catch (e) {
      definirRecado(e instanceof Error ? e.message : "Não consegui apagar.");
    } finally {
      definirSalvando(false);
    }
  }

  const doDia = agenda ? itensDoDia(agenda, dia) : [];
  const nomeDaPaciente = (id: string | null) => pacientes.find((p) => p.id === id)?.nome ?? null;

  return (
    <div className="c-ag">
      <div>
        <h1 className="c-titulo">Agenda</h1>
        <p className="c-subtitulo">Só você vê. Consultas, visitas e compromissos pessoais num lugar só.</p>
      </div>

      {erroCarga && (
        <div className="c-aviso c-aviso-erro" role="alert">
          Não consegui abrir a agenda. Recarregue a página.
        </div>
      )}

      <div className="c-ag-grade">
        <section className="c-bloco c-ag-mes" aria-label="Mês">
          <div className="c-ag-mes-topo">
            <button type="button" className="c-ag-seta" onClick={() => andar(-1)} aria-label="Mês anterior">
              ‹
            </button>
            <h2 className="c-ag-mes-nome">{nomeDoMes(ano, mes)}</h2>
            <button type="button" className="c-ag-seta" onClick={() => andar(1)} aria-label="Próximo mês">
              ›
            </button>
            <button type="button" className="c-botao c-botao-secundario c-botao-pequeno c-ag-hoje" onClick={irParaHoje}>
              Hoje
            </button>
          </div>
          <div className="c-ag-semana" aria-hidden="true">
            {DIAS.map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
          {agenda === null && !erroCarga ? (
            <Esqueleto linhas={5} />
          ) : (
            <div className="c-ag-dias" role="grid">
              {semanas.flat().map((d) => {
                const itens = agenda ? itensDoDia(agenda, d) : [];
                const fora = Number(d.slice(5, 7)) - 1 !== mes;
                return (
                  <button
                    key={d}
                    type="button"
                    role="gridcell"
                    aria-selected={d === dia}
                    aria-label={`${diaPorExtenso(d)}${itens.length ? `, ${itens.length} na agenda` : ""}`}
                    className={`c-ag-dia${fora ? " c-ag-dia--fora" : ""}${d === hoje ? " c-ag-dia--hoje" : ""}${d === dia ? " c-ag-dia--escolhido" : ""}`}
                    onClick={() => escolher(d)}
                  >
                    <span className="c-ag-num">{Number(d.slice(8, 10))}</span>
                    <span className="c-ag-pontos">
                      {itens.slice(0, 4).map((it, i) => (
                        <i key={i} className={`c-ag-ponto c-ag-tipo-${it.tipo === "consulta" ? "consulta" : it.evento.tipo}`} />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="c-ag-legenda">
            {TIPOS_DE_EVENTO.map((t) => (
              <span key={t.valor}>
                <i className={`c-ag-ponto c-ag-tipo-${t.valor}`} />
                {t.rotulo}
              </span>
            ))}
          </div>
        </section>

        <section className="c-bloco c-ag-diario" aria-label="Dia escolhido">
          <div className="c-ag-dia-topo">
            <h2 className="c-ag-dia-nome">{diaPorExtenso(dia)}</h2>
            {!rascunho && (
              <button type="button" className="c-botao c-botao-pequeno" onClick={() => {
                  definirDiaDaOcorrencia(null);
                  definirRascunho(novo(dia));
                }}>
                + Novo
              </button>
            )}
          </div>
          {recado && <p className="c-ag-recado">{recado}</p>}

          {!rascunho && doDia.length === 0 && agenda && <p className="c-ag-vazio">Nada marcado neste dia.</p>}

          {!rascunho && (
            <ul className="c-ag-lista">
              {doDia.map((it) =>
                it.tipo === "consulta" ? (
                  <li key={`c-${it.consulta.id}`} className="c-ag-item">
                    <i className="c-ag-ponto c-ag-tipo-consulta" />
                    <span className="c-ag-hora">{it.hora ?? "dia todo"}</span>
                    <span className="c-ag-texto">
                      <strong>
                        {it.consulta.tipo === "primeira" ? "Primeira consulta" : "Retorno"} · {it.consulta.pacienteNome}
                      </strong>
                      <small>
                        Do prontuário ·{" "}
                        <Link className="c-link" to={rotas.adminPaciente(it.consulta.pacienteId)}>
                          abrir
                        </Link>
                      </small>
                    </span>
                  </li>
                ) : (
                  <li key={it.evento.id} className="c-ag-item">
                    <i className={`c-ag-ponto c-ag-tipo-${it.evento.tipo}`} />
                    <span className="c-ag-hora">
                      {it.evento.horaInicio ? `${it.evento.horaInicio}${it.evento.horaFim ? `–${it.evento.horaFim}` : ""}` : "dia todo"}
                    </span>
                    <button
                      type="button"
                      className="c-ag-texto c-ag-editar"
                      onClick={() => {
                        const { origem, ...ev } = it.evento as OcorrenciaDaAgenda;
                        definirDiaDaOcorrencia(ev.repete !== "nao" ? ev.data : null);
                        // A edição vale para o compromisso inteiro: volta para o primeiro dia.
                        definirRascunho({ ...ev, data: origem ?? ev.data });
                      }}
                    >
                      <strong>{it.evento.titulo}</strong>
                      <small>
                        {[rotuloDoTipo(it.evento.tipo), it.evento.local, nomeDaPaciente(it.evento.pacienteId)].filter(Boolean).join(" · ")}
                      </small>
                      {rotuloDaRepeticao(it.evento) && <small>Repete {rotuloDaRepeticao(it.evento)}</small>}
                      {it.evento.observacao && <small className="c-ag-obs">{it.evento.observacao}</small>}
                    </button>
                  </li>
                ),
              )}
            </ul>
          )}

          {rascunho && (
            <form
              className="c-ag-form"
              onSubmit={(e) => {
                e.preventDefault();
                void salvar();
              }}
            >
              <label className="c-campo">
                <span className="c-rotulo">O quê</span>
                <input
                  className="c-input"
                  value={rascunho.titulo}
                  placeholder="Ex.: Visita à clínica, dentista, gravar vídeos"
                  onChange={(e) => mudar({ titulo: e.target.value })}
                  autoFocus
                />
              </label>
              <div className="c-campo">
                <span className="c-rotulo">Tipo</span>
                <div className="c-ag-tipos">
                  {TIPOS_DE_EVENTO.map((t) => (
                    <button
                      key={t.valor}
                      type="button"
                      className="c-chip"
                      aria-pressed={rascunho.tipo === t.valor}
                      onClick={() => mudar({ tipo: t.valor as TipoDeEvento })}
                    >
                      <i className={`c-ag-ponto c-ag-tipo-${t.valor}`} /> {t.rotulo}
                    </button>
                  ))}
                </div>
              </div>
              <div className="c-campo">
                <span className="c-rotulo">Repete</span>
                <div className="c-ag-tipos">
                  {REPETICOES.map((r) => (
                    <button
                      key={r.valor}
                      type="button"
                      className="c-chip"
                      aria-pressed={rascunho.repete === r.valor}
                      onClick={() => mudar({ repete: r.valor as Repeticao })}
                    >
                      {r.rotulo}
                    </button>
                  ))}
                </div>
                {rascunho.repete === "semanal" && (
                  <div className="c-ag-semana-escolha" role="group" aria-label="Dias da semana">
                    {["D", "S", "T", "Q", "Q", "S", "S"].map((l, i) => {
                      const marcados = rascunho.diasSemana.length
                        ? rascunho.diasSemana
                        : [new Date(`${rascunho.data}T12:00:00Z`).getUTCDay()];
                      const ligado = marcados.includes(i);
                      return (
                        <button
                          key={i}
                          type="button"
                          className="c-chip c-ag-dia-semana"
                          aria-pressed={ligado}
                          aria-label={["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"][i]}
                          onClick={() => {
                            const novos = ligado ? marcados.filter((d) => d !== i) : [...marcados, i];
                            if (novos.length) mudar({ diasSemana: novos.sort() });
                          }}
                        >
                          {l}
                        </button>
                      );
                    })}
                  </div>
                )}
                {rascunho.repete !== "nao" && (
                  <label className="c-campo" style={{ marginTop: 8 }}>
                    <span className="c-rotulo">Até (opcional)</span>
                    <input
                      className="c-input"
                      type="date"
                      value={rascunho.repeteAte ?? ""}
                      onChange={(e) => mudar({ repeteAte: e.target.value || null })}
                    />
                  </label>
                )}
              </div>
              <div className="c-ag-linha">
                <label className="c-campo">
                  <span className="c-rotulo">{rascunho.repete === "nao" ? "Dia" : "Primeiro dia"}</span>
                  <input className="c-input" type="date" value={rascunho.data} onChange={(e) => mudar({ data: e.target.value })} />
                </label>
                <label className="c-campo">
                  <span className="c-rotulo">Começa</span>
                  <input
                    className="c-input"
                    type="time"
                    value={rascunho.horaInicio ?? ""}
                    onChange={(e) => mudar({ horaInicio: e.target.value || null, ...(e.target.value ? {} : { horaFim: null }) })}
                  />
                </label>
                <label className="c-campo">
                  <span className="c-rotulo">Termina</span>
                  <input
                    className="c-input"
                    type="time"
                    value={rascunho.horaFim ?? ""}
                    disabled={!rascunho.horaInicio}
                    onChange={(e) => mudar({ horaFim: e.target.value || null })}
                  />
                </label>
              </div>
              <p className="c-ag-dica">Sem hora, fica marcado o dia todo.</p>
              <label className="c-campo">
                <span className="c-rotulo">Onde (opcional)</span>
                <input className="c-input" value={rascunho.local ?? ""} onChange={(e) => mudar({ local: e.target.value || null })} />
              </label>
              {pacientes.length > 0 && (
                <label className="c-campo">
                  <span className="c-rotulo">Paciente (opcional)</span>
                  <select
                    className="c-select"
                    value={rascunho.pacienteId ?? ""}
                    onChange={(e) => mudar({ pacienteId: e.target.value || null })}
                  >
                    <option value="">Nenhuma</option>
                    {pacientes.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="c-campo">
                <span className="c-rotulo">Anotação (opcional)</span>
                <textarea
                  className="c-textarea"
                  rows={2}
                  value={rascunho.observacao ?? ""}
                  onChange={(e) => mudar({ observacao: e.target.value || null })}
                />
              </label>
              {falta.length > 0 && rascunho.titulo !== "" && (
                <ul className="c-ag-falta">
                  {falta.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              )}
              <div className="c-ag-acoes">
                <button type="submit" className="c-botao" disabled={salvando || falta.length > 0}>
                  {salvando ? "Salvando…" : "Salvar"}
                </button>
                <button type="button" className="c-botao c-botao-secundario" onClick={() => definirRascunho(null)}>
                  Cancelar
                </button>
                {rascunho.id && rascunho.repete !== "nao" && diaDaOcorrencia && (
                  <button type="button" className="c-link c-ag-apagar" onClick={() => void apagarSoEsteDia()} disabled={salvando}>
                    Apagar só este dia
                  </button>
                )}
                {rascunho.id && (
                  <button type="button" className="c-link c-ag-apagar" onClick={() => void apagar()} disabled={salvando}>
                    {rascunho.repete !== "nao" ? "Apagar todos os dias" : "Apagar"}
                  </button>
                )}
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
