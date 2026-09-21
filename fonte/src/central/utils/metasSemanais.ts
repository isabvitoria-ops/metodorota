import type { SessaoDeTreino } from "@/central/types/treino";
import type { CardioSessao, MetaSemanal } from "@/central/types/treino";

/**
 * As metas da semana, e quanto falta.
 *
 * QUEM CRIA A META É A PROFISSIONAL. O aplicativo não inventa meta, não
 * ajusta meta e não sugere meta — "4 treinos por semana" é decisão clínica
 * dela, tomada olhando para a paciente.
 *
 * O PROGRESSO NÃO É GUARDADO NO BANCO, é contado na hora.
 *
 * Guardado, ele envelheceria: a paciente apaga uma sessão registrada por
 * engano e o contador continuaria em 3/4, ou ela corrige a data de um
 * treino e a semana errada ficaria marcada como cumprida. Contando a partir
 * das sessões, o número é sempre o que está lá — e não há um segundo lugar
 * para a verdade morar.
 *
 * A SEMANA COMEÇA NA SEGUNDA, e isso é escolha: é como se fala de semana de
 * treino ("faço quatro na semana"), e domingo no meio partiria a semana de
 * quem treina no fim de semana.
 */

/** A segunda-feira daquela data. Entra e sai como "AAAA-MM-DD". */
export function segundaDaSemana(dataIso: string): string {
  // `T12:00:00Z` e não meia-noite: com meia-noite, o fuso do navegador da
  // paciente (UTC−3) jogaria a data para o dia anterior, e uma segunda
  // viraria domingo — a semana inteira sairia deslocada.
  const d = new Date(`${dataIso.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return dataIso.slice(0, 10);
  // getUTCDay: 0 é domingo. Domingo pertence à semana que começou na
  // segunda anterior, seis dias antes.
  const diaDaSemana = d.getUTCDay();
  const recuo = diaDaSemana === 0 ? 6 : diaDaSemana - 1;
  d.setUTCDate(d.getUTCDate() - recuo);
  return d.toISOString().slice(0, 10);
}

/** O domingo que fecha a semana daquela segunda. */
export function domingoDaSemana(dataIso: string): string {
  const d = new Date(`${segundaDaSemana(dataIso)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

export function estaNaSemana(dataIso: string, semanaInicio: string): boolean {
  return segundaDaSemana(dataIso) === segundaDaSemana(semanaInicio);
}

export interface ProgressoDaMeta {
  meta: MetaSemanal;
  /** O quanto ela fez na semana da meta. */
  feito: number;
  /** 0 a 100, já limitado: 5 de 4 treinos é 100%, não 125%. */
  porcento: number;
  cumprida: boolean;
  /** "3/4 treinos", "80/90 minutos" — pronto para a tela. */
  texto: string;
}

function comVirgula(n: number): string {
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

/**
 * Quanto a paciente fez, na semana daquela meta.
 *
 * Treino conta SESSÃO (uma por dia de treino); cardio conta MINUTO, que é
 * como a meta dela é escrita ("90 minutos por semana"). Contar sessão de
 * cardio diria que quem fez três caminhadas de dez minutos cumpriu a mesma
 * coisa que quem fez três de trinta.
 */
export function progressoDaMeta(
  meta: MetaSemanal,
  sessoesTreino: SessaoDeTreino[],
  sessoesCardio: CardioSessao[],
): ProgressoDaMeta {
  let feito = 0;

  if (meta.tipo === "treino") {
    const dias = new Set<string>();
    for (const s of sessoesTreino) {
      // Dois registros no mesmo dia são um dia de treino, não dois: a meta
      // é "4 treinos na semana", e quem lançou a sessão em duas partes não
      // treinou duas vezes.
      if (estaNaSemana(s.data, meta.semanaInicio)) dias.add(s.data.slice(0, 10));
    }
    feito = dias.size;
  } else {
    for (const c of sessoesCardio) {
      if (!estaNaSemana(c.data, meta.semanaInicio)) continue;
      feito += c.duracaoMin ?? 0;
    }
  }

  const alvo = meta.alvo > 0 ? meta.alvo : 0;
  const porcento = alvo === 0 ? 0 : Math.min(100, Math.round((feito / alvo) * 100));

  return {
    meta,
    feito,
    porcento,
    cumprida: alvo > 0 && feito >= alvo,
    texto: `${comVirgula(feito)}/${comVirgula(alvo)} ${meta.unidade}`,
  };
}

export const MENSAGEM_META_CUMPRIDA = "Meta semanal concluída!";

/**
 * As metas da semana de hoje, com o progresso de cada uma.
 *
 * Só as da semana corrente: uma meta de três semanas atrás na tela é
 * cobrança por uma semana que já passou, e não há o que fazer com ela.
 */
export function metasDaSemana(
  metas: MetaSemanal[],
  hoje: string,
  sessoesTreino: SessaoDeTreino[],
  sessoesCardio: CardioSessao[],
): ProgressoDaMeta[] {
  const semana = segundaDaSemana(hoje);
  return metas
    .filter((m) => segundaDaSemana(m.semanaInicio) === semana)
    .map((m) => progressoDaMeta(m, sessoesTreino, sessoesCardio));
}

/**
 * Os dias da semana em que ela treinou ou fez cardio — a "consistência".
 *
 * Sai da segunda ao domingo, sempre sete posições, para a tela desenhar
 * sete quadradinhos na mesma ordem toda semana. Uma lista só com os dias
 * feitos faria a régua mudar de tamanho a cada semana.
 */
export function diasDaSemana(
  hoje: string,
  sessoesTreino: SessaoDeTreino[],
  sessoesCardio: CardioSessao[],
): { data: string; treinou: boolean; cardio: boolean }[] {
  const inicio = segundaDaSemana(hoje);
  const comTreino = new Set(sessoesTreino.map((s) => s.data.slice(0, 10)));
  const comCardio = new Set(sessoesCardio.map((c) => c.data.slice(0, 10)));

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${inicio}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    const data = d.toISOString().slice(0, 10);
    return { data, treinou: comTreino.has(data), cardio: comCardio.has(data) };
  });
}
