import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { CategoriaComerFora } from "@/central/types";
import { catalogo } from "@/central/dados/catalogo";
import { CabecalhoPagina } from "@/central/components/CabecalhoPagina";
import { Icone } from "@/central/components/Icone";
import { IlustracaoComerFora } from "@/central/components/IlustracaoComerFora";
import { Logo } from "@/central/components/Logo";
import { useSessao } from "@/central/autenticacao/SessaoContexto";
import { buscarNoComerFora, desenhoDaCategoria } from "@/central/utils/comerForaVisual";
import { rotas } from "@/central/rotas";

/**
 * Comer fora (§13) — a vitrine das categorias.
 *
 * Cada categoria é um cartão com um desenho grande, nas cores da marca. A
 * busca no alto leva direto à casa ("mc" → McDonald's): é o caminho de quem
 * já está na frente do balcão.
 *
 * As categorias que ainda não têm conteúdo continuam aqui, numa lista discreta
 * de "em breve": o paciente vê o que está por vir e a nutricionista tem a
 * lista do que falta escrever. Some uma categoria no cadastro e ela aparece
 * aqui e na busca, sem mexer nesta tela.
 */

/** Os três fundos dos cartões, em rodízio — todos da paleta. */
const TONS = ["marfim", "gelo", "areia"] as const;

/**
 * O que vai no alto do cartão: o desenho que combina com o nome da categoria.
 * Só quando o nome não diz que comida é — a categoria que É uma marca, como
 * Subway — entra a logo cadastrada no lugar. Misturar desenho e figurinha na
 * mesma grade deixava metade dos cartões com outra cara.
 */
function Arte({ categoria, tamanho }: { categoria: CategoriaComerFora; tamanho: number }) {
  const desenho = desenhoDaCategoria(categoria.nome);
  if (desenho === "prato" && categoria.logo) {
    return <Logo nome={categoria.nome} logo={categoria.logo} tamanho={Math.round(tamanho * 0.6)} />;
  }
  return <IlustracaoComerFora desenho={desenho} tamanho={tamanho} />;
}

function contagem(categoria: CategoriaComerFora): string | null {
  const casas = categoria.estabelecimentos.length;
  if (casas > 1) return `${casas} lugares`;
  return null;
}

export function ComerFora() {
  const navegar = useNavigate();
  const { configuracoes } = useSessao();
  const categorias = catalogo.categoriasComerFora();
  const prontas = categorias.filter((c) => c.status === "publicado");
  const emBreve = categorias.filter((c) => c.status !== "publicado");

  const [consulta, definirConsulta] = useState("");
  const achados = useMemo(() => buscarNoComerFora(categorias, consulta), [categorias, consulta]);
  const buscando = consulta.trim().length >= 2;

  return (
    <>
      <CabecalhoPagina
        titulo="Comer fora"
        descricao="Estratégias para escolher melhor fora de casa."
        voltarPara={rotas.home}
      />

      <div className="c-conteudo">
        <section className="c-cf-capa">
          <div className="c-cf-capa-texto">
            <p className="c-cf-capa-sobre">Onde você vai comer?</p>
            {configuracoes.comerForaIntroducao && (
              <p className="c-cf-capa-regra">{configuracoes.comerForaIntroducao}</p>
            )}
          </div>
          <label className="c-cf-busca">
            <Icone nome="busca" tamanho={18} />
            <input
              type="search"
              inputMode="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Busque o lugar ou a comida"
              aria-label="Buscar no Comer fora"
              value={consulta}
              onChange={(e) => definirConsulta(e.target.value)}
            />
          </label>
        </section>

        {buscando && (
          <section className="c-secao" aria-live="polite">
            {achados.length === 0 ? (
              <p className="c-dica">
                Não achei “{consulta.trim()}” por aqui. Veja as categorias abaixo — o lugar pode estar dentro de uma delas.
              </p>
            ) : (
              <div className="c-casas">
                {achados.map((achado) => (
                  <button
                    key={`${achado.categoriaId}-${achado.casaId ?? ""}`}
                    type="button"
                    className="c-casa"
                    onClick={() =>
                      navegar(
                        achado.casaId
                          ? rotas.estabelecimento(achado.categoriaId, achado.casaId)
                          : rotas.categoria(achado.categoriaId),
                      )
                    }
                  >
                    {achado.tipo === "casa" || achado.logo ? (
                      <Logo nome={achado.nome} logo={achado.logo} tamanho={44} />
                    ) : (
                      <span className="c-cf-achado-arte">
                        <IlustracaoComerFora desenho={desenhoDaCategoria(achado.nome)} tamanho={44} />
                      </span>
                    )}
                    <span className="c-casa-texto">
                      <strong>{achado.nome}</strong>
                      <span>{achado.onde ? `em ${achado.onde}` : "Categoria"}</span>
                    </span>
                    <span className="c-casa-seta">
                      <Icone nome="seta" tamanho={18} />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="c-secao" aria-label="Categorias">
          <div className="c-cf-grade">
            {prontas.map((categoria, i) => (
              <button
                key={categoria.id}
                type="button"
                className="c-cf-cartao"
                onClick={() => navegar(rotas.categoria(categoria.id))}
              >
                <span className={`c-cf-arte c-cf-arte--${TONS[i % TONS.length]}`}>
                  <Arte categoria={categoria} tamanho={116} />
                </span>
                <span className="c-cf-texto">
                  <h3>{categoria.nome}</h3>
                  {categoria.resumo && <p>{categoria.resumo}</p>}
                  {contagem(categoria) && <span className="c-cf-contagem">{contagem(categoria)}</span>}
                </span>
              </button>
            ))}
          </div>
        </section>

        {emBreve.length > 0 && (
          <section className="c-secao">
            <h2 className="c-secao-titulo">Em breve</h2>
            <ul className="c-cf-embreve">
              {emBreve.map((categoria) => (
                <li key={categoria.id}>
                  <span className="c-cf-embreve-arte">
                    <Arte categoria={categoria} tamanho={44} />
                  </span>
                  <span>
                    <strong>{categoria.nome}</strong>
                    <span>Em preparação</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
