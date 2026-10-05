/**
 * Filtra as perguntas que a paciente vê NESTA SEMANA.
 *
 * A lista no banco é o catálogo completo da versão; a cada check-in, uma
 * parte não aparece: perguntas quinzenais, mensais e condicionais (que
 * dependem de outra resposta). Esse filtro mora no cliente, e não no banco,
 * porque depende do período e das respostas que a paciente está dando agora
 * (a condicional de I03 muda enquanto ela responde).
 *
 * Cadência: usa a semana do epoch (o número da semana desde 1970-01-01).
 * Quinzenal aparece nas semanas pares, mensal a cada quatro semanas. Assim
 * a cadência é a mesma para todas as pacientes — o que é melhor do que
 * sincronizar com a data de atribuição, que daria janelas diferentes por
 * paciente e dificultaria a comparação em grupo.
 */

import type {
  PerguntaParaResponder,
  RegraExibicao,
  CadenciaPergunta,
} from "@/central/types/questionario";

const MS_POR_SEMANA = 7 * 24 * 60 * 60 * 1000;

export function semanaDoEpoch(periodo: string): number {
  const ms = new Date(`${periodo}T00:00:00Z`).getTime();
  if (Number.isNaN(ms)) return 0;
  return Math.floor(ms / MS_POR_SEMANA);
}

export function cadenciaDeveAparecer(
  cadencia: CadenciaPergunta | undefined | null,
  periodo: string,
): boolean {
  const c = cadencia ?? "semanal";
  if (c === "semanal") return true;
  const semana = semanaDoEpoch(periodo);
  if (c === "quinzenal") return semana % 2 === 0;
  if (c === "mensal") return semana % 4 === 0;
  return true;
}

/**
 * Avalia a regra de exibição condicional: mostra a pergunta só se outra
 * pergunta (identificada por código) teve a resposta exigida. Quando a
 * pergunta-filtro ainda não foi respondida, esconde — é melhor perguntar
 * de menos do que de mais.
 */
export function regraExibicaoCumprida(
  regra: RegraExibicao | null | undefined,
  respostaPorCodigo: Map<string, string>,
): boolean {
  if (!regra) return true;
  const resposta = respostaPorCodigo.get(regra.perguntaCodigo);
  if (resposta === undefined) return false;
  switch (regra.operador) {
    case "igual":
      return resposta === regra.valor;
    case "diferente":
      return resposta !== regra.valor;
    case "inclui":
      return resposta.includes(regra.valor);
    case "nao_inclui":
      return !resposta.includes(regra.valor);
    default:
      return true;
  }
}

/**
 * Filtra as perguntas que aparecem nesta semana, levando em conta:
 * 1. Pergunta ativa (ativa !== false)
 * 2. Cadência (quinzenal, mensal)
 * 3. Regra de exibição condicional
 *
 * `valoresAtuais` são as respostas que a paciente está dando agora (pelo
 * id da pergunta). Para avaliar a regra condicional, precisamos do código
 * da pergunta-filtro — por isso o mapa perguntaId→codigo vem junto.
 */
export function perguntasDestaSemana(
  perguntas: PerguntaParaResponder[],
  periodo: string,
  valoresAtuais: Record<string, string>,
): PerguntaParaResponder[] {
  const codigoPorId = new Map<string, string>();
  for (const p of perguntas) {
    if (p.codigo) codigoPorId.set(p.id, p.codigo);
  }

  const respostaPorCodigo = new Map<string, string>();
  for (const p of perguntas) {
    const codigo = p.codigo ?? codigoPorId.get(p.id);
    if (!codigo) continue;
    const valor = valoresAtuais[p.id];
    if (valor !== undefined && valor !== "") {
      respostaPorCodigo.set(codigo, valor);
    }
  }

  return perguntas.filter((p) => {
    if (p.ativa === false) return false;
    if (!cadenciaDeveAparecer(p.cadencia, periodo)) return false;
    if (!regraExibicaoCumprida(p.regraExibicao, respostaPorCodigo)) return false;
    return true;
  });
}
