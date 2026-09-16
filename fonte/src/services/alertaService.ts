import type { CheckIn, CheckInRascunho, OrigemAlerta } from "@/types";
import { alertaRepository } from "@/repositories";

/**
 * Regra determinística (briefing §22): if/then auditável, nunca geração de
 * linguagem natural. Sempre dirigido à nutricionista — o paciente nunca vê
 * "alerta" nem interpretação, só a confirmação normal de que o check-in foi
 * salvo (a UI decide a mensagem, este serviço só decide se dispara).
 */
export function avaliarOrigensDeAlerta(
  checkinNovo: CheckInRascunho,
  historicoRecente: CheckIn[],
): OrigemAlerta[] {
  const origens: OrigemAlerta[] = [];

  if (checkinNovo.flags.includes("sangue")) {
    origens.push("sangue_nas_fezes");
  }

  const ultimosTres = [...historicoRecente.slice(-2), checkinNovo];
  const tresDatasDiferentes =
    ultimosTres.length === 3 &&
    new Set(ultimosTres.map((c) => c.data.split("T")[0])).size === 3;
  const dorAltaSequencial = tresDatasDiferentes && ultimosTres.every((c) => (c.sintomas.dor ?? 0) >= 3);
  if (dorAltaSequencial) {
    origens.push("dor_alta_sequencial");
  }

  return origens;
}

export async function dispararAlertas(
  nutricionistaId: string,
  pacienteId: string,
  checkinId: string,
  origens: OrigemAlerta[],
): Promise<void> {
  await Promise.all(origens.map((origem) => alertaRepository.criarAlerta(nutricionistaId, pacienteId, origem, checkinId)));
}
