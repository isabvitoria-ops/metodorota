/** Tour do app na primeira vez (0099). */
export interface PassoDoTour {
  id: string;
  ordem: number;
  /** Nula = vale para todas. Senão a chave da área (a de areas_desligadas) ou "rastreio". */
  area: string | null;
  titulo: string;
  texto: string;
  videoUrl: string | null;
  ativo: boolean;
}
