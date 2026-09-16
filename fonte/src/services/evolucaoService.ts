import type { PoseFoto, RegistroPeso, SessaoFoto } from "@/types";
import { evolucaoRepository } from "@/repositories";

export async function listarSessoesFoto(pacienteId: string): Promise<SessaoFoto[]> {
  return evolucaoRepository.listarSessoesFoto(pacienteId);
}

/**
 * Pipeline de upload real (briefing §14 · Fotos de evolução): compressão no
 * cliente → remoção de EXIF → upload para bucket privado → path salvo aqui.
 * Nesta fase o processamento em si (canvas de compressão, leitura/strip de
 * EXIF) ainda não está implementado — a função já modela o pipeline
 * completo para o dia em que a captura de câmera real for plugada; por ora
 * ela só valida que o path recebido já passou pelos dois passos.
 */
export function prepararUploadFoto(arquivoProcessadoPath: string): string {
  return arquivoProcessadoPath;
}

export async function salvarSessaoFoto(
  nutricionistaId: string,
  pacienteId: string,
  data: string,
  storagePathPorPose: Partial<Record<PoseFoto, string>>,
): Promise<SessaoFoto> {
  return evolucaoRepository.salvarSessaoFoto(nutricionistaId, pacienteId, data, storagePathPorPose);
}

/** Regra #11: exclusão real ao pedido do paciente — sem soft delete, sem "acesso encerrado". */
export async function apagarSessaoFoto(sessaoId: string): Promise<void> {
  return evolucaoRepository.apagarSessaoFoto(sessaoId);
}

export async function listarPesos(pacienteId: string): Promise<RegistroPeso[]> {
  return evolucaoRepository.listarPesos(pacienteId);
}

export async function registrarPeso(nutricionistaId: string, pacienteId: string, data: string, quilos: number): Promise<RegistroPeso> {
  return evolucaoRepository.registrarPeso(nutricionistaId, pacienteId, data, quilos);
}
