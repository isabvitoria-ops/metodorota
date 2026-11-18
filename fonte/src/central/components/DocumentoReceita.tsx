import type { Receita } from "@/central/types/receita";
import { rotuloDaCategoria } from "@/central/types/receita";
import { comUnidade, formatarNutriente, numerosParaMostrar } from "@/central/utils/receitas";
import { CabecalhoDoDocumento } from "./CabecalhoDoDocumento";
import { FolhaDeDocumento } from "./FolhaDeDocumento";

/**
 * A receita em PDF (A4): ingredientes um por linha, preparo numerado, uma
 * dica na caixa de destaque e os números da receita inteira e da porção,
 * com a tabela de origem embaixo.
 */
export function DocumentoReceita({ receita, paciente }: { receita: Receita; paciente: string | null }) {
  const np = numerosParaMostrar(receita);
  // Só o que tem valor: o e-book às vezes não traz a gordura, e "— g de gordura" não diz nada.
  const linha = (fonte: Record<string, number | null>) =>
    (
      [
        ["proteina", "de proteína"],
        ["carboidrato", "de carboidrato"],
        ["lipideos", "de gordura"],
      ] as const
    )
      .filter(([k]) => fonte[k] !== null && fonte[k] !== undefined)
      .map(([k, r]) => `${comUnidade(fonte[k], k)} ${r}`)
      .join(" · ");
  return (
    <FolhaDeDocumento titulo={`Receita — ${receita.titulo}`}>
      <article className="doc doc-receita">
        <CabecalhoDoDocumento
          sobretitulo={`Receita · ${rotuloDaCategoria(receita.categoria)}`}
          titulo={receita.titulo}
          paciente={paciente}
          data={[
            receita.minutos ? `${receita.minutos} min` : null,
            receita.porcoes === 1 ? (receita.numeros?.manual ? null : "1 porção") : `rende ${receita.porcoes} porções`,
          ]
            .filter(Boolean)
            .join(" · ")}
        />
        <div className="doc-rc-colunas">
          <section>
            <h2 className="doc-pa-secao-titulo">Ingredientes</h2>
            <ul className="doc-rc-lista">
              {receita.ingredientes.map((i, k) => (
                <li key={k}>{i.texto}</li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="doc-pa-secao-titulo">Preparo</h2>
            <ol className="doc-rc-lista doc-rc-lista--numerada">
              {receita.preparo.map((p, k) => (
                <li key={k}>{p}</li>
              ))}
            </ol>
            {receita.dica && (
              <p className="doc-pa-ajustes doc-rc-dica">
                <strong>Dica. </strong>
                {receita.dica}
              </p>
            )}
          </section>
        </div>
        {np?.porcao && (
          <>
            <div className={`doc-rc-numeros${np.total ? "" : " doc-rc-numeros--so-porcao"}`}>
              {np.total && (
                <div>
                  <span className="doc-pa-rotulo">Receita inteira</span>
                  <strong>{formatarNutriente(np.total.energia_kcal, "energia_kcal")} kcal</strong>
                  <small>{linha(np.total)}</small>
                </div>
              )}
              <div className="doc-rc-numeros-porcao">
                <span className="doc-pa-rotulo">
                  Uma porção{receita.porcoes !== 1 && np.total ? ` (rende ${receita.porcoes})` : ""}
                </span>
                <strong>{formatarNutriente(np.porcao.energia_kcal, "energia_kcal")} kcal</strong>
                <small>{linha(np.porcao)}</small>
              </div>
            </div>
            <p className="doc-rc-fonte">{np.manual ? `Números por porção: ${np.origem}.` : `${np.origem}.`}</p>
          </>
        )}
      </article>
    </FolhaDeDocumento>
  );
}
