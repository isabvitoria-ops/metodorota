import { useNavigate } from "react-router-dom";
import type { CategoriaComerFora } from "@/central/types";
import { catalogo } from "@/central/dados/catalogo";
import { CabecalhoPagina } from "@/central/components/CabecalhoPagina";
import { Icone } from "@/central/components/Icone";
import { Logo } from "@/central/components/Logo";
import { useSessao } from "@/central/autenticacao/SessaoContexto";
import { rotas } from "@/central/rotas";

/**
 * Comer fora (§13) — a grade de categorias.
 *
 * As categorias que ainda não têm conteúdo continuam na grade, marcadas como
 * "em breve": o paciente vê o que está por vir e a nutricionista tem a lista
 * do que falta escrever. Some uma categoria em `data/comerFora.ts` e ela
 * aparece aqui e na busca global, sem mexer nesta tela.
 */
/**
 * A imagem do cartão: a da categoria, quando ela é uma marca; senão a da
 * única casa lá dentro, que é justamente o caso das categorias que abrem
 * direto (Pizza, Açaí, Comida japonesa). Sem nenhuma das duas, o ícone.
 */
function imagemDaCategoria(categoria: CategoriaComerFora): string | null {
  if (categoria.logo) return categoria.logo;
  if (categoria.estabelecimentos.length === 1) return categoria.estabelecimentos[0]!.logo;
  return null;
}

export function ComerFora() {
  const navegar = useNavigate();
  const { configuracoes } = useSessao();
  const categorias = catalogo.categoriasComerFora();
  const prontas = categorias.filter((c) => c.status === "publicado");
  const emBreve = categorias.filter((c) => c.status !== "publicado");

  return (
    <>
      <CabecalhoPagina
        titulo="Comer fora"
        descricao="Veja estratégias para escolher melhor fora de casa."
        voltarPara={rotas.home}
      />

      <div className="c-conteudo">
        {configuracoes.comerForaIntroducao && (
          <p className="c-intro">{configuracoes.comerForaIntroducao}</p>
        )}

        <section className="c-secao">
          <div className="c-grade">
            {prontas.map((categoria) => (
              <button
                key={categoria.id}
                type="button"
                className="c-categoria"
                onClick={() => navegar(rotas.categoria(categoria.id))}
              >
                {imagemDaCategoria(categoria) ? (
                  <Logo nome={categoria.nome} logo={imagemDaCategoria(categoria)} tamanho={40} />
                ) : (
                  <span className="c-categoria-icone">
                    <Icone nome={categoria.icone} tamanho={21} />
                  </span>
                )}
                <span>
                  <h3>{categoria.nome}</h3>
                  {categoria.resumo && <p>{categoria.resumo}</p>}
                </span>
              </button>
            ))}
          </div>
        </section>

        {emBreve.length > 0 && (
          <section className="c-secao">
            <h2 className="c-secao-titulo">Em breve</h2>
            <div className="c-grade">
              {emBreve.map((categoria) => (
                <button
                  key={categoria.id}
                  type="button"
                  className="c-categoria pendente"
                  onClick={() => navegar(rotas.categoria(categoria.id))}
                >
                  {imagemDaCategoria(categoria) ? (
                    <Logo nome={categoria.nome} logo={imagemDaCategoria(categoria)} tamanho={40} />
                  ) : (
                    <span className="c-categoria-icone">
                      <Icone nome={categoria.icone} tamanho={21} />
                    </span>
                  )}
                  <span>
                    <h3>{categoria.nome}</h3>
                    <p>Em preparação</p>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
