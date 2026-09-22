import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import type { AvaliacaoFisica } from "@/central/types/protocolo";
import type { Consulta, ConsultaParaSalvar } from "@/central/types/consulta";
import type { Meta } from "@/central/types/meta";
import type { PanoramaDoPaciente } from "@/central/types/panorama";
import { repositorio } from "@/central/dados/repositorio";
import { Campo, Selecao, Texto } from "@/central/admin/componentes/Campos";
import { CartaoDeMeta } from "@/central/components/CartaoDeMeta";
import { GraficoLinha } from "@/central/components/GraficoLinha";
import { hojeSaoPaulo } from "@/central/utils/situacao";
import { adesao, variacaoDePeso } from "@/central/utils/panoramaPacientes";
import {
  montarLinhaDoTempo,
  quando,
  semanasDeAcompanhamento,
  seriePeso,
} from "@/central/utils/linhaDoTempo";
import { CartaDeEncaminhamento } from "./CartaDeEncaminhamento";
import { CheckinDoPaciente } from "@/central/components/CheckinDoPaciente";
import { FaseDoPaciente } from "@/central/components/FaseDoPaciente";
import { Exames } from "@/central/components/Exames";
import { useSessao } from "@/central/autenticacao/SessaoContexto";
import { AcessosDaPaciente } from "./AcessosDaPaciente";

/**
 * O prontuário: tudo de uma paciente, em ordem cronológica.
 *
 * A LINHA DO TEMPO NÃO TEM TABELA PRÓPRIA. Ela é montada do que já existe —
 * consultas, metas, avaliações. Uma tabela de eventos paralela teria de ser
 * alimentada por gatilho em cada escrita, e o dia em que um gatilho falhasse
 * a linha ficaria com um buraco silencioso enquanto as tabelas de verdade
 * continuariam certas.
 *
 * OS TRÊS NÚMEROS DO TOPO são os que ela olha antes de abrir a porta da
 * sala: peso de agora, adesão e quantas consultas já houve. Cada um vira
 * travessão quando não há de onde sair — um zero ali seria afirmação.
 */
const CONSULTA_VAZIA: ConsultaParaSalvar = {
  data: "",
  hora: "",
  tipo: "retorno",
  status: "agendada",
  resumo: "",
  observacoes: "",
};

export function Prontuario() {
  const { pacienteId = "" } = useParams();
  const { configuracoes } = useSessao();
  const hoje = hojeSaoPaulo();

  const [paciente, definirPaciente] = useState<PanoramaDoPaciente | null>(null);
  const [consultas, definirConsultas] = useState<Consulta[]>([]);
  const [avaliacoes, definirAvaliacoes] = useState<AvaliacaoFisica[]>([]);
  const [metas, definirMetas] = useState<Meta[]>([]);
  const [carregando, definirCarregando] = useState(true);
  const [erro, definirErro] = useState<string | null>(null);
  const [editando, definirEditando] = useState<Consulta | "nova" | null>(null);
  const [filtro, definirFiltro] = useState<"tudo" | "consultas" | "metas" | "avaliacoes">("tudo");

  const carregar = useCallback(async () => {
    try {
      // As quatro juntas: quatro idas em série deixariam a ficha montando
      // aos pedaços enquanto ela já está com a paciente na frente.
      const [panorama, cs, avs, ms] = await Promise.all([
        repositorio.panoramaDosPacientes(),
        repositorio.consultasDe(pacienteId),
        repositorio.avaliacoesDoPaciente(pacienteId).catch(() => []),
        repositorio.metasDe(pacienteId).catch(() => []),
      ]);
      definirPaciente(panorama.find((p) => p.id === pacienteId) ?? null);
      definirConsultas(cs);
      definirAvaliacoes(avs);
      definirMetas(ms);
      definirErro(null);
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui carregar a ficha.");
    } finally {
      definirCarregando(false);
    }
  }, [pacienteId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const linhaCompleta = useMemo(
    () => montarLinhaDoTempo(consultas, metas, avaliacoes, hoje),
    [consultas, metas, avaliacoes, hoje],
  );

  /**
   * O filtro por tipo, para achar rápido sem rolar o histórico inteiro.
   *
   * `tudo` não é um caso especial: ele simplesmente não filtra. Escrever
   * `if (filtro === "tudo") return linhaCompleta` seria um segundo caminho
   * para o mesmo resultado, e é onde a divergência começa.
   */
  const linha = useMemo(
    () =>
      linhaCompleta.filter((e) => {
        if (filtro === "consultas") return e.tipo === "consulta" || e.tipo === "consulta_agendada";
        if (filtro === "metas") return e.tipo === "meta_criada" || e.tipo === "meta_encerrada";
        if (filtro === "avaliacoes") return e.tipo === "avaliacao";
        return true;
      }),
    [linhaCompleta, filtro],
  );
  const serie = useMemo(() => seriePeso(avaliacoes), [avaliacoes]);

  if (carregando) return <p className="c-dica">Carregando…</p>;

  if (erro || !paciente) {
    return (
      <div className="c-aviso c-aviso-erro" role="alert">
        <span>{erro ?? "Não encontrei essa paciente."}</span>
      </div>
    );
  }

  const semanas = semanasDeAcompanhamento(paciente.dataInicio, hoje);
  const peso = variacaoDePeso(paciente);
  const ade = adesao(paciente.metas, hoje);
  const realizadas = consultas.filter((c) => c.status === "concluida").length;
  const ativas = metas.filter((m) => m.status === "ativa");

  return (
    <>
      <div style={{ marginBottom: 4 }}>
        <h1 className="c-titulo" style={{ fontSize: 28 }}>
          {paciente.nome}
        </h1>
        <p className="c-subtitulo">
          {semanas === null
            ? paciente.email
            : semanas === 0
              ? "Primeira semana de acompanhamento"
              : `Em acompanhamento há ${semanas} ${semanas === 1 ? "semana" : "semanas"}`}
          {paciente.proximaConsulta &&
            ` · próximo retorno ${quando(paciente.proximaConsulta.data, hoje)}`}
        </p>
      </div>

      {/* Os três números que ela olha antes de abrir a porta da sala. */}
      <div className="c-painel-numeros">
        <div>
          <strong>
            {paciente.pesoAtual === null
              ? "—"
              : paciente.pesoAtual.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
          </strong>
          <span>peso atual (kg)</span>
        </div>
        <div>
          <strong>{ade === null ? "—" : `${ade}%`}</strong>
          <span>adesão às metas</span>
        </div>
        <div>
          <strong>{realizadas}</strong>
          <span>{realizadas === 1 ? "consulta" : "consultas"}</span>
        </div>
      </div>

      {peso !== null && peso !== 0 && (
        <p className="c-dica">
          {/* O sinal é explícito e a tela não diz se é bom ou ruim: perder
              peso é objetivo de umas e não de outras. */}
          {peso < 0 ? "−" : "+"}
          {Math.abs(peso).toLocaleString("pt-BR")} kg desde a primeira avaliação.
        </p>
      )}

      {serie.length >= 2 && (
        <section className="c-secao">
          <h2 className="c-secao-titulo">Peso no tempo</h2>
          <GraficoLinha serie={serie} unidade="kg" />
        </section>
      )}

      {ativas.length > 0 && (
        <section className="c-secao">
          <h2 className="c-secao-titulo">Metas em andamento</h2>
          {ativas.map((m) => (
            <CartaoDeMeta key={m.id} meta={m} aoMudar={carregar} somenteLeitura />
          ))}
        </section>
      )}

      {/* A fase vem antes de tudo: e o enquadramento que faz o resto do
          prontuario ser lido do jeito certo. */}
      <FaseDoPaciente pacienteId={pacienteId} />

      <AcessosDaPaciente pacienteId={pacienteId} />

      {/* O check-in vem antes do encaminhamento: o que ela relatou nas
          ultimas semanas e o que alimenta a carta, quando houver. */}
      <CheckinDoPaciente pacienteId={pacienteId} />

      <Exames pacienteId={pacienteId} />

      <CartaDeEncaminhamento
        paciente={paciente.nome}
        nutricionista={configuracoes.nomeNutricionista}
        resumo={{
          semanas,
          consultas: realizadas,
          pesoAtual: paciente.pesoAtual,
          pesoInicial: paciente.pesoInicial,
        }}
      />

      <section className="c-secao">
        <h2 className="c-secao-titulo">Linha do tempo</h2>

        {editando ? (
          <EditorDeConsulta
            pacienteId={pacienteId}
            consulta={editando === "nova" ? null : editando}
            aoFechar={() => definirEditando(null)}
            aoSalvar={async () => {
              definirEditando(null);
              await carregar();
            }}
          />
        ) : (
          <div className="c-barra-acoes">
            <button
              type="button"
              className="c-botao c-botao-pequeno"
              onClick={() => definirEditando("nova")}
            >
              Registrar consulta
            </button>
          </div>
        )}

        {/* Os filtros só aparecem quando há o que filtrar: numa ficha com
            três eventos eles ocupariam mais espaço do que a própria linha. */}
        {linhaCompleta.length > 4 && (
          <div className="c-chips" style={{ marginTop: 10 }}>
            {(
              [
                ["tudo", `Tudo (${linhaCompleta.length})`],
                ["consultas", "Consultas"],
                ["metas", "Metas"],
                ["avaliacoes", "Avaliações"],
              ] as ["tudo" | "consultas" | "metas" | "avaliacoes", string][]
            ).map(([valor, rotulo]) => (
              <button
                key={valor}
                type="button"
                className="c-chip"
                aria-pressed={filtro === valor}
                onClick={() => definirFiltro(valor)}
              >
                {rotulo}
              </button>
            ))}
          </div>
        )}

        {linha.length === 0 ? (
          <div className="c-bloco">
            <p className="c-item-protocolo-nome">
              {linhaCompleta.length === 0 ? "Nada registrado ainda" : "Nada com esse filtro"}
            </p>
            <p className="c-dica" style={{ marginTop: 6 }}>
              {linhaCompleta.length === 0
                ? "Registre a primeira consulta e a linha do tempo começa aqui."
                : "Escolha outro filtro para ver o resto."}
            </p>
          </div>
        ) : (
          <ol className="c-cronologia">
            {linha.map((e) => {
              const consulta = consultas.find((c) => `consulta:${c.id}` === e.id);
              return (
                <li key={e.id} className={`c-evento c-evento-${e.tipo}`}>
                  <span className="c-evento-data">
                    <strong>{e.data.slice(8, 10)}</strong>
                    <span>{mes(e.data)}</span>
                  </span>
                  <span className="c-evento-corpo">
                    <span className="c-evento-topo">
                      <span className="c-evento-titulo">{e.titulo}</span>
                      {e.marca && <span className="c-evento-marca">{e.marca}</span>}
                    </span>
                    {e.detalhe && <span className="c-evento-detalhe">{e.detalhe}</span>}
                    {consulta?.observacoes && (
                      /* A anotação clínica aparece AQUI e só aqui. A paciente
                         não a alcança por caminho nenhum: a tabela não tem
                         política de leitura para ela. */
                      <span className="c-evento-anotacao">{consulta.observacoes}</span>
                    )}
                    {consulta && (
                      <button
                        type="button"
                        className="c-botao c-botao-secundario c-botao-pequeno"
                        style={{ marginTop: 8 }}
                        onClick={() => definirEditando(consulta)}
                      >
                        Editar
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </>
  );
}

function mes(iso: string): string {
  const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const n = Number(iso.slice(5, 7));
  return MESES[n - 1] ?? "";
}

function EditorDeConsulta({
  pacienteId,
  consulta,
  aoFechar,
  aoSalvar,
}: {
  pacienteId: string;
  consulta: Consulta | null;
  aoFechar: () => void;
  aoSalvar: () => Promise<void>;
}) {
  const [dados, definirDados] = useState<ConsultaParaSalvar>(() =>
    consulta
      ? {
          data: consulta.data,
          hora: consulta.hora ?? "",
          tipo: consulta.tipo,
          status: consulta.status,
          resumo: consulta.resumo ?? "",
          observacoes: consulta.observacoes ?? "",
        }
      : { ...CONSULTA_VAZIA, data: hojeSaoPaulo() },
  );
  const [salvando, definirSalvando] = useState(false);
  const [aviso, definirAviso] = useState<string | null>(null);
  const [confirmando, definirConfirmando] = useState(false);

  const mudar = (campo: keyof ConsultaParaSalvar, valor: string) =>
    definirDados((antes) => ({ ...antes, [campo]: valor }));

  async function salvar() {
    if (!dados.data) {
      definirAviso("Escolha a data da consulta.");
      return;
    }
    definirSalvando(true);
    definirAviso(null);
    try {
      await repositorio.salvarConsulta(consulta?.id ?? null, pacienteId, dados);
      await aoSalvar();
    } catch (e) {
      definirAviso(e instanceof Error ? e.message : "Não consegui salvar.");
      definirSalvando(false);
    }
  }

  return (
    <div className="c-bloco" style={{ marginTop: 12 }}>
      <div className="c-linha-medidas">
        <Campo rotulo="Data">
          <Texto tipo="date" valor={dados.data} aoMudar={(v) => mudar("data", v)} />
        </Campo>
        <Campo rotulo="Hora (opcional)">
          <Texto tipo="time" valor={dados.hora} aoMudar={(v) => mudar("hora", v)} />
        </Campo>
      </div>

      <div className="c-linha-medidas">
        <Campo rotulo="Tipo">
          <Selecao
            valor={dados.tipo}
            aoMudar={(v) => mudar("tipo", v)}
            opcoes={[
              { valor: "retorno", rotulo: "Retorno" },
              { valor: "primeira", rotulo: "Primeira consulta" },
            ]}
          />
        </Campo>
        <Campo rotulo="Situação">
          <Selecao
            valor={dados.status}
            aoMudar={(v) => mudar("status", v)}
            opcoes={[
              { valor: "agendada", rotulo: "Agendada" },
              { valor: "concluida", rotulo: "Concluída" },
              { valor: "faltou", rotulo: "Faltou" },
              { valor: "cancelada", rotulo: "Cancelada" },
            ]}
          />
        </Campo>
      </div>

      <Campo rotulo="O que ficou combinado" dica="Uma linha. É o que aparece na linha do tempo.">
        <Texto
          valor={dados.resumo}
          aoMudar={(v) => mudar("resumo", v)}
          placeholder="Ajuste no jantar · manteve plano base"
        />
      </Campo>

      <Campo
        rotulo="Sua anotação"
        dica="Só você vê. A paciente não alcança este campo por caminho nenhum."
      >
        <Texto valor={dados.observacoes} aoMudar={(v) => mudar("observacoes", v)} />
      </Campo>

      {aviso && (
        <div className="c-aviso c-aviso-erro" role="alert">
          <span>{aviso}</span>
        </div>
      )}

      <div className="c-linha-botoes-treino">
        <button type="button" className="c-botao" disabled={salvando} onClick={() => void salvar()}>
          {salvando ? "Salvando…" : "Salvar"}
        </button>
        <button type="button" className="c-botao c-botao-secundario" onClick={aoFechar}>
          Cancelar
        </button>

        {consulta &&
          (!confirmando ? (
            <button
              type="button"
              className="c-botao c-botao-secundario c-botao-pequeno"
              onClick={() => definirConfirmando(true)}
            >
              Apagar
            </button>
          ) : (
            <>
              <span className="c-dica">
                Apagar tira a consulta da linha do tempo e leva a sua anotação junto. Apagar mesmo?
              </span>
              <button
                type="button"
                className="c-botao c-botao-perigo c-botao-pequeno"
                disabled={salvando}
                onClick={async () => {
                  definirSalvando(true);
                  try {
                    await repositorio.excluirConsulta(consulta.id);
                    await aoSalvar();
                  } catch (e) {
                    definirAviso(e instanceof Error ? e.message : "Não consegui apagar.");
                    definirSalvando(false);
                  }
                }}
              >
                Sim, apagar
              </button>
              <button
                type="button"
                className="c-botao c-botao-secundario c-botao-pequeno"
                onClick={() => definirConfirmando(false)}
              >
                Não
              </button>
            </>
          ))}
      </div>
    </div>
  );
}
