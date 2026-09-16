import type { ID, ISODateString, RegistroDominio } from "./common";

/**
 * Quantidade tal como a nutricionista escreve — nunca calculada pelo app.
 * `valor`/`unidade` são a forma "de trabalho" (usada pela folha de troca em
 * modo "Comer mais de um" para dividir proporcionalmente — Anexo regra #4);
 * `unidade` pode ser grama ("g") ou uma medida caseira ("colheres de sopa",
 * "unidade média", "concha rasa"...).
 */
export interface Quantidade {
  valor: number;
  unidade: string;
}

/** Regra #7: unidade de exibição é decisão da nutricionista, por paciente — nunca automática. */
export interface ItemPlano {
  id: ID;
  opcaoId: ID;
  /** Papel do item na refeição, ex.: "Proteína", "Carboidrato", "Fruta". */
  slot: string;
  ordem: number;
  /** null enquanto o item importado do texto colado não foi vinculado à base TACO (regra #9). */
  alimentoCodigoTaco: number | null;
  /** Texto como veio do colar/digitar, preservado mesmo depois de vinculado — auditoria do que a nutri escreveu. */
  nomeExibicao: string;
  quantidade: Quantidade;
  /** Mesma quantidade em medida caseira, se a nutri cadastrou uma — usada quando `preferenciaUnidade === "caseira"`. */
  quantidadeCaseira?: Quantidade;
  substituicoes: Substituicao[];
}

/**
 * Substituição escrita pela nutricionista. Regra #3: o app nunca calcula ou
 * sugere uma troca sozinho — toda entrada aqui foi digitada por ela.
 */
export interface Substituicao {
  id: ID;
  itemPlanoId: ID;
  alimentoCodigoTaco: number | null;
  nomeExibicao: string;
  quantidade: Quantidade;
  quantidadeCaseira?: Quantidade;
  /** Aviso curto opcional, ex.: "Contém glúten e fermenta mais que as outras opções." */
  aviso?: string;
}

/**
 * Lista aberta de vegetais com mínimo em grama, sem quantidade fechada por
 * item — existe só quando a refeição libera "à vontade" (briefing §14).
 */
export interface RegraVegetais {
  ativa: boolean;
  minimoGramas?: number;
  itensLiberados: { alimentoCodigoTaco: number | null; nomeExibicao: string }[];
}

/**
 * Uma "opção" dentro de uma refeição. Quando uma refeição tem mais de uma
 * (ex.: jantar com "Comida" / "Hambúrguer" / "Sushi"), as opções herdam a
 * cor da refeição e viram abas na tela — único sinal visual que diferencia
 * "alternativas da mesma refeição" de "refeições diferentes do dia".
 */
export interface Opcao {
  id: ID;
  refeicaoId: ID;
  /** Rótulo da aba; vazio/undefined quando a refeição tem uma única opção (sem abas). */
  nome?: string;
  ordem: number;
  itens: ItemPlano[];
}

export interface Refeicao {
  id: ID;
  planoId: ID;
  nome: string;
  horario: string;
  /** Cor fixa da refeição (regra #6) — id de token, resolvido em constants/cores.ts. */
  corId: string;
  ordem: number;
  observacao?: string;
  opcoes: Opcao[];
  regraVegetais?: RegraVegetais;
}

export interface Plano extends RegistroDominio {
  pacienteId: ID;
  versao: number;
  /** Só uma versão por paciente tem `ativa: true`. */
  ativa: boolean;
  notaVersao?: string;
  faseRotulo?: string;
  refeicoes: Refeicao[];
  publicadoEm: ISODateString | null;
}

/** Registro append-only do histórico de versões (aba "Plano" do painel). */
export interface VersaoPlanoResumo {
  planoId: ID;
  versao: number;
  publicadoEm: ISODateString;
  nota?: string;
  ativa: boolean;
}

/**
 * Item ainda não vinculado à base TACO, produzido pelo parser de texto colado.
 * Publicação fica bloqueada enquanto existir algum `PlanoRascunhoItem` com
 * `alimentoCodigoTaco: null` (regra #9).
 */
export interface PlanoRascunhoItem {
  escrito: string;
  quantidade: Quantidade;
  alimentoCodigoTaco: number | null;
  sugestoesCodigoTaco: number[];
  /** Substituições ("ou ...") coladas logo abaixo do item — mesmo formato, sem aninhar mais um nível. */
  substituicoes: PlanoRascunhoItem[];
}

export interface OpcaoRascunho {
  /** Rótulo da aba ("OPÇÃO Hambúrguer") — vazio quando a refeição tem opção única. */
  nome?: string;
  itens: PlanoRascunhoItem[];
}

export interface RefeicaoRascunho {
  nome: string;
  horario: string;
  opcoes: OpcaoRascunho[];
  observacao?: string;
  regraVegetaisAtiva: boolean;
}

/**
 * Um alimento disponível no "Montar uma refeição" (briefing §14 · Plano
 * alimentar). Não é um item do plano — é o catálogo, curado pela
 * nutricionista, do que o paciente pode combinar livremente dentro do que
 * já foi autorizado (Anexo regra #4: nunca introduz alimento novo).
 * `bloqueado` mostra, com o motivo, um alimento que existe na base mas
 * está fora do protocolo desta fase — valor educativo, não é o mesmo que
 * simplesmente omitir o item.
 */
export interface ItemMontador {
  alimentoCodigoTaco: number;
  /** Nome que o paciente vê — igual ao padrão de `ItemPlano.nomeExibicao`, nunca lido da base TACO na tela do paciente (regra #2). */
  nomeExibicao: string;
  grupo: string;
  /** Ausente quando `livre` (regra livre de vegetais) ou `bloqueado`. */
  quantidadeBase?: Quantidade;
  livre?: boolean;
  bloqueado?: string;
  aviso?: string;
}
