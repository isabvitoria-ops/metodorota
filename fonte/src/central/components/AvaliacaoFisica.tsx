import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MinhaAvaliacao } from "@/central/types/protocolo";
import { repositorio } from "@/central/dados/repositorio";
import { useSessao } from "@/central/autenticacao/SessaoContexto";
import { dataBonita } from "@/central/utils/situacao";
import type { AvaliacaoNoTempo, ChaveDeSerie, SerieParaDesenhar } from "@/central/utils/evolucaoAvaliacoes";
import {
  fraseDaVariacaoTotal,
  pontosDaLinha,
  serieDe,
  seriesParaDesenhar,
  tabelaDeMedidas,
  variacaoRecente,
} from "@/central/utils/evolucaoAvaliacoes";
import { DocumentoAvaliacao } from "@/central/components/DocumentoAvaliacao";
import { Esqueleto } from "@/central/components/Esqueleto";
import { EstadoVazio } from "@/central/components/EstadoVazio";
import { Icone } from "@/central/components/Icone";
import { abrirImpressao } from "@/central/utils/impressao";

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
  const { acesso } = useSessao();
  const [avaliacao, definirAvaliacao] = useState<MinhaAvaliacao | null>(null);
  // "sem-rede" é diferente de "não tem avaliação": dizer "ainda não foi
  // lançada" quando só a internet caiu faria ela achar que a avaliação sumiu.
  const [estado, definirEstado] = useState<"carregando" | "pronto" | "sem-rede">("carregando");
  const [tentativa, definirTentativa] = useState(0);

  useEffect(() => {
    let vivo = true;
    definirEstado("carregando");
    void repositorio
      .minhaAvaliacao()
      .then((a) => {
        if (!vivo) return;
        definirAvaliacao(a);
        definirEstado("pronto");
      })
      .catch(() => vivo && definirEstado("sem-rede"));
    return () => {
      vivo = false;
    };
  }, [tentativa]);

  if (estado === "carregando") return <Esqueleto />;
  if (estado === "sem-rede") {
    return (
      <div className="c-aviso c-aviso-erro" role="alert">
        <span>Não consegui abrir a sua avaliação agora. Confira a internet e tente de novo.</span>
        <button type="button" className="c-botao c-botao-pequeno" onClick={() => definirTentativa((n) => n + 1)}>
          Tentar de novo
        </button>
      </div>
    );
  }
  if (!avaliacao) {
    return (
      <EstadoVazio
        icone="balanca"
        titulo="Sua avaliação aparece aqui"
        descricao="Assim que sua nutricionista lançar a primeira avaliação física, ela fica nesta tela."
      />
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
      <header className="c-prot-capa c-av-capa">
        <p className="c-prot-capa-sobre">
          {avaliacao.total > 1 ? `${avaliacao.total}ª avaliação` : "Primeira avaliação"}
        </p>
        <h2 className="c-prot-capa-titulo">Avaliação de {dataBonita(avaliacao.data)}</h2>
        <p className="c-prot-capa-meta">
          {[
            avaliacao.total > 1 && avaliacao.inicio
              ? `Acompanhando desde ${dataBonita(avaliacao.inicio)}`
              : "Seu ponto de partida",
            d.metodo,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <div className="c-prot-capa-acoes">
          <button
            type="button"
            className="c-prot-acao"
            onClick={() => abrirImpressao()}
          >
            <Icone nome="documentos" tamanho={17} />
            Baixar em PDF
          </button>
        </div>
      </header>

      <Destaques historico={historico} />

      {temEvolucao && <Evolucao historico={historico} />}

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

      {/* O documento fica montado fora da tela, pronto: no iPhone a tela de
          imprimir só abre se for chamada na hora do toque. */}
      <DocumentoAvaliacao paciente={acesso.nome ?? "Paciente"} avaliacao={avaliacao} />
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

  // O primeiro número ocupa a largura toda; os outros dividem a linha de
  // baixo. Três colunas num celular quebravam "Gordura corporal" em duas
  // linhas e a variação em três.
  return (
    <div className="c-av-destaques">
      {visiveis.map(({ chave, rotulo, unidade }) => (
        <div className="c-av-destaque" key={chave}>
          <div>
            <span className="c-destaque-rotulo">{rotulo}</span>
            <span className="c-destaque-valor">
              {numero(ultima[chave])}
              <span className="c-destaque-unidade">{unidade}</span>
            </span>
          </div>
          <Variacao chave={chave} historico={historico} unidade={unidade} />
        </div>
      ))}
    </div>
  );
}

/**
 * A evolução desenhada no tempo, como no PDF dela — o peso primeiro, e as
 * outras medidas que tiverem duas consultas ou mais, uma de cada vez.
 *
 * SVG à mão, sem biblioteca de gráfico: são poucos pontos e uma linha, e
 * uma dependência nova custaria mais no carregamento do celular dela do que
 * este desenho inteiro.
 *
 * `aria-hidden` no desenho, com os números escritos por extenso embaixo:
 * quem usa leitor de tela recebe a mesma informação em palavras, e não um
 * "gráfico" sem conteúdo.
 */
function Evolucao({ historico }: { historico: AvaliacaoNoTempo[] }) {
  const series = seriesParaDesenhar(historico);
  const [escolhida, definirEscolhida] = useState<ChaveDeSerie>("peso");
  const atual = series.find((s) => s.chave === escolhida) ?? series[0];
  if (!atual) return null;

  return (
    <section className="c-secao">
      <h2 className="c-secao-titulo">Sua evolução</h2>
      <div className="c-bloco">
        {series.length > 1 && (
          <div className="c-av-series" role="group" aria-label="O que ver no gráfico">
            {series.map((s) => (
              <button
                key={s.chave}
                type="button"
                className={`c-av-serie${s.chave === atual.chave ? " c-av-serie--ativa" : ""}`}
                aria-pressed={s.chave === atual.chave}
                onClick={() => definirEscolhida(s.chave)}
              >
                {s.rotulo}
              </button>
            ))}
          </div>
        )}
        <Linha atual={atual} />
      </div>
    </section>
  );
}

function Linha({ atual }: { atual: SerieParaDesenhar }) {
  const largura = 280;
  const altura = 64;
  const margem = 10;
  const pontos = pontosDaLinha(atual.serie, largura, altura);
  const caminho = pontos.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const primeiro = pontos[0];
  const ultimo = pontos[pontos.length - 1];
  const frase = fraseDaVariacaoTotal(atual.serie, atual.unidade);

  // O valor escrito em cima de cada ponto — até cinco consultas. Com mais do
  // que isso os números se atropelam, e ficam só o primeiro e o último.
  const comValor = pontos.length <= 5 ? pontos : [primeiro, ultimo];

  return (
    <>
      <div className="c-av-grafico">
       <div className="c-av-grafico-area">
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
        {comValor.map((p, i) =>
          p ? (
            <span
              key={i}
              aria-hidden="true"
              className={`c-av-ponto${p === primeiro ? " c-av-ponto--inicio" : ""}${p === ultimo ? " c-av-ponto--fim" : ""}`}
              style={{
                left: `${((p.x + margem) / (largura + margem * 2)) * 100}%`,
                top: `${((p.y + margem) / (altura + margem * 2)) * 100}%`,
              }}
            >
              {numero(p.ponto.valor)}
            </span>
          ) : null,
        )}
       </div>
      </div>

      <div className="c-linha-tempo-pontas">
        <span>
          {dataBonita(primeiro?.ponto.data ?? null)} · {numero(primeiro?.ponto.valor)} {atual.unidade}
        </span>
        <span>
          {dataBonita(ultimo?.ponto.data ?? null)} · {numero(ultimo?.ponto.valor)} {atual.unidade}
        </span>
      </div>

      {frase && (
        <p className="c-av-frase">
          {frase}, em {dataBonita(primeiro?.ponto.data ?? null)}.
        </p>
      )}
    </>
  );
}

/** Do que o peso é feito — a barra de dois compartimentos do material dela. */
function Composicao({ avaliacao }: { avaliacao: MinhaAvaliacao }) {
  const d = avaliacao.dados;
  // Só aparece com os dois números: meia barra contaria meia verdade sobre o
  // corpo de alguém.
  if (d.massaGorda === null || d.massaMagra === null || !d.peso) return null;

  // O percentual lançado por ela manda: é o mesmo número do cartão
  // "Gordura corporal" logo acima. Recalcular pela massa gorda fazia a barra
  // e o cartão discordarem sempre que um dos dois tivesse arredondamento.
  const bruto = d.percentualGordura ?? (d.massaGorda / d.peso) * 100;
  const porcentoGorda = Math.max(0, Math.min(100, bruto));

  const temFracionamento = d.pesoOsseo !== null && d.pesoOsseo !== undefined
    && d.pesoResidual !== null && d.pesoResidual !== undefined
    && d.pesoMuscular !== null && d.pesoMuscular !== undefined;

  return (
    <section className="c-secao">
      <h2 className="c-secao-titulo">Do que o seu peso é feito</h2>
      <div className="c-bloco">
        <div className="c-barra-corpo" aria-hidden="true">
          <span className="c-barra-gorda" style={{ width: `${porcentoGorda}%` }} />
          <span className="c-barra-magra" />
        </div>
        <dl className="c-av-lista">
          <div>
            <dt>
              <span className="c-av-cor c-av-cor--gorda" aria-hidden="true" />
              Massa gorda
            </dt>
            <dd>{numero(d.massaGorda)} kg</dd>
          </div>
          <div>
            <dt>
              <span className="c-av-cor c-av-cor--magra" aria-hidden="true" />
              Massa livre de gordura
            </dt>
            <dd>{numero(d.massaMagra)} kg</dd>
          </div>
          {temFracionamento && (
            <>
              <div className="c-av-lista-sub">
                <dt>Muscular</dt>
                <dd>{numero(d.pesoMuscular)} kg</dd>
              </div>
              <div className="c-av-lista-sub">
                <dt>Ósseo</dt>
                <dd>{numero(d.pesoOsseo)} kg</dd>
              </div>
              <div className="c-av-lista-sub">
                <dt>Residual</dt>
                <dd>{numero(d.pesoResidual)} kg</dd>
              </div>
            </>
          )}
          {d.tmb !== null && d.tmb !== undefined && (
            <div>
              <dt>Taxa metabólica basal</dt>
              <dd>{d.tmb.toLocaleString("pt-BR")} kcal/dia</dd>
            </div>
          )}
        </dl>
      </div>
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
  const ultima = tabela.colunas.length - 1;

  // A tabela abre mostrando a consulta MAIS RECENTE. Rolando de lado a partir
  // do começo, a coluna de hoje — a que ela veio ver — ficava fora da tela.
  const rolagem = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const caixa = rolagem.current;
    if (caixa) caixa.scrollLeft = caixa.scrollWidth;
  }, [tabela.colunas.length]);

  return (
    <section className="c-secao">
      <h2 className="c-secao-titulo">{titulo}</h2>
      <div className="c-tabela-rolagem" ref={rolagem}>
        <table className="c-tabela-medidas c-av-tabela">
          <thead>
            <tr>
              <th scope="col">Medida</th>
              {tabela.colunas.map((c, i) => (
                <th scope="col" key={c.id} className={!umaSo && i === ultima ? "c-av-atual" : undefined}>
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
                  <td key={i} className={!umaSo && i === ultima ? "c-av-atual" : undefined}>
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
