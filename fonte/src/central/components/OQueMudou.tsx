import { useEffect, useState } from "react";
import type { OQueMudou as Resumo } from "@/central/types/oQueMudou";
import { repositorio } from "@/central/dados/repositorio";
import { quando } from "@/central/utils/linhaDoTempo";
import { hojeSaoPaulo } from "@/central/utils/situacao";

/**
 * "Desde a sua última consulta" — na tela inicial da paciente.
 *
 * A auditoria procurou algo assim no concorrente e não achou em lugar
 * nenhum. É percepção de valor pelo caminho mais honesto que existe: ela
 * abre o aplicativo e vê, em números que ELA MESMA produziu, que o
 * acompanhamento está acontecendo.
 *
 * NENHUMA FRASE DIZ SE O NÚMERO É BOM. "Você marcou 8 vezes" e não "só 8
 * vezes"; o peso aparece com os dois valores e sem seta, sem cor e sem
 * comentário. Perder peso é objetivo de umas pacientes e não de outras, e
 * um aplicativo que comemora ou lamenta número de balança está dando um
 * veredito que não é dele.
 *
 * O CARD SOME quando não há marco (nenhuma consulta registrada ainda) ou
 * quando nada aconteceu no período. Um card dizendo "você não fez nada
 * desde a última consulta" é uma cobrança na primeira tela do aplicativo.
 */
export function OQueMudou() {
  const [resumo, definirResumo] = useState<Resumo | null>(null);

  useEffect(() => {
    let vivo = true;
    void repositorio
      .oQueMudou()
      // Silencioso: a tela inicial não é lugar de explicar falha de rede.
      .then((r) => vivo && definirResumo(r))
      .catch(() => vivo && definirResumo(null));
    return () => {
      vivo = false;
    };
  }, []);

  if (!resumo?.temMarco) return null;

  const linhas: string[] = [];

  if (resumo.pesoAntes !== null && resumo.pesoAgora !== null) {
    const n = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
    linhas.push(`Peso: ${n(resumo.pesoAgora)} kg — antes era ${n(resumo.pesoAntes)} kg.`);
  }

  if (resumo.marcacoesDeMeta > 0) {
    linhas.push(
      `Você marcou ${resumo.marcacoesDeMeta} ${
        resumo.marcacoesDeMeta === 1 ? "vez" : "vezes"
      } nas suas metas.`,
    );
  }

  if (resumo.alimentosTestados > 0) {
    linhas.push(
      `Testou ${resumo.alimentosTestados} ${
        resumo.alimentosTestados === 1 ? "alimento" : "alimentos"
      }, em ${resumo.registrosDeRastreio} ${
        resumo.registrosDeRastreio === 1 ? "registro" : "registros"
      }.`,
    );
  }

  // Nulo é "a aba não está liberada"; zero é "está liberada e ela não
  // treinou" — e nesse caso a linha também não aparece, porque a tela
  // inicial não é lugar de cobrar.
  if (resumo.treinos !== null && resumo.treinos > 0) {
    const cardio =
      resumo.minutosDeCardio !== null && resumo.minutosDeCardio > 0
        ? ` e ${resumo.minutosDeCardio} minutos de cardio`
        : "";
    linhas.push(
      `${resumo.treinos} ${resumo.treinos === 1 ? "treino" : "treinos"}${cardio}.`,
    );
  }

  if (linhas.length === 0) return null;

  return (
    <section className="c-secao">
      <h2 className="c-secao-titulo">
        Desde a sua última consulta
        {resumo.dias !== null && resumo.dias > 0 && (
          <span className="c-secao-apoio">
            {" "}
            · há {resumo.dias} {resumo.dias === 1 ? "dia" : "dias"}
          </span>
        )}
      </h2>

      <div className="c-bloco">
        <ul className="c-padroes">
          {linhas.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>

        {resumo.proximaConsulta && (
          <p className="c-meta-rodape">
            Próximo retorno {quando(resumo.proximaConsulta, hojeSaoPaulo())}.
          </p>
        )}
      </div>
    </section>
  );
}
