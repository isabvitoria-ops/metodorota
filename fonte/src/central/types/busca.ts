import type { TipoFavorito } from "./pessoal";

/** Seções em que a busca global agrupa os resultados (§18). */
export type TipoResultado = TipoFavorito | "ferramenta";

export interface ItemIndice {
  id: string;
  tipo: TipoResultado;
  titulo: string;
  subtitulo: string | null;
  rota: string;
  /** Palavras extras que também devem encontrar o item. */
  palavras: string[];
}

export interface ResultadoBusca extends ItemIndice {
  pontos: number;
}

export interface SecaoResultados {
  tipo: TipoResultado;
  rotulo: string;
  itens: ResultadoBusca[];
}
