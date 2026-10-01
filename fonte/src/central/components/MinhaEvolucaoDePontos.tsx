import { useEffect, useState } from "react";
import { repositorio } from "@/central/dados/repositorio";
import type { MesDaMinhaEvolucao } from "@/central/types/desafio";
import { alturasDasBarras, nomeCurtoDoMes, nomeDoMes } from "@/central/utils/historicoDePontos";

/**
 * "Minha evolução": os pontos que a paciente fez em cada mês, para ela ver o
 * caminho andando. Aparece só depois do primeiro ponto — antes disso seria um
 * gráfico de zeros dizendo que ela não fez nada.
 *
 * Mostra o mês atual e os 3 anteriores. Os pontos mais antigos continuam no
 * saldo; só saem desta lista.
 */
export function MinhaEvolucaoDePontos() {
  const [meses, definirMeses] = useState<MesDaMinhaEvolucao[]>([]);

  useEffect(() => {
    void repositorio.meuHistoricoDePontos().then(definirMeses).catch(() => definirMeses([]));
  }, []);

  if (meses.length === 0) return null;
  const alturas = alturasDasBarras(meses);

  return (
    <section className="c-secao">
      <h2 className="c-secao-titulo">Minha evolução</h2>
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
