/**
 * Semáforo FODMAP — tipos.
 *
 * Os FODMAPs são carboidratos fermentáveis que podem causar sintomas em
 * pacientes com SII. O semáforo classifica alimentos comuns em três faixas
 * (verde/amarelo/vermelho) por grupo FODMAP, com porção segura quando
 * aplicável.
 *
 * O dado é ESTÁTICO: vive num arquivo de semente, não no banco. É referência
 * clínica consultiva — a paciente busca, filtra e vê o semáforo sem gravar
 * nada. A nutricionista não edita aqui; quem quiser ampliar o catálogo mexe
 * no arquivo de semente.
 */

export type GrupoFodmap =
  | "frutanos"
  | "gos"
  | "lactose"
  | "frutose"
  | "sorbitol"
  | "manitol";

export type NivelFodmap = "verde" | "amarelo" | "vermelho";

export type FaseFodmap = "eliminacao" | "reintroducao" | "manutencao";

export type CategoriaFodmap =
  | "frutas"
  | "verduras_legumes"
  | "graos_cereais"
  | "laticinios"
  | "proteinas"
  | "oleaginosas"
  | "condimentos"
  | "bebidas";

export interface AlimentoFodmap {
  id: string;
  nome: string;
  categoria: CategoriaFodmap;
  /** Porção considerada segura (verde). Nula = evitar na eliminação. */
  porcaoSegura: string | null;
  /** Porção moderada (amarelo). Nula se não há faixa intermediária. */
  porcaoModerada: string | null;
  /** Classificação geral do alimento. */
  nivel: NivelFodmap;
  /** Quais grupos FODMAP este alimento contém em quantidade relevante. */
  grupos: GrupoFodmap[];
  /** Dica curta (ex.: "Prefira verde/madura", "Versão sem lactose é verde"). */
  dica: string | null;
}

export const ROTULOS_GRUPO: Record<GrupoFodmap, string> = {
  frutanos: "Frutanos",
  gos: "GOS",
  lactose: "Lactose",
  frutose: "Frutose",
  sorbitol: "Sorbitol",
  manitol: "Manitol",
};

export const ROTULOS_CATEGORIA: Record<CategoriaFodmap, string> = {
  frutas: "Frutas",
  verduras_legumes: "Verduras e legumes",
  graos_cereais: "Grãos e cereais",
  laticinios: "Laticínios",
  proteinas: "Proteínas",
  oleaginosas: "Oleaginosas e sementes",
  condimentos: "Condimentos e temperos",
  bebidas: "Bebidas",
};

export const ROTULOS_NIVEL: Record<NivelFodmap, string> = {
  verde: "Baixo FODMAP",
  amarelo: "Moderado",
  vermelho: "Alto FODMAP",
};

export const ROTULOS_FASE: Record<FaseFodmap, string> = {
  eliminacao: "Eliminação",
  reintroducao: "Reintrodução",
  manutencao: "Manutenção",
};

export const DESCRICAO_FASE: Record<FaseFodmap, string> = {
  eliminacao:
    "Evite os alimentos vermelhos e amarelos. Fique com os verdes por 2 a 6 semanas.",
  reintroducao:
    "Teste um grupo FODMAP por vez, em porção pequena, por 3 dias. Observe os sintomas.",
  manutencao:
    "Você já sabe o que tolera. Inclua o que deu certo e evite só o que causou sintomas.",
};
