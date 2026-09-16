import type {
  Alimento,
  CategoriaComerFora,
  Configuracoes,
  Equivalencia,
  GrupoAlimentar,
  Guia,
  Unidade,
} from "@/central/types";
import { CONFIGURACOES_PADRAO } from "./mapeadores";
import type { DadosCatalogo } from "./repositorio";

/**
 * O catálogo em memória.
 *
 * As telas continuam perguntando de forma síncrona (`catalogo.alimento(id)`)
 * porque o catálogo inteiro — algumas dezenas de alimentos e conteúdos — é
 * carregado de uma vez no início e não muda enquanto o paciente navega.
 * Isso evita espalhar estado de carregamento por dez telas para buscar
 * dados que cabem numa requisição só.
 *
 * Quem preenche é `hidratar()`, chamada pelo provedor de dados assim que o
 * repositório responde. Antes disso o catálogo está vazio e o app mostra a
 * tela de carregamento — nenhuma tela renderiza com dado pela metade.
 */

interface Estado {
  unidades: Unidade[];
  grupos: GrupoAlimentar[];
  alimentos: Alimento[];
  equivalencias: Equivalencia[];
  categoriasComerFora: CategoriaComerFora[];
  guias: Guia[];
  configuracoes: Configuracoes;
  porUnidade: Map<string, Unidade>;
  porGrupo: Map<string, GrupoAlimentar>;
  porAlimento: Map<string, Alimento>;
  porCategoria: Map<string, CategoriaComerFora>;
  porGuia: Map<string, Guia>;
  carregado: boolean;
}

const estado: Estado = {
  unidades: [],
  grupos: [],
  alimentos: [],
  equivalencias: [],
  categoriasComerFora: [],
  guias: [],
  configuracoes: CONFIGURACOES_PADRAO,
  porUnidade: new Map(),
  porGrupo: new Map(),
  porAlimento: new Map(),
  porCategoria: new Map(),
  porGuia: new Map(),
  carregado: false,
};

export function hidratar(dados: DadosCatalogo): void {
  estado.unidades = dados.unidades;
  estado.grupos = [...dados.grupos].sort((a, b) => a.ordem - b.ordem);
  estado.alimentos = dados.alimentos;
  estado.equivalencias = dados.equivalencias;
  estado.categoriasComerFora = [...dados.categoriasComerFora].sort((a, b) => a.ordem - b.ordem);
  estado.guias = [...dados.guias].sort((a, b) => a.ordem - b.ordem);
  estado.configuracoes = dados.configuracoes;
  estado.porUnidade = new Map(dados.unidades.map((u) => [u.id, u]));
  estado.porGrupo = new Map(dados.grupos.map((g) => [g.id, g]));
  estado.porAlimento = new Map(dados.alimentos.map((a) => [a.id, a]));
  estado.porCategoria = new Map(dados.categoriasComerFora.map((c) => [c.id, c]));
  estado.porGuia = new Map(dados.guias.map((g) => [g.id, g]));
  estado.carregado = true;
}

export const catalogo = {
  carregado: () => estado.carregado,

  unidades: () => estado.unidades,
  unidade: (id: string): Unidade | null => estado.porUnidade.get(id) ?? null,

  grupos: () => estado.grupos,
  grupo: (id: string): GrupoAlimentar | null => estado.porGrupo.get(id) ?? null,

  /**
   * O que o paciente vê: só o que está no ar. A nutricionista pede a lista
   * inteira pelas funções `...Cadastrados`, porque é ela quem religa o que
   * está desativado — e se as duas listas fossem a mesma, um item escondido
   * do paciente ficaria invisível também para quem precisa reativá-lo.
   */
  alimentos: () => estado.alimentos.filter((a) => a.ativo),
  alimentosCadastrados: () => estado.alimentos,
  alimento: (id: string): Alimento | null => estado.porAlimento.get(id) ?? null,
  alimentosDoGrupo: (grupoId: string): Alimento[] =>
    estado.alimentos
      .filter((a) => a.ativo && a.grupoId === grupoId)
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),

  equivalencias: () => estado.equivalencias.filter((e) => e.ativo),
  equivalenciasCadastradas: () => estado.equivalencias,
  equivalenciasDe: (alimentoId: string): Equivalencia[] =>
    estado.equivalencias.filter(
      (e) =>
        e.ativo &&
        (e.origemAlimentoId === alimentoId ||
          (e.bidirecional && e.destinoAlimentoId === alimentoId)),
    ),

  categoriasComerFora: () => estado.categoriasComerFora,
  categoriaComerFora: (id: string): CategoriaComerFora | null => estado.porCategoria.get(id) ?? null,

  guias: () => estado.guias,
  guia: (id: string): Guia | null => estado.porGuia.get(id) ?? null,

  configuracoes: (): Configuracoes => estado.configuracoes,
};
