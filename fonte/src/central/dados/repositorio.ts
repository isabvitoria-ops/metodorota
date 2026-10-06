import type { EstadoDoTermo, PedidoLgpd, SituacaoDosAceites, TermoDeUso } from "@/central/types";
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
  MesDaMinhaEvolucao,
  MesDoHistorico,
  IndicacaoPendente,
  LimpezaDePontos,
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
import type {
  Questionario,
  PerguntaQuestionario,
  PeriodicidadeQuestionario,
  MeuQuestionario,
  RespostaEnviada,
  QuestionarioDoPaciente,
  EixoCheckin,
  AlertaParaPaciente,
  AlertaPendente,
  CheckinPendente,
} from "@/central/types/questionario";
import type { Fase, MudancaDeFase, MinhaFase } from "@/central/types/fase";
import type { Exame, EspacoDosExames } from "@/central/types/exame";
import type {
  FonteDoCerebro,
  PendenciasDoCerebro,
  SugestaoDoCerebro,
  TrechoCitado,
} from "@/central/types/cerebro";
import type {
  PainelFinanceiro,
  ValorDoPaciente,
  Balanco,
  FormaDePagamento,
  MetricasDeAcompanhamento,
} from "@/central/types/financeiro";
import type { Consulta, ConsultaParaSalvar } from "@/central/types/consulta";
import type { Meta, MetaParaSalvar, StatusDaMeta } from "@/central/types/meta";
import type { OQueMudou } from "@/central/types/oQueMudou";
import type { FotoDoDiario, RefeicaoDoDiario } from "@/central/types/diarioDeFotos";
import type { MensagemDaRefeicao, ResumoDaConversa } from "@/central/types/conversaDaRefeicao";
import type {
  Conduta,
  CondutaPendente,
  EtapaDoModelo,
  ModeloDeConduta,
  StatusDaConduta,
  TarefaParaAplicar,
} from "@/central/types/conduta";
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

  /** Cria o desafio do mês se ainda não houver (0060). Idempotente; nunca lança. */
  garantirDesafioDoMes(): Promise<void>;
  /** Tudo que a tela do desafio mostra, numa chamada só. */
  meuDesafio(): Promise<MeuDesafio>;
  /** "Eu fiz isso." Nasce pendente, sempre. */
  enviarAcao(acaoId: string, observacao?: string | null): Promise<void>;
  /** Desfaz o próprio envio, enquanto não foi conferido. */
  cancelarEnvio(envioId: string): Promise<void>;
  registrarIndicacao(nome: string, email?: string | null, telefone?: string | null): Promise<void>;
  /** A nutricionista registra a indicação POR uma paciente (0061). Devolve o id. */
  registrarIndicacaoPor(
    pacienteId: string,
    nome: string,
    email?: string | null,
    telefone?: string | null,
  ): Promise<string>;
  /**
   * Mostra (`confirmar` falso) ou faz (verdadeiro) a limpeza dos pontos de mais
   * de 3 meses atrás. As linhas vão para um arquivo antes de saírem do saldo.
   */
  limparPontosAntigos(confirmar: boolean): Promise<LimpezaDePontos>;

  // Área da nutricionista
  listarDesafios(): Promise<DesafioAdmin[]>;
  salvarDesafio(desafio: Partial<DesafioAdmin> & { nome: string; dataInicio: string; dataFim: string }): Promise<void>;
  painelDoDesafio(desafioId: string): Promise<PainelDoDesafio>;
  rankingDoDesafio(desafioId: string): Promise<LinhaDoRanking[]>;
  /**
   * O placar de cada mês (o atual e os `meses` anteriores), para a nutricionista
   * dar os presentes no começo do mês (0059). Lê o livro de pontos: nada é
   * guardado a mais e nada é apagado.
   */
  historicoMensalDePontos(meses?: number): Promise<MesDoHistorico[]>;
  /** A minha evolução mês a mês, para a paciente. Vazio se nunca pontuou. */
  meuHistoricoDePontos(): Promise<MesDaMinhaEvolucao[]>;
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

  /** Os interruptores e os estados de uma paciente, numa ida só. */
  acessosDoPaciente(pacienteId: string): Promise<{
    rastreio: boolean;
    treino: boolean;
    desafio: boolean;
    protocolo: boolean;
    avaliacao: boolean;
    metas: boolean;
  }>;
  definirDesafioDoPaciente(pacienteId: string, ativo: boolean): Promise<boolean>;
  definirTreinoDoPaciente(pacienteId: string, ativo: boolean): Promise<boolean>;

  // ---------------------------------------------------------------------
  // Questionários e check-in semanal
  // ---------------------------------------------------------------------

  /** Os questionários dela, com perguntas e quantas pacientes respondem. */
  listarQuestionarios(): Promise<Questionario[]>;

  /**
   * Grava o questionário inteiro, perguntas incluídas.
   *
   * `id` nulo cria. As perguntas são regravadas por completo, como o
   * protocolo — mas as JÁ RESPONDIDAS não são apagadas mesmo saindo da
   * lista: apagar a pergunta levaria a resposta em cascata.
   */
  salvarQuestionario(
    id: string | null,
    titulo: string,
    descricao: string | null,
    periodicidade: PeriodicidadeQuestionario,
    ativo: boolean,
    perguntas: PerguntaQuestionario[],
    mostraPontuacao: boolean,
  ): Promise<string>;

  /** Os eixos do check-in (lista gerenciável). */
  listarEixosCheckin(): Promise<EixoCheckin[]>;

  /** Grava a lista inteira de eixos. Devolve a lista já normalizada. */
  salvarEixosCheckin(eixos: { id: string | null; nome: string }[]): Promise<EixoCheckin[]>;

  /**
   * Refotografa a régua atual nos envios de uma paciente naquele
   * questionário — a saída de emergência para "aplicar o novo peso para
   * trás". Devolve quantos envios foram refotografados.
   */
  reaplicarRegua(questionarioId: string, pacienteId: string): Promise<number>;

  /** Liga ou desliga um questionário para uma paciente. */
  definirQuestionarioDoPaciente(
    questionarioId: string,
    pacienteId: string,
    ativo: boolean,
  ): Promise<boolean>;

  /** O que a paciente tem em aberto e o que já respondeu. */
  meusQuestionarios(): Promise<MeuQuestionario[]>;

  /**
   * A paciente responde.
   *
   * O PERÍODO NÃO VAI DAQUI — quem decide a que semana a resposta pertence
   * é o banco, a partir da data de hoje. Mandar o período daqui deixaria
   * reescrever semana passada.
   */
  responderQuestionario(questionarioId: string, respostas: RespostaEnviada[]): Promise<AlertaParaPaciente[]>;

  /**
   * Marca um check-in como lido. Devolve o estado GRAVADO.
   *
   * A marca é dela: a paciente não vê e não é avisada. Um "visto" visível
   * criaria expectativa de resposta que o aplicativo não promete.
   */
  marcarRevisado(envioId: string, revisado: boolean): Promise<boolean>;

  listarAlertasPendentes(): Promise<AlertaPendente[]>;
  atualizarAlerta(alertaId: string, status: string, nota?: string | null): Promise<void>;

  /** Pacientes que ainda não responderam o check-in semanal desta semana. */
  listarCheckinPendentes(): Promise<CheckinPendente[]>;

  // ---------------------------------------------------------------------
  // Exames
  // ---------------------------------------------------------------------

  /**
   * Envia o arquivo ao balde privado e registra o exame.
   *
   * `pacienteId` nulo quer dizer "eu", e é o que a paciente manda. O banco
   * ignora o id que vem da tela quando é ela quem envia.
   */
  enviarExame(
    pacienteId: string | null,
    arquivo: File,
    data: string | null,
    descricao: string | null,
  ): Promise<void>;

  /** Os exames de uma paciente, para a nutricionista. */
  examesDoPaciente(pacienteId: string): Promise<Exame[]>;

  /** Os meus exames, para a paciente. */
  meusExames(): Promise<Exame[]>;

  /**
   * Um endereço temporário para abrir o arquivo.
   *
   * O balde é privado: não existe endereço permanente, e é assim de
   * propósito — endereço de arquivo vaza em print e em encaminhamento.
   */
  enderecoDoExame(caminho: string): Promise<string>;

  /** Apaga a linha E o arquivo. Linha sem arquivo deixaria lixo ocupando espaço. */
  apagarExame(id: string): Promise<void>;

  espacoDosExames(): Promise<EspacoDosExames>;

  // ---------------------------------------------------------------------
  // Fases do método
  // ---------------------------------------------------------------------

  /** As fases dela, com quantas pacientes estão em cada uma agora. */
  listarFases(): Promise<Fase[]>;

  salvarFase(
    id: string | null,
    nome: string,
    descricao: string | null,
    ordem: number,
    ativa: boolean,
  ): Promise<string>;

  /**
   * Apaga a fase — ou desativa, se alguém já passou por ela.
   *
   * Devolve "apagada" ou "desativada", para a tela dizer o que aconteceu de
   * verdade em vez de supor.
   */
  excluirFase(id: string): Promise<string>;

  /**
   * Move a paciente para uma fase, gravando uma LINHA NOVA.
   *
   * Mover é evento com data, não edição de campo — é isso que deixa
   * responder "quanto tempo ela ficou na restrição" seis meses depois.
   */
  moverDeFase(
    pacienteId: string,
    faseId: string,
    inicio: string | null,
    observacao: string | null,
  ): Promise<void>;

  apagarMudancaDeFase(id: string): Promise<boolean>;

  /** Por onde a paciente passou, para o prontuário. */
  fasesDoPaciente(pacienteId: string): Promise<MudancaDeFase[]>;

  /** O caminho inteiro com o ponto dela marcado — para a própria paciente. */
  minhaFase(): Promise<MinhaFase>;

  // ---------------------------------------------------------------------
  // Cobrança
  // ---------------------------------------------------------------------

  /** As cobranças e os totais, numa ida só. */
  painelFinanceiro(desde: string | null): Promise<PainelFinanceiro>;

  /** Quanto cada paciente paga, para a tela poder mudar. */
  valoresDosPacientes(): Promise<ValorDoPaciente[]>;

  /**
   * Gera as cobranças do mês para quem tem valor combinado.
   *
   * Apertar duas vezes no mesmo mês não duplica — e ela vai apertar de novo
   * só para conferir. Devolve quantas foram criadas.
   */
  gerarCobrancas(competencia: string): Promise<number>;

  /** Marca como paga, ou desfaz. Devolve o status GRAVADO. */
  baixarCobranca(
    id: string,
    paga: boolean,
    forma: string | null,
    pagoEm: string | null,
  ): Promise<string>;

  /** Cancelar não apaga: a linha continua, com status cancelada. */
  cancelarCobranca(id: string): Promise<boolean>;

  /**
   * Anota que o botão "Cobrar" foi apertado. Só em cobrança em aberto.
   * É o registro do CLIQUE: quem aperta enviar no WhatsApp é ela.
   */
  registrarLembreteCobranca(id: string): Promise<{ lembradaEm: string; lembretes: number }>;

  definirValorDoPaciente(
    pacienteId: string,
    valor: number | null,
    dia: number | null,
  ): Promise<{ valor: number | null; dia: number | null }>;

  /**
   * O balanço: meses, formas de pagamento e o livro-caixa.
   *
   * O dinheiro vem TODO daqui. Baixa de cobrança já entra no caixa, então
   * não existe soma paralela a fazer na tela — contar duas vezes é
   * impossível por construção.
   */
  balancoFinanceiro(meses: number): Promise<Balanco>;

  /** Ativas, ticket médio e permanência média — calculadas na hora (0056). */
  metricasDeAcompanhamento(): Promise<MetricasDeAcompanhamento>;

  // ---------------------------------------------------------------------
  // Diário de fotos (0057)
  // ---------------------------------------------------------------------

  /** A paciente manda a foto da refeição (já reduzida) e registra. */
  enviarFotoDoDiario(
    foto: Blob,
    refeicao: RefeicaoDoDiario,
    legenda: string | null,
    data: string | null,
  ): Promise<void>;
  /** As minhas fotos, para a paciente. */
  meuDiario(): Promise<FotoDoDiario[]>;
  /** O diário de uma paciente, para a nutricionista. */
  diarioDoPaciente(pacienteId: string): Promise<FotoDoDiario[]>;
  /** Endereço temporário para mostrar a foto (o balde é privado). */
  enderecoDaFoto(caminho: string): Promise<string>;
  /** Só a nutricionista curte. Devolve o estado que ficou gravado. */
  curtirFoto(id: string, curtida: boolean): Promise<boolean>;
  apagarFotoDoDiario(id: string): Promise<void>;

  // ---------------------------------------------------------------------
  // Conversa por refeição (0058)
  // ---------------------------------------------------------------------
  //
  // `pacienteId` nulo = sou a paciente (a conversa é a minha). Preenchido = é
  // a nutricionista, escrevendo na conversa daquela paciente.

  enviarMensagemDeRefeicao(pacienteId: string | null, refeicao: string, texto: string): Promise<void>;
  conversaDaRefeicao(pacienteId: string | null, refeicao: string): Promise<MensagemDaRefeicao[]>;
  /** Marca como lidas as mensagens da outra ponta. */
  marcarConversaLida(pacienteId: string | null, refeicao: string): Promise<void>;
  resumoDasConversas(pacienteId: string | null): Promise<ResumoDaConversa[]>;

  /** Registra ou edita uma entrada avulsa (PIX, cartão, transferência…). */
  registrarRecebimento(
    id: string | null,
    pacienteId: string | null,
    descricao: string | null,
    valor: number,
    data: string | null,
    forma: FormaDePagamento,
    observacao: string | null,
  ): Promise<string>;

  /** Apaga uma entrada avulsa. A que veio de cobrança sai desfazendo a baixa. */
  apagarRecebimento(id: string): Promise<boolean>;

  /** As respostas de uma paciente, para a nutricionista ler. */
  questionariosDoPaciente(pacienteId: string): Promise<QuestionarioDoPaciente[]>;

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

  /**
   * O resumo do período desde a última consulta — da própria paciente.
   *
   * Sem parâmetro de propósito: não há id para mandar errado. O banco
   * resolve de quem é pelo `meu_paciente_id()`.
   */
  oQueMudou(): Promise<OQueMudou | null>;

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

  // ---------------------------------------------------------------------
  // Cérebro do Nutri (base de conhecimento privada)
  // ---------------------------------------------------------------------
  //
  // A caixa fechada da nutricionista. TUDO admin. A paciente nunca alcança
  // nada, e essa é a única regra que precisa valer.

  /** Todas as fontes que ela guardou. */
  fontesDoCerebro(): Promise<FonteDoCerebro[]>;

  /**
   * Envia um PDF (opcional) e registra a fonte com o texto já extraído no
   * cliente. Trechos vão em uma segunda chamada, para que reprocessar não
   * dependa de reenviar o arquivo.
   */
  registrarFonte(dados: {
    titulo: string;
    fonte: string | null;
    tipo: "pdf" | "texto";
    arquivo: File | null;
    conteudo: string;
  }): Promise<string>;

  /** Substitui os trechos daquela fonte. Repetir a chamada não duplica. */
  salvarTrechos(
    fonteId: string,
    trechos: { ordem: number; trecho: string; embedding?: number[] }[],
  ): Promise<number>;

  /** Apaga a fonte, os trechos (cascata) e o PDF do balde, se houver. */
  apagarFonte(fonteId: string): Promise<void>;

  /**
   * Busca no Cérebro. Sem embedding, cai em busca textual — o Cérebro
   * funciona antes de contratar a chave de embeddings.
   */
  buscarNoCerebro(pergunta: string, embedding?: number[] | null): Promise<TrechoCitado[]>;

  /** Quanto ainda falta indexar. */
  pendenciasDoCerebro(): Promise<PendenciasDoCerebro>;

  /** Registra uma pergunta feita sobre uma paciente. */
  registrarSugestao(
    pacienteId: string,
    pergunta: string,
    resposta: string | null,
    citacoes: TrechoCitado[],
  ): Promise<string>;

  /** Fecha o laço: aceita, edita ou rejeita. */
  darFeedbackSugestao(
    sugestaoId: string,
    feedback: "aceita" | "editada" | "rejeitada",
    condutaFinal: string | null,
    motivo: string | null,
  ): Promise<void>;

  /** Histórico de sugestões de uma paciente, para a ficha. */
  sugestoesDoPaciente(pacienteId: string): Promise<SugestaoDoCerebro[]>;

  // ---------------------------------------------------------------------
  // Condutas em Kanban (0055) — só da nutricionista
  // ---------------------------------------------------------------------

  /** A biblioteca de modelos ("Protocolo SIBO", "Primeira consulta"…). */
  listarModelosConduta(): Promise<ModeloDeConduta[]>;
  /** Cria (id null) ou regrava o modelo inteiro, etapas incluídas. */
  salvarModeloConduta(
    id: string | null,
    nome: string,
    descricao: string | null,
    etapas: EtapaDoModelo[],
  ): Promise<string>;
  /** Apaga o modelo. O que já foi aplicado fica. */
  excluirModeloConduta(id: string): Promise<void>;
  /** Grava as tarefas com as datas que ela confirmou. Devolve quantas. */
  aplicarModeloConduta(
    pacienteId: string,
    modeloId: string | null,
    tarefas: TarefaParaAplicar[],
  ): Promise<number>;
  condutasDe(pacienteId: string): Promise<Conduta[]>;
  salvarConduta(
    id: string | null,
    pacienteId: string,
    titulo: string,
    descricao: string | null,
    prazo: string | null,
    status: StatusDaConduta,
  ): Promise<string>;
  moverConduta(id: string, status: StatusDaConduta): Promise<void>;
  excluirConduta(id: string): Promise<void>;
  /** Tudo o que não está concluído, de todas as pacientes. */
  condutasPendentes(): Promise<CondutaPendente[]>;

  // ---------------------------------------------------------------------
  // Termo de uso, privacidade e direitos (LGPD) — 0063
  // ---------------------------------------------------------------------

  /** A versão atual do termo. Abre sem login. */
  lerTermo(): Promise<TermoDeUso>;
  /** Se quem está usando já aceitou a versão atual. */
  meuTermo(): Promise<EstadoDoTermo>;
  aceitarTermo(versao: number): Promise<EstadoDoTermo>;
  /** Publica texto novo (sobe a versão e todas aceitam de novo). */
  publicarTermo(texto: string): Promise<{ versao: number; mudou: boolean }>;
  situacaoDosAceites(): Promise<SituacaoDosAceites>;
  /** A cópia dos dados da própria paciente (sem as anotações clínicas). */
  exportarMeusDados(): Promise<unknown>;
  /** A ficha completa, para a nutricionista entregar a pedido formal. */
  exportarFichaCompleta(pacienteId: string): Promise<unknown>;
  pedirExclusaoDosMeusDados(motivo: string | null): Promise<void>;
  /** Os pedidos da própria paciente (ela vê se já foi atendido). */
  meusPedidosLgpd(): Promise<PedidoLgpd[]>;
  /** Todos os pedidos, para a nutricionista. */
  pedidosLgpd(): Promise<PedidoLgpd[]>;
  atenderPedidoLgpd(id: string): Promise<void>;
  /** Marca que a paciente já viu as boas-vindas (uma vez só, para sempre). */
  concluirBoasVindas(): Promise<void>;
}

export const repositorio: Repositorio = MODO_DEMONSTRACAO ? repositorioLocal : repositorioSupabase;
