import type {
  Alimento,
  CategoriaComerFora,
  Configuracoes,
  Equivalencia,
  EventoHistorico,
  GrupoAlimentar,
  Guia,
  Paciente,
  Plano,
  RegraEquivalencia,
  Unidade,
} from "@/central/types";

/**
 * Tradução entre a linha do banco (snake_case, como o Postgres gosta) e o
 * objeto do domínio (camelCase, como o app usa).
 *
 * Existe um arquivo só para isso porque é o ponto exato onde um dia se troca
 * o banco: se as colunas mudarem de nome, muda aqui e mais nada. Nenhuma tela
 * conhece o formato da linha.
 */

export type Linha = Record<string, unknown>;

export const texto = (v: unknown): string => (typeof v === "string" ? v : "");
export const textoOuNulo = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);
export const numero = (v: unknown): number => (typeof v === "number" ? v : Number(v) || 0);
const numeroOuNulo = (v: unknown): number | null =>
  v === null || v === undefined ? null : Number(v);
const booleano = (v: unknown): boolean => v === true;
const booleanoOuNulo = (v: unknown): boolean | null =>
  v === null || v === undefined ? null : v === true;
const lista = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export function paraUnidade(l: Linha): Unidade {
  return {
    id: texto(l.id),
    rotulo: texto(l.rotulo),
    abreviacao: texto(l.abreviacao),
    singular: texto(l.singular),
    continua: booleano(l.continua),
  };
}

export function paraGrupo(l: Linha): GrupoAlimentar {
  return {
    id: texto(l.id),
    nome: texto(l.nome),
    descricao: textoOuNulo(l.descricao),
    ordem: numero(l.ordem),
    regra: (l.regra as GrupoAlimentar["regra"]) ?? null,
    trocaPorPorcao: booleano(l.troca_por_porcao),
    trocaParaGrupos: lista(l.troca_para_grupos),
    tags: lista(l.tags),
  };
}

export function paraAlimento(l: Linha): Alimento {
  const quantidade = numeroOuNulo(l.porcao_quantidade);
  const unidade = textoOuNulo(l.porcao_unidade_id);
  return {
    id: texto(l.id),
    nome: texto(l.nome),
    grupoId: texto(l.grupo_id),
    unidadeBaseId: texto(l.unidade_base_id),
    porcao: quantidade !== null && unidade ? { quantidade, unidadeId: unidade } : null,
    quantidadeLivre: l.quantidade_livre === true,
    medidas: Array.isArray(l.medidas) ? (l.medidas as Alimento["medidas"]) : [],
    atributos: {
      semGluten: booleanoOuNulo(l.sem_gluten),
      semLactose: booleanoOuNulo(l.sem_lactose),
    },
    tags: lista(l.tags),
    imagem: textoOuNulo(l.imagem_url),
    observacao: textoOuNulo(l.observacao),
    ativo: l.ativo !== false,
  };
}

export function paraEquivalencia(l: Linha): Equivalencia {
  return {
    id: texto(l.id),
    origemAlimentoId: texto(l.origem_alimento_id),
    destinoAlimentoId: texto(l.destino_alimento_id),
    regra: l.regra as RegraEquivalencia,
    bidirecional: booleano(l.bidirecional),
    fonte: textoOuNulo(l.fonte),
    observacao: textoOuNulo(l.observacao),
    ativo: l.ativo !== false,
  };
}

export function paraCategoriaComerFora(l: Linha): CategoriaComerFora {
  const corpo = (l.corpo ?? {}) as {
    introducao?: string | null;
    decisoes?: CategoriaComerFora["decisoes"];
    estabelecimentos?: CategoriaComerFora["estabelecimentos"];
    logo?: string | null;
    lembretes?: string[];
  };
  return {
    id: texto(l.id),
    nome: texto(l.titulo),
    resumo: textoOuNulo(l.resumo),
    icone: texto(l.icone) || "restaurante",
    logo: corpo.logo ?? null,
    ordem: numero(l.ordem),
    status: l.status === "publicado" ? "publicado" : "em-preparacao",
    introducao: corpo.introducao ?? null,
    decisoes: corpo.decisoes ?? [],
    estabelecimentos: corpo.estabelecimentos ?? [],
    lembretes: corpo.lembretes ?? [],
    tags: lista(l.tags),
  };
}

export function paraGuia(l: Linha): Guia {
  const corpo = (l.corpo ?? {}) as { secoes?: Guia["secoes"] };
  return {
    id: texto(l.id),
    titulo: texto(l.titulo),
    tema: texto(l.tema) || "Outros",
    resumo: textoOuNulo(l.resumo),
    ordem: numero(l.ordem),
    status: l.status === "publicado" ? "publicado" : "em-preparacao",
    secoes: corpo.secoes ?? [],
    tags: lista(l.tags),
  };
}

export function paraPlano(l: Linha): Plano {
  return {
    id: texto(l.id),
    nome: texto(l.nome),
    duracaoDias: numero(l.duracao_dias),
    descricao: textoOuNulo(l.descricao),
    ordem: numero(l.ordem),
    ativo: booleano(l.ativo),
  };
}

export function paraPaciente(l: Linha): Paciente {
  return {
    id: texto(l.id),
    perfilId: textoOuNulo(l.perfil_id),
    email: texto(l.email),
    nome: texto(l.nome),
    telefone: textoOuNulo(l.telefone),
    planoId: textoOuNulo(l.plano_id),
    planoNome: textoOuNulo(l.plano_nome),
    dataInicio: texto(l.data_inicio),
    dataFim: texto(l.data_fim),
    status: (texto(l.status) || "convite_pendente") as Paciente["status"],
    situacao: (texto(l.situacao) || "convite_pendente") as Paciente["situacao"],
    diasRestantes: numeroOuNulo(l.dias_restantes),
    observacoes: textoOuNulo(l.observacoes),
    ultimoAcesso: textoOuNulo(l.ultimo_acesso),
    conviteEnviadoEm: textoOuNulo(l.convite_enviado_em),
    criadoEm: texto(l.criado_em),
  };
}

export function paraEvento(l: Linha): EventoHistorico {
  return {
    id: texto(l.id),
    pacienteId: textoOuNulo(l.paciente_id),
    evento: texto(l.evento),
    detalhe: (l.detalhe as Record<string, unknown>) ?? {},
    criadoEm: texto(l.criado_em),
  };
}

const PADROES: Configuracoes = {
  nomeCentral: "Central do Paciente",
  fraseHome: "Facilite suas escolhas no dia a dia.",
  lema: "",
  comerForaIntroducao: "",
  whatsapp: "",
  nomeNutricionista: "",
  alertaVencimentoDias: 15,
};

/** As configurações chegam como linhas chave/valor e viram um objeto só. */
export function paraConfiguracoes(linhas: Linha[]): Configuracoes {
  const mapa = new Map(linhas.map((l) => [texto(l.chave), l.valor]));
  const str = (chave: string, padrao: string) => {
    const v = mapa.get(chave);
    return typeof v === "string" && v ? v : padrao;
  };
  return {
    nomeCentral: str("nome_central", PADROES.nomeCentral),
    fraseHome: str("frase_home", PADROES.fraseHome),
    lema: str("lema", PADROES.lema),
    comerForaIntroducao: str("comer_fora_introducao", PADROES.comerForaIntroducao),
    whatsapp: str("whatsapp", PADROES.whatsapp),
    nomeNutricionista: str("nome_nutricionista", PADROES.nomeNutricionista),
    alertaVencimentoDias: Number(mapa.get("alerta_vencimento_dias") ?? PADROES.alertaVencimentoDias),
  };
}

export { PADROES as CONFIGURACOES_PADRAO };
