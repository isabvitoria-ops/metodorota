import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { EstabelecimentoComerFora, NivelEscolha } from "@/central/types";
import { catalogo } from "@/central/dados/catalogo";
import { CabecalhoPagina } from "@/central/components/CabecalhoPagina";
import { CartaoOpcao } from "@/central/components/CartaoOpcao";
import { ConteudoDaCasa } from "@/central/components/ConteudoDaCasa";
import { EstadoVazio } from "@/central/components/EstadoVazio";
import { BotaoFavorito } from "@/central/components/BotaoFavorito";
import { Icone } from "@/central/components/Icone";
import { Logo } from "@/central/components/Logo";
import { rotas } from "@/central/rotas";

/**
 * Uma categoria de "Comer fora" por dentro.
 *
 * A tela é organizada pelas decisões que a refeição realmente exige — no
 * material de massas, por exemplo, a quantidade da massa, a proteína e o
 * molho são três escolhas separadas. O filtro no topo serve para quem chegou
 * com a pergunta pronta ("o que é melhor escolha aqui?").
 */
const FILTROS: { valor: NivelEscolha | "todos"; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todas" },
  { valor: "melhor", rotulo: "Melhor escolha" },
  { valor: "boa", rotulo: "Boa opção" },
  { valor: "ocasional", rotulo: "Mais ocasional" },
];

export function CategoriaDetalhe() {
  const { categoriaId = "" } = useParams();
  const navegar = useNavigate();
  const [parametros] = useSearchParams();
  const [filtro, definirFiltro] = useState<NivelEscolha | "todos">("todos");

  const categoria = catalogo.categoriaComerFora(categoriaId);
  const opcaoDestacada = parametros.get("opcao");

  // As casas viram seções pelo campo `grupo` — é ele que separa lanchonete de
  // artesanal. Quem não tem grupo cai numa seção genérica em vez de sumir.
  // Uma casa só não merece uma lista de um item: seria um toque a mais para
  // chegar ao mesmo lugar. O conteúdo dela aparece direto aqui.
  const casaUnica = categoria?.estabelecimentos.length === 1 ? categoria.estabelecimentos[0]! : null;

  const porGrupo = useMemo(() => {
    const casas = [...(categoria?.estabelecimentos ?? [])].sort(
      (a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR"),
    );
    const mapa = new Map<string, EstabelecimentoComerFora[]>();
    for (const casa of casas) {
      const chave = casa.grupo?.trim() || "Onde comer";
      mapa.set(chave, [...(mapa.get(chave) ?? []), casa]);
    }
    return [...mapa.entries()];
  }, [categoria]);

  if (!categoria) {
    return (
      <>
        <CabecalhoPagina titulo="Categoria não encontrada" voltarPara={rotas.comerFora} />
        <div className="c-conteudo">
          <EstadoVazio titulo="Esta categoria não existe" descricao="Volte e escolha outra." />
        </div>
      </>
    );
  }

  const totalDeOpcoes = categoria.decisoes.reduce((soma, d) => soma + d.opcoes.length, 0);
  const temNiveis = categoria.decisoes.some((d) => d.opcoes.some((o) => o.nivel !== null));

  return (
    <>
      <CabecalhoPagina
        titulo={categoria.nome}
        descricao={categoria.resumo}
        voltarPara={rotas.comerFora}
        acao={
          <BotaoFavorito
            item={{
              tipo: "categoria",
              refId: categoria.id,
              titulo: categoria.nome,
              subtitulo: "Comer fora",
              rota: rotas.categoria(categoria.id),
            }}
          />
        }
      />

      <div className="c-conteudo">
        {categoria.introducao && <p className="c-intro">{categoria.introducao}</p>}

        {totalDeOpcoes === 0 && porGrupo.length === 0 && (
          <EstadoVazio
            icone="comerFora"
            titulo="Conteúdo em preparação"
            descricao={
              categoria.decisoes.length > 0
                ? "As escolhas desta refeição já estão mapeadas. Sua nutricionista está finalizando as opções de cada uma."
                : "Sua nutricionista está preparando o material desta categoria."
            }
          />
        )}

        {casaUnica && (
          <ConteudoDaCasa
            casa={casaUnica}
            categoriaId={categoria.id}
            categoriaNome={categoria.nome}
            mostrarGrupo={false}
          />
        )}

        {!casaUnica &&
          porGrupo.map(([grupo, casas]) => (
            <section className="c-secao" key={grupo}>
              <h2 className="c-secao-titulo">{grupo}</h2>
              <div className="c-casas">
                {casas.map((casa) => (
                  <button
                    key={casa.id}
                    type="button"
                    className="c-casa"
                    onClick={() => navegar(rotas.estabelecimento(categoria.id, casa.id))}
                  >
                    <Logo nome={casa.nome} logo={casa.logo} tamanho={44} />
                    <span className="c-casa-texto">
                      <strong>{casa.nome}</strong>
                      <span>
                        {casa.opcoes.length === 0
                          ? "Opções em preparação"
                          : `${casa.opcoes.length} ${casa.opcoes.length === 1 ? "opção" : "opções"}`}
                      </span>
                    </span>
                    <span className="c-casa-seta">
                      <Icone nome="seta" tamanho={18} />
                    </span>
                  </button>
                ))}
              </div>
            </section>
          ))}

        {/* Os filtros ficam aqui, e não no topo: eles agem sobre as decisões.
            Em cima das casas eles prometeriam um recorte que não fazem — e a
            classificação de cada casa já tem filtro próprio, na tela dela. */}
        {temNiveis && (
          <div className="c-chips" style={{ marginTop: 18 }}>
            {FILTROS.map((opcao) => (
              <button
                key={opcao.valor}
                type="button"
                className="c-chip"
                aria-pressed={filtro === opcao.valor}
                onClick={() => definirFiltro(opcao.valor)}
              >
                {opcao.rotulo}
              </button>
            ))}
          </div>
        )}

        {categoria.decisoes.map((decisao) => {
          const opcoes = decisao.opcoes.filter((o) => filtro === "todos" || o.nivel === filtro);
          if (totalDeOpcoes > 0 && opcoes.length === 0 && decisao.opcoes.length > 0) return null;
          return (
            <section className="c-decisao" key={decisao.id}>
              <h2>{decisao.titulo}</h2>
              {decisao.pergunta && <p className="c-decisao-pergunta">{decisao.pergunta}</p>}
              {decisao.observacoes.length > 0 && (
                <ul className="c-observacoes">
                  {decisao.observacoes.map((nota) => (
                    <li key={nota}>{nota}</li>
                  ))}
                </ul>
              )}
              {decisao.opcoes.length === 0 ? (
                <p className="c-contagem">Opções em preparação.</p>
              ) : (
                opcoes.map((opcao) => (
                  <CartaoOpcao
                    key={opcao.id}
                    opcao={opcao}
                    categoriaId={categoria.id}
                    categoriaNome={categoria.nome}
                    destacada={opcao.id === opcaoDestacada}
                  />
                ))
              )}
            </section>
          );
        })}

        {categoria.lembretes.length > 0 && (
          <section className="c-secao c-prosa">
            <h2 className="c-secao-titulo">Para lembrar</h2>
            <ul>
              {categoria.lembretes.map((lembrete) => (
                <li key={lembrete}>{lembrete}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
