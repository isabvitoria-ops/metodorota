import type { Meta, RegistroDeMeta } from "@/central/types/meta";
import { domingoDaSemana, segundaDaSemana } from "@/central/utils/metasSemanais";

/**
 * O progresso de uma meta do acompanhamento.
 *
 * O PROGRESSO NÃO É GUARDADO. É contado dos registros, toda vez, pela mesma
 * razão da meta semanal de treino: um contador gravado fica errado no dia em
 * que um registro é apagado, e fica errado em silêncio.
 *
 * A CONTA MORA AQUI, e não no banco, de propósito. A função `metas_de`
 * devolve os registros crus; se ela também somasse, existiriam duas contas
 * para o mesmo número e um dia elas discordariam — e a que discordasse
 * calada seria a que a paciente vê.
 *
 * E A TELA NÃO JULGA. Nada aqui devolve "atrasada", "ruim" ou "você
 * falhou". Devolve quanto foi feito e quanto era o alvo; quem interpreta é
 * a profissional, na consulta.
 */

export interface Periodo {
  inicio: string;
  fim: string;
}

export interface Progresso {
  periodo: Periodo;
  /** Quanto ela marcou no período, na unidade da meta. */
  feito: number;
  /** O alvo do período. Nulo em meta de "fez ou não fez". */
  alvo: number | null;
  /**
   * De 0 a 100, TETO EM 100.
   *
   * Passar de 100 viraria uma barra maior que a caixa e um "137%" que não
   * quer dizer nada melhor do que "cumpriu". Quem quiser o número cru soma
   * `feito`, que não tem teto.
   */
  percentual: number;
  cumprida: boolean;
  /** Quantas vezes ela marcou no período. Serve para meta sem alvo. */
  marcacoes: number;
}

/** O dia, ou a semana, a que aquela data pertence naquela meta. */
export function periodoDe(frequencia: Meta["frequencia"], dataIso: string): Periodo {
  const dia = dataIso.slice(0, 10);
  if (frequencia === "semanal") {
    return { inicio: segundaDaSemana(dia), fim: domingoDaSemana(dia) };
  }
  return { inicio: dia, fim: dia };
}

function dentro(data: string, periodo: Periodo): boolean {
  const d = data.slice(0, 10);
  return d >= periodo.inicio && d <= periodo.fim;
}

/**
 * Quanto uma marcação vale.
 *
 * Quantidade NULA numa meta COM alvo vale 1, e não 0: "marquei que fiz" é
 * uma ocorrência. Valendo zero, a paciente que só toca no botão veria a
 * barra parada e concluiria que o aplicativo não registrou.
 */
function valorDe(r: RegistroDeMeta): number {
  return r.quantidade === null ? 1 : r.quantidade;
}

export function progressoNoPeriodo(meta: Meta, dataIso: string): Progresso {
  const periodo = periodoDe(meta.frequencia, dataIso);
  const doPeriodo = meta.registros.filter((r) => dentro(r.data, periodo));
  const feito = doPeriodo.reduce((s, r) => s + valorDe(r), 0);

  if (meta.alvo === null) {
    // "Fez ou não fez": marcou uma vez, cumpriu.
    const cumprida = doPeriodo.length > 0;
    return { periodo, feito, alvo: null, percentual: cumprida ? 100 : 0, cumprida,
             marcacoes: doPeriodo.length };
  }

  const bruto = (feito / meta.alvo) * 100;
  return {
    periodo,
    feito,
    alvo: meta.alvo,
    percentual: Math.max(0, Math.min(100, Math.round(bruto))),
    cumprida: feito >= meta.alvo,
    marcacoes: doPeriodo.length,
  };
}

/** O passo de um período para o anterior. */
function periodoAnterior(frequencia: Meta["frequencia"], periodo: Periodo): Periodo {
  const d = new Date(`${periodo.inicio}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (frequencia === "semanal" ? 7 : 1));
  return periodoDe(frequencia, d.toISOString().slice(0, 10));
}

/**
 * Os últimos N períodos, do mais recente para o mais antigo.
 *
 * O período SEM marcação nenhuma entra na lista, zerado, em vez de sumir: o
 * buraco de três dias é exatamente o que a profissional quer enxergar, e uma
 * lista que só mostra os dias bons conta outra história.
 *
 * Nunca passa do início da meta: períodos antes de a meta existir não são
 * períodos em que ela deixou de fazer nada.
 */
export function historico(meta: Meta, hojeIso: string, quantos = 7): Progresso[] {
  const saida: Progresso[] = [];
  let periodo = periodoDe(meta.frequencia, hojeIso);
  const limite = periodoDe(meta.frequencia, meta.inicio).inicio;

  for (let i = 0; i < quantos && periodo.inicio >= limite; i += 1) {
    saida.push(progressoNoPeriodo(meta, periodo.inicio));
    periodo = periodoAnterior(meta.frequencia, periodo);
  }
  return saida;
}

/**
 * Há quantos períodos seguidos ela cumpre a meta, contando de trás para
 * frente a partir de hoje.
 *
 * O PERÍODO CORRENTE NÃO QUEBRA A SEQUÊNCIA quando ainda está aberto. Hoje
 * às nove da manhã ninguém bebeu dois litros ainda; zerar a sequência ali
 * diria à paciente que ela perdeu uma coisa que ainda dá tempo de fazer.
 * Ele conta quando cumprido, e é ignorado quando não.
 */
export function sequencia(meta: Meta, hojeIso: string): number {
  let periodo = periodoDe(meta.frequencia, hojeIso);
  let total = 0;

  if (progressoNoPeriodo(meta, periodo.inicio).cumprida) total += 1;
  periodo = periodoAnterior(meta.frequencia, periodo);

  const limite = periodoDe(meta.frequencia, meta.inicio).inicio;
  while (periodo.inicio >= limite && progressoNoPeriodo(meta, periodo.inicio).cumprida) {
    total += 1;
    periodo = periodoAnterior(meta.frequencia, periodo);
  }
  return total;
}

/**
 * A meta que a tela inicial da paciente destaca.
 *
 * A ATIVA COM MENOS PROGRESSO no período corrente — é a que ainda pede
 * alguma coisa dela hoje. Destacar a mais cumprida seria decorar a tela com
 * o que já está resolvido.
 *
 * Empatadas, vence a que começou primeiro: a mais antiga é a que está há
 * mais tempo esperando.
 */
export function metaEmDestaque(metas: Meta[], hojeIso: string): Meta | null {
  const ativas = metas.filter((m) => m.status === "ativa");
  if (ativas.length === 0) return null;

  return ativas.reduce((melhor, m) => {
    const a = progressoNoPeriodo(m, hojeIso).percentual;
    const b = progressoNoPeriodo(melhor, hojeIso).percentual;
    if (a !== b) return a < b ? m : melhor;
    return m.inicio < melhor.inicio ? m : melhor;
  });
}

/** "2 de 3 dias", "1,5 de 2 litros", "feito" — o que vai embaixo da barra. */
export function resumoDoProgresso(p: Progresso, unidade: string | null): string {
  const n = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  if (p.alvo === null) return p.cumprida ? "Feito" : "Ainda não";
  return `${n(p.feito)} de ${n(p.alvo)}${unidade ? ` ${unidade}` : ""}`;
}
