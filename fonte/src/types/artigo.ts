import type { RegistroDominio } from "./common";
import type { SintomaId } from "./checkin";

/**
 * Artigo curto da tela "Biblioteca" do paciente — conteúdo educativo em
 * texto, sugerido por sintoma registrado no check-in do dia. Distinto de
 * `Material` (guias em PDF geridos na aba "Materiais" do painel): aqui o
 * texto vive no próprio banco, lá é um arquivo no Storage.
 */
export interface ArtigoBiblioteca extends RegistroDominio {
  categoria: "Entender" | "Na prática" | "O caminho";
  minutosLeitura: number;
  titulo: string;
  resumo: string;
  corpo: string;
  ligadoASintomas: SintomaId[];
}
