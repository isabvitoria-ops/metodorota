import type { ID, RegistroDominio } from "./common";

/**
 * Regra #objetividade: hoje mostra resumo com texto fixo; a versão real abre
 * PDF do Supabase Storage, mantendo liberação por paciente (`Paciente.materiaisLiberadosId`).
 */
export interface Material extends RegistroDominio {
  titulo: string;
  categoria: string;
  storagePath: string | null;
  recomendadoParaPacienteId: ID[];
}
