import { Fragment, useEffect, useMemo, useState } from "react";
import type {
  CardioSessao,
  ExercicioPlanejado,
  MetaSemanal,
  PermissaoDeTreino,
  SerieParaSalvar,
  SessaoDeTreino,
  Treino,
} from "@/central/types/treino";
import { MeuTreino } from "@/central/components/MeuTreino";
import { PainelDaSemana } from "@/central/components/PainelDaSemana";
import { RegistroDeCardio } from "@/central/components/RegistroDeCardio";
import { repositorio } from "@/central/dados/repositorio";
import { dataBonita, hojeSaoPaulo } from "@/central/utils/situacao";
import { naoEntendido, numeroDeTexto } from "@/central/utils/numero";
import type { SessaoDoExercicio } from "@/central/utils/progressaoTreino";
import {
  MENSAGEM_TOPO_DA_FAIXA,
  evolucaoDoExercicio,
  recordesDe,
} from "@/central/utils/progressaoTreino";
import { Esqueleto } from "@/central/components/Esqueleto";

/**
 * A evolução de treino da paciente.
 *
 * A profissional NÃO é personal trainer, e esta tela não vira uma. Ela
 * REGISTRA, COMPARA, ORGANIZA e MOSTRA — e para por aí:
 *
 *   * não prescreve exercício, não sugere carga, não monta treino;
 *   * não chama menos repetições de regressão nem de piora. Um dia pior
 *     dormido é um dia pior dormido, e registrar não é julgar;
 *   * chegando ao topo da faixa programada, SINALIZA e manda conversar.
 *     Não propõe a próxima carga: quem decide isso é quem programou o
 *     treino.
 *
 * O que ela ensina, e é a razão de existir do card do topo: mais peso não é
 * a única forma de evoluir. 60 kg × 6 seguido de 60 kg × 7 é progressão, e
 * uma tela que só olha para a carga diria que nada aconteceu em quatro
 * sessões seguidas.
 */
export function EvolucaoTreino({ pacienteId }: { pacienteId?: string }) {
  const [treinos, definirTreinos] = useState<Treino[]>([]);
  const [sessoes, definirSessoes] = useState<SessaoDeTreino[]>([]);
  const [cardio, definirCardio] = useState<CardioSessao[]>([]);
  const [metas, definirMetas] = useState<MetaSemanal[]>([]);
  const [permissao, definirPermissao] = useState<PermissaoDeTreino | null>(null);
  const [carregando, definirCarregando] = useState(true);
  const [registrando, definirRegistrando] = useState<Treino | null>(null);

  const daNutri = Boolean(pacienteId);

  const carregar = useMemo(
    () => async () => {
      const [ts, s, c, m, p] = await Promise.all([
        daNutri ? Promise.resolve([]) : repositorio.meusTreinos(),
        repositorio.sessoesDeTreino(pacienteId ?? null),
        repositorio.sessoesDeCardio(pacienteId ?? null),
        repositorio.metasSemanais(pacienteId ?? null),
        daNutri ? Promise.resolve(null) : repositorio.possoEscreverTreino(),
      ]);
      if (!daNutri) {
        definirTreinos(ts);
        definirPermissao(p);
      }
      definirSessoes(s);
      definirCardio(c);
      definirMetas(m);
    },
    [daNutri, pacienteId],
  );

  useEffect(() => {
    let vivo = true;
    void carregar()
      .catch(() => vivo && definirSessoes([]))
      .finally(() => vivo && definirCarregando(false));
    return () => {
      vivo = false;
    };
  }, [carregar]);

  if (carregando) return <Esqueleto />;

  const treino = treinos.length > 0 ? treinos[0]! : null;
  const exercicios = nomesDeExercicioMulti(treinos, sessoes);

  return (
    <>
      <PainelDaSemana metas={metas} treinos={sessoes} cardio={cardio} />

      <ComoVoceEvolui />

      {!daNutri && treinos.length > 0 && treinos.map((t) => (
        <PlanoDoTreino key={t.id} treino={t} aoRegistrar={() => definirRegistrando(t)} />
      ))}

      {!daNutri && <MeuTreino treino={treino} permissao={permissao} aoMudar={carregar} />}

      {registrando && (
        <RegistrarSessao
          treino={registrando}
          aoFechar={() => definirRegistrando(null)}
          aoSalvar={async () => {
            definirRegistrando(null);
            await carregar();
          }}
        />
      )}

      <RegistroDeCardio
        sessoes={cardio}
        somenteLeitura={daNutri}
        aoMudar={carregar}
      />

      {sessoes.length > 0 && <ResumoSessoes sessoes={sessoes} />}

      {sessoes.length === 0 ? (
        <div className="c-bloco" style={{ marginTop: 14 }}>
          <p className="c-item-protocolo-nome">Nenhum treino registrado ainda</p>
          <p className="c-dica" style={{ marginTop: 6 }}>
            {daNutri
              ? "Assim que ela registrar um treino, o histórico aparece aqui."
              : "Registre o primeiro e a evolução começa a aparecer aqui."}
          </p>
        </div>
      ) : (
        exercicios.map((nome) => (
          <HistoricoDoExercicio
            key={nome}
            nome={nome}
            sessoes={sessoes}
            treinos={treinos}
          />
        ))
      )}
    </>
  );
}

/**
 * Os exercícios que têm história.
 *
 * Sai do PLANO e do REGISTRADO juntos: o exercício que ela tirou do plano
 * mas a paciente já fez continua tendo histórico, e some da lista seria
 * perder meses de registro da tela.
 */
function nomesDeExercicioMulti(treinos: Treino[], sessoes: SessaoDeTreino[]): string[] {
  const vistos = new Set<string>();
  const saida: string[] = [];
  for (const t of treinos) {
    for (const e of t.exercicios) {
      if (vistos.has(e.nome)) continue;
      vistos.add(e.nome);
      saida.push(e.nome);
    }
  }
  for (const s of sessoes) {
    for (const serie of s.series) {
      if (vistos.has(serie.exercicioNome)) continue;
      vistos.add(serie.exercicioNome);
      saida.push(serie.exercicioNome);
    }
  }
  return saida;
}

/** O card educativo. Curto e visual, como foi pedido — não é uma aula. */
function ComoVoceEvolui() {
  return (
    <section className="c-bloco c-como-evolui">
      <p className="c-como-evolui-titulo">Como você evolui?</p>
      <p className="c-como-evolui-frase">
        Você não precisa aumentar o peso toda vez para evoluir. Fazer mais repetições com o
        mesmo peso também é progresso.
      </p>
      <div className="c-como-evolui-escada" aria-hidden="true">
        <span>60 kg × 6</span>
        <span className="c-seta">↓</span>
        <span>60 kg × 7</span>
        <span className="c-seta">↓</span>
        <span>60 kg × 8</span>
      </div>
      <p className="c-como-evolui-rodape">
        Mesmo peso + mais repetições = evolução. <strong>+1 repetição</strong> também é
        evolução. <strong>+0,5 kg</strong> também é evolução.
      </p>
    </section>
  );
}

function PlanoDoTreino({ treino, aoRegistrar }: { treino: Treino; aoRegistrar: () => void }) {
  return (
    <section className="c-secao">
      {treino.rotulo && <p className="c-secao-rotulo">{treino.rotulo}</p>}
      <h2 className="c-secao-titulo">{treino.nome}</h2>
      {treino.observacao && <p className="c-dica">{treino.observacao}</p>}
      <div className="c-bloco">
        {treino.exercicios.map((e) => (
          <div className="c-item-protocolo" key={e.id}>
            <div className="c-item-protocolo-linha">
              <span className="c-item-protocolo-nome">{e.nome}</span>
              {(!e.faixas || e.faixas.length === 0) && (
                <span className="c-item-protocolo-quantidade">{faixaEmTexto(e)}</span>
              )}
            </div>
            {e.faixas && e.faixas.length > 0 && (
              <div className="c-faixas-lista">
                {e.faixas.map((f, fi) => (
                  <span key={fi} className="c-faixa-tag">{faixaUnicaEmTexto(f)}</span>
                ))}
              </div>
            )}
            {e.observacao && <p className="c-item-protocolo-trocas">{e.observacao}</p>}
            {e.videoUrl && (
              <a
                href={e.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="c-link-video"
              >
                ▶ Ver demonstração
              </a>
            )}
          </div>
        ))}
      </div>
      <button type="button" className="c-botao" style={{ marginTop: 12 }} onClick={aoRegistrar}>
        Registrar treino de hoje
      </button>
    </section>
  );
}

function faixaUnicaEmTexto(f: {
  series: number;
  repMin: number | null;
  repMax: number | null;
  tipo?: string;
  metodo?: string | null;
}): string {
  const partes: string[] = [];
  if (f.tipo) partes.push(f.tipo);
  const rep =
    f.repMin && f.repMax ? `${f.repMin}–${f.repMax}`
    : f.repMax ? `até ${f.repMax}`
    : f.repMin ? `${f.repMin}+`
    : null;
  partes.push(rep ? `${f.series}×${rep}` : `${f.series} séries`);
  if (f.metodo) partes.push(f.metodo);
  return partes.join(" ");
}

function faixaEmTexto(e: ExercicioPlanejado): string {
  if (e.faixas && e.faixas.length > 0) {
    return e.faixas.map(faixaUnicaEmTexto).join(", ");
  }
  const partes: string[] = [];
  if (e.seriesPlanejadas) partes.push(`${e.seriesPlanejadas} séries`);
  if (e.repeticoesMin && e.repeticoesMax) partes.push(`${e.repeticoesMin}–${e.repeticoesMax} rep.`);
  else if (e.repeticoesMax) partes.push(`até ${e.repeticoesMax} rep.`);
  else if (e.repeticoesMin) partes.push(`${e.repeticoesMin}+ rep.`);
  return partes.join(" · ");
}

function numero(v: number | null): string {
  return v === null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function ResumoSessoes({ sessoes }: { sessoes: SessaoDeTreino[] }) {
  const ultimas = [...sessoes]
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, 5);

  const algumaDuracao = ultimas.some((s) => s.duracaoMin !== null);
  if (!algumaDuracao) return null;

  return (
    <section className="c-secao">
      <h2 className="c-secao-titulo">Últimos treinos</h2>
      <div className="c-bloco">
        {ultimas.map((s) => (
          <div className="c-item-protocolo" key={s.id}>
            <div className="c-item-protocolo-linha">
              <span className="c-item-protocolo-nome">{dataBonita(s.data)}</span>
              <span className="c-item-protocolo-quantidade">
                {s.duracaoMin !== null ? `${s.duracaoMin} min` : ""}
                {s.series.length > 0 ? ` · ${s.series.length} séries` : ""}
              </span>
            </div>
            {s.observacao && <p className="c-item-protocolo-trocas">{s.observacao}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * O histórico de um exercício: data, carga, repetições — e o que mudou.
 *
 * A mensagem de progressão fica na linha da sessão em que ela aconteceu. No
 * fim da lista, não: quem abre a tela quer ver o dia, e o dia é onde a
 * informação nasce.
 */
function HistoricoDoExercicio({
  nome,
  sessoes,
  treinos,
}: {
  nome: string;
  sessoes: SessaoDeTreino[];
  treinos: Treino[];
}) {
  const doExercicio: SessaoDoExercicio[] = sessoes
    .map((s) => ({
      data: s.data,
      series: s.series
        .filter((x) => x.exercicioNome === nome)
        .map((x) => ({ numero: x.numero, carga: x.carga, repeticoes: x.repeticoes })),
    }))
    .filter((s) => s.series.length > 0);

  if (doExercicio.length === 0) return null;

  let faixa: ExercicioPlanejado | null = null;
  for (const t of treinos) {
    faixa = t.exercicios.find((e) => e.nome === nome) ?? null;
    if (faixa) break;
  }
  const linhas = evolucaoDoExercicio(doExercicio, faixa);
  const recordes = recordesDe(doExercicio);
  // Da mais nova para a mais antiga na tela: o último treino é o que ela
  // quer ver primeiro. A conta da progressão é feita no sentido do tempo.
  const emOrdemInversa = [...linhas].reverse();
  const topo = emOrdemInversa[0]?.topoDaFaixa ?? false;

  return (
    <section className="c-secao">
      <h2 className="c-secao-titulo">{nome}</h2>

      {topo && <p className="c-aviso-topo">{MENSAGEM_TOPO_DA_FAIXA}</p>}

      {/* A mensagem do que mudou fica numa LINHA PRÓPRIA, abaixo dos
          números, e não numa quarta coluna. Como coluna, ela era a primeira
          a sair da tela no celular — e é justamente a informação que a tela
          existe para dar. Assim a tabela tem três colunas de número, que
          cabem em 390 px sem rolagem lateral nenhuma. */}
      <div className="c-tabela-rolagem">
        <table className="c-tabela-medidas c-tabela-treino">
          <thead>
            <tr>
              <th scope="col">Data</th>
              <th scope="col">Carga</th>
              <th scope="col">Repetições</th>
            </tr>
          </thead>
          <tbody>
            {emOrdemInversa.map((l) => (
              <Fragment key={l.data}>
                <tr className={l.progressao.mensagem ? "c-linha-com-nota" : ""}>
                  <th scope="row">{dataBonita(l.data)}</th>
                  <td>{l.carga === null ? "—" : `${numero(l.carga)} kg`}</td>
                  <td>{numero(l.repeticoes)}</td>
                </tr>
                {l.progressao.mensagem && (
                  <tr className="c-linha-nota">
                    <td colSpan={3}>
                      <span className="c-progrediu">{l.progressao.mensagem}</span>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <p className="c-nota-protocolo">
        {recordes.maiorCarga !== null && (
          <>
            Maior carga registrada: {numero(recordes.maiorCarga)} kg
            {recordes.repeticoesNaMaiorCarga !== null
              ? ` (${recordes.repeticoesNaMaiorCarga} repetições)`
              : ""}
            .{" "}
          </>
        )}
        {recordes.maiorRepeticoes !== null && (
          <>
            Maior número de repetições: {recordes.maiorRepeticoes}
            {recordes.cargaNasMaioresRepeticoes !== null
              ? ` (com ${numero(recordes.cargaNasMaioresRepeticoes)} kg)`
              : ""}
            .
          </>
        )}
      </p>
    </section>
  );
}

/**
 * O formulário de registro, um card por exercício.
 *
 * Cada exercício do plano vira um card com as séries programadas já
 * abertas. A paciente preenche carga e repetições dentro do card, e pode
 * acrescentar ou tirar série — o que ela FEZ pode não ser o que estava
 * programado.
 */
function RegistrarSessao({
  treino,
  aoFechar,
  aoSalvar,
}: {
  treino: Treino;
  aoFechar: () => void;
  aoSalvar: () => Promise<void>;
}) {
  const hoje = hojeSaoPaulo();
  const [data, definirData] = useState(hoje);
  const [observacao, definirObservacao] = useState("");
  const [duracao, definirDuracao] = useState("");
  const [series, definirSeries] = useState<SerieParaSalvar[]>(() => seriesIniciais(treino));
  const [salvando, definirSalvando] = useState(false);
  const [aviso, definirAviso] = useState<string | null>(null);

  const mudar = (i: number, campo: "carga" | "repeticoes", valor: string) => {
    definirSeries((antes) =>
      antes.map((s, j) => (i === j ? { ...s, [campo]: valor } : s)),
    );
  };

  const adicionarSerie = (exercicioId: string | null, exercicioNome: string) => {
    const doExercicio = series.filter((s) => s.exercicioNome === exercicioNome);
    let pos = series.length;
    for (let k = series.length - 1; k >= 0; k--) {
      if (series[k]!.exercicioNome === exercicioNome) { pos = k + 1; break; }
    }
    definirSeries((antes) => [
      ...antes.slice(0, pos),
      { exercicioId, exercicioNome, numero: doExercicio.length + 1, carga: "", repeticoes: "", observacao: "" },
      ...antes.slice(pos),
    ]);
  };

  const tirarSerie = (i: number) => {
    definirSeries((antes) => antes.filter((_, j) => j !== i));
  };

  const salvar = async () => {
    const feitas = series.filter((s) => s.repeticoes.trim() !== "");
    if (feitas.length === 0) {
      definirAviso("Preencha as repetições de pelo menos uma série.");
      return;
    }
    for (const s of feitas) {
      const qual = `${s.exercicioNome}, série ${s.numero || ""}`.replace(/, série $/, "");
      if (naoEntendido(s.carga)) {
        definirAviso(`Não entendi a carga "${s.carga}" em ${qual}. Escreva só o número, como 22,5.`);
        return;
      }
      const reps = numeroDeTexto(s.repeticoes);
      if (reps === null || !Number.isInteger(reps) || reps <= 0) {
        definirAviso(`As repetições em ${qual} precisam ser um número inteiro, como 12.`);
        return;
      }
    }
    const duracaoNum = duracao.trim() ? numeroDeTexto(duracao) : null;
    if (duracao.trim() && (duracaoNum === null || duracaoNum <= 0)) {
      definirAviso("A duração precisa ser um número positivo, como 45.");
      return;
    }
    definirSalvando(true);
    definirAviso(null);
    try {
      await repositorio.registrarSessaoTreino(
        null,
        null,
        treino.id,
        data,
        observacao,
        feitas.map((s, i) => ({ ...s, numero: i + 1 })),
        duracaoNum ? Math.round(duracaoNum) : null,
      );
      await aoSalvar();
    } catch (e) {
      definirAviso(e instanceof Error ? e.message : "Não consegui registrar.");
      definirSalvando(false);
    }
  };

  const exerciciosAgrupados = agruparPorExercicio(series);

  return (
    <section className="c-secao c-registrar-treino">
      <h2 className="c-secao-titulo">Registrar treino</h2>

      <div className="c-bloco">
        <div className="c-duas-colunas">
          <label className="c-campo">
            <span>Data</span>
            <input
              type="date"
              value={data}
              max={hoje}
              onChange={(e) => definirData(e.target.value)}
            />
          </label>
          <label className="c-campo">
            <span>Duração (min)</span>
            <input
              type="text"
              inputMode="numeric"
              value={duracao}
              placeholder="—"
              onChange={(e) => definirDuracao(e.target.value)}
            />
          </label>
        </div>
      </div>

      {exerciciosAgrupados.map((grupo) => {
        const exercicioPlano = treino.exercicios.find((e) => e.nome === grupo.nome);
        return (
          <div className="c-bloco c-card-exercicio" key={grupo.nome}>
            <div className="c-card-exercicio-topo">
              <strong>{grupo.nome}</strong>
              {exercicioPlano && (
                <span className="c-card-exercicio-faixa">{faixaEmTexto(exercicioPlano)}</span>
              )}
            </div>
            {exercicioPlano?.videoUrl && (
              <a
                href={exercicioPlano.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="c-link-video"
              >
                ▶ Ver demonstração
              </a>
            )}
            {grupo.series.map((s) => (
              <div className="c-serie-linha" key={s.indiceGlobal}>
                <span className="c-serie-numero">{s.numeroDentro}</span>
                <label className="c-serie-campo">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={s.serie.carga}
                    placeholder="kg"
                    aria-label={`${grupo.nome}, série ${s.numeroDentro}, carga`}
                    onChange={(e) => mudar(s.indiceGlobal, "carga", e.target.value)}
                  />
                </label>
                <span className="c-serie-x" aria-hidden="true">×</span>
                <label className="c-serie-campo">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={s.serie.repeticoes}
                    placeholder="reps"
                    aria-label={`${grupo.nome}, série ${s.numeroDentro}, repetições`}
                    onChange={(e) => mudar(s.indiceGlobal, "repeticoes", e.target.value)}
                  />
                </label>
                {grupo.series.length > 1 && (
                  <button
                    type="button"
                    className="c-serie-tirar"
                    aria-label={`Tirar série ${s.numeroDentro}`}
                    onClick={() => tirarSerie(s.indiceGlobal)}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="c-botao-texto"
              onClick={() => adicionarSerie(grupo.series[0]?.serie.exercicioId ?? null, grupo.nome)}
            >
              + série
            </button>
          </div>
        );
      })}

      <div className="c-bloco">
        <label className="c-campo">
          <span>Alguma observação? (opcional)</span>
          <textarea
            rows={2}
            value={observacao}
            onChange={(e) => definirObservacao(e.target.value)}
          />
        </label>
      </div>

      {aviso && (
        <div className="c-aviso c-aviso-erro" role="alert">
          <span>{aviso}</span>
        </div>
      )}

      <div className="c-linha-botoes-treino">
        <button type="button" className="c-botao" disabled={salvando} onClick={() => void salvar()}>
          {salvando ? "Registrando…" : "Registrar"}
        </button>
        <button type="button" className="c-botao c-botao-secundario" onClick={aoFechar}>
          Cancelar
        </button>
      </div>
    </section>
  );
}

interface GrupoDeExercicio {
  nome: string;
  series: { serie: SerieParaSalvar; indiceGlobal: number; numeroDentro: number }[];
}

function agruparPorExercicio(series: SerieParaSalvar[]): GrupoDeExercicio[] {
  const grupos: GrupoDeExercicio[] = [];
  const mapa = new Map<string, GrupoDeExercicio>();
  for (let i = 0; i < series.length; i++) {
    const s = series[i]!;
    let grupo = mapa.get(s.exercicioNome);
    if (!grupo) {
      grupo = { nome: s.exercicioNome, series: [] };
      mapa.set(s.exercicioNome, grupo);
      grupos.push(grupo);
    }
    grupo.series.push({ serie: s, indiceGlobal: i, numeroDentro: grupo.series.length + 1 });
  }
  return grupos;
}

function seriesIniciais(treino: Treino): SerieParaSalvar[] {
  const saida: SerieParaSalvar[] = [];
  for (const e of treino.exercicios) {
    let total: number;
    if (e.faixas && e.faixas.length > 0) {
      total = e.faixas.reduce((acc, f) => acc + Math.max(f.series, 1), 0);
    } else {
      total = e.seriesPlanejadas ?? 1;
    }
    const quantas = Math.min(Math.max(total, 1), 20);
    for (let i = 0; i < quantas; i += 1) {
      saida.push({
        exercicioId: e.id,
        exercicioNome: e.nome,
        numero: i + 1,
        carga: "",
        repeticoes: "",
        observacao: "",
      });
    }
  }
  return saida;
}
