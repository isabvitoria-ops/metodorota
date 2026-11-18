import type { Receita } from "@/central/types/receita";
import { rotuloDaCategoria } from "@/central/types/receita";
import { formatarNutriente, porPorcao, textoDasFontes } from "@/central/utils/receitas";
import { CabecalhoDoDocumento } from "./CabecalhoDoDocumento";
import { FolhaDeDocumento } from "./FolhaDeDocumento";

/**
 * A receita em PDF (A4): ingredientes um por linha, preparo numerado, uma
 * dica na caixa de destaque e os números da receita inteira e da porção,
 * com a tabela de origem embaixo.
 */
export function DocumentoReceita({ receita, paciente }: { receita: Receita; paciente: string | null }) {
  const n = receita.numeros;
  const linha = (fonte: Record<string, number | null>) =>
    `${formatarNutriente(fonte.proteina, "proteina")} g de proteína · ${formatarNutriente(fonte.carboidrato, "carboidrato")} g de carboidrato · ${formatarNutriente(fonte.lipideos, "lipideos")} g de gordura`;
  const porcao = n
    ? Object.fromEntries(Object.entries(n.total).map(([k, v]) => [k, porPorcao(v, receita.porcoes)]))
    : null;
  return (
    <FolhaDeDocumento titulo={`Receita — ${receita.titulo}`}>
      <article className="doc doc-receita">
        <CabecalhoDoDocumento
          sobretitulo={`Receita · ${rotuloDaCategoria(receita.categoria)}`}
          titulo={receita.titulo}
          paciente={paciente}
          data={[
            receita.minutos ? `${receita.minutos} min` : null,
            receita.porcoes === 1 ? "1 porção" : `rende ${receita.porcoes} porções`,
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
        {n && porcao && (
          <>
            <div className="doc-rc-numeros">
              <div>
                <span className="doc-pa-rotulo">Receita inteira</span>
                <strong>{formatarNutriente(n.total.energia_kcal, "energia_kcal")} kcal</strong>
                <small>{linha(n.total)}</small>
              </div>
              <div className="doc-rc-numeros-porcao">
                <span className="doc-pa-rotulo">
                  Uma porção{receita.porcoes !== 1 ? ` (rende ${receita.porcoes})` : ""}
                </span>
                <strong>{formatarNutriente(porcao.energia_kcal, "energia_kcal")} kcal</strong>
                <small>{linha(porcao)}</small>
              </div>
            </div>
            <p className="doc-rc-fonte">Contas a partir dos gramas de cada ingrediente: {textoDasFontes(n.fontes)}.</p>
          </>
        )}
      </article>
    </FolhaDeDocumento>
  );
}
