import type { EstabelecimentoComerFora, NivelEscolha, OpcaoComerFora } from "@/central/types";
import { gerarIdentificador } from "@/central/hooks/useCatalogo";
import { AreaTexto, Campo, Selecao, Texto, linhasDeLista, listaDeLinhas } from "./Campos";
import { CampoLogo } from "./CampoLogo";

/**
 * As casas de uma categoria: McDonald's dentro de Hambúrguer, Spoleto dentro
 * de Massas.
 *
 * Cada uma tem suas próprias opções classificadas, porque é assim que a
 * pergunta chega: não é "o que vale num hambúrguer", é "o que eu peço ali".
 */
const NIVEIS: { valor: NivelEscolha | "nenhum"; rotulo: string }[] = [
  { valor: "nenhum", rotulo: "Sem classificação" },
  { valor: "melhor", rotulo: "Melhor escolha" },
  { valor: "boa", rotulo: "Boa opção" },
  { valor: "ocasional", rotulo: "Mais ocasional" },
];

export function EditorEstabelecimentos({
  estabelecimentos,
  aoMudar,
}: {
  estabelecimentos: EstabelecimentoComerFora[];
  aoMudar: (lista: EstabelecimentoComerFora[]) => void;
}) {
  function alterar(indice: number, mudanca: Partial<EstabelecimentoComerFora>) {
    aoMudar(estabelecimentos.map((e, i) => (i === indice ? { ...e, ...mudanca } : e)));
  }

  function alterarOpcao(iCasa: number, iOpcao: number, mudanca: Partial<OpcaoComerFora>) {
    const casa = estabelecimentos[iCasa];
    if (!casa) return;
    alterar(iCasa, {
      opcoes: casa.opcoes.map((o, j) => (j === iOpcao ? { ...o, ...mudanca } : o)),
    });
  }

  function adicionar() {
    aoMudar([
      ...estabelecimentos,
      {
        id: `casa-${Date.now()}`,
        nome: "",
        grupo: null,
        logo: null,
        resumo: null,
        ordem: estabelecimentos.length + 1,
        opcoes: [],
        observacoes: [],
      },
    ]);
  }

  return (
    <>
      <h3 className="c-secao-titulo" style={{ marginTop: 22 }}>
        Onde comer
      </h3>
      <p className="c-dica" style={{ marginTop: 0 }}>
        As casas desta categoria. O campo <strong>Grupo</strong> separa as seções na tela —
        &ldquo;Lanchonetes&rdquo; e &ldquo;Artesanais&rdquo;, por exemplo.
      </p>

      {estabelecimentos.map((casa, iCasa) => (
        <div className="c-bloco" key={casa.id}>
          <div className="c-bloco-topo">
            <strong style={{ fontSize: 14 }}>{casa.nome || `Casa ${iCasa + 1}`}</strong>
            <button
              type="button"
              className="c-link"
              onClick={() => aoMudar(estabelecimentos.filter((_, i) => i !== iCasa))}
            >
              Remover
            </button>
          </div>

          <Campo rotulo="Nome">
            <Texto
              valor={casa.nome}
              aoMudar={(v) =>
                alterar(iCasa, {
                  nome: v,
                  // O identificador acompanha o nome só enquanto a casa é
                  // nova: mexer nele depois quebraria link já compartilhado.
                  id: casa.opcoes.length === 0 ? gerarIdentificador(v) || casa.id : casa.id,
                })
              }
              placeholder="McDonald's"
            />
          </Campo>

          <div className="c-duas-colunas">
            <Campo rotulo="Grupo" dica="Agrupa na tela. Deixe vazio para cair em “Onde comer”.">
              <Texto
                valor={casa.grupo ?? ""}
                aoMudar={(v) => alterar(iCasa, { grupo: v || null })}
                placeholder="Lanchonetes"
              />
            </Campo>
            <Campo rotulo="Ordem">
              <Texto
                valor={String(casa.ordem)}
                aoMudar={(v) => alterar(iCasa, { ordem: Number(v) || 0 })}
              />
            </Campo>
          </div>

          <Campo rotulo="Resumo" dica="Uma linha, aparece no topo da tela da casa.">
            <Texto valor={casa.resumo ?? ""} aoMudar={(v) => alterar(iCasa, { resumo: v || null })} />
          </Campo>

          <CampoLogo nome={casa.nome} logo={casa.logo} aoMudar={(logo) => alterar(iCasa, { logo })} />

          <Campo rotulo="Observações" dica="Uma por linha. Valem para a casa inteira.">
            <AreaTexto
              valor={linhasDeLista(casa.observacoes)}
              aoMudar={(v) => alterar(iCasa, { observacoes: listaDeLinhas(v) })}
              linhas={2}
            />
          </Campo>

          {casa.opcoes.map((opcao, iOpcao) => (
            <div className="c-bloco" key={opcao.id} style={{ background: "var(--surface)" }}>
              <div className="c-bloco-topo">
                <strong style={{ fontSize: 13 }}>Opção {iOpcao + 1}</strong>
                <button
                  type="button"
                  className="c-link"
                  onClick={() => alterar(iCasa, { opcoes: casa.opcoes.filter((_, j) => j !== iOpcao) })}
                >
                  Remover
                </button>
              </div>
              <Campo rotulo="Título">
                <Texto
                  valor={opcao.titulo}
                  aoMudar={(v) => alterarOpcao(iCasa, iOpcao, { titulo: v })}
                  placeholder="McChicken sem maionese"
                />
              </Campo>
              <Campo rotulo="Classificação">
                <Selecao
                  valor={opcao.nivel ?? "nenhum"}
                  aoMudar={(v) =>
                    alterarOpcao(iCasa, iOpcao, { nivel: v === "nenhum" ? null : (v as NivelEscolha) })
                  }
                  opcoes={NIVEIS}
                />
              </Campo>
              <Campo rotulo="Descrição">
                <AreaTexto
                  valor={opcao.descricao ?? ""}
                  aoMudar={(v) => alterarOpcao(iCasa, iOpcao, { descricao: v || null })}
                  linhas={2}
                />
              </Campo>
              <Campo rotulo="Marcadores" dica="Um por linha.">
                <AreaTexto
                  valor={linhasDeLista(opcao.detalhes)}
                  aoMudar={(v) => alterarOpcao(iCasa, iOpcao, { detalhes: listaDeLinhas(v) })}
                  linhas={2}
                />
              </Campo>
            </div>
          ))}

          <button
            type="button"
            className="c-botao c-botao-secundario c-botao-pequeno"
            style={{ marginTop: 10 }}
            onClick={() =>
              alterar(iCasa, {
                opcoes: [
                  ...casa.opcoes,
                  {
                    id: `opcao-${Date.now()}`,
                    titulo: "",
                    descricao: null,
                    nivel: null,
                    energia: null,
                    detalhes: [],
                    tags: [],
                  },
                ],
              })
            }
          >
            Adicionar opção
          </button>
        </div>
      ))}

      <button
        type="button"
        className="c-botao c-botao-secundario c-botao-pequeno"
        style={{ marginTop: 12 }}
        onClick={adicionar}
      >
        Adicionar casa
      </button>
    </>
  );
}
