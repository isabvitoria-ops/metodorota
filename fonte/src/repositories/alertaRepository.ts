import type { AlertaClinico, OrigemAlerta } from "@/types";
import { agoraISO, atraso, db, gerarId } from "./mockDb";

export async function listarAlertasNaoLidos(nutricionistaId: string): Promise<AlertaClinico[]> {
  await atraso();
  return db.alertasClinicos.filter((a) => a.nutricionistaId === nutricionistaId && !a.lidoPelaNutricionistaEm);
}

/** Regra determinística (briefing §22) — chamado por services/checkinService, nunca gerado por IA. */
export async function criarAlerta(
  nutricionistaId: string,
  pacienteId: string,
  origem: OrigemAlerta,
  origemRegistroId: string,
): Promise<AlertaClinico> {
  await atraso(100);
  const jaExiste = db.alertasClinicos.find(
    (a) => a.pacienteId === pacienteId && a.origem === origem && a.origemRegistroId === origemRegistroId,
  );
  if (jaExiste) return jaExiste;

  const alerta: AlertaClinico = {
    id: gerarId("alerta"),
    nutricionistaId,
    criadoEm: agoraISO(),
    atualizadoEm: agoraISO(),
    pacienteId,
    origem,
    origemRegistroId,
    geradoEm: agoraISO(),
    lidoPelaNutricionistaEm: null,
  };
  db.alertasClinicos.push(alerta);
  return alerta;
}

export async function marcarAlertaLido(alertaId: string): Promise<void> {
  await atraso();
  const alerta = db.alertasClinicos.find((a) => a.id === alertaId);
  if (alerta) alerta.lidoPelaNutricionistaEm = agoraISO();
}
