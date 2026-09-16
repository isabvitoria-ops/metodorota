import type { RegistroDiario } from "@/types";

/**
 * O protótipo sempre inicia o diário alimentar do dia vazio (`useState({})`)
 * — cada refeição só ganha registro quando a paciente responde no modal.
 * Mantido vazio aqui pelo mesmo motivo; o repositório grava o que a UI enviar.
 */
export const REGISTROS_DIARIO_INICIAIS: RegistroDiario[] = [];
