import type { AvaliacaoFisica } from "@/central/types/protocolo";
import type { AvaliacaoNoTempo, ChaveDeSerie } from "@/central/utils/evolucaoAvaliacoes";
import {
  emOrdemDeData,
  pontosDaLinha,
  serieDe,
  tabelaDeMedidas,
  variacaoRecente,
  variacaoTotal,
} from "@/central/utils/evolucaoAvaliacoes";
import { dataBonita } from "@/central/utils/situacao";

/**
 * A evolução da composição corporal para a nutricionista.
 *
 * O molde é o PDF do WebDiet que ela já conhece: tabela com uma coluna
 * por avaliação, gráfico de peso no tempo, e os destaques com variação.
 *
 * DIFERENTE DA TELA DA PACIENTE, aqui:
 *   * as classificações aparecem (IMC, % de gordura);
 *   * todas as séries importantes ganham gráfico;
 *   * a tabela comparativa mostra TODAS as colunas, não só as últimas 3.
 */

function num(v: number | null | undefined, casas = 1): string {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

function delta(serie: { data: string; valor: number }[], casas = 1): string | null {
  const v = variacaoRecente(serie, casas);
  if (!v || v.sentido === "igual") return null;
  return `${v.sentido === "desceu" ? "↓" : "↑"} (${v.sentido === "desceu" ? "−" : "+"}${v.absoluto})`;
}

export function EvolucaoCorpoDoProntuario({ avaliacoes }: { avaliacoes: AvaliacaoFisica[] }) {
  if (avaliacoes.length === 0) return null;

  const historico: AvaliacaoNoTempo[] = avaliacoes.map((a) => ({
    id: a.id,
    data: a.data,
    dados: a.dados,
  }));

  const cronologico = emOrdemDeData(historico);
  const ultima = cronologico[cronologico.length - 1];
  if (!ultima) return null;

  const d = ultima.dados;
  const temEvolucao = cronologico.length > 1;

  const seriePeso = serieDe(historico, "peso");
  const serieGordura = serieDe(historico, "percentualGordura");
  const serieMassaMagra = serieDe(historico, "massaMagra");

  const dobras = tabelaDeMedidas(historico, "dobras", cronologico.length);
  const circunferencias = tabelaDeMedidas(historico, "circunferencias", cronologico.length);

  return (
    <section className="c-secao">
      <h2 className="c-secao-titulo">Composição corporal</h2>
      <p className="c-dica">
        Última avaliação em {dataBonita(ultima.data)}
        {d.metodo ? ` · ${d.metodo}` : ""}
        {cronologico.length > 1
          ? ` · ${cronologico.length} avaliações desde ${dataBonita(cronologico[0]?.data ?? "")}`
          : " · primeira avaliação"}
      </p>

      <PainelDeNumeros historico={cronologico} />

      {temEvolucao && seriePeso.length >= 2 && (
        <MiniGrafico serie={seriePeso} titulo="Peso" unidade="kg" />
      )}

      {temEvolucao && serieGordura.length >= 2 && (
        <MiniGrafico serie={serieGordura} titulo="% gordura" unidade="%" />
      )}

      {temEvolucao && serieMassaMagra.length >= 2 && (
        <MiniGrafico serie={serieMassaMagra} titulo="Massa magra" unidade="kg" />
      )}

      <TabelaPrincipal cronologico={cronologico} />

      {circunferencias.linhas.length > 0 && (
        <TabelaComparativa titulo="Circunferências" tabela={circunferencias} />
      )}

      {dobras.linhas.length > 0 && (
        <TabelaComparativa titulo="Dobras cutâneas" tabela={dobras} />
      )}
    </section>
  );
}

const DESTAQUES: { chave: ChaveDeSerie; rotulo: string; unidade: string }[] = [
  { chave: "peso", rotulo: "Peso", unidade: "kg" },
  { chave: "imc", rotulo: "IMC", unidade: "kg/m²" },
  { chave: "percentualGordura", rotulo: "% Gordura", unidade: "%" },
  { chave: "massaGorda", rotulo: "Massa gorda", unidade: "kg" },
  { chave: "massaMagra", rotulo: "Massa magra", unidade: "kg" },
  { chave: "pesoMuscular", rotulo: "Massa muscular", unidade: "kg" },
];

function PainelDeNumeros({ historico }: { historico: AvaliacaoNoTempo[] }) {
  const ultima = historico[historico.length - 1]?.dados;
  if (!ultima) return null;

  const visiveis = DESTAQUES.filter(
    (x) => ultima[x.chave] !== null && ultima[x.chave] !== undefined,
  );
  if (visiveis.length === 0) return null;

  return (
    <div className="c-bloco c-destaques c-destaques-admin">
      {visiveis.map(({ chave, rotulo, unidade }) => {
        const serie = serieDe(historico, chave);
        const d = delta(serie);
        return (
          <div key={chave}>
            <span className="c-destaque-rotulo">{rotulo}</span>
            <span className="c-destaque-valor">
              {num(ultima[chave])}
              <span className="c-destaque-unidade">{unidade}</span>
            </span>
            {d && (
              <span className={`c-variacao c-variacao-${d.startsWith("↓") ? "desceu" : "subiu"}`}>
                {d}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MiniGrafico({
  serie,
  titulo,
  unidade,
}: {
  serie: { data: string; valor: number }[];
  titulo: string;
  unidade: string;
}) {
  const largura = 300;
  const altura = 56;
  const margem = 8;
  const pontos = pontosDaLinha(serie, largura, altura);
  const caminho = pontos.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const primeiro = pontos[0];
  const ultimo = pontos[pontos.length - 1];
  const total = variacaoTotal(serie);

  return (
    <div className="c-bloco" style={{ marginTop: 10 }}>
      <strong className="c-destaque-rotulo">{titulo}</strong>
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
          {dataBonita(primeiro?.ponto.data ?? null)} · {num(primeiro?.ponto.valor)} {unidade}
        </span>
        <span>
          {dataBonita(ultimo?.ponto.data ?? null)} · {num(ultimo?.ponto.valor)} {unidade}
        </span>
      </div>
      {total && total.sentido !== "igual" && (
        <p className="c-dica" style={{ marginTop: 4 }}>
          {total.sentido === "desceu" ? "−" : "+"}
          {total.absoluto} {unidade} no total
        </p>
      )}
    </div>
  );
}

interface LinhaParam {
  rotulo: string;
  valores: (string | null)[];
}

function TabelaPrincipal({ cronologico }: { cronologico: AvaliacaoNoTempo[] }) {
  const parametros: { rotulo: string; extrair: (d: AvaliacaoNoTempo) => string | null }[] = [
    { rotulo: "Peso (kg)", extrair: (a) => num(a.dados.peso) },
    { rotulo: "Altura (cm)", extrair: (a) => (a.dados.altura ? num(a.dados.altura, 0) : null) },
    { rotulo: "IMC (kg/m²)", extrair: (a) => num(a.dados.imc) },
    { rotulo: "Gordura (%)", extrair: (a) => num(a.dados.percentualGordura) },
    { rotulo: "Massa gorda (kg)", extrair: (a) => num(a.dados.massaGorda) },
    { rotulo: "Massa magra (kg)", extrair: (a) => num(a.dados.massaMagra) },
    { rotulo: "Massa muscular (kg)", extrair: (a) => num(a.dados.pesoMuscular) },
    { rotulo: "Peso ósseo (kg)", extrair: (a) => num(a.dados.pesoOsseo) },
    { rotulo: "Peso residual (kg)", extrair: (a) => num(a.dados.pesoResidual) },
    { rotulo: "TMB (kcal)", extrair: (a) => (a.dados.tmb !== null && a.dados.tmb !== undefined ? a.dados.tmb.toLocaleString("pt-BR") : null) },
    { rotulo: "Soma dobras (mm)", extrair: (a) => num(a.dados.somaDobras) },
  ];

  const linhas: LinhaParam[] = parametros
    .map((p) => ({
      rotulo: p.rotulo,
      valores: cronologico.map((a) => p.extrair(a)),
    }))
    .filter((l) => l.valores.some((v) => v !== null && v !== "—"));

  if (linhas.length === 0) return null;

  return (
    <div style={{ marginTop: 14 }}>
      <strong className="c-destaque-rotulo" style={{ display: "block", marginBottom: 6 }}>
        Parâmetros por avaliação
      </strong>
      <div className="c-tabela-rolagem">
        <table className="c-tabela-medidas">
          <thead>
            <tr>
              <th scope="col">Parâmetro</th>
              {cronologico.map((a, i) => (
                <th scope="col" key={a.id}>
                  <span className="c-coluna-ordinal">{i + 1}ª</span>
                  <span className="c-coluna-data">{dataBonita(a.data)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.rotulo}>
                <th scope="row">{l.rotulo}</th>
                {l.valores.map((v, i) => {
                  const d = i > 0 && v && v !== "—" && l.valores[i - 1] && l.valores[i - 1] !== "—"
                    ? deltaEntre(l.valores[i - 1]!, v)
                    : null;
                  return (
                    <td key={i}>
                      {v ?? "—"}
                      {d && <span className="c-delta-celula">{d}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function deltaEntre(anterior: string, atual: string): string | null {
  const a = parseFloat(anterior.replace(",", ".").replace(/[^\d.\-]/g, ""));
  const b = parseFloat(atual.replace(",", ".").replace(/[^\d.\-]/g, ""));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const diff = Number((b - a).toFixed(1));
  if (diff === 0) return null;
  return diff > 0 ? `↑ +${comVirgula(diff)}` : `↓ ${comVirgula(diff)}`;
}

function comVirgula(n: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function TabelaComparativa({
  titulo,
  tabela,
}: {
  titulo: string;
  tabela: ReturnType<typeof tabelaDeMedidas>;
}) {
  return (
    <div style={{ marginTop: 14 }}>
      <strong className="c-destaque-rotulo" style={{ display: "block", marginBottom: 6 }}>
        {titulo}
      </strong>
      <div className="c-tabela-rolagem">
        <table className="c-tabela-medidas">
          <thead>
            <tr>
              <th scope="col">Medida</th>
              {tabela.colunas.map((c) => (
                <th scope="col" key={c.id}>
                  <span className="c-coluna-ordinal">{c.ordinal}</span>
                  <span className="c-coluna-data">{dataBonita(c.data)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tabela.linhas.map((linha) => (
              <tr key={linha.nome}>
                <th scope="row">{linha.nome}</th>
                {linha.valores.map((v, i) => {
                  const d = i > 0 && v && linha.valores[i - 1]
                    ? deltaEntre(linha.valores[i - 1]!, v)
                    : null;
                  return (
                    <td key={i}>
                      {v ?? "—"}
                      {d && <span className="c-delta-celula">{d}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
