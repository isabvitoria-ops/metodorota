import type { Paciente, SituacaoPaciente } from "@/central/types";

/**
 * A mesma regra de situação que o banco aplica (`situacao_paciente` em
 * 0002_funcoes.sql), escrita em TypeScript.
 *
 * Por que existir nos dois lugares: no banco ela é a que vale — é ela que
 * decide o que sai da consulta, e é ela que um paciente vencido não
 * consegue contornar. Aqui ela serve para a tela dizer "vence em 3 dias"
 * sem uma ida ao servidor, e para o modo demonstração funcionar sem banco
 * nenhum. Se as duas discordarem, a do banco ganha: a tela pode errar um
 * rótulo, mas não consegue liberar conteúdo.
 */

/** Data de hoje no fuso de quem usa o app, em formato ISO (AAAA-MM-DD). */
export function hojeSaoPaulo(): string {
  const formatador = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatador.format(new Date());
}

/** Diferença em dias entre duas datas ISO. Positivo = `fim` está no futuro. */
export function diasEntre(inicio: string, fim: string): number {
  const a = Date.parse(`${inicio}T00:00:00Z`);
  const b = Date.parse(`${fim}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

export interface DadosSituacao {
  status: "convite_pendente" | "ativo" | "suspenso";
  perfilId: string | null;
  dataInicio: string;
  dataFim: string;
}

export function calcularSituacao(
  dados: DadosSituacao,
  alertaDias = 15,
  hoje = hojeSaoPaulo(),
): SituacaoPaciente {
  if (!dados.perfilId) return "convite_pendente";
  if (dados.status === "suspenso") return "suspenso";
  if (hoje < dados.dataInicio) return "nao_iniciado";
  if (hoje > dados.dataFim) return "expirado";
  if (diasEntre(hoje, dados.dataFim) <= alertaDias) return "proximo_do_vencimento";
  return "ativo";
}

/**
 * A frase do briefing: acesso = conta vinculada + não suspenso + dentro do
 * período. Repare que "próximo do vencimento" tem acesso — é só um aviso.
 */
export function temAcesso(dados: DadosSituacao, hoje = hojeSaoPaulo()): boolean {
  return (
    dados.perfilId !== null &&
    dados.status === "ativo" &&
    hoje >= dados.dataInicio &&
    hoje <= dados.dataFim
  );
}

const ROTULOS: Record<SituacaoPaciente, string> = {
  convite_pendente: "Convite pendente",
  ativo: "Ativo",
  suspenso: "Suspenso",
  nao_iniciado: "Ainda não começou",
  expirado: "Expirado",
  proximo_do_vencimento: "Próximo do vencimento",
};

export function rotuloSituacao(situacao: SituacaoPaciente): string {
  return ROTULOS[situacao] ?? situacao;
}

/** Cor do selo na tela administrativa. */
export function tomSituacao(situacao: SituacaoPaciente): "melhor" | "boa" | "ocasional" | "neutro" {
  switch (situacao) {
    case "ativo":
      return "melhor";
    case "proximo_do_vencimento":
      return "boa";
    case "expirado":
    case "suspenso":
      return "ocasional";
    default:
      return "neutro";
  }
}

/** Soma dias a uma data ISO — usado para sugerir a data de fim de um plano. */
export function somarDias(dataIso: string, dias: number): string {
  const base = Date.parse(`${dataIso}T00:00:00Z`);
  if (Number.isNaN(base)) return dataIso;
  return new Date(base + dias * 86_400_000).toISOString().slice(0, 10);
}

/** "12/03/2026" a partir de "2026-03-12", sem depender de fuso. */
export function dataBonita(dataIso: string | null): string {
  if (!dataIso) return "—";
  const partes = dataIso.slice(0, 10).split("-");
  if (partes.length !== 3) return dataIso;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

export function ordenarPorVencimento(a: Paciente, b: Paciente): number {
  return a.dataFim.localeCompare(b.dataFim);
}
