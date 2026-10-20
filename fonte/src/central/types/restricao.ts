export type TipoRestricao = "alergia" | "intolerancia" | "sensibilidade" | "preferencia";
export type GravidadeRestricao = "leve" | "moderada" | "grave";

export interface RestricaoAlimentar {
  id: string;
  tipo: TipoRestricao;
  alimento: string;
  gravidade: GravidadeRestricao;
  notas: string | null;
  criadoEm: string;
  atualizadoEm: string;
}
