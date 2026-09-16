import { useNavigate } from "react-router-dom";
import { catalogo } from "@/central/dados/catalogo";
import { TEMAS_GUIAS } from "@/central/dados/sementes/guias";
import { CabecalhoPagina } from "@/central/components/CabecalhoPagina";
import { Icone } from "@/central/components/Icone";
import { SeloNeutro } from "@/central/components/Selo";
import { rotas } from "@/central/rotas";

/**
 * Guias (§17) — a estrutura inicial.
 *
 * Os temas estão reservados e agrupados; o conteúdo clínico é da
 * nutricionista e entra depois (o briefing proíbe inventar). A tela deixa
 * isso explícito com "em preparação" em vez de mostrar texto genérico.
 */
export function Guias() {
  const navegar = useNavigate();
  const guias = catalogo.guias();
  const temas = [...TEMAS_GUIAS, ...new Set(guias.map((g) => g.tema))].filter(
    (tema, indice, lista) => lista.indexOf(tema) === indice && guias.some((g) => g.tema === tema),
  );

  return (
    <>
      <CabecalhoPagina
        titulo="Guias"
        descricao="Orientações práticas para situações do dia a dia."
        voltarPara={rotas.home}
      />

      <div className="c-conteudo">
        {temas.map((tema) => (
          <section className="c-secao" key={tema}>
            <h2 className="c-secao-titulo">{tema}</h2>
            <div className="c-lista">
              {guias
                .filter((guia) => guia.tema === tema)
                .map((guia) => (
                  <button key={guia.id} type="button" className="c-lista-item" onClick={() => navegar(rotas.guia(guia.id))}>
                    <span>
                      <span className="c-lista-item-nome">{guia.titulo}</span>
                      {guia.resumo && <span className="c-lista-item-apoio">{guia.resumo}</span>}
                    </span>
                    <span className="c-lista-item-direita">
                      {guia.status === "em-preparacao" ? <SeloNeutro>Em breve</SeloNeutro> : <Icone nome="seta" tamanho={17} />}
                    </span>
                  </button>
                ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
