/**
 * Rota Viagem — o guia de viagem de uma paciente.
 *
 * O guia inteiro é DADO, gravado por paciente no banco: nenhum texto de
 * paciente mora no código. A tela só sabe desenhar blocos; o que cada bloco
 * diz é a nutricionista que escreve, na ficha da paciente.
 *
 * Nos textos, `**assim**` vira negrito e `*assim*` vira itálico. Não há HTML.
 */

/** Um item de lista: um título curto (opcional) e o texto. */
export interface ItemDoGuia {
  titulo?: string;
  texto: string;
}

export type TomDoDestaque = "dica" | "atencao" | "alerta" | "neutro";
export type EstiloDaLista = "numerada" | "marcadores" | "cartoes";
export type CorDoSemaforo = "verde" | "amarelo" | "vermelho";

export type BlocoDoGuia =
  | { tipo: "texto"; texto: string }
  | { tipo: "subtitulo"; texto: string }
  | { tipo: "destaque"; tom: TomDoDestaque; titulo?: string; texto?: string; itens?: string[] }
  | { tipo: "lista"; estilo: EstiloDaLista; itens: ItemDoGuia[] }
  /** Três grupos de alimentos com busca. As cores são as de estado do app. */
  | { tipo: "semaforo"; grupos: { cor: CorDoSemaforo; titulo: string; itens: ItemDoGuia[] }[] }
  /** Abas (por país, por idioma): cada uma com os próprios blocos. */
  | { tipo: "abas"; abas: { rotulo: string; blocos: BlocoDoGuia[] }[] }
  /** Cartão grande para mostrar na tela (ao garçom, por exemplo). */
  | { tipo: "cartao"; texto: string; destaques: string[] }
  | { tipo: "tabela"; colunas: string[]; linhas: string[][] }
  /** A ficha de saúde, montada com os dados pessoais da paciente. */
  | { tipo: "ficha" }
  /** O diário, um dia para cada data da viagem. */
  | { tipo: "diario" }
  /** Um produto indicado: foto, nome e uma linha. A foto vai dentro do guia. */
  | { tipo: "produto"; imagem: string; titulo: string; texto: string; link?: string };

export type TipoDeBloco = BlocoDoGuia["tipo"];

export interface SecaoDoGuia {
  id: string;
  /** Nome curto na barra de seções. Vazio = a seção não entra na barra. */
  rotulo: string;
  titulo: string;
  blocos: BlocoDoGuia[];
}

export interface GuiaDeViagem {
  /** A frase do topo. */
  chamada: string;
  /** "Portugal · Itália · Espanha" */
  destinos: string;
  /** Como ela quer que apareça: "11 a 26 de novembro de 2026 (16 dias)". */
  periodo: string;
  /** AAAA-MM-DD. Com as duas datas, o diário ganha um dia para cada data. */
  dataInicio: string | null;
  dataFim: string | null;
  secoes: SecaoDoGuia[];
}

/**
 * Os dados pessoais da ficha de saúde.
 *
 * Ficam separados do guia porque são o que identifica a pessoa: copiar o guia
 * de uma paciente para outra nunca leva a ficha junto.
 */
export interface FichaDeViagem {
  nome: string | null;
  nascimento: string | null;
  diagnosticos: string | null;
}

/** O que a paciente recebe: o guia dela e a ficha dela. */
export interface MeuGuiaDeViagem {
  guia: GuiaDeViagem;
  ficha: FichaDeViagem | null;
}

/** Uma paciente que já tem guia, para servir de ponto de partida. */
export interface GuiaParaCopiar {
  pacienteId: string;
  nome: string;
  destinos: string;
  periodo: string;
}

/** Os campos de um dia do diário, como a paciente digita. */
export interface CamposDoDiario {
  onde: string;
  inchaco: string;
  dor: string;
  azia: string;
  evacuacoes: string;
  bristol: string;
  observacoes: string;
}

/** Um dia do diário como está gravado no banco. */
export interface DiaDoDiarioDeViagem {
  /** AAAA-MM-DD */
  dia: string;
  onde: string | null;
  inchaco: number | null;
  dor: number | null;
  azia: number | null;
  evacuacoes: number | null;
  bristol: number | null;
  observacoes: string | null;
  atualizadoEm: string | null;
}

/** O que a nutricionista vê do Rota Viagem de uma paciente. */
export interface ViagemDoPaciente {
  liberado: boolean;
  /** Nulo enquanto ela não montou o guia desta paciente. */
  guia: GuiaDeViagem | null;
  guiaAtualizadoEm: string | null;
  ficha: FichaDeViagem | null;
  diario: DiaDoDiarioDeViagem[];
}
