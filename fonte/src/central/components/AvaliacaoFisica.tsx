import { useEffect, useState } from "react";
import type { MinhaAvaliacao } from "@/central/types/protocolo";
import { repositorio } from "@/central/dados/repositorio";
import { dataBonita } from "@/central/utils/situacao";
import type { AvaliacaoNoTempo, ChaveDeSerie } from "@/central/utils/evolucaoAvaliacoes";
import {
  pontosDaLinha,
  serieDe,
  tabelaDeMedidas,
  variacaoRecente,
  variacaoTotal,
} from "@/central/utils/evolucaoAvaliacoes";

/**
 * A avaliação física da paciente, e a evolução dela no tempo.
 *
 * Molde: o PDF que a nutricionista usa — os números grandes, o peso
 * desenhado no tempo, e uma COLUNA POR AVALIAÇÃO nas medidas, com travessão
 * onde não se mediu.
 *
 * O QUE ESTA TELA NÃO FAZ, e é decisão, não falta:
 *
 *   * não recalcula nada. O percentual, a massa gorda e o IMC são os que a
 *     nutricionista lançou, vindos da ferramenta de cálculo dela. A única
 *     conta daqui é a subtração entre dois valores que ela já entregou;
 *   * não classifica o corpo da paciente. Não há "acima do ideal", não há
 *     faixa colorida dizendo se ela está certa ou errada — o PDF da
 *     nutricionista tem essa régua porque é ela lendo; aqui é a paciente
 *     lendo sobre o próprio corpo, sozinha;
 *   * não chama a variação de boa nem de ruim. "−2,4 kg desde 14/04" é
 *     fato; "parabéns" seria juízo, e quem decide o que a mudança significa
 *     é a consulta;
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

  // Uma versão antiga do banco não manda o histórico. Sem este recuo, a tela
  // quebraria inteira por causa da parte nova.
  const historico: AvaliacaoNoTempo[] =
    avaliacao.historico && avaliacao.historico.length > 0
      ? avaliacao.historico
      : [{ id: avaliacao.id, data: avaliacao.data, dados: d }];

  const dobras = tabelaDeMedidas(historico, "dobras");
  const circunferencias = tabelaDeMedidas(historico, "circunferencias");
  const temEvolucao = historico.length > 1;

  return (
    <>
      <p className="c-dica">
        Avaliação de {dataBonita(avaliacao.data)}
        {d.metodo ? ` · ${d.metodo}` : ""}
        {avaliacao.total > 1 && avaliacao.inicio
          ? ` · ${avaliacao.total}ª avaliação, desde ${dataBonita(avaliacao.inicio)}`
          : " · primeira avaliação, seu ponto de partida"}
      </p>

      <Destaques historico={historico} />

      {temEvolucao && <LinhaDoPeso historico={historico} />}

      <Composicao avaliacao={avaliacao} />

      {circunferencias.linhas.length > 0 && (
        <TabelaComparativa titulo="Suas medidas" tabela={circunferencias} />
      )}

      {dobras.linhas.length > 0 && (
        <>
          <TabelaComparativa titulo="Dobras cutâneas" tabela={dobras} />
          <SomaDasDobras historico={historico} metodo={d.metodo} />
        </>
      )}

      {d.observacao && <p className="c-nota-protocolo">{d.observacao}</p>}

      <p className="c-dica" style={{ marginTop: 18 }}>
        Medidas feitas e calculadas pela sua nutricionista. Os números mostram onde você está
        hoje — o que eles significam para você é conversa de consulta.
      </p>
    </>
  );
}

function numero(v: number | null | undefined, casas = 1): string | null {
  return v === null || v === undefined
    ? null
    : v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

/** A seta e a diferença, sem adjetivo. Ver o comentário do componente. */
function Variacao({
  chave,
  historico,
  unidade,
  casas = 1,
}: {
  chave: ChaveDeSerie;
  historico: AvaliacaoNoTempo[];
  unidade: string;
  casas?: number;
}) {
  const v = variacaoRecente(serieDe(historico, chave), casas);
  if (!v) return null;
  if (v.sentido === "igual") {
    return <span className="c-variacao c-variacao-igual">igual à anterior</span>;
  }
  return (
    <span className={`c-variacao c-variacao-${v.sentido}`}>
      {v.sentido === "subiu" ? "▲" : "▼"} {v.absoluto} {unidade}
      <span className="c-variacao-desde"> desde {dataBonita(v.desde)}</span>
    </span>
  );
}

const DESTAQUES: { chave: ChaveDeSerie; rotulo: string; unidade: string }[] = [
  { chave: "peso", rotulo: "Peso", unidade: "kg" },
  { chave: "imc", rotulo: "IMC", unidade: "kg/m²" },
  { chave: "percentualGordura", rotulo: "Gordura corporal", unidade: "%" },
];

function Destaques({ historico }: { historico: AvaliacaoNoTempo[] }) {
  const ultima = historico[0]?.dados;
  if (!ultima) return null;

  const visiveis = DESTAQUES.filter((x) => numero(ultima[x.chave]) !== null);
  if (visiveis.length === 0) return null;

  return (
    <div className="c-bloco c-destaques">
      {visiveis.map(({ chave, rotulo, unidade }) => (
        <div key={chave}>
          <span className="c-destaque-rotulo">{rotulo}</span>
          <span className="c-destaque-valor">
            {numero(ultima[chave])}
            <span className="c-destaque-unidade">{unidade}</span>
          </span>
          <Variacao chave={chave} historico={historico} unidade={unidade} />
        </div>
      ))}
    </div>
  );
}

/**
 * O peso desenhado no tempo, como no PDF dela.
 *
 * SVG à mão, sem biblioteca de gráfico: são poucos pontos e uma linha, e
 * uma dependência nova custaria mais no carregamento do celular dela do que
 * este desenho inteiro.
 *
 * `aria-hidden` no desenho, com os números escritos por extenso embaixo:
 * quem usa leitor de tela recebe a mesma informação em palavras, e não um
 * "gráfico" sem conteúdo.
 */
function LinhaDoPeso({ historico }: { historico: AvaliacaoNoTempo[] }) {
  const serie = serieDe(historico, "peso");
  if (serie.length < 2) return null;

  const largura = 280;
  const altura = 64;
  const margem = 10;
  const pontos = pontosDaLinha(serie, largura, altura);
  const caminho = pontos.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  const primeiro = pontos[0];
  const ultimo = pontos[pontos.length - 1];
  const total = variacaoTotal(serie);

  return (
    <section className="c-secao">
      <h2 className="c-secao-titulo">Seu peso ao longo do tempo</h2>
      <div className="c-bloco">
        <svg
          className="c-linha-tempo"
          viewBox={`${-margem} ${-margem} ${largura + margem * 2} ${altura + margem * 2}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <polyline points={caminho} />
          {pontos.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={3.5} />
          ))}
        </svg>

        <div className="c-linha-tempo-pontas">
          <span>
            {dataBonita(primeiro?.ponto.data ?? null)} · {numero(primeiro?.ponto.valor)} kg
          </span>
          <span>
            {dataBonita(ultimo?.ponto.data ?? null)} · {numero(ultimo?.ponto.valor)} kg
          </span>
        </div>

        {total && total.sentido !== "igual" && (
          <p className="c-item-protocolo-trocas" style={{ marginTop: 10 }}>
            {total.sentido === "desceu" ? "−" : "+"}
            {total.absoluto} kg desde a primeira avaliação, em {dataBonita(total.desde)}.
          </p>
        )}
      </div>
    </section>
  );
}

/** Do que o peso é feito — a barra de dois compartimentos do material dela. */
function Composicao({ avaliacao }: { avaliacao: MinhaAvaliacao }) {
  const d = avaliacao.dados;
  // Só aparece com os dois números: meia barra contaria meia verdade sobre o
  // corpo de alguém.
  if (d.massaGorda === null || d.massaMagra === null || !d.peso) return null;

  const porcentoGorda = (d.massaGorda / d.peso) * 100;

  return (
    <section className="c-secao">
      <h2 className="c-secao-titulo">Do que o seu peso é feito</h2>
      <div className="c-barra-corpo" aria-hidden="true">
        <span className="c-barra-gorda" style={{ width: `${porcentoGorda}%` }} />
        <span className="c-barra-magra" />
      </div>
      <p className="c-item-protocolo-trocas" style={{ marginTop: 8 }}>
        Massa gorda {numero(d.massaGorda)} kg · massa livre de gordura {numero(d.massaMagra)} kg
      </p>
    </section>
  );
}

function SomaDasDobras({
  historico,
  metodo,
}: {
  historico: AvaliacaoNoTempo[];
  metodo: string;
}) {
  const soma = historico[0]?.dados.somaDobras;
  if (soma === null || soma === undefined) return null;
  return (
    <p className="c-nota-protocolo">
      Soma das dobras: {numero(soma)} mm{metodo ? ` — ${metodo}` : ""}
    </p>
  );
}

/**
 * Uma coluna por avaliação, como no PDF.
 *
 * NO CELULAR a tabela rola de lado em vez de espremer as colunas: três
 * colunas de número num telefone estreito quebrariam "16,4 mm" em duas
 * linhas, e comparar valores quebrados é pior do que rolar.
 */
function TabelaComparativa({
  titulo,
  tabela,
}: {
  titulo: string;
  tabela: ReturnType<typeof tabelaDeMedidas>;
}) {
  const umaSo = tabela.colunas.length === 1;

  return (
    <section className="c-secao">
      <h2 className="c-secao-titulo">{titulo}</h2>
      <div className="c-tabela-rolagem">
        <table className="c-tabela-medidas">
          <thead>
            <tr>
              <th scope="col">Medida</th>
              {tabela.colunas.map((c) => (
                <th scope="col" key={c.id}>
                  {!umaSo && <span className="c-coluna-ordinal">{c.ordinal}</span>}
                  <span className="c-coluna-data">{dataBonita(c.data)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tabela.linhas.map((linha) => (
              <tr key={linha.nome}>
                <th scope="row">{linha.nome}</th>
                {linha.valores.map((v, i) => (
                  <td key={i}>
                    {v ?? (
                      <>
                        <span aria-hidden="true">—</span>
                        <span className="c-so-leitor">não medido nesta consulta</span>
                      </>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
