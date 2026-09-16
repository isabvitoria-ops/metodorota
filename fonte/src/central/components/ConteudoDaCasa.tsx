import { useState } from "react";
import type { EstabelecimentoComerFora, NivelEscolha } from "@/central/types";
import { CartaoOpcao } from "./CartaoOpcao";
import { EstadoVazio } from "./EstadoVazio";
import { Logo } from "./Logo";

/**
 * O miolo da tela de uma casa: logo, observações e as opções classificadas.
 *
 * Existe separado porque é usado em dois lugares. Numa categoria com várias
 * casas, cada uma tem tela própria. Numa categoria com uma casa só — Pizza,
 * hoje —, a lista intermediária seria uma lista de um item: um toque a mais
 * para chegar ao mesmo lugar. Aí o conteúdo aparece direto na categoria.
 */
const FILTROS: { valor: NivelEscolha | "todos"; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todas" },
  { valor: "melhor", rotulo: "Melhor escolha" },
  { valor: "boa", rotulo: "Boa opção" },
  { valor: "ocasional", rotulo: "Mais ocasional" },
];

export function ConteudoDaCasa({
  casa,
  categoriaId,
  categoriaNome,
  mostrarGrupo = true,
}: {
  casa: EstabelecimentoComerFora;
  categoriaId: string;
  categoriaNome: string;
  /** Dentro da categoria, o grupo já é redundante com o título da tela. */
  mostrarGrupo?: boolean;
}) {
  const [filtro, definirFiltro] = useState<NivelEscolha | "todos">("todos");
  const temNiveis = casa.opcoes.some((o) => o.nivel !== null);
  const visiveis = casa.opcoes.filter((o) => filtro === "todos" || o.nivel === filtro);

  return (
    <>
      <div className="c-casa-topo">
        <Logo nome={casa.nome} logo={casa.logo} tamanho={56} nomeVisivel={false} />
        {mostrarGrupo && casa.grupo && <span className="c-contagem">{casa.grupo}</span>}
      </div>

      {casa.observacoes.length > 0 && (
        <ul className="c-observacoes" style={{ marginTop: 16 }}>
          {casa.observacoes.map((nota) => (
            <li key={nota}>{nota}</li>
          ))}
        </ul>
      )}

      {casa.opcoes.length === 0 ? (
        <EstadoVazio
          icone="comerFora"
          titulo="Opções em preparação"
          descricao={`Sua nutricionista está montando as escolhas do ${casa.nome}.`}
        />
      ) : (
        <>
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

          <section className="c-decisao">
            {visiveis.length === 0 ? (
              <p className="c-contagem" role="status">
                Nenhuma opção nesta classificação.
              </p>
            ) : (
              visiveis.map((opcao) => (
                <CartaoOpcao
                  key={opcao.id}
                  opcao={opcao}
                  categoriaId={categoriaId}
                  categoriaNome={categoriaNome}
                />
              ))
            )}
          </section>
        </>
      )}
    </>
  );
}
