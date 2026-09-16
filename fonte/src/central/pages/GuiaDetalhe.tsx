import { useParams } from "react-router-dom";
import { catalogo } from "@/central/dados/catalogo";
import { CabecalhoPagina } from "@/central/components/CabecalhoPagina";
import { EstadoVazio } from "@/central/components/EstadoVazio";
import { BotaoFavorito } from "@/central/components/BotaoFavorito";
import { TextoComLinks } from "@/central/components/TextoComLinks";
import { rotas } from "@/central/rotas";

/** Um guia. Enquanto não tiver seções escritas, mostra o estado de preparo. */
export function GuiaDetalhe() {
  const { guiaId = "" } = useParams();
  const guia = catalogo.guia(guiaId);

  if (!guia) {
    return (
      <>
        <CabecalhoPagina titulo="Guia não encontrado" voltarPara={rotas.guias} />
        <div className="c-conteudo">
          <EstadoVazio titulo="Este guia não existe" descricao="Volte e escolha outro." />
        </div>
      </>
    );
  }

  return (
    <>
      <CabecalhoPagina
        titulo={guia.titulo}
        descricao={guia.resumo}
        voltarPara={rotas.guias}
        acao={
          <BotaoFavorito
            item={{ tipo: "guia", refId: guia.id, titulo: guia.titulo, subtitulo: "Guia", rota: rotas.guia(guia.id) }}
          />
        }
      />

      <div className="c-conteudo">
        {guia.secoes.length === 0 ? (
          <EstadoVazio
            icone="guias"
            titulo="Em preparação"
            descricao="Sua nutricionista está escrevendo este guia. Ele aparece aqui assim que estiver pronto."
          />
        ) : (
          guia.secoes.map((secao) => (
            <section className="c-secao c-prosa" key={secao.id}>
              {secao.titulo && <h2 className="c-secao-titulo">{secao.titulo}</h2>}
              {secao.paragrafos.map((paragrafo) => (
                <p key={paragrafo}>
                  <TextoComLinks texto={paragrafo} />
                </p>
              ))}
              {secao.itens.length > 0 && (
                <ul>
                  {secao.itens.map((item) => (
                    <li key={item}>
                      <TextoComLinks texto={item} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))
        )}
      </div>
    </>
  );
}
