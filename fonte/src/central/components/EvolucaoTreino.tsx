import { Fragment, useEffect, useMemo, useState } from "react";
import type {
  CardioSessao,
  MetaSemanal,
  SerieParaSalvar,
  SessaoDeTreino,
  Treino,
} from "@/central/types/treino";
import { PainelDaSemana } from "@/central/components/PainelDaSemana";
import { RegistroDeCardio } from "@/central/components/RegistroDeCardio";
import { repositorio } from "@/central/dados/repositorio";
import { dataBonita } from "@/central/utils/situacao";
import type { SessaoDoExercicio } from "@/central/utils/progressaoTreino";
import {
  MENSAGEM_TOPO_DA_FAIXA,
  evolucaoDoExercicio,
  recordesDe,
} from "@/central/utils/progressaoTreino";

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
  const [treino, definirTreino] = useState<Treino | null>(null);
  const [sessoes, definirSessoes] = useState<SessaoDeTreino[]>([]);
  const [cardio, definirCardio] = useState<CardioSessao[]>([]);
  const [metas, definirMetas] = useState<MetaSemanal[]>([]);
  const [carregando, definirCarregando] = useState(true);
  const [registrando, definirRegistrando] = useState(false);

  const daNutri = Boolean(pacienteId);

  const carregar = useMemo(
    () => async () => {
      // As quatro juntas: quatro idas ao banco em série deixariam a tela
      // montando aos pedaços no celular dela.
      const [t, s, c, m] = await Promise.all([
        daNutri ? Promise.resolve(null) : repositorio.meuTreino(),
        repositorio.sessoesDeTreino(pacienteId ?? null),
        repositorio.sessoesDeCardio(pacienteId ?? null),
        repositorio.metasSemanais(pacienteId ?? null),
      ]);
      if (!daNutri) definirTreino(t);
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

  if (carregando) return <p className="c-dica">Carregando…</p>;

  const exercicios = nomesDeExercicio(treino, sessoes);

  return (
    <>
      {/* O painel primeiro: é a resposta de "como está a minha semana", que
          é o que ela abre a tela para saber. O card educativo vem depois —
          ele ensina, mas não é notícia. */}
      <PainelDaSemana metas={metas} treinos={sessoes} cardio={cardio} />

      <ComoVoceEvolui />

      {!daNutri && treino && (
        <PlanoDoTreino treino={treino} aoRegistrar={() => definirRegistrando(true)} />
      )}

      {registrando && treino && (
        <RegistrarSessao
          treino={treino}
          aoFechar={() => definirRegistrando(false)}
          aoSalvar={async () => {
            definirRegistrando(false);
            await carregar();
          }}
        />
      )}

      <RegistroDeCardio
        sessoes={cardio}
        somenteLeitura={daNutri}
        aoMudar={carregar}
      />

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
            treino={treino}
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
function nomesDeExercicio(treino: Treino | null, sessoes: SessaoDeTreino[]): string[] {
  const vistos = new Set<string>();
  const saida: string[] = [];
  for (const e of treino?.exercicios ?? []) {
    if (vistos.has(e.nome)) continue;
    vistos.add(e.nome);
    saida.push(e.nome);
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
      <h2 className="c-secao-titulo">{treino.nome}</h2>
      {treino.observacao && <p className="c-dica">{treino.observacao}</p>}
      <div className="c-bloco">
        {treino.exercicios.map((e) => (
          <div className="c-item-protocolo" key={e.id}>
            <div className="c-item-protocolo-linha">
              <span className="c-item-protocolo-nome">{e.nome}</span>
              <span className="c-item-protocolo-quantidade">{faixaEmTexto(e)}</span>
            </div>
            {e.observacao && <p className="c-item-protocolo-trocas">{e.observacao}</p>}
          </div>
        ))}
      </div>
      <button type="button" className="c-botao" style={{ marginTop: 12 }} onClick={aoRegistrar}>
        Registrar treino de hoje
      </button>
    </section>
  );
}

function faixaEmTexto(e: {
  seriesPlanejadas: number | null;
  repeticoesMin: number | null;
  repeticoesMax: number | null;
}): string {
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
  treino,
}: {
  nome: string;
  sessoes: SessaoDeTreino[];
  treino: Treino | null;
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

  const faixa = treino?.exercicios.find((e) => e.nome === nome) ?? null;
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
 * O formulário de registro: uma linha por série, com carga e repetições.
 *
 * Nasce com as séries que a profissional programou — três séries
 * programadas viram três linhas em branco. Digitar do zero toda vez seria
 * trabalho que o plano já resolveu; e a paciente pode acrescentar ou tirar
 * linha, porque o que ela FEZ pode não ser o que estava programado, e é o
 * que ela fez que vale aqui.
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
  const hoje = new Date().toISOString().slice(0, 10);
  const [data, definirData] = useState(hoje);
  const [observacao, definirObservacao] = useState("");
  const [series, definirSeries] = useState<SerieParaSalvar[]>(() => seriesIniciais(treino));
  const [salvando, definirSalvando] = useState(false);
  const [aviso, definirAviso] = useState<string | null>(null);

  const mudar = (i: number, campo: "carga" | "repeticoes", valor: string) => {
    definirSeries((antes) =>
      antes.map((s, j) => (i === j ? { ...s, [campo]: valor } : s)),
    );
  };

  const salvar = async () => {
    // Série sem repetição não é série feita. Mandando tudo, uma linha em
    // branco viraria "0 repetições" no histórico dela.
    const feitas = series.filter((s) => s.repeticoes.trim() !== "");
    if (feitas.length === 0) {
      definirAviso("Preencha as repetições de pelo menos uma série.");
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
      );
      await aoSalvar();
    } catch (e) {
      definirAviso(e instanceof Error ? e.message : "Não consegui registrar.");
      definirSalvando(false);
    }
  };

  return (
    <section className="c-secao c-registrar-treino">
      <h2 className="c-secao-titulo">Registrar treino</h2>
      <div className="c-bloco">
        <label className="c-campo">
          <span>Data</span>
          {/* `max` de hoje: o banco recusa data futura, e é melhor o
              calendário nem oferecer do que a mensagem de erro depois. */}
          <input
            type="date"
            value={data}
            max={hoje}
            onChange={(e) => definirData(e.target.value)}
          />
        </label>

        <div className="c-tabela-rolagem" style={{ marginTop: 10 }}>
          <table className="c-tabela-medidas c-tabela-registro">
            <thead>
              <tr>
                <th scope="col">Exercício</th>
                <th scope="col">Série</th>
                <th scope="col">Carga (kg)</th>
                <th scope="col">Repetições</th>
              </tr>
            </thead>
            <tbody>
              {series.map((s, i) => (
                <tr key={`${s.exercicioNome}-${i}`}>
                  <th scope="row">{s.exercicioNome}</th>
                  <td>{i + 1 - series.findIndex((x) => x.exercicioNome === s.exercicioNome)}</td>
                  <td>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={s.carga}
                      placeholder="—"
                      onChange={(e) => mudar(i, "carga", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={s.repeticoes}
                      onChange={(e) => mudar(i, "repeticoes", e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <label className="c-campo" style={{ marginTop: 10 }}>
          <span>Alguma observação? (opcional)</span>
          <textarea
            rows={2}
            value={observacao}
            onChange={(e) => definirObservacao(e.target.value)}
          />
        </label>

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
      </div>
    </section>
  );
}

function seriesIniciais(treino: Treino): SerieParaSalvar[] {
  const saida: SerieParaSalvar[] = [];
  for (const e of treino.exercicios) {
    const quantas = Math.min(Math.max(e.seriesPlanejadas ?? 1, 1), 10);
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
