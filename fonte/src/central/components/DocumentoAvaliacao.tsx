import type { MinhaAvaliacao } from "@/central/types/protocolo";
import { dataBonita } from "@/central/utils/situacao";
import type { AvaliacaoNoTempo } from "@/central/utils/evolucaoAvaliacoes";
import {
  serieDe,
  tabelaDeMedidas,
  variacaoRecente,
  variacaoTotal,
} from "@/central/utils/evolucaoAvaliacoes";
import { Marca } from "./Marca";

/**
 * A avaliação física em documento, com a evolução entre consultas.
 *
 * Mesmas regras de sempre, e elas valem ainda mais no papel, que sai da
 * consulta e vai para a gaveta:
 *
 *   * NADA é recalculado. Percentual, massa gorda e IMC são os que a
 *     nutricionista lançou. A única conta do documento é a subtração entre
 *     dois valores que ela mesma entregou;
 *   * NADA é classificado. Não há faixa dizendo se o corpo da paciente
 *     está certo ou errado, e não há verde nem vermelho na variação:
 *     perder peso é o objetivo de uma paciente e o problema de outra;
 *   * o que não foi medido vira TRAVESSÃO na coluna daquela consulta, não
 *     zero — e não some da linha, senão a medida que existe iria junto.
 */
export function DocumentoAvaliacao({
  paciente,
  avaliacao,
  nutricionista,
}: {
  paciente: string;
  avaliacao: MinhaAvaliacao | null;
  nutricionista: string;
}) {
  if (!avaliacao) return null;

  const d = avaliacao.dados;
  const historico: AvaliacaoNoTempo[] =
    avaliacao.historico && avaliacao.historico.length > 0
      ? avaliacao.historico
      : [{ id: avaliacao.id, data: avaliacao.data, dados: d }];

  const dobras = tabelaDeMedidas(historico, "dobras", 4);
  const circunferencias = tabelaDeMedidas(historico, "circunferencias", 4);

  return (
    <article className="doc" aria-hidden="true">
      <header className="doc-capa">
        <Marca altura={40} className="doc-marca" />
        <p className="doc-sobretitulo">Avaliação Física</p>
        <h1 className="doc-nome">{paciente}</h1>
        <p className="doc-periodo">
          Avaliação de {dataBonita(avaliacao.data)}
          {d.metodo ? ` · ${d.metodo}` : ""}
          {avaliacao.total > 1 && avaliacao.inicio
            ? ` · ${avaliacao.total}ª avaliação, desde ${dataBonita(avaliacao.inicio)}`
            : " · primeira avaliação"}
        </p>
        <p className="doc-aviso">
          Medidas feitas e calculadas pela sua nutricionista. Os números mostram onde você está
          hoje — o que eles significam para você é conversa de consulta.
        </p>
      </header>

      <Numeros historico={historico} />
      <Composicao avaliacao={avaliacao} />

      {circunferencias.linhas.length > 0 && (
        <Comparativa titulo="Medidas" tabela={circunferencias} />
      )}
      {dobras.linhas.length > 0 && (
        <>
          <Comparativa titulo="Dobras cutâneas" tabela={dobras} />
          {d.somaDobras !== null && (
            <p className="doc-nota">
              Soma das dobras: {numero(d.somaDobras)} mm{d.metodo ? ` — ${d.metodo}` : ""}
            </p>
          )}
        </>
      )}

      {d.observacao && (
        <section className="doc-secao">
          <h2 className="doc-titulo">Observações</h2>
          <p className="doc-paragrafo">{d.observacao}</p>
        </section>
      )}

      <footer className="doc-rodape">
        <p>
          <strong>Avaliação Física — {paciente}</strong>
        </p>
        <p>Nutricionista: {nutricionista}</p>
      </footer>
    </article>
  );
}

function numero(v: number | null | undefined, casas = 1): string | null {
  return v === null || v === undefined
    ? null
    : v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

const NUMEROS = [
  { chave: "peso", rotulo: "Peso", unidade: "kg" },
  { chave: "imc", rotulo: "IMC", unidade: "kg/m²" },
  { chave: "percentualGordura", rotulo: "Gordura corporal", unidade: "%" },
] as const;

function Numeros({ historico }: { historico: AvaliacaoNoTempo[] }) {
  const ultima = historico[0]?.dados;
  if (!ultima) return null;
  const visiveis = NUMEROS.filter((x) => numero(ultima[x.chave]) !== null);
  if (visiveis.length === 0) return null;

  return (
    <section className="doc-secao">
      <h2 className="doc-titulo">Onde você está hoje</h2>
      <div className="doc-resumo doc-resumo-tres">
        {visiveis.map(({ chave, rotulo, unidade }) => {
          const serie = serieDe(historico, chave);
          const recente = variacaoRecente(serie);
          const total = variacaoTotal(serie);
          return (
            <div className="doc-numero" key={chave}>
              <strong>
                {numero(ultima[chave])}
                <small> {unidade}</small>
              </strong>
              <span>{rotulo}</span>
              {/* A seta diz a DIREÇÃO, e o texto vem junto: impresso em
                  preto e branco, quem lê precisa da palavra, não da cor. */}
              {recente && recente.sentido !== "igual" && (
                <span className="doc-variacao">
                  {recente.sentido === "desceu" ? "▼" : "▲"} {recente.absoluto} {unidade} desde{" "}
                  {dataBonita(recente.desde)}
                </span>
              )}
              {total && total.sentido !== "igual" && historico.length > 2 && (
                <span className="doc-variacao">
                  {total.sentido === "desceu" ? "−" : "+"}
                  {total.absoluto} {unidade} desde a primeira
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Composicao({ avaliacao }: { avaliacao: MinhaAvaliacao }) {
  const d = avaliacao.dados;
  // Meia barra contaria meia verdade sobre o corpo de alguém.
  if (d.massaGorda === null || d.massaMagra === null || !d.peso) return null;
  const porcento = (d.massaGorda / d.peso) * 100;

  return (
    <section className="doc-secao">
      <h2 className="doc-titulo">Do que o seu peso é feito</h2>
      <div className="doc-barra">
        <span className="doc-barra-gorda" style={{ width: `${porcento}%` }} />
      </div>
      <p className="doc-nota">
        Massa gorda {numero(d.massaGorda)} kg · massa livre de gordura {numero(d.massaMagra)} kg
      </p>
    </section>
  );
}

/** Uma coluna por consulta, com travessão onde não se mediu. */
function Comparativa({
  titulo,
  tabela,
}: {
  titulo: string;
  tabela: ReturnType<typeof tabelaDeMedidas>;
}) {
  const umaSo = tabela.colunas.length === 1;
  return (
    <section className="doc-secao">
      <h2 className="doc-titulo">{titulo}</h2>
      <table className="doc-tabela doc-tabela-medidas">
        <thead>
          <tr>
            <th scope="col">Medida</th>
            {tabela.colunas.map((c) => (
              <th scope="col" key={c.id} className="doc-data">
                {!umaSo && <span className="doc-ordinal">{c.ordinal}</span>}
                {dataBonita(c.data)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tabela.linhas.map((linha) => (
            <tr key={linha.nome}>
              <th scope="row">{linha.nome}</th>
              {linha.valores.map((v, i) => (
                <td key={i} className="doc-data">
                  {v ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
