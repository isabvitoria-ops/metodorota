import type { Meta } from "@/central/types/meta";
import type { PanoramaDoPaciente, StatusDoPaciente } from "@/central/types/panorama";
import { historico } from "@/central/utils/progressoMetas";

/**
 * A régua da lista de pacientes.
 *
 * TUDO AQUI SAI DE DADO REAL. Nenhuma etiqueta é inventada e nenhum número é
 * estimado: se não há de onde tirar, a resposta é NULA e a tela mostra um
 * travessão. Um "54% de adesão" chutado é pior do que um "—", porque o
 * travessão ela sabe ler e o número errado ela acredita.
 *
 * E NADA AQUI JULGA A PACIENTE. "Sem registro recente" é a constatação de
 * que faz nove dias que ninguém anotou nada — não é "relaxou", não é
 * "abandonou", e a tela não diz nenhuma das duas coisas.
 */

/** Quantos dias sem registro nenhum até a lista chamar atenção. */
export const DIAS_SEM_REGISTRO = 7;

/** Quantos dias antes do retorno ele passa a contar como "próximo". */
export const DIAS_RETORNO_PROXIMO = 7;

/** Em quantos dias a adesão é medida. Quatro semanas fechadas. */
export const DIAS_DE_ADESAO = 28;

function diasEntre(deIso: string, ateIso: string): number {
  // `T12:00:00Z` pelo motivo de sempre: com meia-noite, o fuso do navegador
  // (UTC−3) jogaria a data para o dia anterior e a conta sairia um dia
  // errada — justamente na véspera do retorno, que é quando importa.
  const de = new Date(`${deIso.slice(0, 10)}T12:00:00Z`).getTime();
  const ate = new Date(`${ateIso.slice(0, 10)}T12:00:00Z`).getTime();
  if (Number.isNaN(de) || Number.isNaN(ate)) return 0;
  return Math.round((ate - de) / 86_400_000);
}

/**
 * A adesão: de quantos períodos cobrados ela cumpriu quantos.
 *
 * NULA quando não há o que medir — sem meta ativa, ou com metas que
 * começaram hoje. Zero por cento diria que ela não fez nada; nulo diz que
 * não há como saber, que é a verdade.
 *
 * Conta com o MESMO `historico()` que desenha a tela da paciente. Uma
 * segunda conta aqui faria a lista da profissional e a tela da paciente
 * discordarem sobre a mesma semana.
 */
export function adesao(metas: Meta[], hojeIso: string): number | null {
  const ativas = metas.filter((m) => m.status === "ativa");
  if (ativas.length === 0) return null;

  let cumpridos = 0;
  let total = 0;

  for (const meta of ativas) {
    // Em períodos, não em dias: numa meta semanal, 28 dias são 4 períodos.
    const quantos = meta.frequencia === "semanal"
      ? Math.ceil(DIAS_DE_ADESAO / 7)
      : DIAS_DE_ADESAO;

    // O período CORRENTE fica de fora: ele ainda está aberto, e contá-lo
    // como não cumprido derrubaria a adesão de toda paciente toda segunda
    // de manhã, por um motivo que não é dela.
    const passados = historico(meta, hojeIso, quantos + 1).slice(1);
    for (const p of passados) {
      total += 1;
      if (p.cumprida) cumpridos += 1;
    }
  }

  if (total === 0) return null;
  return Math.round((cumpridos / total) * 100);
}

/**
 * A etiqueta ao lado do nome.
 *
 * A ORDEM É A DA URGÊNCIA, e uma paciente tem uma etiqueta só: o retorno de
 * hoje ganha de tudo, porque é o que ela precisa preparar agora. Duas
 * etiquetas na mesma linha fariam a lista virar um mural.
 */
export function statusDoPaciente(p: PanoramaDoPaciente, hojeIso: string): StatusDoPaciente {
  if (p.proximaConsulta) {
    const faltam = diasEntre(hojeIso, p.proximaConsulta.data);
    if (faltam === 0) return "retorno_hoje";
    if (faltam > 0 && faltam <= DIAS_RETORNO_PROXIMO) return "retorno_proximo";
  }

  // Sem acesso vem depois do retorno de propósito: se há consulta marcada,
  // o acesso vencido é assunto da consulta, não da lista.
  if (p.situacao === "expirado" || p.situacao === "suspenso") return "sem_acesso";

  // "Sem registro" só faz sentido para quem tem o que registrar. Paciente
  // sem meta, sem treino e sem rastreio nunca registrou nada porque nunca
  // teve onde — chamá-la de "sem registro recente" seria cobrar o silêncio
  // de uma porta que ela não tem.
  if (p.metas.length > 0) {
    if (p.ultimoRegistro === null) return "sem_registro";
    if (diasEntre(p.ultimoRegistro, hojeIso) > DIAS_SEM_REGISTRO) return "sem_registro";
  }

  return "em_dia";
}

export function textoDoStatus(status: StatusDoPaciente, p: PanoramaDoPaciente): string {
  switch (status) {
    case "retorno_hoje":
      return "retorno hoje";
    case "retorno_proximo": {
      const faltam = p.proximaConsulta ? diasEntre(hojeDe(p), p.proximaConsulta.data) : 0;
      return faltam === 1 ? "retorno amanhã" : `retorno em ${faltam} dias`;
    }
    case "sem_registro":
      return p.ultimoRegistro === null
        ? "nenhum registro ainda"
        : `sem registro há ${diasEntre(p.ultimoRegistro, hojeDe(p))} dias`;
    case "sem_acesso":
      return p.situacao === "suspenso" ? "acesso suspenso" : "acesso vencido";
    default:
      return "em dia";
  }
}

// O "hoje" usado pelo texto vem do próprio panorama, e não de um relógio
// global: assim `textoDoStatus` é uma função pura e o teste consegue
// congelar a data. `diasRestantes` é `data_fim - hoje`, então o hoje está
// implícito ali — e quando ele falta, o texto cai para a data da consulta.
function hojeDe(p: PanoramaDoPaciente): string {
  if (p.dataFim && p.diasRestantes !== null) {
    const d = new Date(`${p.dataFim}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - p.diasRestantes);
    return d.toISOString().slice(0, 10);
  }
  return p.proximaConsulta?.data ?? p.ultimoRegistro ?? "1970-01-01";
}

/** "−4,2 kg" desde a primeira avaliação. Nulo sem as duas pontas. */
export function variacaoDePeso(p: PanoramaDoPaciente): number | null {
  if (p.pesoInicial === null || p.pesoAtual === null) return null;
  return Math.round((p.pesoAtual - p.pesoInicial) * 10) / 10;
}

/** As iniciais para o círculo do avatar. "Ana Maria Silva" → "AS". */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const primeira = partes[0]![0] ?? "";
  const ultima = partes.length > 1 ? (partes[partes.length - 1]![0] ?? "") : "";
  return (primeira + ultima).toUpperCase();
}

/**
 * A ordem da lista: quem precisa de alguma coisa primeiro.
 *
 * Alfabética seria mais previsível, e é exatamente o problema — a paciente
 * com retorno hoje ficaria na letra dela, no meio de doze nomes.
 */
const PESO: Record<StatusDoPaciente, number> = {
  retorno_hoje: 0,
  retorno_proximo: 1,
  sem_registro: 2,
  sem_acesso: 3,
  em_dia: 4,
};

export function emOrdemDeAtencao(
  pacientes: PanoramaDoPaciente[],
  hojeIso: string,
): PanoramaDoPaciente[] {
  return [...pacientes].sort((a, b) => {
    const pa = PESO[statusDoPaciente(a, hojeIso)];
    const pb = PESO[statusDoPaciente(b, hojeIso)];
    if (pa !== pb) return pa - pb;
    return a.nome.localeCompare(b.nome, "pt-BR");
  });
}
