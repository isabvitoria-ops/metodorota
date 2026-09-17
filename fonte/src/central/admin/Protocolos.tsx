import { useCallback, useEffect, useRef, useState } from "react";
import type { Paciente } from "@/central/types";
import type {
  ConteudoProtocolo,
  FichaProtocolo,
  GrupoDoProtocolo,
  ItemProtocolo,
  OpcaoProtocolo,
  RefeicaoProtocolo,
  ResumoProtocolo,
} from "@/central/types/protocolo";
import { CONTEUDO_VAZIO } from "@/central/types/protocolo";
import { repositorio } from "@/central/dados/repositorio";
import { dataBonita } from "@/central/utils/situacao";
import { AreaDeLinhas, AreaTexto, Campo, Selecao, Texto } from "./componentes/Campos";

/**
 * Protocolo alimentar — área da nutricionista.
 *
 * Montado à mão, refeição por refeição. A primeira versão desta tela tentava
 * interpretar o protocolo colado do Google Docs; ela testou e o resultado
 * saiu bagunçado, então o caminho de colar saiu inteiro. Digitar dá mais
 * trabalho uma vez e evita conferir tudo toda vez — foi a escolha dela, e
 * está certa.
 *
 * A tela não calcula nada: nem caloria, nem macro, nem porção. Ela faz o
 * cálculo fora, do jeito dela; o aplicativo guarda o resultado e mostra
 * bonito para a paciente.
 */

/**
 * As refeições mais comuns, para acrescentar num toque.
 *
 * É lista de atalho, não de obrigação: paciente com quatro refeições recebe
 * quatro, e o campo ao lado aceita qualquer nome que ela queira ("Pré-treino",
 * "Jantar de sábado", "Ceia opcional").
 */
const REFEICOES_COMUNS = [
  "Café da manhã",
  "Lanche da manhã",
  "Almoço",
  "Lanche da tarde",
  "Jantar",
  "Ceia",
];

export function Protocolos() {
  const [aba, definirAba] = useState<"pacientes" | "grupos">("pacientes");
  const [grupos, definirGrupos] = useState<GrupoDoProtocolo[]>([]);
  const [pacientes, definirPacientes] = useState<Paciente[]>([]);
  const [resumos, definirResumos] = useState<ResumoProtocolo[]>([]);
  const [escolhida, definirEscolhida] = useState("");
  const [busca, definirBusca] = useState("");
  const [erro, definirErro] = useState<string | null>(null);

  const carregarResumos = useCallback(async () => {
    definirResumos(await repositorio.protocolosDasPacientes().catch(() => []));
  }, []);

  const carregarGrupos = useCallback(async () => {
    definirGrupos(await repositorio.listarGruposProtocolo().catch(() => []));
  }, []);

  useEffect(() => {
    void repositorio
      .listarPacientes()
      .then(definirPacientes)
      .catch((e: unknown) =>
        definirErro(e instanceof Error ? e.message : "Não consegui carregar as pacientes."),
      );
    void carregarResumos();
    void carregarGrupos();
  }, [carregarResumos, carregarGrupos]);

  const visiveis = pacientes.filter((p) =>
    p.nome.toLowerCase().includes(busca.trim().toLowerCase()),
  );
  const paciente = pacientes.find((p) => p.id === escolhida) ?? null;
  const comProtocolo = resumos.filter((r) => r.situacao === "publicado").length;

  function rotuloDa(p: Paciente): string {
    const resumo = resumos.find((r) => r.pacienteId === p.id);
    if (!resumo) return p.nome;
    if (resumo.temRascunho) return `${p.nome} · rascunho não publicado`;
    if (resumo.situacao === "publicado") return `${p.nome} · publicado`;
    return `${p.nome} · sem protocolo`;
  }

  return (
    <>
      <div style={{ marginBottom: 4 }}>
        <h1 className="c-titulo" style={{ fontSize: 28 }}>
          Protocolo alimentar
        </h1>
        <p className="c-subtitulo">
          Monte o protocolo de cada paciente aqui. Ela só vê depois que você publicar.
        </p>
      </div>

      {erro && (
        <div className="c-aviso c-aviso-erro" role="alert">
          <span>{erro}</span>
        </div>
      )}

      <div className="c-admin-abas" style={{ marginTop: 16, marginBottom: 4 }}>
        <button
          type="button"
          className={`c-admin-aba ${aba === "pacientes" ? "ativo" : ""}`}
          onClick={() => definirAba("pacientes")}
        >
          Protocolo das pacientes
        </button>
        <button
          type="button"
          className={`c-admin-aba ${aba === "grupos" ? "ativo" : ""}`}
          onClick={() => definirAba("grupos")}
        >
          Grupos de alimentos
        </button>
      </div>

      {/* As duas ficam montadas, só uma aparece. Desmontar a de protocolo
          ao ir em "Grupos" jogava fora o que ela tinha acabado de escrever —
          era o "é como se não salvasse só porque fui para outra aba". */}
      <div hidden={aba !== "grupos"}>
        <GruposDeAlimentos grupos={grupos} aoMudar={() => void carregarGrupos()} />
      </div>

      <div hidden={aba !== "pacientes"}>
      <Campo rotulo="Buscar paciente">
        <Texto valor={busca} aoMudar={definirBusca} placeholder="Nome" />
      </Campo>
      <p className="c-dica" style={{ marginTop: -4 }}>
        {comProtocolo === 0
          ? "Nenhuma paciente com protocolo publicado ainda."
          : `${comProtocolo} ${comProtocolo === 1 ? "paciente está" : "pacientes estão"} com protocolo publicado.`}
      </p>

      <Campo rotulo="Paciente">
        <Selecao
          valor={escolhida}
          aoMudar={definirEscolhida}
          opcoes={[
            { valor: "", rotulo: "Escolha a paciente" },
            ...visiveis.map((p) => ({ valor: p.id, rotulo: rotuloDa(p) })),
          ]}
        />
      </Campo>

      {paciente && (
        /* `key` pelo id: sem ela, trocar de paciente com a tela aberta
           deixaria o rascunho de uma aparecendo no lugar do da outra — e
           salvar gravaria a dieta errada na ficha errada. Já aconteceu duas
           vezes neste projeto; aqui o estrago seria clínico. */
        <EditorDoProtocolo
          key={paciente.id}
          paciente={paciente}
          grupos={grupos}
          aoMudar={() => void carregarResumos()}
        />
      )}
      </div>
    </>
  );
}

function EditorDoProtocolo({
  paciente,
  grupos,
  aoMudar,
}: {
  paciente: Paciente;
  grupos: GrupoDoProtocolo[];
  aoMudar: () => void;
}) {
  const [ficha, definirFicha] = useState<FichaProtocolo | null>(null);
  const [titulo, definirTitulo] = useState("Protocolo alimentar");
  const [conteudo, definirConteudo] = useState<ConteudoProtocolo>(CONTEUDO_VAZIO);
  const [ajustes, definirAjustes] = useState("");
  const [nomeNovo, definirNomeNovo] = useState("");
  const [aviso, definirAviso] = useState<string | null>(null);
  const [erro, definirErro] = useState<string | null>(null);
  const [ocupado, definirOcupado] = useState(false);
  const [guardando, definirGuardando] = useState<"parado" | "salvando" | "salvo">("parado");
  // O que veio do banco. Enquanto for igual ao da tela, não há o que guardar
  // — e é isso que impede o salvamento automático de disparar na abertura.
  const espelho = useRef<string>("");

  const carregar = useCallback(async () => {
    const dados = await repositorio.protocoloDoPaciente(paciente.id);
    definirFicha(dados);
    const base = dados.rascunho ?? dados.publicado;
    definirTitulo(base?.titulo ?? "Protocolo alimentar");
    definirConteudo(base?.conteudo ?? CONTEUDO_VAZIO);
    definirAjustes(base?.ajustes ?? "");
    espelho.current = JSON.stringify([
      base?.titulo ?? "Protocolo alimentar",
      base?.conteudo ?? CONTEUDO_VAZIO,
      base?.ajustes ?? "",
    ]);
    definirGuardando("parado");
  }, [paciente.id]);

  useEffect(() => {
    void carregar().catch((e: unknown) =>
      definirErro(e instanceof Error ? e.message : "Não consegui abrir o protocolo."),
    );
  }, [carregar]);

  /**
   * Guarda o rascunho sozinho, um segundo e meio depois de ela parar de
   * escrever.
   *
   * Ela reclamou que "é como se não salvasse" ao mudar de assunto na tela.
   * Um botão que só ela lembra de apertar é uma armadilha quando o que se
   * perde é a dieta de alguém. Guardar sozinho nunca publica: a paciente
   * continua vendo o que estava no ar.
   */
  useEffect(() => {
    const atual = JSON.stringify([titulo, conteudo, ajustes]);
    if (atual === espelho.current) return;
    if (conteudo.refeicoes.length === 0 && conteudo.orientacoes.length === 0) return;

    definirGuardando("salvando");
    const relogio = setTimeout(() => {
      void repositorio
        .salvarRascunhoProtocolo(paciente.id, titulo, limpar(conteudo), ajustes.trim() || null)
        .then(() => {
          espelho.current = atual;
          definirGuardando("salvo");
          aoMudar();
        })
        .catch(() => definirGuardando("parado"));
    }, 1500);

    return () => clearTimeout(relogio);
  }, [titulo, conteudo, ajustes, paciente.id, aoMudar]);

  async function executar(acao: () => Promise<void>, mensagem: string) {
    definirOcupado(true);
    definirErro(null);
    try {
      await acao();
      await carregar();
      aoMudar();
      definirAviso(mensagem);
    } catch (e: unknown) {
      definirErro(e instanceof Error ? e.message : "Não consegui salvar.");
    } finally {
      definirOcupado(false);
    }
  }

  function acrescentarRefeicao(nome: string) {
    const limpo = nome.trim();
    if (!limpo) return;
    definirConteudo({
      ...conteudo,
      refeicoes: [
        ...conteudo.refeicoes,
        // Já nasce com uma linha em branco: sem isso ela acrescenta a
        // refeição e precisa de um segundo clique só para começar a escrever.
        { nome: limpo, opcoes: [{ rotulo: "", itens: [itemVazio()], notas: [] }] },
      ],
    });
    definirAviso(null);
  }

  const publicado = ficha?.publicado ?? null;
  const jaTem = (nome: string) =>
    conteudo.refeicoes.some((r) => r.nome.toLowerCase() === nome.toLowerCase());

  return (
    <div style={{ marginTop: 18 }}>
      {aviso && (
        <div className="c-aviso c-aviso-ok" role="status">
          <span>{aviso}</span>
        </div>
      )}
      {erro && (
        <div className="c-aviso c-aviso-erro" role="alert">
          <span>{erro}</span>
        </div>
      )}

      <p className="c-dica" aria-live="polite" style={{ minHeight: 18 }}>
        {guardando === "salvando" && "Guardando…"}
        {guardando === "salvo" && "Rascunho guardado. A paciente ainda não vê."}
      </p>

      {publicado && (
        <p className="c-dica">
          No ar: versão {publicado.versao}
          {publicado.publicadoEm ? `, de ${dataBonita(publicado.publicadoEm.slice(0, 10))}` : ""}.
          {ficha?.rascunho ? " Há um rascunho não publicado." : ""}
        </p>
      )}

      <Campo rotulo="Título do protocolo">
        <Texto valor={titulo} aoMudar={definirTitulo} placeholder="Protocolo de emagrecimento" />
      </Campo>

      <Campo
        rotulo="Ajustes desta semana"
        dica="Aparece em destaque no topo da tela dela. Serve para trocar uma coisa sem refazer o protocolo."
      >
        <AreaTexto valor={ajustes} aoMudar={definirAjustes} linhas={2} />
      </Campo>

      <Campo rotulo="Orientações gerais" dica="Uma por linha. Aparecem antes das refeições.">
        <AreaDeLinhas
          valor={conteudo.orientacoes}
          aoMudar={(lista) => definirConteudo({ ...conteudo, orientacoes: lista })}
          linhas={3}
        />
      </Campo>

      <h2 className="c-secao-titulo" style={{ marginTop: 22 }}>
        Refeições
      </h2>
      <p className="c-dica" style={{ marginTop: 0 }}>
        Acrescente só as refeições desta paciente. Toque no nome para mudar.
      </p>

      <div className="c-chips">
        {REFEICOES_COMUNS.filter((nome) => !jaTem(nome)).map((nome) => (
          <button
            key={nome}
            type="button"
            className="c-chip"
            onClick={() => acrescentarRefeicao(nome)}
          >
            + {nome}
          </button>
        ))}
      </div>

      <div className="c-duas-colunas">
        <Campo rotulo="Outra refeição" dica="Escreva o nome e acrescente.">
          <Texto valor={nomeNovo} aoMudar={definirNomeNovo} placeholder="Pré-treino" />
        </Campo>
        <Campo rotulo=" ">
          <button
            type="button"
            className="c-botao c-botao-secundario"
            disabled={!nomeNovo.trim()}
            onClick={() => {
              acrescentarRefeicao(nomeNovo);
              definirNomeNovo("");
            }}
          >
            Acrescentar
          </button>
        </Campo>
      </div>

      {conteudo.refeicoes.length === 0 && (
        <p className="c-dica">
          Nenhuma refeição ainda. Use os botões acima para montar o dia desta paciente.
        </p>
      )}

      {conteudo.refeicoes.map((refeicao, iRefeicao) => (
        <BlocoDaRefeicao
          key={iRefeicao}
          refeicao={refeicao}
          grupos={grupos}
          primeira={iRefeicao === 0}
          ultima={iRefeicao === conteudo.refeicoes.length - 1}
          aoTrocar={(nova) => definirConteudo(trocarRefeicao(conteudo, iRefeicao, nova))}
          aoRemover={() => definirConteudo(removerRefeicao(conteudo, iRefeicao))}
          aoMover={(passo) => definirConteudo(moverRefeicao(conteudo, iRefeicao, passo))}
        />
      ))}

      <h2 className="c-secao-titulo" style={{ marginTop: 24 }}>
        Orientações de rotina
      </h2>
      <p className="c-dica" style={{ marginTop: 0 }}>
        Blocos de texto que ficam no fim, fechados. A paciente abre quando quiser — acordar cedo,
        beber água, como cozinhar, o que fazer no fim de semana.
      </p>

      {conteudo.secoes.map((secao, i) => (
        <div className="c-bloco" key={i}>
          <div className="c-bloco-topo">
            <Texto
              valor={secao.titulo}
              aoMudar={(v) =>
                definirConteudo({
                  ...conteudo,
                  secoes: conteudo.secoes.map((x, j) => (j === i ? { ...x, titulo: v } : x)),
                })
              }
            />
            <button
              type="button"
              className="c-link"
              onClick={() =>
                definirConteudo({ ...conteudo, secoes: conteudo.secoes.filter((_, j) => j !== i) })
              }
            >
              Remover
            </button>
          </div>
          <Campo rotulo="Texto" dica="Um parágrafo por linha.">
            <AreaDeLinhas
              valor={secao.paragrafos}
              linhas={3}
              aoMudar={(lista) =>
                definirConteudo({
                  ...conteudo,
                  secoes: conteudo.secoes.map((x, j) =>
                    j === i ? { ...x, paragrafos: lista } : x,
                  ),
                })
              }
            />
          </Campo>
        </div>
      ))}

      <button
        type="button"
        className="c-botao c-botao-secundario"
        style={{ marginTop: 12 }}
        onClick={() =>
          definirConteudo({
            ...conteudo,
            secoes: [...conteudo.secoes, { titulo: "", paragrafos: [] }],
          })
        }
      >
        + Acrescentar bloco de rotina
      </button>

      <div style={{ display: "grid", gap: 10, marginTop: 22 }}>
        <button
          type="button"
          className="c-botao"
          disabled={ocupado}
          onClick={() =>
            void executar(
              () =>
                repositorio.salvarRascunhoProtocolo(
                  paciente.id,
                  titulo,
                  limpar(conteudo),
                  ajustes.trim() || null,
                ),
              "Rascunho salvo. A paciente ainda não vê.",
            )
          }
        >
          Salvar rascunho
        </button>

        <button
          type="button"
          className="c-botao c-botao-secundario"
          disabled={ocupado || conteudo.refeicoes.length === 0}
          onClick={() =>
            void executar(async () => {
              // Salvar antes de publicar: sem isto, publicar mandaria para a
              // paciente a versão de antes da última correção na tela.
              await repositorio.salvarRascunhoProtocolo(
                paciente.id,
                titulo,
                limpar(conteudo),
                ajustes.trim() || null,
              );
              await repositorio.publicarProtocolo(paciente.id);
            }, `Publicado. ${paciente.nome} já vê o protocolo no aplicativo.`)
          }
        >
          Publicar para {paciente.nome.split(" ")[0]}
        </button>

        {publicado && (
          <button
            type="button"
            className="c-botao c-botao-secundario"
            disabled={ocupado}
            onClick={() =>
              void executar(
                () => repositorio.definirAjustesProtocolo(paciente.id, ajustes.trim() || null),
                "Recado da semana atualizado. Chegou na paciente agora.",
              )
            }
          >
            Enviar só os ajustes
          </button>
        )}

        {ficha?.rascunho && (
          <button
            type="button"
            className="c-link"
            disabled={ocupado}
            onClick={() =>
              void executar(
                () => repositorio.descartarRascunhoProtocolo(paciente.id),
                "Rascunho descartado. O que estava no ar continua igual.",
              )
            }
          >
            Descartar rascunho
          </button>
        )}
      </div>

      {(ficha?.historico.length ?? 0) > 0 && (
        <>
          <h2 className="c-secao-titulo" style={{ marginTop: 24 }}>
            Versões anteriores
          </h2>
          <div className="c-lista">
            {ficha?.historico.map((v) => (
              <div className="c-lista-item" key={v.id}>
                <span>
                  <span className="c-lista-item-nome">
                    Versão {v.versao} — {v.titulo}
                  </span>
                  <span className="c-lista-item-apoio">
                    {v.publicadoEm
                      ? `No ar em ${dataBonita(v.publicadoEm.slice(0, 10))}`
                      : "Não publicada"}
                  </span>
                </span>
                <button
                  type="button"
                  className="c-link"
                  disabled={ocupado}
                  onClick={() =>
                    void executar(
                      () => repositorio.restaurarProtocolo(v.id),
                      "Versão trazida de volta como rascunho. Confira e publique.",
                    )
                  }
                >
                  Restaurar
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function BlocoDaRefeicao({
  refeicao,
  grupos,
  primeira,
  ultima,
  aoTrocar,
  aoRemover,
  aoMover,
}: {
  refeicao: RefeicaoProtocolo;
  grupos: GrupoDoProtocolo[];
  primeira: boolean;
  ultima: boolean;
  aoTrocar: (nova: RefeicaoProtocolo) => void;
  aoRemover: () => void;
  aoMover: (passo: -1 | 1) => void;
}) {
  function trocarOpcao(iOpcao: number, nova: OpcaoProtocolo) {
    aoTrocar({ ...refeicao, opcoes: refeicao.opcoes.map((o, j) => (j === iOpcao ? nova : o)) });
  }

  return (
    <div className="c-bloco">
      <div className="c-bloco-topo">
        <Texto valor={refeicao.nome} aoMudar={(v) => aoTrocar({ ...refeicao, nome: v })} />
        <span className="c-hora-refeicao">
          <Texto
            valor={refeicao.horario ?? ""}
            aoMudar={(v) => aoTrocar({ ...refeicao, horario: v })}
            placeholder="08:00"
          />
        </span>
        <span className="c-acoes-refeicao">
          <button type="button" className="c-link" disabled={primeira} onClick={() => aoMover(-1)}>
            ↑
          </button>
          <button type="button" className="c-link" disabled={ultima} onClick={() => aoMover(1)}>
            ↓
          </button>
          <button type="button" className="c-link" onClick={aoRemover}>
            Remover
          </button>
        </span>
      </div>

      {refeicao.opcoes.map((opcao, iOpcao) => (
        <div key={iOpcao} style={{ marginTop: iOpcao === 0 ? 8 : 16 }}>
          {refeicao.opcoes.length > 1 && (
            <div className="c-bloco-topo">
              <Campo rotulo={`Versão ${iOpcao + 1}`} dica="Ex.: Hambúrguer, Pastel na airfryer.">
                <Texto
                  valor={opcao.rotulo}
                  aoMudar={(v) => trocarOpcao(iOpcao, { ...opcao, rotulo: v })}
                />
              </Campo>
              <button
                type="button"
                className="c-link"
                onClick={() =>
                  aoTrocar({
                    ...refeicao,
                    opcoes: refeicao.opcoes.filter((_, j) => j !== iOpcao),
                  })
                }
              >
                Remover versão
              </button>
            </div>
          )}

          {opcao.itens.map((item, iItem) => (
            <div key={iItem} className="c-linha-item">
              <div className="c-duas-colunas">
                <Campo rotulo="Alimento">
                  <Texto
                    valor={item.alimento}
                    aoMudar={(v) =>
                      trocarOpcao(iOpcao, {
                        ...opcao,
                        itens: opcao.itens.map((x, j) => (j === iItem ? { ...x, alimento: v } : x)),
                      })
                    }
                  />
                </Campo>
                <Campo rotulo="Quantidade">
                  <Texto
                    valor={item.quantidade}
                    aoMudar={(v) =>
                      trocarOpcao(iOpcao, {
                        ...opcao,
                        itens: opcao.itens.map((x, j) =>
                          j === iItem ? { ...x, quantidade: v } : x,
                        ),
                      })
                    }
                    placeholder="3 fatias - 75g"
                  />
                </Campo>
                <Campo rotulo="Substituições" dica="Uma por linha. Pode não ter nenhuma.">
                  <AreaDeLinhas
                    valor={item.substituicoes}
                    linhas={2}
                    placeholder={"Tapioca - 70g\nPão francês - 1 unidade"}
                    aoMudar={(lista) =>
                      trocarOpcao(iOpcao, {
                        ...opcao,
                        itens: opcao.itens.map((x, j) =>
                          j === iItem ? { ...x, substituicoes: lista } : x,
                        ),
                      })
                    }
                  />
                </Campo>
              </div>
              <button
                type="button"
                className="c-link"
                onClick={() =>
                  trocarOpcao(iOpcao, {
                    ...opcao,
                    itens: opcao.itens.filter((_, j) => j !== iItem),
                  })
                }
              >
                Remover alimento
              </button>
            </div>
          ))}

          <div className="c-acoes-refeicao" style={{ gap: 16, flexWrap: "wrap" }}>
            <button
              type="button"
              className="c-link"
              onClick={() => trocarOpcao(iOpcao, { ...opcao, itens: [...opcao.itens, itemVazio()] })}
            >
              + Acrescentar alimento
            </button>

            {grupos.length > 0 && (
              <Selecao
                valor=""
                aoMudar={(id) => {
                  const grupo = grupos.find((g) => g.id === id);
                  if (!grupo) return;
                  // O grupo entra COPIADO: vira um item com o nome dele e a
                  // lista como substituições. Mexer no grupo depois não muda
                  // a dieta de quem já recebeu este protocolo.
                  trocarOpcao(iOpcao, {
                    ...opcao,
                    itens: [
                      ...opcao.itens,
                      {
                        alimento: grupo.nome,
                        quantidade: "1 porção",
                        substituicoes: grupo.itens.map((i) =>
                          i.quantidade ? `${i.alimento} - ${i.quantidade}` : i.alimento,
                        ),
                      },
                    ],
                  });
                }}
                opcoes={[
                  { valor: "", rotulo: "+ Usar um grupo…" },
                  ...grupos.map((g) => ({ valor: g.id, rotulo: `${g.nome} (${g.itens.length})` })),
                ]}
              />
            )}
          </div>

          <Campo
            rotulo="Lembrete desta refeição"
            dica="Um por linha. Chá, suplementação, modo de preparo, vegetais liberados — aparece embaixo desta refeição, na tela dela."
          >
            <AreaDeLinhas
              valor={opcao.notas}
              linhas={2}
              aoMudar={(lista) => trocarOpcao(iOpcao, { ...opcao, notas: lista })}
            />
          </Campo>
        </div>
      ))}

      <button
        type="button"
        className="c-link"
        onClick={() =>
          aoTrocar({
            ...refeicao,
            opcoes: [
              ...refeicao.opcoes,
              { rotulo: "", itens: [itemVazio()], notas: [] },
            ],
          })
        }
      >
        + Acrescentar outra versão desta refeição
      </button>
    </div>
  );
}

function itemVazio(): ItemProtocolo {
  return { alimento: "", quantidade: "", substituicoes: [] };
}

/**
 * Tira as linhas em branco antes de gravar.
 *
 * A tela sempre deixa uma linha vazia esperando ser preenchida; se ela
 * publicar sem usar, a paciente veria um item fantasma no meio da dieta.
 * Aqui é o único lugar que mexe no conteúdo dela — e só para tirar o que
 * ela não escreveu.
 */
function limpar(conteudo: ConteudoProtocolo): ConteudoProtocolo {
  return {
    orientacoes: conteudo.orientacoes.filter((o) => o.trim()),
    secoes: conteudo.secoes
      .map((s) => ({ ...s, titulo: s.titulo.trim() }))
      .filter((s) => s.titulo || s.paragrafos.length > 0),
    refeicoes: conteudo.refeicoes
      .map((r) => ({
        ...r,
        nome: r.nome.trim(),
        opcoes: r.opcoes
          .map((o) => ({ ...o, itens: o.itens.filter((i) => i.alimento.trim()) }))
          .filter((o) => o.itens.length > 0 || o.notas.length > 0),
      }))
      .filter((r) => r.nome && r.opcoes.length > 0),
  };
}

function trocarRefeicao(
  conteudo: ConteudoProtocolo,
  i: number,
  refeicao: RefeicaoProtocolo,
): ConteudoProtocolo {
  return { ...conteudo, refeicoes: conteudo.refeicoes.map((r, j) => (j === i ? refeicao : r)) };
}

function removerRefeicao(conteudo: ConteudoProtocolo, i: number): ConteudoProtocolo {
  return { ...conteudo, refeicoes: conteudo.refeicoes.filter((_, j) => j !== i) };
}

function moverRefeicao(conteudo: ConteudoProtocolo, i: number, passo: -1 | 1): ConteudoProtocolo {
  const destino = i + passo;
  if (destino < 0 || destino >= conteudo.refeicoes.length) return conteudo;
  const refeicoes = [...conteudo.refeicoes];
  const atual = refeicoes[i];
  const outra = refeicoes[destino];
  if (!atual || !outra) return conteudo;
  refeicoes[i] = outra;
  refeicoes[destino] = atual;
  return { ...conteudo, refeicoes };
}


/**
 * Grupos de alimentos — a lista que ela monta uma vez e usa em toda paciente.
 *
 * "Frutas" com a porção de cada uma, "Carboidratos do almoço" com as fontes
 * que ela aceita. Sem caloria e sem macro: nome e quantidade, escritos por
 * ela, que é o que entra no protocolo.
 */
function GruposDeAlimentos({
  grupos,
  aoMudar,
}: {
  grupos: GrupoDoProtocolo[];
  aoMudar: () => void;
}) {
  const [abertoId, definirAberto] = useState<string | null>(null);
  const [nome, definirNome] = useState("");
  const [itens, definirItens] = useState<GrupoDoProtocolo["itens"]>([{ alimento: "", quantidade: "" }]);
  const [aviso, definirAviso] = useState<string | null>(null);
  const [erro, definirErro] = useState<string | null>(null);
  const [ocupado, definirOcupado] = useState(false);

  function abrir(grupo: GrupoDoProtocolo | null) {
    definirAberto(grupo?.id ?? "novo");
    definirNome(grupo?.nome ?? "");
    definirItens(
      grupo && grupo.itens.length > 0 ? [...grupo.itens] : [{ alimento: "", quantidade: "" }],
    );
    definirErro(null);
  }

  async function executar(acao: () => Promise<void>, mensagem: string) {
    definirOcupado(true);
    definirErro(null);
    try {
      await acao();
      aoMudar();
      definirAviso(mensagem);
      definirAberto(null);
    } catch (e: unknown) {
      definirErro(e instanceof Error ? e.message : "Não consegui salvar o grupo.");
    } finally {
      definirOcupado(false);
    }
  }

  return (
    <div style={{ marginTop: 14 }}>
      <p className="c-dica" style={{ marginTop: 0 }}>
        Monte aqui as listas que você repete em toda paciente. Depois, em cada refeição, é só
        escolher o grupo — ele entra copiado, então mexer nele aqui não muda a dieta de quem já
        recebeu.
      </p>

      {aviso && (
        <div className="c-aviso c-aviso-ok" role="status">
          <span>{aviso}</span>
        </div>
      )}
      {erro && (
        <div className="c-aviso c-aviso-erro" role="alert">
          <span>{erro}</span>
        </div>
      )}

      {grupos.length === 0 && abertoId === null && (
        <p className="c-dica">Nenhum grupo ainda.</p>
      )}

      <div className="c-lista">
        {grupos.map((g) => (
          <div className="c-lista-item" key={g.id}>
            <span>
              <span className="c-lista-item-nome">{g.nome}</span>
              <span className="c-lista-item-apoio">
                {g.itens.length} {g.itens.length === 1 ? "alimento" : "alimentos"}
                {g.itens.length > 0 ? ` · ${g.itens.map((i) => i.alimento).join(", ")}` : ""}
              </span>
            </span>
            <button type="button" className="c-link" onClick={() => abrir(g)}>
              Editar
            </button>
          </div>
        ))}
      </div>

      {abertoId === null && (
        <button
          type="button"
          className="c-botao c-botao-secundario"
          style={{ marginTop: 14 }}
          onClick={() => abrir(null)}
        >
          + Novo grupo
        </button>
      )}

      {abertoId !== null && (
        <div className="c-bloco">
          <Campo rotulo="Nome do grupo" dica="Ex.: Frutas, Carboidratos do almoço, Proteínas.">
            <Texto valor={nome} aoMudar={definirNome} placeholder="Frutas" />
          </Campo>

          {itens.map((item, i) => (
            <div className="c-linha-item" key={i}>
              <div className="c-duas-colunas">
                <Campo rotulo="Alimento">
                  <Texto
                    valor={item.alimento}
                    aoMudar={(v) =>
                      definirItens(itens.map((x, j) => (j === i ? { ...x, alimento: v } : x)))
                    }
                    placeholder="Banana"
                  />
                </Campo>
                <Campo rotulo="Quantidade">
                  <Texto
                    valor={item.quantidade}
                    aoMudar={(v) =>
                      definirItens(itens.map((x, j) => (j === i ? { ...x, quantidade: v } : x)))
                    }
                    placeholder="1 unidade"
                  />
                </Campo>
              </div>
              <button
                type="button"
                className="c-link"
                onClick={() => definirItens(itens.filter((_, j) => j !== i))}
              >
                Remover
              </button>
            </div>
          ))}

          <button
            type="button"
            className="c-link"
            onClick={() => definirItens([...itens, { alimento: "", quantidade: "" }])}
          >
            + Acrescentar alimento
          </button>

          <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
            <button
              type="button"
              className="c-botao"
              disabled={ocupado || !nome.trim()}
              onClick={() =>
                void executar(
                  () =>
                    repositorio.salvarGrupoProtocolo(
                      abertoId === "novo" ? null : abertoId,
                      nome,
                      itens.filter((i) => i.alimento.trim()),
                    ),
                  "Grupo guardado.",
                )
              }
            >
              Guardar grupo
            </button>

            <button type="button" className="c-link" onClick={() => definirAberto(null)}>
              Cancelar
            </button>

            {abertoId !== "novo" && (
              <button
                type="button"
                className="c-link"
                disabled={ocupado}
                onClick={() =>
                  void executar(
                    () => repositorio.excluirGrupoProtocolo(abertoId),
                    "Grupo apagado. Os protocolos que já usaram continuam iguais.",
                  )
                }
              >
                Apagar este grupo
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
