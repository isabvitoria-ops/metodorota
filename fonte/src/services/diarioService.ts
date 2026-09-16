import type { AdesaoId, RegistroDiario } from "@/types";
import { diarioRepository } from "@/repositories";

export async function listarRegistrosDoDia(pacienteId: string, data: string): Promise<RegistroDiario[]> {
  return diarioRepository.listarRegistrosDoDia(pacienteId, data);
}

export async function registrarAdesao(
  nutricionistaId: string,
  pacienteId: string,
  refeicaoId: string,
  data: string,
  adesao: AdesaoId,
  nota?: string,
  fotoUrl?: string,
): Promise<RegistroDiario> {
  return diarioRepository.salvarRegistro(nutricionistaId, pacienteId, refeicaoId, data, adesao, nota, fotoUrl);
}

/**
 * Regra #5 (inegociável): trocar dentro do que foi liberado nunca conta
 * como desvio. Único caminho de gravação para o resultado do "Montar uma
 * refeição" e da folha de troca — hardcoda `adesao: "troquei"` para que
 * nenhum call site consiga, por engano, gravar isso como "fora".
 */
export async function registrarTrocaComoAdesao(
  nutricionistaId: string,
  pacienteId: string,
  refeicaoId: string,
  data: string,
  descricaoEscolha: string,
): Promise<RegistroDiario> {
  return diarioRepository.salvarRegistro(nutricionistaId, pacienteId, refeicaoId, data, "troquei" as AdesaoId, descricaoEscolha, undefined);
}
