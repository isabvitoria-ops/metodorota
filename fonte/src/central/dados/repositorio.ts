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
  MarcadorDoAlimento,
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
import type {
  CardioSessao,
  MetaSemanal,
  PermissaoDeTreino,
  TipoDeMeta,
  ExercicioParaSalvar,
  SerieParaSalvar,
  SessaoDeTreino,
  Treino,
} from "@/central/types/treino";
import type { Consulta, ConsultaParaSalvar } from "@/central/types/consulta";
import type { Meta, MetaParaSalvar, StatusDaMeta } from "@/central/types/meta";
import type { PanoramaDoPaciente } from "@/central/types/panorama";
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
  /**
   * A marcação que ela escreve à mão para um alimento daquela paciente.
   *
   * Para o que nenhuma tabela traz — produto de marca, receita de casa. `null`
   * apaga o que ela escreveu e devolve a vez à marcação do Mapa.
   */
  definirMarcacaoItem(itemId: string, marcacao: MarcadorDoAlimento[] | null): Promise<void>;
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

  // ------------------------------------------------------- evolução de treino
  //
  // O plano é dela; o registro do que foi feito é da paciente. O app não
  // prescreve treino, não sugere carga e não monta série.

  /** O treino ativo da paciente, com os exercícios. Nulo se não há. */
  meuTreino(): Promise<Treino | null>;

  /**
   * Se a paciente pode escrever o treino dela agora.
   *
   * "Eu escrevo o treino do paciente, ou então ele mesmo pode escrever." A
   * paciente escreve o DELA — nunca por cima do plano prescrito.
   */
  possoEscreverTreino(): Promise<PermissaoDeTreino>;

  /**
   * As sessões realizadas. Sem `pacienteId`, as da própria paciente; com
   * `pacienteId`, as daquela paciente — e aí só a nutricionista passa.
   */
  sessoesDeTreino(pacienteId?: string | null): Promise<SessaoDeTreino[]>;

  registrarSessaoTreino(
    id: string | null,
    pacienteId: string | null,
    treinoId: string | null,
    data: string,
    observacao: string,
    series: SerieParaSalvar[],
  ): Promise<void>;
  excluirSessaoTreino(id: string): Promise<void>;

  treinosDoPaciente(pacienteId: string): Promise<Treino[]>;

  /**
   * O interruptor da aba de treino, paciente a paciente — igual ao do
   * rastreio. Devolve o estado GRAVADO, não o que foi pedido: é o que deixa
   * a tela mostrar a verdade do banco em vez do palpite do clique.
   */
  treinoLiberado(pacienteId: string): Promise<boolean>;
  definirTreinoDoPaciente(pacienteId: string, ativo: boolean): Promise<boolean>;

  /**
   * Grava o plano inteiro de uma vez.
   *
   * `pacienteId` NULO quer dizer "o meu", e é o que a paciente manda. Ela
   * não escolhe de quem é o treino: o banco ignora esse campo para quem não
   * é a nutricionista, senão bastaria mandar o id de outra para escrever na
   * ficha dela.
   */
  salvarTreino(
    id: string | null,
    pacienteId: string | null,
    nome: string,
    observacao: string,
    ativo: boolean,
    exercicios: ExercicioParaSalvar[],
  ): Promise<void>;
  excluirTreino(id: string): Promise<void>;

  // --------------------------------------------- panorama e consultas
  //
  // A base da lista de pacientes e do prontuário. O banco devolve datas e
  // números; quem traduz em "retorno hoje" e "sem registro recente" é
  // `utils/panoramaPacientes.ts`, onde a régua tem teste.

  panoramaDosPacientes(): Promise<PanoramaDoPaciente[]>;

  /**
   * Uma cópia de tudo, para ela guardar.
   *
   * Numa função só, e não trinta consultas: um backup montado de trinta
   * idas ao banco pode pegar uma tabela antes de uma escrita e outra
   * depois, e gravar um arquivo internamente inconsistente.
   */
  exportarTudo(): Promise<unknown>;

  consultasDe(pacienteId: string): Promise<Consulta[]>;
  salvarConsulta(id: string | null, pacienteId: string | null, dados: ConsultaParaSalvar): Promise<void>;
  excluirConsulta(id: string): Promise<void>;

  // ------------------------------------------------- metas do acompanhamento
  //
  // A meta é decisão clínica: quem cria, edita, pausa e apaga é ela. A
  // paciente MARCA o que fez, e só na meta dela — e quem confere isso é o
  // banco, não a tela.

  /** Sem `pacienteId`, as da própria paciente. Com, as daquela paciente. */
  metasDe(pacienteId?: string | null): Promise<Meta[]>;

  salvarMeta(id: string | null, pacienteId: string | null, dados: MetaParaSalvar): Promise<void>;
  definirStatusMeta(id: string, status: StatusDaMeta): Promise<StatusDaMeta>;
  excluirMeta(id: string): Promise<void>;

  registrarMeta(
    metaId: string,
    data: string,
    quantidade: string,
    observacao: string,
  ): Promise<void>;
  apagarRegistroMeta(id: string): Promise<void>;

  // --------------------------------------------------------- cardio e metas
  //
  // O cardio é registro DELA (a paciente anda, a paciente anota). A meta é
  // decisão da PROFISSIONAL — o app não cria meta, não ajusta e não sugere.

  sessoesDeCardio(pacienteId?: string | null): Promise<CardioSessao[]>;
  registrarCardio(
    id: string | null,
    pacienteId: string | null,
    data: string,
    tipo: string,
    duracaoMin: string,
    distanciaKm: string,
    intensidade: string,
    observacao: string,
  ): Promise<void>;
  excluirCardio(id: string): Promise<void>;

  /** As metas. Sem `pacienteId`, as de quem chamou. */
  metasSemanais(pacienteId?: string | null): Promise<MetaSemanal[]>;

  // Área da nutricionista
  definirMetaSemanal(
    pacienteId: string,
    semana: string,
    tipo: TipoDeMeta,
    alvo: string,
    unidade: string,
  ): Promise<void>;
  excluirMetaSemanal(id: string): Promise<void>;
}

export const repositorio: Repositorio = MODO_DEMONSTRACAO ? repositorioLocal : repositorioSupabase;
