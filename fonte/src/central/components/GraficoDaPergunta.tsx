import { useState } from "react";
import type { QuestionarioDoPaciente } from "@/central/types/questionario";
import { carinhaDe } from "@/central/utils/carinhaDaResposta";
import {
  resumoDaPergunta,
  serieDaPergunta,
  temGrafico,
  trechosDaLinha,
} from "@/central/utils/evolucaoPorPergunta";

/**
 * Uma pergunta do check-in ao longo das semanas, com as carinhas no eixo.
 *
 * UMA PERGUNTA DE CADA VEZ, escolhida por chip. Um check-in de quinze
 * perguntas daria quinze gráficos empilhados, e o prontuário viraria uma
 * rolagem sem fim para achar "fome".
 *
 * O EIXO DO TEMPO É A POSIÇÃO, e não a data — ao contrário do peso. Check-in
 * é semanal: uma semana sem resposta já aparece como buraco na linha, e é
 * esse buraco que importa ver.
 *
 * SEM LIBRARY, pelo mesmo motivo do `GraficoLinha`: poucos pontos, e uma
 * dependência custaria mais no celular do que este desenho inteiro.
 */

const LARGURA = 320;
const ALTURA = 172;
const X0 = 46;
const X1 = 308;
const Y_TOPO = 12;
const Y_BASE = 140;
/** As carinhas ficam no meio de cada faixa de `carinhaDe`. */
const NIVEIS = [9, 7, 5, 3, 1];

function y(valor: number): number {
  return Y_BASE - (valor / 10) * (Y_BASE - Y_TOPO);
}

function diaMes(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return dia && mes ? `${dia}/${mes}` : iso;
}

export function GraficoDaPergunta({ questionario }: { questionario: QuestionarioDoPaciente }) {
  const perguntas = questionario.perguntas.filter(temGrafico);
  const [escolhida, definirEscolhida] = useState(perguntas[0]?.id ?? "");
  const pergunta = perguntas.find((p) => p.id === escolhida) ?? perguntas[0];

  if (!pergunta || questionario.envios.length < 2) return null;

  const serie = serieDaPergunta(
    { id: pergunta.id, tipo: pergunta.tipo, peso: pergunta.peso, invertida: pergunta.invertida },
    questionario.envios,
  );
  const trechos = trechosDaLinha(serie);
  const resumo = resumoDaPergunta(serie);
  const passo = serie.length > 1 ? (X1 - X0) / (serie.length - 1) : 0;
  const x = (i: number) => (serie.length > 1 ? X0 + i * passo : (X0 + X1) / 2);
  // Com muitas semanas as datas se atropelam: mostra umas seis, sempre com
  // a última, que é a que ela procura.
  const salto = Math.max(1, Math.ceil(serie.length / 6));
  const comRotulo = (i: number) => i === serie.length - 1 || i % salto === 0;

  const primeira = carinhaDe(resumo.primeiro?.valor ?? null);
  const ultima = carinhaDe(resumo.ultimo?.valor ?? null);

  return (
    <div className="c-grafico-pergunta">
      <h3 className="c-subtitulo">Evolução por pergunta</h3>
      <div className="c-chips" role="group" aria-label="Escolha a pergunta do gráfico">
        {perguntas.map((p) => (
          <button
            key={p.id}
            type="button"
            className="c-chip c-chip-pergunta"
            aria-pressed={p.id === pergunta.id}
            onClick={() => definirEscolhida(p.id)}
            title={p.texto}
          >
            {p.texto}
          </button>
        ))}
      </div>

      <svg
        className="c-grafico-carinhas"
        viewBox={`0 0 ${LARGURA} ${ALTURA}`}
        role="img"
        aria-label={`${pergunta.texto}: ${resumo.respondidas} respostas desenhadas no tempo`}
      >
        {NIVEIS.map((n) => {
          const carinha = carinhaDe(n);
          return (
            <g key={n}>
              <line className="c-grade" x1={X0 - 10} x2={X1 + 6} y1={y(n)} y2={y(n)} />
              <text className="c-eixo-carinha" x={18} y={y(n)} dominantBaseline="central">
                {carinha?.rosto}
              </text>
            </g>
          );
        })}

        {trechos
          .filter((t) => t.length > 1)
          .map((t) => (
            <polyline
              key={t[0]}
              className="c-linha-pergunta"
              points={t.map((i) => `${x(i).toFixed(1)},${y(serie[i]?.valor ?? 0).toFixed(1)}`).join(" ")}
            />
          ))}

        {serie.map((p, i) => {
          const rotulo = comRotulo(i) ? (
            <text key={`r${i}`} className="c-eixo-data" x={x(i)} y={ALTURA - 8} textAnchor="middle">
              {diaMes(p.periodo)}
            </text>
          ) : null;
          if (p.valor === null) {
            // Semana sem resposta: um tracinho no pé, para o buraco ter
            // lugar marcado e não parecer defeito do desenho.
            return (
              <g key={p.periodo}>
                <line className="c-sem-ponto" x1={x(i) - 4} x2={x(i) + 4} y1={Y_BASE + 8} y2={Y_BASE + 8} />
                {rotulo}
              </g>
            );
          }
          const carinha = carinhaDe(p.valor);
          return (
            <g key={p.periodo}>
              <circle className={`c-ponto-pergunta nivel-${carinha?.nivel ?? "medio"}`} cx={x(i)} cy={y(p.valor)} r={5}>
                <title>{`${diaMes(p.periodo)} · ${carinha?.descricao ?? ""}`}</title>
              </circle>
              {rotulo}
            </g>
          );
        })}
      </svg>

      <p className="c-grafico-faixa">
        Respondeu {resumo.respondidas} de {resumo.total}{" "}
        {questionario.periodicidade === "semanal" ? "semanas" : "vezes"}
        {primeira && ultima && (
          <>
            {" "}· primeira {primeira.rosto} {primeira.descricao} · última {ultima.rosto}{" "}
            {ultima.descricao}
          </>
        )}
      </p>
      {pergunta.invertida && (
        <p className="c-dica" style={{ marginTop: 4 }}>
          Pergunta invertida: aqui, para cima quer dizer <strong>menos</strong> — como na
          carinha da tabela.
        </p>
      )}
    </div>
  );
}
