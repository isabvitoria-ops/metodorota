/**
 * Dado do próprio paciente: favoritos (§23) e trocas recentes (§24).
 *
 * Hoje mora no localStorage. O formato já é o de uma linha de tabela
 * (id, tipo, referência, data ISO) justamente para que migrar para Supabase
 * seja trocar a implementação do repositório, não o formato (§30).
 */
export type TipoFavorito = "alimento" | "troca" | "grupo" | "categoria" | "opcao" | "guia";

export interface Favorito {
  /** `${tipo}:${refId}` — estável, para alternar sem duplicar. */
  id: string;
  tipo: TipoFavorito;
  refId: string;
  titulo: string;
  subtitulo: string | null;
  /** Rota para onde o cartão em "Salvos" leva. */
  rota: string;
  salvoEm: string;
}

export interface TrocaRecente {
  id: string;
  origemAlimentoId: string;
  destinoAlimentoId: string;
  quantidade: number;
  unidadeId: string;
  em: string;
}
