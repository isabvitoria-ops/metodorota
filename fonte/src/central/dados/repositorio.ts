import type {
  AcaoAdmin,
  Alimento,
  AlimentoDoMaterial,
  CategoriaComerFora,
  Configuracoes,
  DesafioAdmin,
  EnvioPendente,
  Equivalencia,
  EventoHistorico,
  Favorito,
  GrupoAlimentar,
  Guia,
  IndicacaoPendente,
  LinhaDoRanking,
  MeuDesafio,
  NovoPaciente,
  NovoRegistroDeReintroducao,
  Paciente,
  PainelDoDesafio,
  Plano,
  Reintroducao,
  ResumoIndicacao,
  StatusReintroducao,
  Unidade,
} from "@/central/types";
import type {
  AvaliacaoFisica,
  ConteudoProtocolo,
  DadosAvaliacao,
  FichaProtocolo,
  GrupoDoProtocolo,
  MinhaAvaliacao,
  Protocolo,
  ResumoProtocolo,
} from "@/central/types/protocolo";
import { MODO_DEMONSTRACAO } from "@/central/supabase/cliente";
import { repositorioLocal } from "./repositorioLocal";
import { repositorioSupabase } from "./repositorioSupabase";

/**
 * A porta única entre o app e onde os dados moram (§2, §30 do briefing).
 *
 * Duas implementações atendem a mesma interface: `repositorioSupabase`, que
 * fala com o banco de verdade, e `repositorioLocal`, que usa os arquivos de
 * semente e o armazenamento do navegador. Quem escolhe é a presença das
 * variáveis de ambiente — nenhuma tela sabe qual das duas está respondendo.
 *
 * É por aqui que entraria um terceiro backend um dia, sem tocar em tela.
 */

export interface DadosCatalogo {
  unidades: Unidade[];
  grupos: GrupoAlimentar[];
  alimentos: Alimento[];
  equivalencias: Equivalencia[];
  categoriasComerFora: CategoriaComerFora[];
  guias: Guia[];
  configuracoes: Configuracoes;
}

export interface AlteracaoPaciente {
  nome?: string;
  email?: string;
  telefone?: string | null;
  planoId?: string | null;
  dataInicio?: string;
  dataFim?: string;
  status?: "convite_pendente" | "ativo" | "suspenso";
  observacoes?: string | null;
}

export interface Repositorio {
  /** Tudo que as telas do paciente precisam, numa carga só. */
  carregarCatalogo(): Promise<DadosCatalogo>;

  listarFavoritos(): Promise<Favorito[]>;
  salvarFavorito(favorito: Favorito): Promise<void>;
  removerFavorito(id: string): Promise<void>;

  listarPlanos(): Promise<Plano[]>;
  listarPacientes(): Promise<Paciente[]>;
  criarPaciente(dados: NovoPaciente): Promise<Paciente>;
  alterarPaciente(id: string, alteracao: AlteracaoPaciente): Promise<void>;
  excluirPaciente(id: string): Promise<void>;
  registrarConvite(pacienteId: string, email: string): Promise<void>;
  historicoDoPaciente(pacienteId: string): Promise<EventoHistorico[]>;

  salvarAlimento(alimento: Alimento, ativo: boolean): Promise<void>;
  salvarEquivalencia(equivalencia: Equivalencia, ativo: boolean): Promise<void>;
  salvarCategoriaComerFora(categoria: CategoriaComerFora): Promise<void>;
  salvarGuia(guia: Guia): Promise<void>;
  salvarConfiguracoes(configuracoes: Configuracoes): Promise<void>;

  /** Marca presença do paciente. Falha em silêncio: não é crítico. */
  registrarAcesso(): Promise<void>;

  // ---------------------------------------------------------------- desafio
  //
  // Repare que não existe `salvarPontos` nem nada parecido: o app não tem
  // como escrever um ponto. Ele marca ação, registra indicação e lê o
  // resultado. Quem transforma isso em ponto é o banco, na aprovação.

  /** Tudo que a tela do desafio mostra, numa chamada só. */
  meuDesafio(): Promise<MeuDesafio>;
  /** "Eu fiz isso." Nasce pendente, sempre. */
  enviarAcao(acaoId: string, observacao?: string | null): Promise<void>;
  /** Desfaz o próprio envio, enquanto não foi conferido. */
  cancelarEnvio(envioId: string): Promise<void>;
  registrarIndicacao(nome: string, email?: string | null, telefone?: string | null): Promise<void>;

  // Área da nutricionista
  listarDesafios(): Promise<DesafioAdmin[]>;
  salvarDesafio(desafio: Partial<DesafioAdmin> & { nome: string; dataInicio: string; dataFim: string }): Promise<void>;
  painelDoDesafio(desafioId: string): Promise<PainelDoDesafio>;
  rankingDoDesafio(desafioId: string): Promise<LinhaDoRanking[]>;
  enviosPendentes(desafioId: string): Promise<EnvioPendente[]>;
  aprovarEnvio(envioId: string): Promise<void>;
  recusarEnvio(envioId: string, motivo?: string | null): Promise<void>;
  /** As ações do desafio, para ela escolher qual lançar por alguém. */
  acoesDoDesafio(desafioId: string): Promise<AcaoAdmin[]>;
  /**
   * Lançar a ação por uma paciente que fez e esqueceu de marcar. Não é ponto
   * solto: vira um envio aprovado, com o histórico de sempre.
   */
  concederAcao(pacienteId: string, acaoId: string, semana?: number | null): Promise<void>;
  ajustarPontos(pacienteId: string, pontos: number, motivo: string, desafioId?: string | null): Promise<void>;
  listarIndicacoes(): Promise<IndicacaoPendente[]>;
  /** Quantas indicações cada paciente já fez, somando desde sempre. */
  resumoIndicacoes(): Promise<ResumoIndicacao[]>;

  // ------------------------------------------------- rastreabilidade alimentar
  //
  // Repare no que não existe: nenhum método pergunta se "pode" registrar.
  // O módulo registra o que aconteceu — quem decide o ritmo é a dupla
  // paciente/nutricionista, não o aplicativo.

  /** Tudo que a tela da paciente mostra, numa chamada só. */
  minhaReintroducao(): Promise<Reintroducao>;
  registrarReintroducao(registro: NovoRegistroDeReintroducao): Promise<void>;
  editarRegistroReintroducao(
    registroId: string,
    registro: NovoRegistroDeReintroducao,
  ): Promise<void>;
  excluirRegistroReintroducao(registroId: string): Promise<void>;
  /** "Esse alimento não faz parte da minha alimentação." */
  marcarRelevanciaReintroducao(itemId: string, relevante: boolean): Promise<void>;

  // Área da nutricionista
  /** O material dela, para montar a lista de cada paciente. */
  listarAlimentosDoMaterial(): Promise<AlimentoDoMaterial[]>;
  reintroducaoDoPaciente(pacienteId: string): Promise<Reintroducao>;
  /**
   * Lançar um registro no diário de uma paciente, com data para trás.
   *
   * Para quem fez rastreio no papel antes de o aplicativo existir: o
   * histórico entra sem pedir que a paciente redigite semanas de diário.
   */
  /**
   * Aponta um alimento digitado à mão para um do Mapa, sem renomeá-lo.
   *
   * É o que devolve oxalato, histamina e lectina a uma lista montada à mão.
   */
  ligarItemAoMapa(itemId: string, alimentoId: string): Promise<void>;
  desligarItemDoMapa(itemId: string): Promise<void>;
  registrarReintroducaoPorPaciente(
    pacienteId: string,
    registro: NovoRegistroDeReintroducao,
  ): Promise<void>;
  /** Liga ou desliga o módulo inteiro para aquela paciente. */
  definirRastreioDoPaciente(pacienteId: string, ativo: boolean): Promise<void>;
  /** Quem já está com o rastreio ligado, para a lista de pacientes. */
  rastreiosAtivos(): Promise<string[]>;
  adicionarItensReintroducao(pacienteId: string, alimentos: string[]): Promise<number>;
  adicionarItemLivreReintroducao(pacienteId: string, nome: string): Promise<void>;
  removerItemReintroducao(itemId: string): Promise<void>;
  definirStatusReintroducao(
    itemId: string,
    status: StatusReintroducao,
    nota?: string | null,
  ): Promise<void>;
  definirAcompanhamentoReintroducao(
    pacienteId: string,
    inicio: string | null,
    orientacao: string | null,
  ): Promise<void>;
  validarIndicacao(indicacaoId: string): Promise<void>;
  recusarIndicacao(indicacaoId: string, motivo?: string | null): Promise<void>;

  // ------------------------------------------------------- protocolo alimentar
  //
  // O app não calcula dieta: ela calcula fora e cola aqui. Por isso não há
  // método nenhum que some, converta ou estime — só guardar e mostrar.

  /** O protocolo publicado da paciente, ou nulo se ela ainda não recebeu. */
  meuProtocolo(): Promise<Protocolo | null>;

  // Área da nutricionista
  protocolosDasPacientes(): Promise<ResumoProtocolo[]>;
  protocoloDoPaciente(pacienteId: string): Promise<FichaProtocolo>;
  /** Salvar nunca publica: a paciente só vê quando ela mandar. */
  salvarRascunhoProtocolo(
    pacienteId: string,
    titulo: string,
    conteudo: ConteudoProtocolo,
    ajustes: string | null,
  ): Promise<void>;
  publicarProtocolo(pacienteId: string): Promise<void>;
  /** O recado da semana, que chega sem criar versão nova. */
  definirAjustesProtocolo(pacienteId: string, ajustes: string | null): Promise<void>;
  descartarRascunhoProtocolo(pacienteId: string): Promise<void>;
  /** Traz uma versão antiga de volta como rascunho, para ela conferir. */
  restaurarProtocolo(protocoloId: string): Promise<void>;

  /** Os grupos de alimentos dela — "Frutas", "Carboidratos do almoço". */
  listarGruposProtocolo(): Promise<GrupoDoProtocolo[]>;
  salvarGrupoProtocolo(
    id: string | null,
    nome: string,
    itens: GrupoDoProtocolo["itens"],
  ): Promise<void>;
  excluirGrupoProtocolo(id: string): Promise<void>;

  // --------------------------------------------------------- avaliação física
  //
  // O app guarda e mostra; quem calcula é ela, fora daqui.

  /** A última avaliação publicada da paciente, ou nulo. */
  minhaAvaliacao(): Promise<MinhaAvaliacao | null>;

  // Área da nutricionista
  avaliacoesDoPaciente(pacienteId: string): Promise<AvaliacaoFisica[]>;
  salvarAvaliacaoFisica(
    id: string | null,
    pacienteId: string,
    data: string,
    dados: DadosAvaliacao,
    publicada: boolean,
  ): Promise<void>;
  excluirAvaliacaoFisica(id: string): Promise<void>;
}

export const repositorio: Repositorio = MODO_DEMONSTRACAO ? repositorioLocal : repositorioSupabase;
