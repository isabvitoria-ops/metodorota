/**
 * A pontuação de um check-in, e a comparação com a semana anterior.
 *
 * Este é o item 4 da lista que ela aprovou, e que ficou esperando o módulo
 * de questionários existir. A conta mora aqui, em TypeScript, e não no
 * banco: o banco devolve os valores crus e a régua (peso e inversão), e a
 * conta é feita num lugar só, testada.
 *
 * AS REGRAS QUE NÃO SE NEGOCIAM
 *
 * 1. PERGUNTA NÃO RESPONDIDA NÃO VALE ZERO. Ela sai da conta inteira —
 *    de cima e de baixo. Contar como zero transformaria "ela pulou a
 *    pergunta" em "ela está péssima", e a semana em que a paciente teve
 *    pressa apareceria como piora clínica.
 *
 * 2. ESCALA INVERTIDA É INVERTIDA NA CONTA. Em "quanta dor você sentiu",
 *    10 é a pior semana possível. Somar isso junto com bem-estar faria a
 *    pontuação SUBIR justamente na semana pior — o erro mais perigoso que
 *    este arquivo poderia ter, porque o número continuaria parecendo certo.
 *
 * 3. PESO ZERO NÃO ENTRA. "Conte em uma frase" é importante e não é nota.
 *
 * 4. SEM NENHUMA RESPOSTA PONTUÁVEL, A PONTUAÇÃO É `null`, E NÃO 0. Um
 *    check-in só de texto não vale zero por cento; ele não tem nota.
 */

export interface PerguntaPontuavel {
  id: string;
  tipo: "escala" | "sim_nao" | "numero" | "texto" | "escolha";
  peso: number;
  invertida: boolean;
}

export interface RespostaCrua {
  perguntaId: string;
  numero: number | null;
  texto: string | null;
}

export interface EnvioCru {
  id: string;
  periodo: string;
  respostas: RespostaCrua[];
}

/** O máximo que uma pergunta vale, na escala interna de 0 a 10. */
const TETO = 10;

/**
 * Normaliza uma resposta para 0–10, já com a inversão aplicada.
 * Devolve `null` quando a pergunta não entra na conta.
 */
export function valorNaEscala(
  pergunta: PerguntaPontuavel,
  resposta: RespostaCrua | undefined,
): number | null {
  if (pergunta.peso <= 0) return null;
  if (pergunta.tipo !== "escala" && pergunta.tipo !== "sim_nao") return null;
  if (!resposta || resposta.numero === null || Number.isNaN(resposta.numero)) return null;

  const bruto =
    pergunta.tipo === "sim_nao"
      ? (resposta.numero > 0 ? TETO : 0)
      : Math.min(Math.max(resposta.numero, 0), TETO);

  return pergunta.invertida ? TETO - bruto : bruto;
}

/**
 * A nota do envio, de 0 a 100 — ou `null` quando não há o que pontuar.
 */
export function pontuacaoDoEnvio(
  perguntas: PerguntaPontuavel[],
  envio: EnvioCru,
): number | null {
  const porPergunta = new Map(envio.respostas.map((r) => [r.perguntaId, r]));
  let soma = 0;
  let maximo = 0;

  for (const p of perguntas) {
    const valor = valorNaEscala(p, porPergunta.get(p.id));
    if (valor === null) continue;
    soma += p.peso * valor;
    maximo += p.peso * TETO;
  }

  if (maximo === 0) return null;
  return Math.round((soma / maximo) * 100);
}

export interface PontoDaSerie {
  periodo: string;
  pontuacao: number | null;
  respondidas: number;
}

/** A série, da mais antiga para a mais nova — que é como gráfico se lê. */
export function serieDePontuacao(
  perguntas: PerguntaPontuavel[],
  envios: EnvioCru[],
): PontoDaSerie[] {
  return [...envios]
    .sort((a, b) => a.periodo.localeCompare(b.periodo))
    .map((e) => ({
      periodo: e.periodo,
      pontuacao: pontuacaoDoEnvio(perguntas, e),
      respondidas: e.respostas.filter((r) => r.numero !== null || (r.texto ?? "") !== "").length,
    }));
}

export interface Comparacao {
  atual: number | null;
  anterior: number | null;
  /** Diferença em pontos. `null` quando falta uma das duas pontas. */
  variacao: number | null;
}

/**
 * A semana de agora contra a de antes.
 *
 * Com uma ponta só, `variacao` é `null` e NÃO zero: zero diria "não mudou
 * nada", que é uma afirmação — e não há com o que comparar.
 */
export function compararComAnterior(serie: PontoDaSerie[]): Comparacao {
  const comNota = serie.filter((p) => p.pontuacao !== null);
  const atual = comNota.at(-1)?.pontuacao ?? null;
  const anterior = comNota.at(-2)?.pontuacao ?? null;
  return {
    atual,
    anterior,
    variacao: atual !== null && anterior !== null ? atual - anterior : null,
  };
}

/**
 * A frase da variação.
 *
 * NÃO DIZ SE É BOM OU RUIM. "+8 pontos" e não "melhorou": a pontuação é
 * um resumo de respostas, não um veredito clínico, e quem lê é quem sabe
 * se aquilo era o esperado para aquela paciente naquela semana.
 */
export function textoDaVariacao(c: Comparacao): string {
  if (c.atual === null) return "sem pontuação nesta semana";
  if (c.variacao === null) return `${c.atual} pontos — primeira semana pontuada`;
  if (c.variacao === 0) return `${c.atual} pontos — igual à semana anterior`;
  const sinal = c.variacao > 0 ? "+" : "−";
  return `${c.atual} pontos — ${sinal}${Math.abs(c.variacao)} em relação à semana anterior`;
}

/**
 * Quantas semanas seguidas ela respondeu, contando de trás para frente.
 *
 * Semana sem envio quebra a sequência. É o número que responde "ela está
 * acompanhando ou parou?" sem precisar ler a série inteira.
 */
export function semanasSeguidas(serie: PontoDaSerie[], semanaAtual: string): number {
  const periodos = new Set(serie.map((p) => p.periodo));
  let contagem = 0;
  const dia = new Date(`${semanaAtual}T00:00:00Z`);
  if (Number.isNaN(dia.getTime())) return 0;

  // Começa na semana atual; se ela ainda não respondeu esta, a conta parte
  // da anterior — a semana em curso ainda está aberta, e não respondê-la
  // hoje não é falha.
  if (!periodos.has(semanaAtual)) dia.setUTCDate(dia.getUTCDate() - 7);

  for (;;) {
    const chave = dia.toISOString().slice(0, 10);
    if (!periodos.has(chave)) break;
    contagem++;
    dia.setUTCDate(dia.getUTCDate() - 7);
  }
  return contagem;
}
