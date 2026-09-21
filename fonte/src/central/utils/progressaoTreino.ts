/**
 * Como se reconhece que a paciente evoluiu no treino.
 *
 * A REGRA CENTRAL, e é dela que o módulo inteiro depende:
 *
 *   MAIS PESO NÃO É A ÚNICA FORMA DE EVOLUIR.
 *
 * 60 kg × 6 seguido de 60 kg × 7 é progressão. O aplicativo que só olha
 * para a carga diria que nada aconteceu em quatro sessões seguidas, e a
 * paciente concluiria que não está saindo do lugar — quando está.
 *
 * O QUE ESTE ARQUIVO NÃO FAZ, e cada um é uma linha do pedido dela:
 *
 *   * não prescreve. Não diz qual carga usar, não sugere aumentar, não
 *     sugere diminuir, não monta treino. A nutricionista não é personal
 *     trainer, e o aplicativo não vira um;
 *   * não chama menos repetições de regressão, nem de piora. Um dia pior
 *     dormido é um dia pior dormido. Registrar não é julgar;
 *   * não usa "PR". O termo tem critério em treinamento, e inventar um
 *     critério aqui seria dar peso a um número que ninguém definiu. Fica
 *     "maior carga registrada" e "maior número de repetições registrado".
 *
 * Quando a paciente chega ao TOPO da faixa que a profissional programou, o
 * aplicativo só sinaliza — e manda conversar. Não propõe a próxima carga.
 */

export interface SerieRealizada {
  /** A ordem dentro da sessão: 1ª, 2ª, 3ª série. */
  numero: number;
  /** Quilos. Nulo em exercício sem carga (prancha, abdominal). */
  carga: number | null;
  repeticoes: number | null;
}

export interface SessaoDoExercicio {
  data: string;
  series: SerieRealizada[];
}

/**
 * A faixa que a profissional programou. Nula quando ela não programou.
 *
 * `series` é opcional porque só `repeticoesMax` decide o topo da faixa — e
 * exigir as três forçaria a tela a remontar um objeto só para passar aqui.
 */
export interface FaixaPlanejada {
  series?: number | null;
  repeticoesMin: number | null;
  repeticoesMax: number | null;
}

/**
 * A "melhor" série de uma sessão, para comparar sessão com sessão.
 *
 * Melhor é a de maior CARGA; empatando a carga, a de mais repetições. Não
 * é a de maior volume: 40 kg × 20 tem mais volume que 60 kg × 8, e chamar
 * a primeira de melhor faria a paciente que subiu para 60 kg parecer ter
 * regredido no mesmo dia em que subiu.
 */
export function melhorSerie(series: SerieRealizada[]): SerieRealizada | null {
  let melhor: SerieRealizada | null = null;
  for (const s of series) {
    if (s.repeticoes === null || s.repeticoes <= 0) continue;
    if (melhor === null) {
      melhor = s;
      continue;
    }
    const carga = s.carga ?? 0;
    const cargaMelhor = melhor.carga ?? 0;
    if (carga > cargaMelhor) melhor = s;
    else if (carga === cargaMelhor && s.repeticoes > (melhor.repeticoes ?? 0)) melhor = s;
  }
  return melhor;
}

export type TipoDeProgressao = "carga" | "repeticoes" | "carga_e_repeticoes" | "nenhuma";

export interface Progressao {
  tipo: TipoDeProgressao;
  /** Quantos quilos a mais. Zero quando a carga não mudou. */
  cargaAMais: number;
  /** Quantas repetições a mais. Pode ser negativo, e isso NÃO é "piora". */
  repeticoesAMais: number;
  /** A frase curta que vai para a tela. Vazia quando não há o que dizer. */
  mensagem: string;
}

function comVirgula(n: number): string {
  // "0,5" e não "0.5", e "5" e não "5,0": meio quilo tem que aparecer, quilo
  // inteiro não precisa de casa decimal.
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

/**
 * O que mudou de uma sessão para a seguinte, naquele exercício.
 *
 * A comparação é entre as melhores séries das duas sessões. Comparar série
 * 1 com série 1 pareceria mais justo, mas a ordem das séries muda — quem
 * fez a mais pesada por último num dia e por primeiro no outro apareceria
 * oscilando sem ter oscilado.
 */
export function progressaoEntre(
  anterior: SessaoDoExercicio | null | undefined,
  atual: SessaoDoExercicio | null | undefined,
): Progressao {
  const nada: Progressao = { tipo: "nenhuma", cargaAMais: 0, repeticoesAMais: 0, mensagem: "" };

  const a = anterior ? melhorSerie(anterior.series) : null;
  const b = atual ? melhorSerie(atual.series) : null;
  if (!a || !b) return nada;

  // Arredondar para duas casas antes de comparar: 60,000000000000004 kg é
  // um artefato de ponto flutuante, não meio grama a mais.
  const cargaAMais = Number(((b.carga ?? 0) - (a.carga ?? 0)).toFixed(2));
  const repeticoesAMais = (b.repeticoes ?? 0) - (a.repeticoes ?? 0);

  if (cargaAMais > 0 && repeticoesAMais > 0) {
    return {
      tipo: "carga_e_repeticoes",
      cargaAMais,
      repeticoesAMais,
      mensagem: `+${comVirgula(cargaAMais)} kg e ${repeticoesAMais} ${repeticoesAMais === 1 ? "repetição" : "repetições"} a mais.`,
    };
  }

  if (cargaAMais > 0) {
    return {
      tipo: "carga",
      cargaAMais,
      repeticoesAMais,
      // "+0,5 kg também é evolução": o aumento pequeno é o mais comum e o
      // mais fácil de a paciente achar que não conta.
      mensagem:
        cargaAMais < 1
          ? `+${comVirgula(cargaAMais)} kg também é evolução.`
          : `Você aumentou sua carga: +${comVirgula(cargaAMais)} kg.`,
    };
  }

  if (cargaAMais === 0 && repeticoesAMais > 0) {
    // "Com a mesma carga" só faz sentido quando existe carga. Na prancha e
    // no abdominal, que não têm, a frase soaria como se houvesse um peso
    // que ninguém pôs — e a paciente procuraria o número que não existe.
    const temCarga = a.carga !== null || b.carga !== null;
    const complemento = temCarga ? " com a mesma carga" : "";
    return {
      tipo: "repeticoes",
      cargaAMais,
      repeticoesAMais,
      mensagem:
        repeticoesAMais === 1
          ? `Você fez 1 repetição a mais${complemento}.`
          : `Você fez ${repeticoesAMais} repetições a mais${complemento}.`,
    };
  }

  // Menos repetições, ou carga menor, cai aqui — SEM mensagem. Não é
  // regressão, não é piora, e não é assunto do aplicativo.
  return { ...nada, cargaAMais, repeticoesAMais };
}

export interface Recordes {
  maiorCarga: number | null;
  /** As repetições feitas no dia da maior carga — o contexto dela. */
  repeticoesNaMaiorCarga: number | null;
  maiorRepeticoes: number | null;
  /** A carga usada no dia do maior número de repetições. */
  cargaNasMaioresRepeticoes: number | null;
}

/**
 * Os maiores números já registrados naquele exercício.
 *
 * "Maior carga registrada", não "PR": ver o cabeçalho. E cada um vem com o
 * outro número junto — "maior carga: 62 kg" sem dizer quantas repetições
 * foram é meio dado, e meio dado numa tela de evolução convida a comparar
 * coisas diferentes.
 */
export function recordesDe(sessoes: SessaoDoExercicio[]): Recordes {
  const vazio: Recordes = {
    maiorCarga: null,
    repeticoesNaMaiorCarga: null,
    maiorRepeticoes: null,
    cargaNasMaioresRepeticoes: null,
  };

  const todas = sessoes.flatMap((s) => s.series).filter((s) => (s.repeticoes ?? 0) > 0);
  if (todas.length === 0) return vazio;

  let porCarga: SerieRealizada | null = null;
  let porReps: SerieRealizada | null = null;
  for (const s of todas) {
    if (s.carga !== null) {
      // Empatando a carga, vence a de MAIS repetições. Com `>` estrito, a
      // primeira vez que ela fez 62 kg (× 6) ficaria eternamente sendo o
      // contexto, e as 7 repetições que ela fez depois com os mesmos 62 kg
      // nunca apareceriam — a evolução dentro da carga máxima sumia.
      const mesma = s.carga === (porCarga?.carga ?? Number.NEGATIVE_INFINITY);
      if (
        porCarga === null ||
        s.carga > (porCarga.carga ?? 0) ||
        (mesma && (s.repeticoes ?? 0) > (porCarga.repeticoes ?? 0))
      ) {
        porCarga = s;
      }
    }
    // O mesmo raciocínio do outro lado: empatando as repetições, vence a de
    // maior carga. 10 repetições com 62 kg vale mais que 10 com 60 kg.
    const mesmasReps = (s.repeticoes ?? 0) === (porReps?.repeticoes ?? Number.NEGATIVE_INFINITY);
    if (
      porReps === null ||
      (s.repeticoes ?? 0) > (porReps.repeticoes ?? 0) ||
      (mesmasReps && (s.carga ?? 0) > (porReps.carga ?? 0))
    ) {
      porReps = s;
    }
  }

  return {
    maiorCarga: porCarga?.carga ?? null,
    repeticoesNaMaiorCarga: porCarga?.repeticoes ?? null,
    maiorRepeticoes: porReps?.repeticoes ?? null,
    cargaNasMaioresRepeticoes: porReps?.carga ?? null,
  };
}

/**
 * Chegou ao topo da faixa que a profissional programou?
 *
 * A mensagem SINALIZA e manda conversar. Não propõe carga nova: quem
 * decide a próxima progressão é quem programou o treino, não o aplicativo.
 * Sem faixa programada, não há topo — e inventar um seria prescrever.
 */
export function chegouAoTopoDaFaixa(
  sessao: SessaoDoExercicio | null | undefined,
  faixa: FaixaPlanejada | null | undefined,
): boolean {
  const max = faixa?.repeticoesMax;
  if (max === null || max === undefined || max <= 0) return false;
  const melhor = sessao ? melhorSerie(sessao.series) : null;
  return (melhor?.repeticoes ?? 0) >= max;
}

export const MENSAGEM_TOPO_DA_FAIXA =
  "Você chegou ao topo da faixa! Converse com seu profissional sobre a próxima progressão.";

/**
 * A linha do tempo de um exercício, sessão a sessão, já com o que mudou.
 *
 * Da mais antiga para a mais nova: é assim que uma evolução se lê, e é a
 * ordem em que a comparação faz sentido.
 */
export interface LinhaDaEvolucao {
  data: string;
  carga: number | null;
  repeticoes: number | null;
  progressao: Progressao;
  topoDaFaixa: boolean;
}

export function evolucaoDoExercicio(
  sessoes: SessaoDoExercicio[],
  faixa?: FaixaPlanejada | null,
): LinhaDaEvolucao[] {
  const ordenadas = [...sessoes].sort((a, b) => a.data.localeCompare(b.data));
  return ordenadas.map((sessao, i) => {
    const melhor = melhorSerie(sessao.series);
    return {
      data: sessao.data,
      carga: melhor?.carga ?? null,
      repeticoes: melhor?.repeticoes ?? null,
      progressao: progressaoEntre(ordenadas[i - 1] ?? null, sessao),
      topoDaFaixa: chegouAoTopoDaFaixa(sessao, faixa),
    };
  });
}

/** Volume = carga × repetições, somado na sessão. Métrica COMPLEMENTAR. */
export function volumeDaSessao(series: SerieRealizada[]): number {
  return series.reduce((total, s) => total + (s.carga ?? 0) * (s.repeticoes ?? 0), 0);
}
