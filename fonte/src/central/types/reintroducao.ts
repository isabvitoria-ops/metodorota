/**
 * Rastreabilidade alimentar e reintrodução.
 *
 * Estes tipos descrevem o que `minha_reintroducao()` e
 * `reintroducao_do_paciente()` devolvem. Repare no que NÃO existe aqui:
 * nenhum campo de "pendente", "atrasado", "faltando" ou "concluído". Não é
 * esquecimento — é o desenho. O módulo registra o processo; ele não cobra
 * nem fecha nada.
 */

/** Os sintomas do protocolo dela. `outros` vem acompanhado da observação. */
export type SintomaReintroducao =
  | "nenhum"
  | "distensao"
  | "gases"
  | "dor_abdominal"
  | "colica"
  | "alteracao_evacuacao"
  | "diarreia"
  | "constipacao"
  | "urgencia"
  | "nausea"
  | "refluxo"
  | "manchas_pele"
  | "outros";

/**
 * Estados neutros (§10 e §12 do pedido dela).
 *
 * Nenhum deles significa "proibido", e o único que o sistema atribui sozinho
 * é `em_teste` — porque passou a existir registro, o que é fato e não
 * julgamento. Os demais são da nutricionista.
 */
export type StatusReintroducao =
  | "nao_iniciado"
  | "em_teste"
  | "bem_tolerado"
  | "tolerancia_parcial"
  | "sintomas_observados"
  | "necessita_reavaliacao"
  | "pausado"
  | "nao_relevante";

export type CategoriaReintroducao =
  | "carboidratos"
  | "gorduras"
  | "proteinas"
  | "frutas"
  | "vegetais"
  | "outros";

/** Quão presente está o marcador, na escala do material dela. */
export type NivelDoMarcador = "muito_baixa" | "baixa" | "media" | "alta" | "muito_alta";

/**
 * Um marcador alto naquele alimento — oxalato, histamina ou lectina.
 *
 * Só chega aqui o que está em média ou acima: o material serve para responder
 * "o que este alimento tem de alto", e listar o que é baixo esconderia isso.
 *
 * Não é diagnóstico. A introdução do material dela diz para que serve: se um
 * alimento que caiu mal é muito alto em oxalato, outros alimentos altos em
 * oxalato merecem atenção. É pista de comparação, e quem compara é a dupla.
 */
export interface MarcadorDoAlimento {
  nome: "Oxalato" | "Histamina" | "Lectina";
  nivel: NivelDoMarcador;
}

/** Um alimento do material dela, como referência para montar a lista. */
export interface AlimentoDoMaterial {
  id: string;
  nome: string;
  categoria: CategoriaReintroducao;
  /** A etapa em que ele aparece no PDF. Sugestão de ordem, não cronograma. */
  semanaSugerida: number | null;
  porcaoReferencia: string | null;
  observacao: string | null;
}

/** Um alimento na lista de uma paciente. */
export interface ItemDeReintroducao {
  id: string;
  alimentoId: string | null;
  nome: string;
  categoria: CategoriaReintroducao;
  semanaSugerida: number | null;
  porcaoReferencia: string | null;
  observacaoMaterial: string | null;
  /** `false` = nome digitado, fora do material. */
  doCatalogo: boolean;
  status: StatusReintroducao;
  notaNutri: string | null;
  ordem: number;
  /** Vazio quando o alimento não está na tabela de oxalato/histamina/lectina. */
  marcacao: MarcadorDoAlimento[];
  totalDeRegistros: number;
  ultimoRegistro: string | null;
}

export interface RegistroDeReintroducao {
  id: string;
  itemId: string;
  itemNome: string;
  data: string;
  /** "HH:MM", ou nulo quando ela não anotou a hora. */
  horario: string | null;
  /** Só agrupa o histórico no tempo. Não fecha e não vence. */
  semana: number;
  quantidade: string | null;
  preparo: string | null;
  sintomas: SintomaReintroducao[];
  intensidade: number | null;
  /** Escala de Bristol, 1 a 7, do protocolo de rastreio dela. */
  bristol: number | null;
  observacao: string | null;
  /**
   * A marcação do alimento. Vem sempre; quem decide mostrar é a tela, e só
   * quando este registro tem sintoma — foi o que ela pediu.
   */
  marcacao: MarcadorDoAlimento[];
  criadoEm: string;
}

/** O retorno inteiro. Serve à tela da paciente e à da nutricionista. */
export interface Reintroducao {
  /** Se o módulo está ligado para esta paciente. */
  ativo: boolean;
  /** A nutricionista abrindo a tela da paciente. */
  previa?: boolean;
  orientacao: string | null;
  inicio: string | null;
  semanaAtual: number;
  semanasComRegistro: number[];
  itens: ItemDeReintroducao[];
  registros: RegistroDeReintroducao[];
}

/** O que a paciente preenche ao registrar. Tudo opcional menos o alimento. */
export interface NovoRegistroDeReintroducao {
  itemId?: string | null;
  nomeNovo?: string | null;
  data?: string | null;
  horario?: string | null;
  quantidade?: string | null;
  preparo?: string | null;
  sintomas?: SintomaReintroducao[];
  intensidade?: number | null;
  bristol?: number | null;
  observacao?: string | null;
}
