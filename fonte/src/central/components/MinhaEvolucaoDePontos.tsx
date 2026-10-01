import { useEffect, useState } from "react";
import { repositorio } from "@/central/dados/repositorio";
import type { MesDaMinhaEvolucao } from "@/central/types/desafio";
import { alturasDasBarras, fraseDoMes, nomeCurtoDoMes, nomeDoMes } from "@/central/utils/historicoDePontos";
import { hojeSaoPaulo } from "@/central/utils/situacao";

/**
 * "Minha evolução": os pontos que a paciente fez em cada mês, para ela ver o
 * caminho andando. Aparece só depois do primeiro ponto — antes disso seria um
 * gráfico de zeros dizendo que ela não fez nada.
 *
 * Em cima, a frase do mês que acabou (pontos e posição), para ela saber por que
 * recebe o presente. Mostra o mês atual e os 3 anteriores. Os pontos mais antigos continuam no
 * saldo; só saem desta lista.
 */
export function MinhaEvolucaoDePontos() {
  const [meses, definirMeses] = useState<MesDaMinhaEvolucao[]>([]);

  useEffect(() => {
    void repositorio.meuHistoricoDePontos().then(definirMeses).catch(() => definirMeses([]));
  }, []);

  if (meses.length === 0) return null;
  const alturas = alturasDasBarras(meses);
  // O mês que acabou: é o dos presentes. A paciente precisa ver ali o que ela
  // fez e em que lugar ficou, para entender o que está ganhando.
  const mesDeHoje = `${hojeSaoPaulo().slice(0, 7)}-01`;
  const passado = [...meses].reverse().find((m) => m.mes < mesDeHoje);
  const frase = passado ? fraseDoMes(passado) : null;

  return (
    <section className="c-secao">
      <h2 className="c-secao-titulo">Minha evolução</h2>
      {frase && passado && (
        <p className="c-mes-passado">
          <span aria-hidden="true">{passado.posicao === 1 ? "👑" : passado.posicao === 2 ? "🥈" : passado.posicao === 3 ? "🥉" : "🌱"}</span>{" "}
          {frase}
        </p>
      )}
      <div className="c-evolucao" role="img" aria-label={meses.map((m) => `${nomeDoMes(m.mes)}: ${m.pontos} pontos`).join(". ")}>
        {meses.map((m, i) => (
          <div key={m.mes} className="c-evolucao-coluna">
            <span className="c-evolucao-valor">{m.pontos}</span>
            <span className="c-evolucao-barra-caixa">
              <span className="c-evolucao-barra" style={{ height: `${alturas[i]}%` }} />
            </span>
            <span className="c-evolucao-mes">{nomeCurtoDoMes(m.mes)}</span>
          </div>
        ))}
      </div>
      <p className="c-dica">Pontos que você fez em cada mês. O saldo acumulado continua somando tudo.</p>
    </section>
  );
}
