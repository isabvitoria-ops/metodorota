import type { DadosAvaliacao } from "@/central/types/protocolo";
import { CIRCUNFERENCIAS, DOBRAS, numeroDaMedida } from "@/central/utils/medidasCorporais";

/**
 * A evolução entre avaliações.
 *
 * "Ao longo do tempo, com várias avaliações, quero que vá gerando
 * evoluções." O molde é o PDF que ela usa: uma coluna por avaliação, com
 * travessão onde não se mediu, e o peso desenhado no tempo.
 *
 * DUAS REGRAS QUE VALEM PARA TUDO AQUI
 *
 *   * nada é recalculado. Percentual, massa gorda e IMC são os que ela
 *     lançou, vindos da ferramenta de cálculo. A única conta que este
 *     arquivo faz é SUBTRAÇÃO entre dois números que ela já entregou —
 *     e mesmo essa só entre valores que existem;
 *   * ausência não vira zero. Uma dobra que ela não pegou é travessão na
 *     coluna daquela consulta, não zero milímetro. Tratada como zero, a
 *     variação apareceria como uma queda enorme que nunca aconteceu.
 */

export interface AvaliacaoNoTempo {
  id: string;
  data: string;
  dados: DadosAvaliacao;
}

/** Uma chave numérica que dá para acompanhar no tempo. */
export type ChaveDeSerie = "peso" | "imc" | "percentualGordura" | "massaGorda" | "massaMagra";

export interface PontoDaSerie {
  data: string;
  valor: number;
}

/**
 * Da mais antiga para a mais nova — é assim que uma linha do tempo se lê.
 *
 * As avaliações chegam do banco da mais nova para a mais antiga, porque a
 * tela principal quer a última primeiro. Desenhar a linha nessa ordem a
 * inverteria: uma perda de peso subiria no gráfico.
 */
export function emOrdemDeData(avaliacoes: AvaliacaoNoTempo[]): AvaliacaoNoTempo[] {
  return [...avaliacoes].sort((a, b) => a.data.localeCompare(b.data));
}

/** Os valores de um número ao longo do tempo, pulando as consultas sem ele. */
export function serieDe(avaliacoes: AvaliacaoNoTempo[], chave: ChaveDeSerie): PontoDaSerie[] {
  const saida: PontoDaSerie[] = [];
  for (const a of emOrdemDeData(avaliacoes)) {
    const valor = a.dados[chave];
    if (typeof valor === "number" && Number.isFinite(valor)) {
      saida.push({ data: a.data, valor });
    }
  }
  return saida;
}

export interface Variacao {
  /** Positivo subiu, negativo desceu. Zero é zero, e é uma informação. */
  delta: number;
  /** "2,4" — sempre sem sinal; o sinal é o `sentido`. */
  absoluto: string;
  sentido: "subiu" | "desceu" | "igual";
  /** A data do valor com que se comparou. */
  desde: string;
}

function comVirgula(n: number, casas: number): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

/**
 * Quanto mudou da penúltima medida para a última.
 *
 * Nulo quando não há duas medidas daquele número: com uma só não existe
 * variação, e inventar "0" diria que não mudou nada — que é afirmação
 * diferente de "ainda não dá para saber".
 */
export function variacaoRecente(serie: PontoDaSerie[], casas = 1): Variacao | null {
  if (serie.length < 2) return null;
  const ultimo = serie[serie.length - 1];
  const anterior = serie[serie.length - 2];
  if (!ultimo || !anterior) return null;
  const delta = ultimo.valor - anterior.valor;
  // Arredondar ANTES de decidir o sentido: 0,04 kg de diferença vira "0,0"
  // na tela, e uma seta dizendo que subiu ao lado de um "0,0" é ruído.
  const arredondado = Number(delta.toFixed(casas));
  return {
    delta: arredondado,
    absoluto: comVirgula(Math.abs(arredondado), casas),
    sentido: arredondado > 0 ? "subiu" : arredondado < 0 ? "desceu" : "igual",
    desde: anterior.data,
  };
}

/** A mesma conta, mas contra a primeira avaliação: o ponto de partida. */
export function variacaoTotal(serie: PontoDaSerie[], casas = 1): Variacao | null {
  if (serie.length < 2) return null;
  const ultimo = serie[serie.length - 1];
  const primeiro = serie[0];
  if (!ultimo || !primeiro) return null;
  const arredondado = Number((ultimo.valor - primeiro.valor).toFixed(casas));
  return {
    delta: arredondado,
    absoluto: comVirgula(Math.abs(arredondado), casas),
    sentido: arredondado > 0 ? "subiu" : arredondado < 0 ? "desceu" : "igual",
    desde: primeiro.data,
  };
}

export interface ColunaDeAvaliacao {
  id: string;
  data: string;
  /** "1ª", "2ª" — a ordem dela na história inteira, não nesta tabela. */
  ordinal: string;
}

export interface LinhaDeMedida {
  nome: string;
  /** Uma posição por coluna. `null` é "não foi medido nessa consulta". */
  valores: (string | null)[];
}

export interface TabelaDeMedidas {
  colunas: ColunaDeAvaliacao[];
  linhas: LinhaDeMedida[];
}

/**
 * A tabela comparativa de dobras ou de circunferências.
 *
 * A ORDEM DAS LINHAS é a da lista oficial (`DOBRAS`, `CIRCUNFERENCIAS`), e
 * não a ordem em que apareceram nas avaliações. Sem isso, a mesma paciente
 * veria "Tríceps" acima de "Bíceps" numa consulta e abaixo na seguinte, só
 * porque a nutricionista digitou em ordem diferente — e comparar duas
 * colunas linha a linha deixaria de funcionar.
 *
 * Uma medida que não está na lista oficial (uma que ela criou) não some:
 * entra no fim, na ordem em que apareceu.
 *
 * Linha sem nenhum valor não entra. Foi o pedido: "os que eu não preencher
 * nem precisa aparecer pro paciente".
 */
export function tabelaDeMedidas(
  avaliacoes: AvaliacaoNoTempo[],
  tipo: "dobras" | "circunferencias",
  quantasColunas = 3,
): TabelaDeMedidas {
  const todas = emOrdemDeData(avaliacoes);
  const oficiais = (tipo === "dobras" ? DOBRAS : CIRCUNFERENCIAS).map((c) => c.nome);

  const mostradas = todas.slice(Math.max(0, todas.length - quantasColunas));
  const colunas: ColunaDeAvaliacao[] = mostradas.map((a) => ({
    id: a.id,
    // O ordinal é o lugar dela na história toda: mostrando as três últimas
    // de cinco, a primeira coluna é a "3ª", não a "1ª".
    ordinal: `${todas.indexOf(a) + 1}ª`,
    data: a.data,
  }));

  const porNome = new Map<string, (string | null)[]>();
  const ordemExtra: string[] = [];

  const vazio = () => colunas.map(() => null);

  for (const nome of oficiais) porNome.set(nome, vazio());

  mostradas.forEach((a, coluna) => {
    for (const m of a.dados[tipo] ?? []) {
      const nome = String(m.nome ?? "").trim();
      if (!nome) continue;
      if (!porNome.has(nome)) {
        porNome.set(nome, vazio());
        ordemExtra.push(nome);
      }
      const linha = porNome.get(nome);
      // Valor em branco é o mesmo que não medido: fica travessão.
      if (linha && numeroDaMedida(m.valor) !== "") linha[coluna] = m.valor;
    }
  });

  const linhas: LinhaDeMedida[] = [];
  for (const nome of [...oficiais, ...ordemExtra]) {
    const valores = porNome.get(nome);
    if (!valores || valores.every((v) => v === null)) continue;
    linhas.push({ nome, valores });
  }

  return { colunas, linhas };
}

/**
 * Os pontos de uma linha desenhada, já em coordenadas de SVG.
 *
 * O eixo do tempo é a DATA, não a posição na lista: duas avaliações com uma
 * semana entre elas e uma terceira seis meses depois têm que sair com
 * espaços diferentes, senão o desenho conta uma história de ritmo que não
 * aconteceu.
 *
 * O eixo vertical ganha uma folga de 10% em cima e embaixo, e uma série
 * inteira no mesmo valor vira uma linha reta no meio — sem a folga, uma
 * variação de 200 g ocuparia a altura toda e pareceria despencar.
 */
export function pontosDaLinha(
  serie: PontoDaSerie[],
  largura: number,
  altura: number,
): { x: number; y: number; ponto: PontoDaSerie }[] {
  if (serie.length === 0) return [];
  if (serie.length === 1) {
    const unico = serie[0];
    return unico ? [{ x: largura / 2, y: altura / 2, ponto: unico }] : [];
  }

  const dias = serie.map((p) => Date.parse(`${p.data.slice(0, 10)}T12:00:00Z`));
  const t0 = Math.min(...dias);
  const t1 = Math.max(...dias);
  const vao = t1 - t0;

  const valores = serie.map((p) => p.valor);
  const menor = Math.min(...valores);
  const maior = Math.max(...valores);
  const folga = (maior - menor) * 0.1 || 1;
  const baixo = menor - folga;
  const alto = maior + folga;

  return serie.map((ponto, i) => {
    const dia = dias[i] ?? t0;
    const x = vao === 0 ? (largura * i) / (serie.length - 1) : (largura * (dia - t0)) / vao;
    // O SVG cresce para baixo; o valor maior tem que ficar em cima.
    const y = altura - (altura * (ponto.valor - baixo)) / (alto - baixo);
    return { x, y, ponto };
  });
}
