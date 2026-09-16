/**
 * Conteúdo editorial: "Comer fora" (§13-§16) e "Guias" (§17).
 *
 * Tudo que a nutricionista ainda não escreveu fica como `null` ou lista
 * vazia e a tela renderiza um estado de "em preparação" — o briefing (§29)
 * pede explicitamente para não preencher lacuna com informação inventada.
 */

/** Classificação sem julgamento moral (§15): contexto, não permissão. */
export type NivelEscolha = "melhor" | "boa" | "ocasional";

/**
 * Valor energético (§16): fica guardado no dado, mas só aparece na tela se
 * `mostrarKcal` for verdadeiro. A decisão é item a item.
 */
export interface ValorEnergetico {
  kcal: number | null;
  mostrarKcal: boolean;
  observacao: string | null;
}

export interface OpcaoComerFora {
  id: string;
  titulo: string;
  descricao: string | null;
  nivel: NivelEscolha | null;
  energia: ValorEnergetico | null;
  /** Marcadores curtos exibidos como lista dentro do cartão aberto. */
  detalhes: string[];
  tags: string[];
}

/**
 * Um ponto de decisão dentro da categoria — é assim que o material de massas
 * funciona, por exemplo: primeiro a quantidade da massa, depois a proteína,
 * depois o molho. Cada decisão tem suas próprias opções classificadas.
 */
export interface DecisaoComerFora {
  id: string;
  titulo: string;
  pergunta: string | null;
  opcoes: OpcaoComerFora[];
  /**
   * Notas que valem para a decisão inteira, não para uma opção só — é a
   * forma como os materiais da nutricionista são escritos ("prefira molho ao
   * sugo", "sugiro 20 peças", "shoyu tradicional ou light").
   */
  observacoes: string[];
}

/**
 * Uma casa: McDonald's dentro de Hambúrguer, Spoleto dentro de Massas.
 *
 * É o nível que faltava. As `decisoes` respondem "como montar esta refeição";
 * o estabelecimento responde "e naquele lugar ali, o que eu peço?" — que é a
 * pergunta que a paciente realmente faz parada na frente do balcão.
 *
 * `grupo` é o que separa lanchonete de artesanal na tela; `logo` é a marca,
 * que a nutricionista envia pelo painel. Sem logo, a tela desenha a inicial
 * num círculo em vez de deixar um buraco.
 */
export interface EstabelecimentoComerFora {
  id: string;
  nome: string;
  /** Agrupa na tela: "Lanchonetes", "Artesanais", "Rodízios"… */
  grupo: string | null;
  /** Logo da marca, como URL ou data URI. */
  logo: string | null;
  resumo: string | null;
  ordem: number;
  opcoes: OpcaoComerFora[];
  observacoes: string[];
}

export type StatusConteudo = "publicado" | "em-preparacao";

export interface CategoriaComerFora {
  id: string;
  nome: string;
  resumo: string | null;
  /** Chave do ícone em `components/Icone.tsx`. Usado quando não há logo. */
  icone: string;
  /**
   * Logo da marca, quando a categoria É uma marca — Subway, por exemplo.
   * `null` cai no ícone, que é o caso das categorias genéricas (Pizza).
   */
  logo: string | null;
  ordem: number;
  status: StatusConteudo;
  introducao: string | null;
  decisoes: DecisaoComerFora[];
  /** As casas desta categoria. Vazio = a categoria só tem as decisões. */
  estabelecimentos: EstabelecimentoComerFora[];
  /** Fecho da tela: lembretes curtos, quando houver. */
  lembretes: string[];
  tags: string[];
}

export interface SecaoGuia {
  id: string;
  titulo: string | null;
  paragrafos: string[];
  itens: string[];
}

export interface Guia {
  id: string;
  titulo: string;
  /** Agrupa os guias em blocos na listagem ("Dia a dia", "Digestão"...). */
  tema: string;
  resumo: string | null;
  ordem: number;
  status: StatusConteudo;
  secoes: SecaoGuia[];
  tags: string[];
}
