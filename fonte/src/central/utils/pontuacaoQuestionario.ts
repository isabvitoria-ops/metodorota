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
  tipo: "escala" | "sim_nao" | "numero" | "texto" | "escolha"
    | "emoji" | "estrelas" | "multipla_escolha" | "metrica";
  peso: number;
  invertida: boolean;
  /** Só para 'escolha': os rótulos e os pontos (0–10) de cada opção. */
  opcoes?: string[];
  pontosOpcoes?: number[];
  /** A que eixo a pergunta pertence, para a quebra da nota. */
  eixoId?: string | null;
  eixoNome?: string | null;
  /** Código estável (B01, I05…) para comparação entre versões. */
  codigo?: string | null;
  /** Faixas de nota para perguntas numéricas. */
  notas_por_faixa?: { faixas: { de: number | null; ate: number | null; nota: number }[] } | null;
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
  /**
   * A régua fotografada quando a paciente respondeu (0054). Quando existe,
   * é ela que pontua o envio — mudar o peso de uma pergunta hoje não mexe
   * na nota das semanas já respondidas. Ausente nos envios antigos: aí a
   * régua atual vale, como antes.
   */
  reguaSnapshot?: PerguntaPontuavel[] | null;
}

/** O máximo que uma pergunta vale, na escala interna de 0 a 10. */
const TETO = 10;

/**
 * A régua que pontua um envio: a foto, quando o envio a tem; a atual, quando
 * não (envio anterior à 0054). É por aqui que o congelamento acontece.
 */
export function reguaDoEnvio(
  perguntasAtuais: PerguntaPontuavel[],
  envio: EnvioCru,
): PerguntaPontuavel[] {
  return envio.reguaSnapshot && envio.reguaSnapshot.length > 0
    ? envio.reguaSnapshot
    : perguntasAtuais;
}

/**
 * Normaliza uma resposta para 0–10, já com a inversão aplicada.
 * Devolve `null` quando a pergunta não entra na conta.
 */
export function valorNaEscala(
  pergunta: PerguntaPontuavel,
  resposta: RespostaCrua | undefined,
): number | null {
  if (pergunta.peso <= 0) return null;

  // Múltipla escolha: a resposta é o rótulo escolhido, e cada rótulo tem um
  // valor de 0 a 10 que a nutricionista definiu. Sem pontos, não pontua.
  if (pergunta.tipo === "escolha") {
    const opcoes = pergunta.opcoes ?? [];
    const pontos = pergunta.pontosOpcoes ?? [];
    if (opcoes.length === 0 || pontos.length === 0) return null;
    const escolhido = resposta?.texto ?? null;
    if (escolhido === null || escolhido === "") return null;
    const i = opcoes.indexOf(escolhido);
    if (i < 0 || i >= pontos.length) return null;
    const p = pontos[i];
    if (p === null || p === undefined || Number.isNaN(p)) return null;
    return Math.min(Math.max(p, 0), TETO);
  }

  // Emoji de 5 níveis: pontos definidos em pontosOpcoes (como escolha).
  if (pergunta.tipo === "emoji") {
    const opcoes = pergunta.opcoes ?? [];
    const pontos = pergunta.pontosOpcoes ?? [];
    if (opcoes.length === 0 || pontos.length === 0) return null;
    const escolhido = resposta?.texto ?? null;
    if (escolhido === null || escolhido === "") return null;
    const i = opcoes.indexOf(escolhido);
    if (i < 0 || i >= pontos.length) return null;
    const p = pontos[i];
    if (p === null || p === undefined || Number.isNaN(p)) return null;
    return Math.min(Math.max(p, 0), TETO);
  }

  // Estrelas (1–5): normaliza para 0–10.
  if (pergunta.tipo === "estrelas") {
    if (!resposta || resposta.numero === null || Number.isNaN(resposta.numero)) return null;
    return Math.min(Math.max(((resposta.numero - 1) / 4) * TETO, 0), TETO);
  }

  // Métrica e texto nunca pontuam.
  if (pergunta.tipo === "metrica" || pergunta.tipo === "texto") return null;

  // Múltipla escolha: pontua via pontosOpcoes[0] por enquanto;
  // a lógica completa (gravidade por item) virá na Etapa 4.
  if (pergunta.tipo === "multipla_escolha") {
    const pontos = pergunta.pontosOpcoes ?? [];
    if (pontos.length === 0) return null;
    const escolhido = resposta?.texto ?? null;
    if (escolhido === null || escolhido === "") return null;
    const opcoes = pergunta.opcoes ?? [];
    const i = opcoes.indexOf(escolhido);
    if (i >= 0 && i < pontos.length) {
      const p = pontos[i];
      if (p !== null && p !== undefined && !Number.isNaN(p)) {
        return Math.min(Math.max(p, 0), TETO);
      }
    }
    return null;
  }

  if (pergunta.tipo !== "escala" && pergunta.tipo !== "sim_nao" && pergunta.tipo !== "numero")
    return null;
  if (!resposta || resposta.numero === null || Number.isNaN(resposta.numero)) return null;

  const bruto =
    pergunta.tipo === "sim_nao"
      ? (resposta.numero > 0 ? TETO : 0)
      : Math.min(Math.max(resposta.numero, 0), TETO);

  return pergunta.invertida ? TETO - bruto : bruto;
}

/**
 * A nota do envio, de 0 a 100 — ou `null` quando não há o que pontuar.
 *
 * Usa a régua fotografada do envio quando ela existe (congelamento); senão,
 * a régua atual passada em `perguntas`.
 */
export function pontuacaoDoEnvio(
  perguntas: PerguntaPontuavel[],
  envio: EnvioCru,
): number | null {
  const regua = reguaDoEnvio(perguntas, envio);
  const porPergunta = new Map(envio.respostas.map((r) => [r.perguntaId, r]));
  let soma = 0;
  let maximo = 0;

  for (const p of regua) {
    const valor = valorNaEscala(p, porPergunta.get(p.id));
    if (valor === null) continue;
    soma += p.peso * valor;
    maximo += p.peso * TETO;
  }

  if (maximo === 0) return null;
  return Math.round((soma / maximo) * 100);
}

export interface NotaDeEixo {
  eixoId: string | null;
  eixoNome: string;
  nota: number | null;
  /** Quantas perguntas pontuáveis daquele eixo entraram na conta. */
  perguntas: number;
}

/**
 * A nota quebrada por eixo, de 0 a 100 em cada. Perguntas sem eixo caem num
 * grupo "Sem eixo". Um eixo sem nenhuma resposta pontuável fica com `null`,
 * e não com zero — não pontuar não é pontuar mal.
 */
export function pontuacaoPorEixo(
  perguntas: PerguntaPontuavel[],
  envio: EnvioCru,
): NotaDeEixo[] {
  const regua = reguaDoEnvio(perguntas, envio);
  const porPergunta = new Map(envio.respostas.map((r) => [r.perguntaId, r]));

  const grupos = new Map<string, { nome: string; soma: number; maximo: number; n: number }>();
  for (const p of regua) {
    const valor = valorNaEscala(p, porPergunta.get(p.id));
    if (valor === null) continue;
    const chave = p.eixoId ?? "__sem_eixo__";
    const nome = p.eixoNome ?? (p.eixoId ? "Eixo" : "Sem eixo");
    const g = grupos.get(chave) ?? { nome, soma: 0, maximo: 0, n: 0 };
    g.soma += p.peso * valor;
    g.maximo += p.peso * TETO;
    g.n += 1;
    grupos.set(chave, g);
  }

  return [...grupos.entries()].map(([chave, g]) => ({
    eixoId: chave === "__sem_eixo__" ? null : chave,
    eixoNome: g.nome,
    nota: g.maximo === 0 ? null : Math.round((g.soma / g.maximo) * 100),
    perguntas: g.n,
  }));
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
