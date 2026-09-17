import { useCallback, useEffect, useState } from "react";
import type { Paciente } from "@/central/types";
import type {
  ConteudoProtocolo,
  FichaProtocolo,
  ResumoProtocolo,
} from "@/central/types/protocolo";
import { CONTEUDO_VAZIO } from "@/central/types/protocolo";
import { repositorio } from "@/central/dados/repositorio";
import { contarProtocolo, interpretarProtocolo } from "@/central/utils/interpretarProtocolo";
import { dataBonita } from "@/central/utils/situacao";
import { AreaTexto, Campo, Selecao, Texto, linhasDeLista, listaDeLinhas } from "./componentes/Campos";

/**
 * Protocolo alimentar — área da nutricionista.
 *
 * O caminho é: colar do Google Docs → conferir o que o app entendeu →
 * corrigir o que ele errou → publicar. Salvar nunca publica, e publicar
 * nunca apaga a versão anterior.
 *
 * A tela não calcula nada. Não há caloria, macro nem porção em lugar nenhum
 * — ela faz esse cálculo fora, do jeito dela, e o aplicativo registra o
 * resultado. É a diferença entre guardar a decisão clínica e tomá-la.
 */
export function Protocolos() {
  const [pacientes, definirPacientes] = useState<Paciente[]>([]);
  const [resumos, definirResumos] = useState<ResumoProtocolo[]>([]);
  const [escolhida, definirEscolhida] = useState("");
  const [busca, definirBusca] = useState("");
  const [erro, definirErro] = useState<string | null>(null);

  const carregarResumos = useCallback(async () => {
    definirResumos(await repositorio.protocolosDasPacientes().catch(() => []));
  }, []);

  useEffect(() => {
    void repositorio
      .listarPacientes()
      .then(definirPacientes)
      .catch((e: unknown) =>
        definirErro(e instanceof Error ? e.message : "Não consegui carregar as pacientes."),
      );
    void carregarResumos();
  }, [carregarResumos]);

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
          Cole aqui o protocolo que você montou, confira o que o app entendeu e publique. A
          paciente só vê depois que você publicar.
        </p>
      </div>

      {erro && (
        <div className="c-aviso c-aviso-erro" role="alert">
          <span>{erro}</span>
        </div>
      )}

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
          aoMudar={() => void carregarResumos()}
        />
      )}
    </>
  );
}

function EditorDoProtocolo({
  paciente,
  aoMudar,
}: {
  paciente: Paciente;
  aoMudar: () => void;
}) {
  const [ficha, definirFicha] = useState<FichaProtocolo | null>(null);
  const [titulo, definirTitulo] = useState("Protocolo alimentar");
  const [conteudo, definirConteudo] = useState<ConteudoProtocolo>(CONTEUDO_VAZIO);
  const [ajustes, definirAjustes] = useState("");
  const [colado, definirColado] = useState("");
  const [aviso, definirAviso] = useState<string | null>(null);
  const [erro, definirErro] = useState<string | null>(null);
  const [ocupado, definirOcupado] = useState(false);

  const carregar = useCallback(async () => {
    const dados = await repositorio.protocoloDoPaciente(paciente.id);
    definirFicha(dados);
    const base = dados.rascunho ?? dados.publicado;
    definirTitulo(base?.titulo ?? "Protocolo alimentar");
    definirConteudo(base?.conteudo ?? CONTEUDO_VAZIO);
    definirAjustes(base?.ajustes ?? "");
  }, [paciente.id]);

  useEffect(() => {
    void carregar().catch((e: unknown) =>
      definirErro(e instanceof Error ? e.message : "Não consegui abrir o protocolo."),
    );
  }, [carregar]);

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

  function interpretar() {
    if (!colado.trim()) return;
    const lido = interpretarProtocolo(colado);
    // Junta com o que já estava na tela em vez de trocar: ela pode colar o
    // café da manhã agora e o jantar daqui a pouco.
    definirConteudo(
      conteudo.refeicoes.length === 0
        ? lido
        : {
            orientacoes: [...conteudo.orientacoes, ...lido.orientacoes],
            refeicoes: [...conteudo.refeicoes, ...lido.refeicoes],
            secoes: [...conteudo.secoes, ...lido.secoes],
          },
    );
    definirColado("");
    const c = contarProtocolo(lido);
    definirAviso(
      `Li ${c.refeicoes} ${c.refeicoes === 1 ? "refeição" : "refeições"}, ${c.itens} ${
        c.itens === 1 ? "item" : "itens"
      }, ${c.substituicoes} ${c.substituicoes === 1 ? "substituição" : "substituições"} e ${c.notas} ${
        c.notas === 1 ? "observação" : "observações"
      }. Confira antes de publicar.`,
    );
  }

  const contagem = contarProtocolo(conteudo);
  const publicado = ficha?.publicado ?? null;

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

      {publicado && (
        <p className="c-dica">
          No ar: versão {publicado.versao}
          {publicado.publicadoEm ? `, de ${dataBonita(publicado.publicadoEm.slice(0, 10))}` : ""}.
          {ficha?.rascunho ? " Há um rascunho não publicado." : ""}
        </p>
      )}

      <Campo rotulo="Colar do Google Docs" dica="Selecione o protocolo no documento, copie e cole aqui. Depois clique em Interpretar.">
        <AreaTexto
          valor={colado}
          aoMudar={definirColado}
          linhas={6}
          placeholder={"CAFÉ DA MANHÃ\nPão de forma\t3 fatias - 75g\tTapioca - 70g"}
        />
      </Campo>
      <button type="button" className="c-botao c-botao-secundario" onClick={interpretar} disabled={!colado.trim()}>
        Interpretar
      </button>

      <Campo rotulo="Título do protocolo">
        <Texto valor={titulo} aoMudar={definirTitulo} placeholder="Protocolo de emagrecimento" />
      </Campo>

      <Campo
        rotulo="Ajustes desta semana"
        dica="Aparece em destaque no topo da tela dela. Serve para trocar uma coisa sem refazer o protocolo."
      >
        <AreaTexto valor={ajustes} aoMudar={definirAjustes} linhas={2} />
      </Campo>

      <Campo rotulo="Orientações gerais" dica="Uma por linha.">
        <AreaTexto
          valor={linhasDeLista(conteudo.orientacoes)}
          aoMudar={(v) => definirConteudo({ ...conteudo, orientacoes: listaDeLinhas(v) })}
          linhas={3}
        />
      </Campo>

      <h2 className="c-secao-titulo" style={{ marginTop: 20 }}>
        Refeições
      </h2>
      <p className="c-dica" style={{ marginTop: 0 }}>
        {contagem.refeicoes} refeições, {contagem.itens} itens, {contagem.substituicoes}{" "}
        substituições.
      </p>

      {conteudo.refeicoes.length === 0 && (
        <p className="c-dica">Nada ainda. Cole o protocolo acima e clique em Interpretar.</p>
      )}

      {conteudo.refeicoes.map((refeicao, iRefeicao) => (
        <div className="c-bloco" key={`${refeicao.nome}-${iRefeicao}`}>
          <div className="c-bloco-topo">
            <Texto
              valor={refeicao.nome}
              aoMudar={(v) =>
                definirConteudo(trocarRefeicao(conteudo, iRefeicao, { ...refeicao, nome: v }))
              }
            />
            <button
              type="button"
              className="c-link"
              onClick={() => definirConteudo(removerRefeicao(conteudo, iRefeicao))}
            >
              Remover
            </button>
          </div>

          {refeicao.opcoes.map((opcao, iOpcao) => (
            <div key={iOpcao} style={{ marginTop: 14 }}>
              {refeicao.opcoes.length > 1 && (
                <Campo rotulo={`Opção ${iOpcao + 1}`}>
                  <Texto
                    valor={opcao.rotulo}
                    aoMudar={(v) =>
                      definirConteudo(
                        trocarOpcao(conteudo, iRefeicao, iOpcao, { ...opcao, rotulo: v }),
                      )
                    }
                  />
                </Campo>
              )}

              {opcao.itens.map((item, iItem) => (
                <div className="c-duas-colunas" key={iItem}>
                  <Campo rotulo="Alimento">
                    <Texto
                      valor={item.alimento}
                      aoMudar={(v) =>
                        definirConteudo(
                          trocarItem(conteudo, iRefeicao, iOpcao, iItem, { ...item, alimento: v }),
                        )
                      }
                    />
                  </Campo>
                  <Campo rotulo="Quantidade">
                    <Texto
                      valor={item.quantidade}
                      aoMudar={(v) =>
                        definirConteudo(
                          trocarItem(conteudo, iRefeicao, iOpcao, iItem, { ...item, quantidade: v }),
                        )
                      }
                    />
                  </Campo>
                  <Campo rotulo="Substituições" dica="Uma por linha.">
                    <AreaTexto
                      valor={linhasDeLista(item.substituicoes)}
                      linhas={2}
                      aoMudar={(v) =>
                        definirConteudo(
                          trocarItem(conteudo, iRefeicao, iOpcao, iItem, {
                            ...item,
                            substituicoes: listaDeLinhas(v),
                          }),
                        )
                      }
                    />
                  </Campo>
                </div>
              ))}

              <button
                type="button"
                className="c-link"
                onClick={() =>
                  definirConteudo(
                    trocarOpcao(conteudo, iRefeicao, iOpcao, {
                      ...opcao,
                      itens: [...opcao.itens, { alimento: "", quantidade: "", substituicoes: [] }],
                    }),
                  )
                }
              >
                + Acrescentar alimento
              </button>

              <Campo rotulo="Observações desta refeição" dica="Uma por linha. Chá, suplementação, modo de preparo.">
                <AreaTexto
                  valor={linhasDeLista(opcao.notas)}
                  linhas={2}
                  aoMudar={(v) =>
                    definirConteudo(
                      trocarOpcao(conteudo, iRefeicao, iOpcao, {
                        ...opcao,
                        notas: listaDeLinhas(v),
                      }),
                    )
                  }
                />
              </Campo>
            </div>
          ))}

          <button
            type="button"
            className="c-link"
            onClick={() =>
              definirConteudo(
                trocarRefeicao(conteudo, iRefeicao, {
                  ...refeicao,
                  opcoes: [
                    ...refeicao.opcoes,
                    { rotulo: `Opção ${refeicao.opcoes.length + 1}`, itens: [], notas: [] },
                  ],
                }),
              )
            }
          >
            + Acrescentar outra versão desta refeição
          </button>
        </div>
      ))}

      <button
        type="button"
        className="c-botao c-botao-secundario"
        style={{ marginTop: 12 }}
        onClick={() =>
          definirConteudo({
            ...conteudo,
            refeicoes: [
              ...conteudo.refeicoes,
              { nome: "Nova refeição", opcoes: [{ rotulo: "", itens: [], notas: [] }] },
            ],
          })
        }
      >
        + Acrescentar refeição
      </button>

      <h2 className="c-secao-titulo" style={{ marginTop: 24 }}>
        Orientações de rotina
      </h2>
      <p className="c-dica" style={{ marginTop: 0 }}>
        Os blocos de texto do fim do seu documento. A paciente abre quando quiser.
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
                definirConteudo({
                  ...conteudo,
                  secoes: conteudo.secoes.filter((_, j) => j !== i),
                })
              }
            >
              Remover
            </button>
          </div>
          <Campo rotulo="Texto" dica="Um parágrafo por linha.">
            <AreaTexto
              valor={linhasDeLista(secao.paragrafos)}
              linhas={3}
              aoMudar={(v) =>
                definirConteudo({
                  ...conteudo,
                  secoes: conteudo.secoes.map((x, j) =>
                    j === i ? { ...x, paragrafos: listaDeLinhas(v) } : x,
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
            secoes: [...conteudo.secoes, { titulo: "Novo bloco", paragrafos: [] }],
          })
        }
      >
        + Acrescentar bloco de rotina
      </button>

      <div style={{ display: "grid", gap: 10, marginTop: 20 }}>
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
                  conteudo,
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
                conteudo,
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
                    {v.publicadoEm ? `No ar em ${dataBonita(v.publicadoEm.slice(0, 10))}` : "Não publicada"}
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

// ---------------------------------------------------------------------------
// Trocas imutáveis. O conteúdo é o documento dela; mexer no objeto no lugar
// faria o React não perceber a mudança e a tela mentir sobre o que está
// salvo.
// ---------------------------------------------------------------------------

function trocarRefeicao(
  conteudo: ConteudoProtocolo,
  i: number,
  refeicao: ConteudoProtocolo["refeicoes"][number],
): ConteudoProtocolo {
  return { ...conteudo, refeicoes: conteudo.refeicoes.map((r, j) => (j === i ? refeicao : r)) };
}

function removerRefeicao(conteudo: ConteudoProtocolo, i: number): ConteudoProtocolo {
  return { ...conteudo, refeicoes: conteudo.refeicoes.filter((_, j) => j !== i) };
}

function trocarOpcao(
  conteudo: ConteudoProtocolo,
  iRefeicao: number,
  iOpcao: number,
  opcao: ConteudoProtocolo["refeicoes"][number]["opcoes"][number],
): ConteudoProtocolo {
  const refeicao = conteudo.refeicoes[iRefeicao];
  if (!refeicao) return conteudo;
  return trocarRefeicao(conteudo, iRefeicao, {
    ...refeicao,
    opcoes: refeicao.opcoes.map((o, j) => (j === iOpcao ? opcao : o)),
  });
}

function trocarItem(
  conteudo: ConteudoProtocolo,
  iRefeicao: number,
  iOpcao: number,
  iItem: number,
  item: ConteudoProtocolo["refeicoes"][number]["opcoes"][number]["itens"][number],
): ConteudoProtocolo {
  const opcao = conteudo.refeicoes[iRefeicao]?.opcoes[iOpcao];
  if (!opcao) return conteudo;
  return trocarOpcao(conteudo, iRefeicao, iOpcao, {
    ...opcao,
    itens: opcao.itens.map((it, j) => (j === iItem ? item : it)),
  });
}
