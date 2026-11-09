/**
 * Os dados pessoais da ficha de saúde do Rota Viagem.
 *
 * Vêm do banco, só para a própria paciente: nome completo, nascimento e
 * diagnóstico não podem morar no código, que é baixado por qualquer visitante.
 */
export interface FichaDeViagem {
  nome: string | null;
  nascimento: string | null;
  diagnosticos: string | null;
}
