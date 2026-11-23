export type TipoRestricao = "alergia" | "intolerancia" | "sensibilidade" | "preferencia";
export type GravidadeRestricao = "leve" | "moderada" | "grave";

export interface RestricaoAlimentar {
  id: string;
  tipo: TipoRestricao;
  alimento: string;
  gravidade: GravidadeRestricao;
  notas: string | null;
  /** Os alimentos da lista de trocas ligados a esta restrição (0105). */
  alimentoIds?: string[];
  /** "rastreio": nasceu do "Virar restrição" da Rastreabilidade. */
  origem?: "consulta" | "rastreio";
  criadoEm: string;
  atualizadoEm: string;
}

/** O que a Troca da paciente recebe: só alimento, tipo e origem (0105). */
export interface AlimentoRestrito {
  alimentoId: string;
  tipo: TipoRestricao;
  origem: "consulta" | "rastreio";
}
