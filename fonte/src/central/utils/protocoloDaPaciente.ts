import type { Protocolo, RefeicaoProtocolo } from "@/central/types/protocolo";

/**
 * A tela do protocolo da paciente — as regras que não dependem de tela.
 *
 * Nada aqui muda o protocolo nem calcula valor nutricional: só decide COMO
 * mostrar o que a nutricionista escreveu.
 */

/** O ícone de cada refeição, pelo nome que ela deu. Sem nome conhecido, o prato. */
const ICONES: [RegExp, string][] = [
  [/caf[eé]\s*(da)?\s*manh[aã]|desjejum/i, "cafe"],
  [/pr[eé][\s-]*treino|p[oó]s[\s-]*treino/i, "treino"],
  [/lanche|cola[cç][aã]o/i, "lanche"],
  [/almo[cç]o/i, "almoco"],
  [/jant(a|ar)/i, "jantar"],
  [/ceia/i, "sono"],
];

export function iconeDaRefeicao(nome: string): string {
  for (const [padrao, icone] of ICONES) if (padrao.test(nome)) return icone;
  return "almoco";
}

export interface SubstituicaoPartida {
  alimento: string;
  quantidade: string | null;
}

/**
 * "Tapioca - 70g" vira alimento e quantidade, para alinhar em duas colunas.
 *
 * O corte é no ÚLTIMO " - " (com espaços): "Pão sem glúten - integral - 2
 * fatias" tem hífen no nome. Hífen sem espaços ("grão-de-bico") nunca corta.
 * Sem o separador, o texto inteiro é o alimento — nada é adivinhado.
 */
export function partirSubstituicao(texto: string): SubstituicaoPartida {
  const limpo = texto.trim();
  const corte = Math.max(limpo.lastIndexOf(" - "), limpo.lastIndexOf(" – "), limpo.lastIndexOf(" — "));
  if (corte <= 0) return { alimento: limpo, quantidade: null };
  const quantidade = limpo.slice(corte + 3).trim();
  return quantidade ? { alimento: limpo.slice(0, corte).trim(), quantidade } : { alimento: limpo, quantidade: null };
}

/** "08:00" ou "8h30" → minutos desde a meia-noite. Nulo se não for horário. */
export function minutosDoHorario(horario: string | undefined): number | null {
  const m = horario?.trim().match(/^(\d{1,2})\s*(?::|h)\s*(\d{2})?\s*(?:h|hs)?$/i);
  if (!m) return null;
  const horas = Number(m[1]);
  const minutos = Number(m[2] ?? 0);
  return horas > 23 || minutos > 59 ? null : horas * 60 + minutos;
}

/**
 * Qual refeição vem agora, pelo horário que a nutricionista escreveu.
 *
 * Só responde quando pelo menos duas refeições têm horário: com uma só (ou
 * nenhuma) não há sequência para comparar, e marcar "próxima" seria palpite.
 * Depois da última refeição do dia, não marca nenhuma.
 *
 * A meia hora de tolerância existe porque ninguém come no minuto exato: às
 * 12h20, o almoço das 12h ainda é "agora", não a refeição que passou.
 */
export function proximaRefeicao(refeicoes: RefeicaoProtocolo[], agoraEmMinutos: number): number | null {
  const horarios = refeicoes.map((r) => minutosDoHorario(r.horario));
  if (horarios.filter((h) => h !== null).length < 2) return null;
  let melhor: number | null = null;
  horarios.forEach((h, i) => {
    if (h === null || h + 30 < agoraEmMinutos) return;
    if (melhor === null || h < (horarios[melhor] as number)) melhor = i;
  });
  return melhor;
}

/** "Atualizado em 10/11/2026 · versão 3 · 4 refeições" — só o que existe. */
export function resumoDoProtocolo(protocolo: Protocolo): string {
  const partes: string[] = [];
  const quando = (protocolo.publicadoEm ?? protocolo.atualizadoEm)?.slice(0, 10).split("-");
  if (quando && quando.length === 3) partes.push(`Atualizado em ${quando[2]}/${quando[1]}/${quando[0]}`);
  if (protocolo.versao > 1) partes.push(`versão ${protocolo.versao}`);
  const n = protocolo.conteudo.refeicoes.length;
  partes.push(n === 1 ? "1 refeição" : `${n} refeições`);
  return partes.join(" · ");
}
