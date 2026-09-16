import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { indiceBusca } from "@/central/dados/indiceBusca";
import { buscar, totalDeResultados } from "@/central/utils/buscaGlobal";
import { BarraBusca } from "@/central/components/BarraBusca";
import { CabecalhoPagina } from "@/central/components/CabecalhoPagina";
import { EstadoVazio } from "@/central/components/EstadoVazio";
import { Icone } from "@/central/components/Icone";
import { rotas } from "@/central/rotas";

/**
 * Busca global (§18).
 *
 * Uma consulta atravessa as áreas: "arroz" traz o alimento na calculadora e
 * o grupo dos carboidratos; "japonês" traz a categoria de comer fora;
 * "gases" traz o guia. O índice vem de `data/indiceBusca.ts` — esta tela só
 * mostra o que a função de busca devolveu.
 */
const SUGESTOES = ["arroz", "macarrão", "japonês", "hambúrguer", "vegetais", "doces"];

export function Busca() {
  const navegar = useNavigate();
  const [parametros, definirParametros] = useSearchParams();
  const consulta = parametros.get("q") ?? "";

  const secoes = useMemo(() => buscar(indiceBusca(), consulta), [consulta]);
  const total = totalDeResultados(secoes);

  return (
    <>
      <CabecalhoPagina titulo="Buscar" voltarPara={rotas.home} />

      <div className="c-conteudo">
        <div style={{ marginTop: 6 }}>
          <BarraBusca
            valor={consulta}
            autoFoco
            aoMudar={(valor) => definirParametros(valor ? { q: valor } : {}, { replace: true })}
            placeholder="Alimento, restaurante, sintoma…"
          />
        </div>

        {consulta.trim().length === 0 && (
          <>
            <p className="c-contagem">Experimente buscar por:</p>
            <div className="c-sugeridos">
              {SUGESTOES.map((termo) => (
                <button
                  key={termo}
                  type="button"
                  className="c-chip"
                  onClick={() => definirParametros({ q: termo }, { replace: true })}
                >
                  {termo}
                </button>
              ))}
            </div>
          </>
        )}

        {consulta.trim().length > 0 && total === 0 && (
          <EstadoVazio
            icone="busca"
            titulo="Nada encontrado"
            descricao={`Não há conteúdo para “${consulta.trim()}” por enquanto. Tente outra palavra ou fale com sua nutricionista.`}
          />
        )}

        {total > 0 && (
          <>
            <p className="c-contagem">
              {total} {total === 1 ? "resultado" : "resultados"}
            </p>
            {secoes.map((secao) => (
              <section className="c-secao c-resultado-secao" key={secao.tipo}>
                <h2 className="c-secao-titulo">{secao.rotulo}</h2>
                <div className="c-lista">
                  {secao.itens.map((item) => (
                    <button key={item.id} type="button" className="c-lista-item" onClick={() => navegar(item.rota)}>
                      <span>
                        <span className="c-lista-item-nome">{item.titulo}</span>
                        {item.subtitulo && <span className="c-lista-item-apoio">{item.subtitulo}</span>}
                      </span>
                      <span className="c-lista-item-direita">
                        <Icone nome="seta" tamanho={17} />
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </>
        )}
      </div>
    </>
  );
}
