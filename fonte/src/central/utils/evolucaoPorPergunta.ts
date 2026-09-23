/**
 * A evolução de UMA pergunta do check-in ao longo das semanas.
 *
 * É o gráfico da referência que ela mandou: uma linha por pergunta, com as
 * carinhas no eixo vertical. A tabela do prontuário mostra todas as
 * perguntas de uma semana; este mostra uma pergunta em todas as semanas —
 * "a energia dela está subindo?" se responde olhando para uma linha só.
 *
 * O VALOR É O MESMO DA CARINHA: `valorNaEscala()`, com a inversão aplicada.
 * Em "quanta dor", para cima quer dizer MENOS dor. Assim a linha sobe quando
 * a semana foi melhor, em toda pergunta, e o gráfico nunca discorda da
 * tabela logo acima dele.
 *
 * SEMANA SEM RESPOSTA É BURACO, e não zero. A linha se interrompe ali: ligar
 * a semana anterior à seguinte inventaria um caminho que ninguém respondeu,
 * e cair a zero diria que a semana foi péssima quando ela só não respondeu.
 */
import { valorNaEscala, type PerguntaPontuavel, type EnvioCru } from "./pontuacaoQuestionario";

export interface PontoDaPergunta {
  periodo: string;
  /** 0 a 10, inversão aplicada. `null` = não respondeu nessa semana. */
  valor: number | null;
}

/** Só estas viram gráfico: são as que têm carinha. */
export function temGrafico(p: { tipo: PerguntaPontuavel["tipo"] }): boolean {
  return p.tipo === "escala" || p.tipo === "sim_nao";
}

/** Da mais antiga para a mais nova — que é como gráfico se lê. */
export function serieDaPergunta(
  pergunta: PerguntaPontuavel,
  envios: EnvioCru[],
): PontoDaPergunta[] {
  // Peso zero tira a pergunta da PONTUAÇÃO, não do gráfico: "como está seu
  // intestino" pode não valer nota e ainda assim ser o que ela quer ver.
  const regua = { ...pergunta, peso: 1 };
  return [...envios]
    .sort((a, b) => a.periodo.localeCompare(b.periodo))
    .map((e) => ({
      periodo: e.periodo,
      valor: valorNaEscala(regua, e.respostas.find((r) => r.perguntaId === pergunta.id)),
    }));
}

/**
 * Os trechos contínuos da linha. Cada trecho é uma lista de índices da
 * série; um buraco (semana sem resposta) começa um trecho novo.
 */
export function trechosDaLinha(serie: PontoDaPergunta[]): number[][] {
  const trechos: number[][] = [];
  let atual: number[] = [];
  serie.forEach((p, i) => {
    if (p.valor === null) {
      if (atual.length > 0) trechos.push(atual);
      atual = [];
    } else {
      atual.push(i);
    }
  });
  if (atual.length > 0) trechos.push(atual);
  return trechos;
}

export interface ResumoDaPergunta {
  respondidas: number;
  total: number;
  primeiro: PontoDaPergunta | null;
  ultimo: PontoDaPergunta | null;
}

/** O que vai escrito embaixo do gráfico. Sem veredito: nada de "melhorou". */
export function resumoDaPergunta(serie: PontoDaPergunta[]): ResumoDaPergunta {
  const comValor = serie.filter((p) => p.valor !== null);
  return {
    respondidas: comValor.length,
    total: serie.length,
    primeiro: comValor[0] ?? null,
    ultimo: comValor.at(-1) ?? null,
  };
}
