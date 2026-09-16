import type { PoseFoto, RegistroPeso, SessaoFoto } from "@/types";
import { agoraISO, atraso, db, gerarId } from "./mockDb";

export async function listarSessoesFoto(pacienteId: string): Promise<SessaoFoto[]> {
  await atraso();
  return db.sessoesFoto.filter((s) => s.pacienteId === pacienteId).sort((a, b) => a.data.localeCompare(b.data));
}

/** Regra #11: bucket privado — aqui só simula o path já processado (sem EXIF, comprimido). O upload real fica em services/fotoService. */
export async function salvarSessaoFoto(
  nutricionistaId: string,
  pacienteId: string,
  data: string,
  storagePathPorPose: Partial<Record<PoseFoto, string>>,
): Promise<SessaoFoto> {
  await atraso(400);
  const sessao: SessaoFoto = {
    id: gerarId("sessao-foto"),
    nutricionistaId,
    criadoEm: agoraISO(),
    atualizadoEm: agoraISO(),
    pacienteId,
    data,
    storagePathPorPose,
  };
  db.sessoesFoto.push(sessao);
  return sessao;
}

export async function apagarSessaoFoto(sessaoId: string): Promise<void> {
  await atraso(200);
  db.sessoesFoto = db.sessoesFoto.filter((s) => s.id !== sessaoId);
}

export async function listarPesos(pacienteId: string): Promise<RegistroPeso[]> {
  await atraso();
  return db.pesos.filter((p) => p.pacienteId === pacienteId).sort((a, b) => a.data.localeCompare(b.data));
}

export async function registrarPeso(nutricionistaId: string, pacienteId: string, data: string, quilos: number): Promise<RegistroPeso> {
  await atraso(250);
  const registro: RegistroPeso = {
    id: gerarId("peso"),
    nutricionistaId,
    criadoEm: agoraISO(),
    atualizadoEm: agoraISO(),
    pacienteId,
    data,
    quilos,
  };
  db.pesos.push(registro);
  return registro;
}
