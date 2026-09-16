import { useParams } from "react-router-dom";
import { catalogo } from "@/central/dados/catalogo";
import { CabecalhoPagina } from "@/central/components/CabecalhoPagina";
import { ConteudoDaCasa } from "@/central/components/ConteudoDaCasa";
import { EstadoVazio } from "@/central/components/EstadoVazio";
import { BotaoFavorito } from "@/central/components/BotaoFavorito";
import { rotas } from "@/central/rotas";

/**
 * Uma casa por dentro: o que pedir no McDonald's, no Spoleto.
 *
 * É a pergunta que a paciente faz parada no balcão. O miolo vive em
 * `ConteudoDaCasa`, porque uma categoria com uma casa só o mostra direto,
 * sem passar por aqui.
 */
export function EstabelecimentoDetalhe() {
  const { categoriaId = "", estabelecimentoId = "" } = useParams();

  const categoria = catalogo.categoriaComerFora(categoriaId);
  const casa = categoria?.estabelecimentos.find((e) => e.id === estabelecimentoId) ?? null;

  if (!categoria || !casa) {
    return (
      <>
        <CabecalhoPagina titulo="Lugar não encontrado" voltarPara={rotas.comerFora} />
        <div className="c-conteudo">
          <EstadoVazio titulo="Este lugar não está na lista" descricao="Volte e escolha outro." />
        </div>
      </>
    );
  }

  return (
    <>
      <CabecalhoPagina
        titulo={casa.nome}
        descricao={casa.resumo ?? categoria.nome}
        voltarPara={rotas.categoria(categoria.id)}
        acao={
          <BotaoFavorito
            item={{
              tipo: "categoria",
              refId: `${categoria.id}/${casa.id}`,
              titulo: casa.nome,
              subtitulo: categoria.nome,
              rota: rotas.estabelecimento(categoria.id, casa.id),
            }}
          />
        }
      />

      <div className="c-conteudo">
        <ConteudoDaCasa casa={casa} categoriaId={categoria.id} categoriaNome={`${categoria.nome} · ${casa.nome}`} />
      </div>
    </>
  );
}
