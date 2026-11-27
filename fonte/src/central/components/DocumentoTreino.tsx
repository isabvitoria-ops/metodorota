import type { ExercicioPlanejado, Treino } from "@/central/types/treino";
import { emBlocos } from "@/central/utils/bisetDoTreino";
import { dataBonita, hojeSaoPaulo } from "@/central/utils/situacao";
import { faixaEmTexto, faixaUnicaEmTexto, linkDoVideo } from "@/central/utils/textoDoTreino";
import { FolhaDeDocumento } from "./FolhaDeDocumento";
import { Marca } from "./Marca";

/**
 * O treino em PDF, no mesmo papel do plano alimentar (pedido dela em
 * 27/11/2026): um bloco por treino, um exercício por linha, e o vídeo da
 * execução como LINK QUE ABRE dentro do PDF.
 *
 * Mesma regra do plano alimentar: não inventa nada. Séries, faixas,
 * observações, trocas e vídeos são os que ela escreveu no treino; o
 * documento só os põe no papel. Biset sai junto, com a etiqueta.
 */
export function DocumentoTreino({ paciente, treinos }: { paciente: string; treinos: Treino[] }) {
  const comExercicio = treinos.filter((t) => t.exercicios.length > 0);
  if (comExercicio.length === 0) return null;
  const temVideo = comExercicio.some((t) =>
    t.exercicios.some((e) => linkDoVideo(e.videoUrl) || (e.trocas ?? []).some((x) => linkDoVideo(x.videoUrl))),
  );

  return (
    <FolhaDeDocumento titulo={`Plano de Treino — ${paciente}`}>
      <article className="doc doc-plano doc-treino">
        <header className="doc-pa-topo">
          <Marca variante="horizontal" altura={30} className="doc-pa-marca" />
          <div className="doc-pa-titulos">
            <div>
              <p className="doc-pa-sobretitulo">
                {comExercicio.length === 1 ? "1 treino" : `${comExercicio.length} treinos`}
              </p>
              <h1 className="doc-pa-titulo">Plano de treino</h1>
            </div>
            <div className="doc-pa-paciente">
              {paciente && (
                <>
                  <span className="doc-pa-rotulo">Paciente</span>
                  <strong>{paciente}</strong>
                </>
              )}
              <span className="doc-pa-data">Gerado em {dataBonita(hojeSaoPaulo())}</span>
            </div>
          </div>
          {comExercicio.length > 1 && (
            <ol className="doc-pa-dia" aria-label="Os treinos">
              {comExercicio.map((t) => (
                <li key={t.id} className="doc-pa-dia-item">
                  {t.rotulo && <span className="doc-pa-dia-hora">{t.rotulo}</span>}
                  <span className="doc-pa-dia-nome">{t.nome}</span>
                </li>
              ))}
            </ol>
          )}
          {temVideo && (
            <p className="doc-pa-ajustes">
              <strong>Vídeos: </strong>toque em “Ver execução” para abrir o vídeo do exercício.
            </p>
          )}
        </header>

        {comExercicio.map((treino, i) => {
          let numero = 0;
          return (
            <section className="doc-secao doc-tn-treino" key={treino.id}>
              <h2 className="doc-pa-refeicao-titulo">
                <span className="doc-pa-numero" aria-hidden="true">{i + 1}</span>
                <span className="doc-pa-refeicao-nome">{treino.nome}</span>
                {treino.rotulo && <span className="doc-pa-hora">{treino.rotulo}</span>}
              </h2>
              {treino.observacao && (
                <ul className="doc-pa-notas doc-tn-observacao">
                  <li>{treino.observacao}</li>
                </ul>
              )}

              <table className="doc-tabela doc-pa-tabela doc-tn-tabela">
                <thead>
                  <tr>
                    <th scope="col">Exercício</th>
                    <th scope="col">Séries e repetições</th>
                    <th scope="col">Execução</th>
                  </tr>
                </thead>
                {emBlocos(treino.exercicios, (e) => e.bisetComProximo === true).map((bloco) => (
                  <tbody className={bloco.length === 2 ? "doc-tn-biset" : undefined} key={bloco[0]!.id}>
                    {bloco.length === 2 && (
                      <tr className="doc-tn-biset-etiqueta">
                        <td colSpan={3}>Biset · faça um seguido do outro</td>
                      </tr>
                    )}
                    {bloco.map((e) => {
                      numero += 1;
                      return <LinhaDoExercicio key={e.id} e={e} numero={numero} />;
                    })}
                  </tbody>
                ))}
              </table>
            </section>
          );
        })}
      </article>
    </FolhaDeDocumento>
  );
}

function LinhaDoExercicio({ e, numero }: { e: ExercicioPlanejado; numero: number }) {
  const video = linkDoVideo(e.videoUrl);
  const trocas = e.trocas ?? [];
  return (
    <tr>
      <th scope="row">
        <span className="doc-tn-nome">
          <span className="doc-tn-ordem">{numero}.</span> {e.nome}
        </span>
        {e.observacao && <span className="doc-tn-obs">{e.observacao}</span>}
        {trocas.length > 0 && (
          <span className="doc-tn-trocas">
            <span className="doc-tn-trocas-titulo">Sem o aparelho ou academia cheia? Troque por: </span>
            {trocas.map((t, i) => {
              const link = linkDoVideo(t.videoUrl);
              return (
                <span key={i}>
                  {i > 0 && " · "}
                  {t.nome}
                  {link && (
                    <>
                      {" "}
                      (<a href={link} target="_blank" rel="noreferrer noopener">ver execução</a>)
                    </>
                  )}
                </span>
              );
            })}
          </span>
        )}
      </th>
      <td className="doc-tn-series">
        {e.faixas && e.faixas.length > 0
          ? e.faixas.map((f, i) => (
              <span key={i} className="doc-tn-faixa">
                {faixaUnicaEmTexto(f)}
              </span>
            ))
          : faixaEmTexto(e) || "—"}
      </td>
      <td className="doc-tn-video">
        {video ? (
          <a href={video} target="_blank" rel="noreferrer noopener" className="doc-tn-link">
            ▶ Ver execução
          </a>
        ) : (
          "—"
        )}
      </td>
    </tr>
  );
}
