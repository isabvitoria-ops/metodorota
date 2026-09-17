import { useEffect, useState } from "react";
import type { MinhaAvaliacao } from "@/central/types/protocolo";
import { repositorio } from "@/central/dados/repositorio";
import { dataBonita } from "@/central/utils/situacao";

/**
 * A última avaliação física da paciente.
 *
 * Molde: o PDF que a nutricionista mandou — os números grandes no topo, o
 * que o peso é feito, as medidas e as dobras. Aqui vira tela do app, com a
 * mesma linguagem visual do resto.
 *
 * O QUE ESTA TELA NÃO FAZ, e é decisão, não falta:
 *
 *   * não recalcula nada. O percentual, a massa gorda e o IMC são os que a
 *     nutricionista lançou, vindos da ferramenta de cálculo dela. Se o app
 *     recalculasse, um dia mostraria número diferente do que ela entregou
 *     na consulta, e não haveria como saber qual dos dois vale;
 *   * não classifica o corpo da paciente. Não há "acima do ideal", não há
 *     faixa colorida dizendo se ela está certa ou errada. O material dela
 *     tem essas faixas porque é a nutricionista lendo; aqui é a paciente
 *     lendo sobre o próprio corpo, sozinha, sem ninguém do lado para
 *     explicar;
 *   * não fala de bioimpedância. Ela não faz, e o app não inventa exame.
 */
export function AvaliacaoFisica() {
  const [avaliacao, definirAvaliacao] = useState<MinhaAvaliacao | null>(null);
  const [carregando, definirCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    void repositorio
      .minhaAvaliacao()
      .then((a) => vivo && definirAvaliacao(a))
      .catch(() => vivo && definirAvaliacao(null))
      .finally(() => vivo && definirCarregando(false));
    return () => {
      vivo = false;
    };
  }, []);

  if (carregando) return <p className="c-dica">Carregando…</p>;
  if (!avaliacao) {
    return (
      <div className="c-bloco">
        <p className="c-item-protocolo-nome">Sua avaliação aparece aqui</p>
        <p className="c-dica" style={{ marginTop: 6 }}>
          Assim que sua nutricionista lançar a primeira avaliação física, ela fica nesta tela.
        </p>
      </div>
    );
  }

  const d = avaliacao.dados;
  const numero = (v: number | null | undefined, casas = 1) =>
    v === null || v === undefined
      ? null
      : v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

  const destaques = [
    ["Peso", numero(d.peso, 1), "kg"],
    ["IMC", numero(d.imc, 1), "kg/m²"],
    ["Gordura corporal", numero(d.percentualGordura, 1), "%"],
  ].filter(([, valor]) => valor !== null) as [string, string, string][];

  return (
    <>
      <p className="c-dica">
        Avaliação de {dataBonita(avaliacao.data)}
        {d.metodo ? ` · ${d.metodo}` : ""}
        {avaliacao.total > 1 && avaliacao.inicio
          ? ` · ${avaliacao.total}ª avaliação, desde ${dataBonita(avaliacao.inicio)}`
          : " · primeira avaliação, seu ponto de partida"}
      </p>

      {destaques.length > 0 && (
        <div className="c-bloco c-destaques">
          {destaques.map(([rotulo, valor, unidade]) => (
            <div key={rotulo}>
              <span className="c-destaque-rotulo">{rotulo}</span>
              <span className="c-destaque-valor">
                {valor}
                <span className="c-destaque-unidade">{unidade}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Do que o peso é feito — a barra de dois compartimentos do material
          dela. Só aparece quando os dois números existem: meia barra
          contaria meia verdade sobre o corpo de alguém. */}
      {d.massaGorda !== null && d.massaMagra !== null && d.peso ? (
        <section className="c-secao">
          <h2 className="c-secao-titulo">Do que o seu peso é feito</h2>
          <div className="c-barra-corpo" aria-hidden="true">
            <span
              className="c-barra-gorda"
              style={{ width: `${(d.massaGorda / d.peso) * 100}%` }}
            />
            <span className="c-barra-magra" />
          </div>
          <p className="c-item-protocolo-trocas" style={{ marginTop: 8 }}>
            Massa gorda {numero(d.massaGorda, 1)} kg · massa livre de gordura{" "}
            {numero(d.massaMagra, 1)} kg
          </p>
        </section>
      ) : null}

      {d.circunferencias.length > 0 && (
        <section className="c-secao">
          <h2 className="c-secao-titulo">Suas medidas</h2>
          <div className="c-bloco">
            {d.circunferencias.map((m, i) => (
              <div className="c-item-protocolo" key={i}>
                <div className="c-item-protocolo-linha">
                  <span className="c-item-protocolo-nome">{m.nome}</span>
                  <span className="c-item-protocolo-quantidade">{m.valor}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {d.dobras.length > 0 && (
        <section className="c-secao">
          <h2 className="c-secao-titulo">Dobras cutâneas</h2>
          <div className="c-bloco">
            {d.dobras.map((m, i) => (
              <div className="c-item-protocolo" key={i}>
                <div className="c-item-protocolo-linha">
                  <span className="c-item-protocolo-nome">{m.nome}</span>
                  <span className="c-item-protocolo-quantidade">{m.valor}</span>
                </div>
              </div>
            ))}
          </div>
          {d.somaDobras !== null && (
            <p className="c-nota-protocolo">
              Soma das dobras: {numero(d.somaDobras, 1)} mm
              {d.metodo ? ` — ${d.metodo}` : ""}
            </p>
          )}
        </section>
      )}

      {d.observacao && <p className="c-nota-protocolo">{d.observacao}</p>}

      <p className="c-dica" style={{ marginTop: 18 }}>
        Medidas feitas e calculadas pela sua nutricionista. Os números mostram onde você está
        hoje — o que eles significam para você é conversa de consulta.
      </p>
    </>
  );
}
