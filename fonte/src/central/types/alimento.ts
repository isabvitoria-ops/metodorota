import type { Medida, MedidaDoAlimento } from "./unidade";

/**
 * Atributos que ligam/desligam os filtros da calculadora (§6).
 *
 * `null` é diferente de `false`: quer dizer "a nutricionista ainda não
 * informou". Um alimento com `semGluten: null` não é apresentado como
 * contendo glúten — ele simplesmente não entra quando o filtro está ligado,
 * e a tela avisa que o dado está pendente em vez de chutar.
 */
export interface AtributosAlimento {
  semGluten: boolean | null;
  semLactose: boolean | null;
}

export interface Alimento {
  id: string;
  nome: string;
  grupoId: string;
  /** Unidade em que as medidas deste alimento são convertidas (normalmente "g" ou "ml"). */
  unidadeBaseId: string;
  /**
   * Porção de referência do material de substituição (§8): 1 porção de arroz
   * cozido = 100 g. É a partir dela que o sistema deriva trocas dentro do
   * mesmo grupo sem precisar de uma linha de equivalência por par.
   * `null` = ainda não cadastrada; o alimento aparece na lista, mas não é
   * oferecido na calculadora.
   */
  porcao: Medida | null;
  /**
   * Quantidade livre por decisão da nutricionista, não por falta de dado.
   * Existe para separar dois "sem porção" que a tela precisa contar de
   * formas opostas: o limão da lista de frutas é livre de propósito, e
   * chamá-lo de "porção a definir" seria mentir sobre o material.
   */
  quantidadeLivre: boolean;
  medidas: MedidaDoAlimento[];
  atributos: AtributosAlimento;
  /** Palavras que a busca global também aceita ("massa", "espaguete"). */
  tags: string[];
  imagem: string | null;
  observacao: string | null;
  /**
   * Visível para os pacientes. Desativar esconde sem apagar — o alimento
   * continua nas equivalências e no histórico de quem já o usou.
   */
  ativo: boolean;
}

/**
 * Regra de consumo de um grupo inteiro.
 *
 * "porcoes" é o caso comum (carboidratos, proteínas...): o grupo trabalha em
 * porções e trocas internas saem da razão entre elas. "livre" é o caso dos
 * vegetais livres (§12): quantidade livre, com um mínimo por refeição.
 */
export type RegraGrupo =
  | { tipo: "porcoes" }
  | {
      tipo: "livre";
      minimos: { refeicao: string; medida: Medida }[];
      texto: string;
    };

export interface GrupoAlimentar {
  id: string;
  nome: string;
  descricao: string | null;
  ordem: number;
  regra: RegraGrupo | null;
  /**
   * Se trocas dentro do grupo podem ser derivadas porção↔porção. Desligue
   * num grupo em que isso não valha e o sistema passa a exigir equivalência
   * explícita ali — sem mexer em código (§10).
   */
  trocaPorPorcao: boolean;
  /**
   * Outros grupos para os quais uma porção deste grupo pode ser convertida.
   *
   * É de MÃO ÚNICA, e essa é a razão de existir: no material, 1 porção de
   * carboidrato equivale a 1 porção de fruta, mas trocar fruta por
   * carboidrato não é permitido. Um campo bidirecional não saberia dizer
   * isso. Quem está aqui é o grupo de ORIGEM; o destino não precisa
   * retribuir.
   */
  trocaParaGrupos: string[];
  tags: string[];
}
