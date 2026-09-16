import { useCallback, useEffect, useState } from "react";
import type {
  AcaoAdmin,
  DesafioAdmin,
  EnvioPendente,
  IndicacaoPendente,
  LinhaDoRanking,
  Paciente,
  PainelDoDesafio,
  ResumoIndicacao,
} from "@/central/types";
import { repositorio } from "@/central/dados/repositorio";
import { dataBonita, hojeSaoPaulo } from "@/central/utils/situacao";
import { SeloNeutro } from "@/central/components/Selo";
import { Campo, Selecao, Texto, AreaTexto } from "./componentes/Campos";
import { Modal } from "./componentes/Modal";

/**
 * Desafio do Mês — área da nutricionista.
 *
 * Cinco abas porque são cinco trabalhos diferentes: ver como vai, conferir o
 * que chegou, lançar o que a paciente esqueceu de marcar, olhar o ranking e
 * cuidar das indicações. Nenhuma delas soma ponto por conta própria: todas
 * chamam a função do banco, e o resultado volta da leitura seguinte.
 */
const ABAS = ["Visão geral", "Pendências", "Lançar pontos", "Ranking", "Indicações"] as const;
type Aba = (typeof ABAS)[number];

const SITUACOES: Record<string, string> = {
  rascunho: "Rascunho",
  agendado: "Agendado",
  ativo: "No ar",
  encerrado: "Encerrado",
};

export function Desafios() {
  const [desafios, definirDesafios] = useState<DesafioAdmin[]>([]);
  const [escolhido, definirEscolhido] = useState<string | null>(null);
  const [aba, definirAba] = useState<Aba>("Visão geral");
  const [editando, definirEditando] = useState<DesafioAdmin | "novo" | null>(null);
  const [erro, definirErro] = useState<string | null>(null);
  const [carregando, definirCarregando] = useState(true);

  const carregar = useCallback(async () => {
    try {
      const lista = await repositorio.listarDesafios();
      definirDesafios(lista);
      definirEscolhido((atual) => atual ?? lista.find((d) => d.situacao === "ativo")?.id ?? lista[0]?.id ?? null);
      definirErro(null);
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui carregar os desafios.");
    } finally {
      definirCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const desafio = desafios.find((d) => d.id === escolhido) ?? null;

  return (
    <>
      <div className="c-admin-topo-linha" style={{ marginBottom: 4 }}>
        <div>
          <h1 className="c-titulo" style={{ fontSize: 28 }}>Desafio do mês</h1>
          <p className="c-subtitulo">
            Marcar não dá pontos. Os pontos entram quando você aprova — e, quando a paciente fez e
            esqueceu de marcar, quando você lança por ela.
          </p>
        </div>
        <button type="button" className="c-botao c-botao-pequeno" onClick={() => definirEditando("novo")}>
          Novo desafio
        </button>
      </div>

      {erro && (
        <div className="c-aviso c-aviso-erro" role="alert">
          <span>{erro}</span>
        </div>
      )}

      {carregando ? (
        <p className="c-contagem">Carregando…</p>
      ) : desafios.length === 0 ? (
        <p className="c-contagem">Nenhum desafio criado ainda.</p>
      ) : (
        <>
          <div className="c-chips" style={{ marginTop: 14 }}>
            {desafios.map((d) => (
              <button
                key={d.id}
                type="button"
                className="c-chip"
                aria-pressed={d.id === escolhido}
                onClick={() => definirEscolhido(d.id)}
              >
                {d.nome} · {SITUACOES[d.situacao] ?? d.situacao}
              </button>
            ))}
          </div>

          {desafio && (
            <>
              <div className="c-admin-abas" style={{ marginTop: 16 }}>
                {ABAS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    className={`c-admin-aba ${a === aba ? "ativo" : ""}`}
                    onClick={() => definirAba(a)}
                  >
                    {a}
                  </button>
                ))}
              </div>

              <div style={{ marginTop: 18 }}>
                {aba === "Visão geral" && (
                  <VisaoGeral desafio={desafio} aoEditar={() => definirEditando(desafio)} />
                )}
                {aba === "Pendências" && <Pendencias desafioId={desafio.id} />}
                {aba === "Lançar pontos" && <LancarPontos desafio={desafio} />}
                {aba === "Ranking" && <Ranking desafioId={desafio.id} />}
                {aba === "Indicações" && <Indicacoes desafioId={desafio.id} />}
              </div>
            </>
          )}
        </>
      )}

      {editando && (
        <ModalDesafio
          desafio={editando === "novo" ? null : editando}
          aoFechar={() => {
            definirEditando(null);
            void carregar();
          }}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------- visão geral

function VisaoGeral({ desafio, aoEditar }: { desafio: DesafioAdmin; aoEditar: () => void }) {
  const [painel, definirPainel] = useState<PainelDoDesafio | null>(null);

  useEffect(() => {
    void repositorio.painelDoDesafio(desafio.id).then(definirPainel).catch(() => definirPainel(null));
  }, [desafio.id]);

  return (
    <>
      <div className="c-bloco">
        <div className="c-bloco-topo">
          <strong style={{ fontSize: 15 }}>{desafio.nome}</strong>
          <button type="button" className="c-link" onClick={aoEditar}>
            Editar
          </button>
        </div>
        <p className="c-contagem">
          {dataBonita(desafio.dataInicio)} — {dataBonita(desafio.dataFim)} ·{" "}
          {SITUACOES[desafio.situacao] ?? desafio.situacao}
          {desafio.semanaAtual ? ` · semana ${desafio.semanaAtual} de ${desafio.totalDeSemanas}` : ""}
        </p>
        {desafio.lema && <p className="c-dica">{desafio.lema}</p>}
      </div>

      {painel && (
        <div className="c-numeros">
          <Numero rotulo="Elegíveis" valor={painel.elegiveis} />
          <Numero rotulo="Participantes" valor={painel.participantes} />
          <Numero rotulo="Sem nenhuma ação" valor={painel.semAcao} />
          <Numero rotulo="Aguardando você" valor={painel.pendentes} destaque={painel.pendentes > 0} />
          <Numero rotulo="Maior pontuação" valor={painel.maiorPontuacao} />
          <Numero rotulo="Média" valor={painel.media} />
        </div>
      )}

      {painel && painel.acoesMaisFeitas.length > 0 && (
        <div className="c-bloco" style={{ marginTop: 14 }}>
          <strong style={{ fontSize: 14 }}>Ações mais realizadas</strong>
          <div className="c-ranking" style={{ marginTop: 10 }}>
            {painel.acoesMaisFeitas.map((a) => (
              <div key={a.nome} className="c-ranking-linha">
                <span className="c-ranking-nome">{a.nome}</span>
                <span className="c-ranking-pontos">{a.total}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function Numero({ rotulo, valor, destaque }: { rotulo: string; valor: number; destaque?: boolean }) {
  return (
    <div className={`c-numero ${destaque ? "destaque" : ""}`}>
      <strong>{valor}</strong>
      <span>{rotulo}</span>
    </div>
  );
}

// ---------------------------------------------------------------- pendências

function Pendencias({ desafioId }: { desafioId: string }) {
  const [lista, definirLista] = useState<EnvioPendente[]>([]);
  const [ocupado, definirOcupado] = useState<string | null>(null);
  const [erro, definirErro] = useState<string | null>(null);
  const [recusando, definirRecusando] = useState<EnvioPendente | null>(null);
  const [motivo, definirMotivo] = useState("");

  const carregar = useCallback(async () => {
    try {
      definirLista(await repositorio.enviosPendentes(desafioId));
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui carregar.");
    }
  }, [desafioId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function executar(id: string, acao: () => Promise<void>) {
    definirOcupado(id);
    definirErro(null);
    try {
      await acao();
      await carregar();
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui salvar.");
    } finally {
      definirOcupado(null);
    }
  }

  if (lista.length === 0) {
    return <p className="c-contagem">Nada aguardando conferência.</p>;
  }

  return (
    <>
      {erro && (
        <div className="c-aviso c-aviso-erro" role="alert">
          <span>{erro}</span>
        </div>
      )}
      <div className="c-acoes">
        {lista.map((envio) => (
          <article className="c-acao" key={envio.id}>
            <div className="c-acao-topo">
              <span className="c-acao-texto">
                <strong>{envio.pacienteNome}</strong>
                <span className="c-acao-descricao">
                  {envio.acaoNome}
                  {envio.semana ? ` · semana ${envio.semana}` : ""} ·{" "}
                  {dataBonita(envio.enviadoEm.slice(0, 10))}
                </span>
                {envio.observacao && <span className="c-acao-descricao">“{envio.observacao}”</span>}
              </span>
              <span className="c-acao-pontos">+{envio.pontos}</span>
            </div>
            <div className="c-acao-estado">
              <button
                type="button"
                className="c-botao c-botao-pequeno"
                disabled={ocupado === envio.id}
                onClick={() => void executar(envio.id, () => repositorio.aprovarEnvio(envio.id))}
              >
                Aprovar
              </button>
              <button
                type="button"
                className="c-botao c-botao-secundario c-botao-pequeno"
                disabled={ocupado === envio.id}
                onClick={() => {
                  definirRecusando(envio);
                  definirMotivo("");
                }}
              >
                Recusar
              </button>
            </div>
          </article>
        ))}
      </div>

      {recusando && (
        <Modal titulo="Recusar" aoFechar={() => definirRecusando(null)}>
          <p className="c-dica">
            {recusando.pacienteNome} · {recusando.acaoNome}. Nenhum ponto será lançado.
          </p>
          <Campo rotulo="Motivo (a paciente vê)" dica="Opcional, mas ajuda a entender.">
            <AreaTexto valor={motivo} aoMudar={definirMotivo} linhas={2} />
          </Campo>
          <div className="c-modal-acoes">
            <button type="button" className="c-botao c-botao-secundario" onClick={() => definirRecusando(null)}>
              Cancelar
            </button>
            <button
              type="button"
              className="c-botao"
              onClick={() => {
                const alvo = recusando;
                definirRecusando(null);
                void executar(alvo.id, () => repositorio.recusarEnvio(alvo.id, motivo));
              }}
            >
              Recusar
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

// ---------------------------------------------------------- lançar pontos

/**
 * O caso dela: "a paciente que faz tudo mas esquece de registrar".
 *
 * São dois caminhos, e a diferença importa. Lançar a AÇÃO cria o mesmo envio
 * que a paciente criaria, já aprovado — a ação aparece marcada na tela dela,
 * conta no histórico e entra no ranking do mês. Pontos AVULSOS são para o que
 * não é ação nenhuma: uma correção, um combinado à parte. Os dois caem no
 * mesmo ledger, e nenhum dos dois apaga nada.
 */
function LancarPontos({ desafio }: { desafio: DesafioAdmin }) {
  const [pacientes, definirPacientes] = useState<Paciente[]>([]);
  const [acoes, definirAcoes] = useState<AcaoAdmin[]>([]);
  const [busca, definirBusca] = useState("");
  const [paciente, definirPaciente] = useState<string>("");
  const [acao, definirAcao] = useState<string>("");
  const [semana, definirSemana] = useState<string>(String(desafio.semanaAtual ?? 1));
  const [pontos, definirPontos] = useState("");
  const [motivo, definirMotivo] = useState("");
  const [ocupado, definirOcupado] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);
  const [feito, definirFeito] = useState<string | null>(null);

  useEffect(() => {
    void repositorio.listarPacientes().then(definirPacientes).catch(() => definirPacientes([]));
  }, []);

  // Trocar de desafio tem que trocar a ação escolhida junto. Guardar a
  // anterior parece inofensivo e não é: o id continuaria válido, e ela
  // lançaria no desafio errado sem a tela dar sinal nenhum.
  useEffect(() => {
    void repositorio
      .acoesDoDesafio(desafio.id)
      .then((lista) => {
        const ativas = lista.filter((a) => a.ativo && a.chave !== "indicacao");
        definirAcoes(ativas);
        definirAcao((atual) =>
          ativas.some((a) => a.id === atual) ? atual : (ativas[0]?.id ?? ""),
        );
      })
      .catch(() => definirAcoes([]));
    definirSemana(String(desafio.semanaAtual ?? 1));
  }, [desafio.id, desafio.semanaAtual]);

  const visiveis = pacientes.filter((p) =>
    p.nome.toLowerCase().includes(busca.trim().toLowerCase()),
  );
  const escolhida = pacientes.find((p) => p.id === paciente) ?? null;
  const acaoEscolhida = acoes.find((a) => a.id === acao) ?? null;
  const semanas = Array.from({ length: desafio.totalDeSemanas }, (_, i) => i + 1);

  /** Devolve se deu certo: limpar os campos depois de um erro apagaria o que
   *  ela acabou de digitar, e ela teria de escrever tudo de novo. */
  async function executar(tarefa: () => Promise<void>, recado: string) {
    definirOcupado(true);
    definirErro(null);
    definirFeito(null);
    try {
      await tarefa();
      definirFeito(recado);
      return true;
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui lançar.");
      return false;
    } finally {
      definirOcupado(false);
    }
  }

  return (
    <>
      {erro && (
        <div className="c-aviso c-aviso-erro" role="alert">
          <span>{erro}</span>
        </div>
      )}
      {feito && (
        <div className="c-aviso" role="status">
          <span>{feito}</span>
        </div>
      )}

      <Campo rotulo="Buscar paciente">
        <Texto valor={busca} aoMudar={definirBusca} placeholder="Nome" />
      </Campo>
      <Campo rotulo="Paciente">
        <Selecao
          valor={paciente}
          aoMudar={definirPaciente}
          opcoes={[
            { valor: "", rotulo: "Escolha a paciente" },
            ...visiveis.map((p) => ({ valor: p.id, rotulo: p.nome })),
          ]}
        />
      </Campo>

      {escolhida && (
        <>
          <div className="c-bloco" style={{ marginTop: 14 }}>
            <strong style={{ fontSize: 14 }}>Lançar uma ação do desafio</strong>
            <p className="c-dica">
              Fica igual ao que ela teria marcado: já aprovado, com o seu nome no histórico.
            </p>
            {acoes.length === 0 ? (
              <p className="c-contagem">Este desafio não tem ações cadastradas.</p>
            ) : (
              <>
                <Campo rotulo="Ação">
                  <Selecao
                    valor={acao}
                    aoMudar={definirAcao}
                    opcoes={acoes.map((a) => ({
                      valor: a.id,
                      rotulo: `${a.nome} · +${a.pontos}`,
                    }))}
                  />
                </Campo>
                {acaoEscolhida?.periodicidade === "semanal" && (
                  <Campo rotulo="Semana" dica="A semana do desafio em que ela fez.">
                    <Selecao
                      valor={semana}
                      aoMudar={definirSemana}
                      opcoes={semanas.map((n) => ({ valor: String(n), rotulo: `Semana ${n}` }))}
                    />
                  </Campo>
                )}
                <button
                  type="button"
                  className="c-botao c-botao-pequeno"
                  disabled={ocupado || !acao}
                  onClick={() =>
                    void executar(
                      () =>
                        repositorio.concederAcao(
                          escolhida.id,
                          acao,
                          acaoEscolhida?.periodicidade === "semanal" ? Number(semana) : null,
                        ),
                      `Lancei ${acaoEscolhida?.nome ?? "a ação"} para ${escolhida.nome}.`,
                    )
                  }
                >
                  Lançar para {escolhida.nome}
                </button>
              </>
            )}
          </div>

          <div className="c-bloco" style={{ marginTop: 14 }}>
            <strong style={{ fontSize: 14 }}>Pontos avulsos</strong>
            <p className="c-dica">
              Para o que não é ação do checklist. Use número negativo para tirar pontos; nada some
              do histórico, a correção entra como uma linha nova.
            </p>
            <div className="c-duas-colunas">
              <Campo rotulo="Pontos">
                <Texto valor={pontos} aoMudar={definirPontos} tipo="number" placeholder="10" />
              </Campo>
              <Campo rotulo="Motivo" dica="A paciente vê este texto.">
                <Texto valor={motivo} aoMudar={definirMotivo} placeholder="Consulta extra" />
              </Campo>
            </div>
            <button
              type="button"
              className="c-botao c-botao-secundario c-botao-pequeno"
              disabled={ocupado || !pontos.trim() || !motivo.trim() || Number(pontos) === 0}
              onClick={() =>
                void executar(
                  () =>
                    repositorio.ajustarPontos(
                      escolhida.id,
                      Number(pontos),
                      motivo.trim(),
                      desafio.id,
                    ),
                  `Lancei ${pontos} para ${escolhida.nome}.`,
                ).then((deuCerto) => {
                  if (deuCerto) {
                    definirPontos("");
                    definirMotivo("");
                  }
                })
              }
            >
              Lançar pontos avulsos
            </button>
          </div>
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------- ranking

function Ranking({ desafioId }: { desafioId: string }) {
  const [lista, definirLista] = useState<LinhaDoRanking[]>([]);
  const [busca, definirBusca] = useState("");

  useEffect(() => {
    void repositorio.rankingDoDesafio(desafioId).then(definirLista).catch(() => definirLista([]));
  }, [desafioId]);

  const visiveis = lista.filter((l) => l.nome.toLowerCase().includes(busca.trim().toLowerCase()));

  if (lista.length === 0) return <p className="c-contagem">Ninguém pontuou ainda.</p>;

  return (
    <>
      <Campo rotulo="Buscar paciente">
        <Texto valor={busca} aoMudar={definirBusca} placeholder="Nome" />
      </Campo>
      <div className="c-ranking" style={{ marginTop: 12 }}>
        {visiveis.map((l) => (
          <div key={`${l.posicao}-${l.nome}`} className={`c-ranking-linha ${l.posicao <= 3 ? "destaque" : ""}`}>
            <span className="c-ranking-posicao">{l.posicao}º</span>
            <span className="c-ranking-nome">{l.nome}</span>
            <span className="c-ranking-pontos">{l.pontos} pts</span>
          </div>
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- indicações

const STATUS_INDICACAO: Record<string, string> = {
  registrada: "Registrada",
  iniciou: "Começou",
  validada: "Validada",
  recusada: "Recusada",
};

/**
 * A escada que ela ditou. Fica aqui como texto de apoio; os valores de
 * verdade moram na tabela `indicacao_beneficios`, que é o que a paciente lê.
 */
const ESCADA = [
  "1 indicação · 100 pontos",
  "2 indicações · 100 pontos + 20% de desconto na renovação do plano",
  "3 indicações · 100 pontos + 1 consulta bônus",
  "4 indicações · 100 pontos + 1 consulta bônus + 1 kit completo das marcas parceiras",
];

function Indicacoes({ desafioId }: { desafioId: string }) {
  const [lista, definirLista] = useState<IndicacaoPendente[]>([]);
  const [resumo, definirResumo] = useState<ResumoIndicacao[]>([]);
  const [pontos, definirPontos] = useState(100);
  const [ocupado, definirOcupado] = useState<string | null>(null);
  const [erro, definirErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      definirLista(await repositorio.listarIndicacoes());
      definirResumo(await repositorio.resumoIndicacoes());
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui carregar.");
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Quanto vale a indicação sai do banco, não de um número escrito aqui: o
  // dia em que ela mudar o valor, o botão muda junto.
  useEffect(() => {
    void repositorio
      .acoesDoDesafio(desafioId)
      .then((acoes) => {
        const indicacao = acoes.find((a) => a.chave === "indicacao");
        if (indicacao) definirPontos(indicacao.pontos);
      })
      .catch(() => undefined);
  }, [desafioId]);

  async function executar(id: string, acao: () => Promise<void>) {
    definirOcupado(id);
    try {
      await acao();
      await carregar();
    } catch (e) {
      definirErro(e instanceof Error ? e.message : "Não consegui salvar.");
    } finally {
      definirOcupado(null);
    }
  }

  return (
    <>
      {erro && (
        <div className="c-aviso c-aviso-erro" role="alert">
          <span>{erro}</span>
        </div>
      )}

      <div className="c-bloco">
        <strong style={{ fontSize: 14 }}>Quanto mais ela indica, mais ela ganha</strong>
        <div className="c-ranking" style={{ marginTop: 10 }}>
          {ESCADA.map((linha) => (
            <div key={linha} className="c-ranking-linha">
              <span className="c-ranking-nome">{linha}</span>
            </div>
          ))}
        </div>
        <p className="c-dica">
          As indicações não zeram no fim do mês: vão somando ao longo do tempo, como os pontos.
        </p>
      </div>

      {resumo.length > 0 && (
        <div className="c-bloco" style={{ marginTop: 14 }}>
          <strong style={{ fontSize: 14 }}>Quem já indicou</strong>
          <div className="c-ranking" style={{ marginTop: 10 }}>
            {resumo.map((r) => (
              <div key={r.pacienteId} className="c-ranking-linha">
                <span className="c-ranking-nome">{r.nome}</span>
                <span className="c-ranking-pontos">
                  {r.validadas} {r.validadas === 1 ? "indicação" : "indicações"}
                  {r.emAndamento > 0 ? ` · ${r.emAndamento} aguardando` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {lista.length === 0 ? (
        <p className="c-contagem" style={{ marginTop: 14 }}>
          Nenhuma indicação registrada.
        </p>
      ) : (
        <>
          <p className="c-dica" style={{ marginTop: 14 }}>
            Os {pontos} pontos só entram quando você confirma que a indicada começou o
            acompanhamento.
          </p>
          <div className="c-acoes">
            {lista.map((i) => (
              <article className="c-acao" key={i.id}>
                <div className="c-acao-topo">
                  <span className="c-acao-texto">
                    <strong>{i.nomeIndicada}</strong>
                    <span className="c-acao-descricao">
                      Indicada por {i.indicadoraNome} · {dataBonita(i.criadoEm.slice(0, 10))}
                    </span>
                    {i.emailIndicada && <span className="c-acao-descricao">{i.emailIndicada}</span>}
                  </span>
                  <SeloNeutro>
                    {STATUS_INDICACAO[i.status] ?? i.status}
                    {i.status === "validada" ? ` · +${pontos}` : ""}
                  </SeloNeutro>
                </div>
                {i.status !== "validada" && i.status !== "recusada" && (
                  <div className="c-acao-estado">
                    <button
                      type="button"
                      className="c-botao c-botao-pequeno"
                      disabled={ocupado === i.id}
                      onClick={() => void executar(i.id, () => repositorio.validarIndicacao(i.id))}
                    >
                      Começou o acompanhamento · +{pontos}
                    </button>
                    <button
                      type="button"
                      className="c-link"
                      disabled={ocupado === i.id}
                      onClick={() => void executar(i.id, () => repositorio.recusarIndicacao(i.id))}
                    >
                      Não começou
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------- criar/editar

const STATUS_OPCOES = [
  { valor: "rascunho", rotulo: "Rascunho (ninguém vê)" },
  { valor: "ativo", rotulo: "No ar" },
  { valor: "encerrado", rotulo: "Encerrado" },
];

function ModalDesafio({ desafio, aoFechar }: { desafio: DesafioAdmin | null; aoFechar: () => void }) {
  const hoje = hojeSaoPaulo();
  const [ano, mes] = hoje.split("-").map(Number) as [number, number];
  const primeiro = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const ultimo = `${ano}-${String(mes).padStart(2, "0")}-${new Date(Date.UTC(ano, mes, 0)).getUTCDate()}`;

  const [nome, definirNome] = useState(desafio?.nome ?? "");
  const [lema, definirLema] = useState(desafio?.lema ?? "Cada pequena ação conta.");
  const [descricao, definirDescricao] = useState(desafio?.descricao ?? "");
  const [regras, definirRegras] = useState(desafio?.regras ?? "");
  const [inicio, definirInicio] = useState(desafio?.dataInicio ?? primeiro);
  const [fim, definirFim] = useState(desafio?.dataFim ?? ultimo);
  const [status, definirStatus] = useState<string>(desafio?.status ?? "rascunho");
  const [aviso, definirAviso] = useState<string | null>(null);
  const [salvando, definirSalvando] = useState(false);

  async function salvar() {
    definirAviso(null);
    if (!nome.trim()) return definirAviso("Escreva o nome do desafio.");
    if (fim < inicio) return definirAviso("A data de fim não pode ser antes da de início.");
    definirSalvando(true);
    try {
      await repositorio.salvarDesafio({
        id: desafio?.id,
        nome: nome.trim(),
        lema: lema.trim() || null,
        descricao: descricao.trim() || null,
        regras: regras.trim() || null,
        dataInicio: inicio,
        dataFim: fim,
        status: status as DesafioAdmin["status"],
      });
      aoFechar();
    } catch (e) {
      definirAviso(e instanceof Error ? e.message : "Não consegui salvar.");
    } finally {
      definirSalvando(false);
    }
  }

  return (
    <Modal titulo={desafio ? "Editar desafio" : "Novo desafio"} aoFechar={aoFechar}>
      <Campo rotulo="Nome">
        <Texto valor={nome} aoMudar={definirNome} placeholder="Desafio de Outubro" />
      </Campo>
      <Campo rotulo="Lema" dica="A frase que abre a tela da paciente.">
        <Texto valor={lema} aoMudar={definirLema} />
      </Campo>
      <div className="c-duas-colunas">
        <Campo rotulo="Início">
          <Texto valor={inicio} aoMudar={definirInicio} tipo="date" />
        </Campo>
        <Campo rotulo="Fim">
          <Texto valor={fim} aoMudar={definirFim} tipo="date" />
        </Campo>
      </div>
      <Campo rotulo="Situação" dica="Rascunho não aparece para ninguém. Encerra sozinho na data de fim.">
        <Selecao valor={status} aoMudar={definirStatus} opcoes={STATUS_OPCOES} />
      </Campo>
      <Campo rotulo="Descrição">
        <AreaTexto valor={descricao} aoMudar={definirDescricao} linhas={2} />
      </Campo>
      <Campo rotulo="Como funciona" dica="Texto no fim da tela, explicando as regras.">
        <AreaTexto valor={regras} aoMudar={definirRegras} linhas={3} />
      </Campo>

      {desafio === null && (
        <p className="c-dica">
          As cinco ações e a pontuação vêm do desafio anterior. Para mudar valores, me chame.
        </p>
      )}

      {aviso && (
        <div className="c-aviso c-aviso-erro" role="alert">
          <span>{aviso}</span>
        </div>
      )}
      <div className="c-modal-acoes">
        <button type="button" className="c-botao c-botao-secundario" onClick={aoFechar}>
          Cancelar
        </button>
        <button type="button" className="c-botao" onClick={() => void salvar()} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </Modal>
  );
}
