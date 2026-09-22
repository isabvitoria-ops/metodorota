import { useEffect, useState } from "react";
import type { MinhaFase as TipoMinhaFase } from "@/central/types/fase";
import { repositorio } from "@/central/dados/repositorio";

/**
 * Onde a paciente está no método — o mapa com "você está aqui".
 *
 * MOSTRA O CAMINHO INTEIRO, e não só o ponto dela. Ver só a própria etapa
 * seria receber um mapa com uma cidade: ela precisa do percurso para se
 * situar dentro dele e para saber que existe um depois.
 *
 * O QUE NÃO APARECE, de propósito:
 *
 *   * NENHUM PRAZO e nenhuma contagem de dias. A fase seguinte chega quando
 *     a nutricionista decidir na consulta; um contador aqui viraria cobrança
 *     de um prazo que ninguém prometeu — e "você está nesta fase há 47 dias"
 *     é uma frase que pesa em quem já está se cobrando;
 *   * nenhuma porcentagem de conclusão, pelo mesmo motivo;
 *   * a anotação da nutricionista, que é dela para ela.
 *
 * O cartão SOME quando ela não está em fase nenhuma. "Você ainda não está
 * em nenhuma fase" informaria que existe algo do qual ela está de fora.
 */
export function MinhaFase() {
  const [dados, definirDados] = useState<TipoMinhaFase | null>(null);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const r = await repositorio.minhaFase();
        if (vivo) definirDados(r);
      } catch {
        // Sem conexão o cartão não aparece. Um erro aqui não pode estragar
        // a primeira tela do aplicativo.
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  if (!dados?.temFase || dados.fases.length === 0) return null;

  const atual = dados.fases.find((f) => f.atual);

  return (
    <section className="c-secao">
      <h2 className="c-secao-titulo">Onde você está</h2>
      <ol className="c-trilha">
        {dados.fases.map((f) => (
          <li key={f.id} className={`c-trilha-passo${f.atual ? " atual" : ""}`}>
            <span className="c-trilha-marca" aria-hidden="true" />
            <span className="c-trilha-texto">
              <strong>{f.nome}</strong>
              {f.atual && <span className="c-trilha-aqui">você está aqui</span>}
              {f.descricao && <span className="c-dica">{f.descricao}</span>}
            </span>
          </li>
        ))}
      </ol>
      {atual && (
        <p className="c-dica">
          A próxima etapa vem quando sua nutricionista entender que é hora — não há prazo
          correndo.
        </p>
      )}
    </section>
  );
}
