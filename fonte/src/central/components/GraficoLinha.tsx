import { dataBonita } from "@/central/utils/situacao";
import { pontosDaLinha } from "@/central/utils/evolucaoAvaliacoes";

/**
 * Uma linha no tempo, desenhada à mão em SVG.
 *
 * SEM BIBLIOTECA DE GRÁFICO, e é escolha: são poucos pontos e uma linha, e
 * uma dependência custaria mais no carregamento do celular dela do que este
 * desenho inteiro. O mesmo `pontosDaLinha` que desenha o peso na avaliação
 * desenha a carga aqui — inclusive a regra de que o eixo do tempo é a DATA
 * e não a posição na lista.
 *
 * `aria-hidden` no desenho, com o número escrito embaixo: quem usa leitor
 * de tela recebe a informação em palavras, não um "gráfico" mudo.
 */
export function GraficoLinha({
  serie,
  unidade,
  vazio = "Sem dados para desenhar.",
}: {
  serie: { data: string; valor: number }[];
  unidade: string;
  vazio?: string;
}) {
  if (serie.length < 2) {
    return <p className="c-dica">{vazio}</p>;
  }

  const largura = 300;
  const altura = 70;
  const margem = 10;
  const pontos = pontosDaLinha(serie, largura, altura);
  const caminho = pontos.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const primeiro = pontos[0];
  const ultimo = pontos[pontos.length - 1];

  const numero = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  const menor = Math.min(...serie.map((p) => p.valor));
  const maior = Math.max(...serie.map((p) => p.valor));

  return (
    <div className="c-grafico">
      <svg
        className="c-linha-tempo"
        viewBox={`${-margem} ${-margem} ${largura + margem * 2} ${altura + margem * 2}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <polyline points={caminho} />
        {pontos.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} />
        ))}
      </svg>
      <div className="c-linha-tempo-pontas">
        <span>
          {dataBonita(primeiro?.ponto.data ?? null)} · {numero(primeiro?.ponto.valor ?? 0)}{" "}
          {unidade}
        </span>
        <span>
          {dataBonita(ultimo?.ponto.data ?? null)} · {numero(ultimo?.ponto.valor ?? 0)} {unidade}
        </span>
      </div>
      <p className="c-grafico-faixa">
        {serie.length} registros · de {numero(menor)} a {numero(maior)} {unidade}
      </p>
    </div>
  );
}

/**
 * As barras de frequência por semana.
 *
 * Barra e não linha: frequência é contagem por período, e uma linha ligando
 * duas semanas sugeriria que existe alguma coisa entre elas.
 */
export function BarrasDeFrequencia({
  semanas,
  metrica,
}: {
  semanas: { semana: string; treinos: number; cardioMin: number }[];
  metrica: "treinos" | "cardioMin";
}) {
  const valores = semanas.map((s) => s[metrica]);
  const teto = Math.max(1, ...valores);
  const unidade = metrica === "treinos" ? "" : " min";

  return (
    <div className="c-barras">
      {semanas.map((s) => {
        const valor = s[metrica];
        return (
          <div className="c-barra-semana" key={s.semana}>
            <span className="c-barra-valor">{valor > 0 ? `${valor}${unidade}` : ""}</span>
            {/* Altura mínima de 2 px na barra ZERADA: sem ela, a semana sem
                nada some do desenho e o buraco deixa de ser visível — e é o
                buraco que a profissional quer enxergar. */}
            <span
              className={valor > 0 ? "c-barra-corpo" : "c-barra-corpo c-barra-zero"}
              style={{ height: valor > 0 ? `${(valor / teto) * 100}%` : "2px" }}
            />
            <span className="c-barra-rotulo">{s.semana.slice(8)}/{s.semana.slice(5, 7)}</span>
          </div>
        );
      })}
    </div>
  );
}
