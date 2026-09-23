import type {
  AcaoAdmin,
  Alimento,
  AlimentoDoMaterial,
  CategoriaComerFora,
  Configuracoes,
  DesafioAdmin,
  Equivalencia,
  EventoHistorico,
  Favorito,
  Guia,
  IndicacaoPendente,
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
} from "@/central/types";
import type {
  Questionario,
  PerguntaQuestionario,
  PeriodicidadeQuestionario,
  MeuQuestionario,
  RespostaEnviada,
  QuestionarioDoPaciente,
} from "@/central/types/questionario";
import type { Fase, MudancaDeFase, MinhaFase } from "@/central/types/fase";
import type { Exame, EspacoDosExames } from "@/central/types/exame";
import { caminhoDoExame, porQueNaoServe, tipoPelaExtensao } from "@/central/utils/exames";
import type {
  PainelFinanceiro,
  ValorDoPaciente,
  Balanco,
  FormaDePagamento,
  Recebimento,
  Cobranca,
  SituacaoCobranca,
  StatusCobranca,
} from "@/central/types/financeiro";
import type { Consulta, ConsultaParaSalvar } from "@/central/types/consulta";
import type { Meta, MetaParaSalvar, StatusDaMeta } from "@/central/types/meta";
import type { OQueMudou } from "@/central/types/oQueMudou";
import type { PanoramaDoPaciente } from "@/central/types/panorama";
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
  AvaliacaoFisica,
  ConteudoProtocolo,
  DadosAvaliacao,
  FichaProtocolo,
  GrupoDoProtocolo,
  MinhaAvaliacao,
  Protocolo,
  ResumoProtocolo,
} from "@/central/types/protocolo";
import { CONTEUDO_VAZIO } from "@/central/types/protocolo";
import { semanaDoDesafio, situacaoDoDesafio, totalDeSemanas } from "@/central/utils/desafio";
import { exigirSupabase } from "@/central/supabase/cliente";
import { urlDaRota } from "@/central/utils/enderecos";
import {
  paraAlimento,
  paraCategoriaComerFora,
  paraConfiguracoes,
  paraEquivalencia,
  paraEvento,
  paraGrupo,
  paraGuia,
  paraPaciente,
  paraPlano,
  paraUnidade,
  numero,
  texto,
  textoOuNulo,
  paraQuestionario,
  paraMeuQuestionario,
  paraQuestionarioDoPaciente,
  type Linha,
} from "./mapeadores";
import type { AlteracaoPaciente, DadosCatalogo, Repositorio } from "./repositorio";

/**
 * A implementação de produção.
 *
 * Repare no que NÃO está aqui: nenhuma verificação de "esta pessoa pode ver
 * isto?". Não é esquecimento — é o desenho. Quem filtra é a política de
 * acesso do banco (0003_rls.sql). Uma consulta feita por paciente vencido
 * volta vazia porque o Postgres não entrega a linha, não porque o código
 * abaixo tenha lembrado de perguntar. É isso que faz o §34 do briefing valer
 * mesmo se alguém chamar a API por fora do app.
 */

function erro(contexto: string, e: { message: string } | null): void {
  if (e) throw new Error(`${contexto}: ${e.message}`);
}

export const repositorioSupabase: Repositorio = {
  async carregarCatalogo(): Promise<DadosCatalogo> {
    const sb = exigirSupabase();

    const [unidades, grupos, alimentos, equivalencias, conteudos, configuracoes] = await Promise.all([
      sb.from("unidades").select("*").eq("ativo", true).order("ordem"),
      sb.from("grupos_alimentares").select("*").eq("ativo", true).order("ordem"),
      sb.from("alimentos").select("*").order("nome"),
      sb.from("equivalencias").select("*"),
      sb.from("conteudos").select("*").order("ordem"),
      sb.from("configuracoes").select("*"),
    ]);

    erro("unidades", unidades.error);
    erro("grupos", grupos.error);
    erro("alimentos", alimentos.error);
    erro("equivalências", equivalencias.error);
    erro("conteúdos", conteudos.error);
    erro("configurações", configuracoes.error);

    const linhasConteudo = conteudos.data ?? [];

    return {
      unidades: (unidades.data ?? []).map(paraUnidade),
      grupos: (grupos.data ?? []).map(paraGrupo),
      alimentos: (alimentos.data ?? []).map(paraAlimento),
      equivalencias: (equivalencias.data ?? []).map(paraEquivalencia),
      categoriasComerFora: linhasConteudo
        .filter((l) => l.tipo === "comer_fora")
        .map(paraCategoriaComerFora),
      guias: linhasConteudo.filter((l) => l.tipo === "guia").map(paraGuia),
      configuracoes: paraConfiguracoes(configuracoes.data ?? []),
    };
  },

  async listarFavoritos(): Promise<Favorito[]> {
    const sb = exigirSupabase();
    const { data, error } = await sb
      .from("favoritos")
      .select("*")
      .order("criado_em", { ascending: false });
    erro("favoritos", error);
    return (data ?? []).map((l) => ({
      id: `${l.tipo}:${l.ref_id}`,
      tipo: l.tipo,
      refId: l.ref_id,
      titulo: l.titulo,
      subtitulo: l.subtitulo,
      rota: l.rota,
      salvoEm: l.criado_em,
    }));
  },

  async salvarFavorito(favorito) {
    const sb = exigirSupabase();
    const { data: sessao } = await sb.auth.getUser();
    if (!sessao.user) throw new Error("Sessão expirada.");
    const { error } = await sb.from("favoritos").insert({
      perfil_id: sessao.user.id,
      tipo: favorito.tipo,
      ref_id: favorito.refId,
      titulo: favorito.titulo,
      subtitulo: favorito.subtitulo,
      rota: favorito.rota,
    });
    erro("salvar favorito", error);
  },

  async removerFavorito(id) {
    const sb = exigirSupabase();
    const [tipo, ...resto] = id.split(":");
    const { error } = await sb
      .from("favoritos")
      .delete()
      .eq("tipo", tipo)
      .eq("ref_id", resto.join(":"));
    erro("remover favorito", error);
  },

  async listarPlanos(): Promise<Plano[]> {
    const sb = exigirSupabase();
    const { data, error } = await sb.from("planos").select("*").eq("ativo", true).order("ordem");
    erro("planos", error);
    return (data ?? []).map(paraPlano);
  },

  async listarPacientes(): Promise<Paciente[]> {
    const sb = exigirSupabase();
    const { data, error } = await sb.from("pacientes_visao").select("*").order("nome");
    erro("pacientes", error);
    return (data ?? []).map(paraPaciente);
  },

  async criarPaciente(dados: NovoPaciente): Promise<Paciente> {
    const sb = exigirSupabase();
    const { data, error } = await sb
      .from("pacientes")
      .insert({
        nome: dados.nome,
        email: dados.email.toLowerCase().trim(),
        telefone: dados.telefone ?? null,
        plano_id: dados.planoId,
        data_inicio: dados.dataInicio,
        data_fim: dados.dataFim,
        observacoes: dados.observacoes ?? null,
        condicao: dados.condicao.trim() || null,
      })
      .select()
      .single();
    erro("cadastrar paciente", error);
    return paraPaciente(data ?? {});
  },

  async alterarPaciente(id, alteracao: AlteracaoPaciente) {
    const sb = exigirSupabase();
    const linha: Record<string, unknown> = {};
    if (alteracao.nome !== undefined) linha.nome = alteracao.nome;
    if (alteracao.email !== undefined) linha.email = alteracao.email.toLowerCase().trim();
    if (alteracao.telefone !== undefined) linha.telefone = alteracao.telefone;
    if (alteracao.planoId !== undefined) linha.plano_id = alteracao.planoId;
    if (alteracao.dataInicio !== undefined) linha.data_inicio = alteracao.dataInicio;
    if (alteracao.dataFim !== undefined) linha.data_fim = alteracao.dataFim;
    if (alteracao.status !== undefined) linha.status = alteracao.status;
    if (alteracao.observacoes !== undefined) linha.observacoes = alteracao.observacoes;
    const { error } = await sb.from("pacientes").update(linha).eq("id", id);
    erro("alterar paciente", error);
  },

  async excluirPaciente(id) {
    const sb = exigirSupabase();
    const { error } = await sb.from("pacientes").delete().eq("id", id);
    erro("excluir paciente", error);
  },

  /**
   * Envia o convite e anota o envio.
   *
   * O e-mail sai pelo próprio Supabase Auth, por link mágico. Foi escolhido
   * assim porque `inviteUserByEmail` exige a chave de serviço, que não pode
   * existir no navegador de jeito nenhum (§64) — precisaria de um servidor
   * só para isso. O link mágico faz o mesmo trabalho com a chave pública.
   *
   * E continua valendo a regra central: receber o e-mail cria uma conta, não
   * cria acesso. O acesso vem da linha em `pacientes`, que só a nutricionista
   * escreve, e da validade do período.
   */
  async registrarConvite(pacienteId, email) {
    const sb = exigirSupabase();
    const { error: erroEnvio } = await sb.auth.signInWithOtp({
      email: email.toLowerCase().trim(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: urlDaRota("/definir-senha"),
      },
    });
    erro("enviar convite", erroEnvio);

    const { data: sessao } = await sb.auth.getUser();
    const { error } = await sb.from("convites").insert({
      paciente_id: pacienteId,
      email: email.toLowerCase().trim(),
      enviado_por: sessao.user?.id ?? null,
    });
    erro("registrar convite", error);
  },

  async historicoDoPaciente(pacienteId): Promise<EventoHistorico[]> {
    const sb = exigirSupabase();
    const { data, error } = await sb
      .from("historico_admin")
      .select("*")
      .eq("paciente_id", pacienteId)
      .order("criado_em", { ascending: false })
      .limit(50);
    erro("histórico", error);
    return (data ?? []).map(paraEvento);
  },

  async salvarAlimento(alimento: Alimento, ativo: boolean) {
    const sb = exigirSupabase();
    const { error } = await sb.from("alimentos").upsert({
      id: alimento.id,
      nome: alimento.nome,
      grupo_id: alimento.grupoId,
      unidade_base_id: alimento.unidadeBaseId,
      porcao_quantidade: alimento.porcao?.quantidade ?? null,
      porcao_unidade_id: alimento.porcao?.unidadeId ?? null,
      quantidade_livre: alimento.quantidadeLivre,
      medidas: alimento.medidas,
      sem_gluten: alimento.atributos.semGluten,
      sem_lactose: alimento.atributos.semLactose,
      tags: alimento.tags,
      imagem_url: alimento.imagem,
      observacao: alimento.observacao,
      ativo,
    });
    erro("salvar alimento", error);
  },

  async salvarEquivalencia(equivalencia: Equivalencia, ativo: boolean) {
    const sb = exigirSupabase();
    const { error } = await sb.from("equivalencias").upsert({
      id: equivalencia.id,
      origem_alimento_id: equivalencia.origemAlimentoId,
      destino_alimento_id: equivalencia.destinoAlimentoId,
      tipo: equivalencia.regra.tipo,
      regra: equivalencia.regra,
      bidirecional: equivalencia.bidirecional,
      fonte: equivalencia.fonte,
      observacao: equivalencia.observacao,
      ativo,
    });
    erro("salvar equivalência", error);
  },

  async salvarCategoriaComerFora(categoria: CategoriaComerFora) {
    const sb = exigirSupabase();
    const { error } = await sb.from("conteudos").upsert({
      id: categoria.id,
      tipo: "comer_fora",
      titulo: categoria.nome,
      resumo: categoria.resumo,
      icone: categoria.icone,
      ordem: categoria.ordem,
      status: categoria.status === "publicado" ? "publicado" : "rascunho",
      corpo: {
        introducao: categoria.introducao,
        decisoes: categoria.decisoes,
        lembretes: categoria.lembretes,
      },
      tags: categoria.tags,
      // Quem controla a visibilidade de conteúdo é `status`, não `ativo`.
      // Mandar explícito evita que um upsert deixe a coluna no valor padrão
      // por omissão e mude o que ninguém pediu para mudar.
      ativo: true,
    });
    erro("salvar categoria", error);
  },

  async salvarGuia(guia: Guia) {
    const sb = exigirSupabase();
    const { error } = await sb.from("conteudos").upsert({
      id: guia.id,
      tipo: "guia",
      titulo: guia.titulo,
      tema: guia.tema,
      resumo: guia.resumo,
      ordem: guia.ordem,
      status: guia.status === "publicado" ? "publicado" : "rascunho",
      corpo: { secoes: guia.secoes },
      tags: guia.tags,
      ativo: true,
    });
    erro("salvar guia", error);
  },

  async salvarConfiguracoes(configuracoes: Configuracoes) {
    const sb = exigirSupabase();
    const linhas = [
      { chave: "nome_central", valor: configuracoes.nomeCentral },
      { chave: "frase_home", valor: configuracoes.fraseHome },
      { chave: "lema", valor: configuracoes.lema },
      { chave: "comer_fora_introducao", valor: configuracoes.comerForaIntroducao },
      { chave: "whatsapp", valor: configuracoes.whatsapp },
      { chave: "nome_nutricionista", valor: configuracoes.nomeNutricionista },
      { chave: "alerta_vencimento_dias", valor: configuracoes.alertaVencimentoDias },
      { chave: "chave_pix", valor: configuracoes.chavePix },
      { chave: "cupons", valor: configuracoes.cupons },
    ];
    const { error } = await sb.from("configuracoes").upsert(linhas);
    erro("salvar configurações", error);
  },

  async registrarAcesso() {
    const sb = exigirSupabase();
    // Marcar presença não pode atrapalhar o uso do app: se falhar, segue.
    try {
      await sb.rpc("registrar_acesso");
    } catch {
      /* rede instável ou sessão trocando — o app continua igual */
    }
  },

  // ---------------------------------------------------------------- desafio

  async meuDesafio() {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("meu_desafio");
    erro("carregar o desafio", error);
    return (data ?? { temDesafio: false, saldoAcumulado: 0, recompensas: [] }) as MeuDesafio;
  },

  async enviarAcao(acaoId: string, observacao?: string | null) {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("enviar_acao", { p_acao: acaoId, p_observacao: observacao ?? null });
    erro("marcar a ação", error);
  },

  async cancelarEnvio(envioId: string) {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("cancelar_envio", { p_envio: envioId });
    erro("desfazer o envio", error);
  },

  async registrarIndicacao(nome: string, email?: string | null, telefone?: string | null) {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("registrar_indicacao", {
      p_nome: nome,
      p_email: email ?? null,
      p_telefone: telefone ?? null,
    });
    erro("registrar a indicação", error);
  },

  async listarDesafios() {
    const sb = exigirSupabase();
    const { data, error } = await sb
      .from("desafios")
      .select("*")
      .order("data_inicio", { ascending: false });
    erro("listar desafios", error);
    return (data ?? []).map((l: Linha) => ({
      id: texto(l.id),
      nome: texto(l.nome),
      descricao: textoOuNulo(l.descricao),
      lema: textoOuNulo(l.lema),
      regras: textoOuNulo(l.regras),
      dataInicio: texto(l.data_inicio),
      dataFim: texto(l.data_fim),
      status: (l.status as DesafioAdmin["status"]) ?? "rascunho",
      situacao: situacaoDoDesafio(texto(l.status), texto(l.data_inicio), texto(l.data_fim)),
      semanaAtual: semanaDoDesafio(texto(l.data_inicio), texto(l.data_fim)),
      totalDeSemanas: totalDeSemanas(texto(l.data_inicio), texto(l.data_fim)),
    }));
  },

  async salvarDesafio(desafio) {
    const sb = exigirSupabase();
    const linha = {
      nome: desafio.nome,
      descricao: desafio.descricao ?? null,
      lema: desafio.lema ?? null,
      regras: desafio.regras ?? null,
      data_inicio: desafio.dataInicio,
      data_fim: desafio.dataFim,
      status: desafio.status ?? "rascunho",
    };
    const { error } = desafio.id
      ? await sb.from("desafios").update(linha).eq("id", desafio.id)
      : await sb.from("desafios").insert(linha);
    erro("salvar o desafio", error);
  },

  async painelDoDesafio(desafioId: string) {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("painel_do_desafio", { p_desafio: desafioId });
    erro("carregar o painel do desafio", error);
    return data as PainelDoDesafio;
  },

  async rankingDoDesafio(desafioId: string) {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("ranking_do_desafio", { p_desafio: desafioId });
    erro("carregar o ranking", error);
    return (data ?? []).map((l: Linha) => ({
      posicao: numero(l.posicao),
      nome: texto(l.nome),
      pontos: numero(l.pontos),
      souEu: l.sou_eu === true,
    }));
  },

  async enviosPendentes(desafioId: string) {
    const sb = exigirSupabase();
    const { data, error } = await sb
      .from("desafio_envios")
      .select("id, semana, observacao, enviado_em, pacientes(nome), desafio_acoes(nome, pontos)")
      .eq("desafio_id", desafioId)
      .eq("status", "enviado")
      .order("enviado_em", { ascending: true });
    erro("listar pendências", error);
    return (data ?? []).map((l: Linha) => ({
      id: texto(l.id),
      pacienteNome: texto((l.pacientes as Linha | null)?.nome),
      acaoNome: texto((l.desafio_acoes as Linha | null)?.nome),
      pontos: numero((l.desafio_acoes as Linha | null)?.pontos),
      semana: l.semana === null ? null : numero(l.semana),
      observacao: textoOuNulo(l.observacao),
      enviadoEm: texto(l.enviado_em),
    }));
  },

  async aprovarEnvio(envioId: string) {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("aprovar_envio", { p_envio: envioId });
    erro("aprovar", error);
  },

  async recusarEnvio(envioId: string, motivo?: string | null) {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("recusar_envio", { p_envio: envioId, p_motivo: motivo ?? null });
    erro("recusar", error);
  },

  async acoesDoDesafio(desafioId: string) {
    const sb = exigirSupabase();
    const { data, error } = await sb
      .from("desafio_acoes")
      .select("id, chave, nome, pontos, periodicidade, max_por_semana, ativo")
      .eq("desafio_id", desafioId)
      .order("ordem", { ascending: true });
    erro("listar as ações do desafio", error);
    return (data ?? []).map((l: Linha) => ({
      id: texto(l.id),
      chave: texto(l.chave),
      nome: texto(l.nome),
      pontos: numero(l.pontos),
      periodicidade: (l.periodicidade as AcaoAdmin["periodicidade"]) ?? "semanal",
      maxPorSemana: l.max_por_semana === undefined ? 1 : numero(l.max_por_semana),
      ativo: l.ativo !== false,
    }));
  },

  async concederAcao(pacienteId: string, acaoId: string, semana?: number | null) {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("conceder_acao", {
      p_paciente: pacienteId,
      p_acao: acaoId,
      p_semana: semana ?? null,
    });
    erro("lançar a ação", error);
  },

  async ajustarPontos(pacienteId: string, pontos: number, motivo: string, desafioId?: string | null) {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("ajustar_pontos", {
      p_paciente: pacienteId,
      p_pontos: pontos,
      p_motivo: motivo,
      p_desafio: desafioId ?? null,
    });
    erro("ajustar pontos", error);
  },

  async listarIndicacoes() {
    const sb = exigirSupabase();
    const { data, error } = await sb
      .from("indicacoes")
      .select("id, nome_indicada, email_indicada, telefone_indicada, status, criado_em, pacientes!indicacoes_paciente_indicadora_id_fkey(nome)")
      .order("criado_em", { ascending: false });
    erro("listar indicações", error);
    return (data ?? []).map((l: Linha) => ({
      id: texto(l.id),
      indicadoraNome: texto((l.pacientes as Linha | null)?.nome),
      nomeIndicada: texto(l.nome_indicada),
      emailIndicada: textoOuNulo(l.email_indicada),
      telefoneIndicada: textoOuNulo(l.telefone_indicada),
      status: (l.status as IndicacaoPendente["status"]) ?? "registrada",
      criadoEm: texto(l.criado_em),
    }));
  },

  async resumoIndicacoes() {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("resumo_indicacoes");
    erro("carregar o resumo de indicações", error);
    return (data ?? []) as ResumoIndicacao[];
  },

  async validarIndicacao(indicacaoId: string) {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("validar_indicacao", { p_indicacao: indicacaoId });
    erro("validar a indicação", error);
  },

  async recusarIndicacao(indicacaoId: string, motivo?: string | null) {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("recusar_indicacao", {
      p_indicacao: indicacaoId,
      p_motivo: motivo ?? null,
    });
    erro("recusar a indicação", error);
  },
  // ------------------------------------------------- rastreabilidade alimentar

  async minhaReintroducao() {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("minha_reintroducao");
    erro("carregar a rastreabilidade", error);
    return data as Reintroducao;
  },

  async registrarReintroducao(registro: NovoRegistroDeReintroducao) {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("registrar_reintroducao", {
      p_item: registro.itemId ?? null,
      p_nome_novo: registro.nomeNovo ?? null,
      p_data: registro.data ?? null,
      p_horario: registro.horario ?? null,
      p_quantidade: registro.quantidade ?? null,
      p_preparo: registro.preparo ?? null,
      p_sintomas: registro.sintomas ?? [],
      p_intensidade: registro.intensidade ?? null,
      p_bristol: registro.bristol ?? null,
      p_observacao: registro.observacao ?? null,
    });
    erro("registrar o alimento", error);
  },

  async ligarItemAoMapa(itemId: string, alimentoId: string) {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("ligar_item_ao_mapa", {
      p_item: itemId,
      p_alimento: alimentoId,
    });
    erro("ligar o alimento ao Mapa", error);
  },

  async definirMarcacaoItem(itemId: string, marcacao: MarcadorDoAlimento[] | null) {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("definir_marcacao_item", {
      p_item: itemId,
      p_marcacao: marcacao,
    });
    erro("gravar a marcação", error);
  },

  async desligarItemDoMapa(itemId: string) {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("desligar_item_do_mapa", { p_item: itemId });
    erro("desfazer a ligação", error);
  },

  async registrarReintroducaoPorPaciente(
    pacienteId: string,
    registro: NovoRegistroDeReintroducao,
  ) {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("registrar_reintroducao_admin", {
      p_paciente: pacienteId,
      p_item: registro.itemId ?? null,
      p_nome_novo: registro.nomeNovo ?? null,
      p_alimento: registro.alimentoId ?? null,
      p_data: registro.data ?? null,
      p_horario: registro.horario ?? null,
      p_quantidade: registro.quantidade ?? null,
      p_preparo: registro.preparo ?? null,
      p_sintomas: registro.sintomas ?? [],
      p_intensidade: registro.intensidade ?? null,
      p_bristol: registro.bristol ?? null,
      p_observacao: registro.observacao ?? null,
    });
    erro("lançar o registro", error);
  },

  async editarRegistroReintroducao(registroId: string, registro: NovoRegistroDeReintroducao) {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("editar_registro_reintroducao", {
      p_registro: registroId,
      p_data: registro.data ?? null,
      p_horario: registro.horario ?? null,
      p_quantidade: registro.quantidade ?? null,
      p_preparo: registro.preparo ?? null,
      p_sintomas: registro.sintomas ?? [],
      p_intensidade: registro.intensidade ?? null,
      p_bristol: registro.bristol ?? null,
      p_observacao: registro.observacao ?? null,
    });
    erro("salvar o registro", error);
  },

  async excluirRegistroReintroducao(registroId: string) {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("excluir_registro_reintroducao", { p_registro: registroId });
    erro("apagar o registro", error);
  },

  async marcarRelevanciaReintroducao(itemId: string, relevante: boolean) {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("marcar_relevancia_reintroducao", {
      p_item: itemId,
      p_relevante: relevante,
    });
    erro("guardar essa escolha", error);
  },

  async listarAlimentosDoMaterial() {
    const sb = exigirSupabase();
    const { data, error } = await sb
      .from("reintroducao_alimentos")
      .select("id, nome, categoria, semana_sugerida, porcao_referencia, observacao")
      .eq("ativo", true)
      .order("ordem", { ascending: true });
    erro("carregar o material de reintrodução", error);
    return (data ?? []).map((l: Linha) => ({
      id: texto(l.id),
      nome: texto(l.nome),
      categoria: (l.categoria as AlimentoDoMaterial["categoria"]) ?? "outros",
      semanaSugerida: l.semana_sugerida === null ? null : numero(l.semana_sugerida),
      porcaoReferencia: textoOuNulo(l.porcao_referencia),
      observacao: textoOuNulo(l.observacao),
    }));
  },

  async reintroducaoDoPaciente(pacienteId: string) {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("reintroducao_do_paciente", { p_paciente: pacienteId });
    erro("carregar o acompanhamento", error);
    return data as Reintroducao;
  },

  async definirRastreioDoPaciente(pacienteId: string, ativo: boolean) {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("definir_rastreio_do_paciente", {
      p_paciente: pacienteId,
      p_ativo: ativo,
    });
    erro("salvar o rastreio", error);
  },

  async rastreiosAtivos() {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("rastreios_ativos");
    erro("carregar quem tem rastreio", error);
    return (data ?? []) as string[];
  },

  async adicionarItensReintroducao(pacienteId: string, alimentos: string[]) {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("adicionar_itens_reintroducao", {
      p_paciente: pacienteId,
      p_alimentos: alimentos,
    });
    erro("adicionar os alimentos", error);
    return numero(data);
  },

  async adicionarItemLivreReintroducao(pacienteId: string, nome: string) {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("adicionar_item_livre_reintroducao", {
      p_paciente: pacienteId,
      p_nome: nome,
    });
    erro("adicionar o alimento", error);
  },

  async removerItemReintroducao(itemId: string) {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("remover_item_reintroducao", { p_item: itemId });
    erro("tirar o alimento da lista", error);
  },

  async definirStatusReintroducao(itemId: string, status: StatusReintroducao, nota?: string | null) {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("definir_status_reintroducao", {
      p_item: itemId,
      p_status: status,
      p_nota: nota ?? null,
    });
    erro("salvar a classificação", error);
  },

  async definirAcompanhamentoReintroducao(
    pacienteId: string,
    inicio: string | null,
    orientacao: string | null,
  ) {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("definir_acompanhamento_reintroducao", {
      p_paciente: pacienteId,
      p_inicio: inicio,
      p_orientacao: orientacao,
    });
    erro("salvar o acompanhamento", error);
  },

  // ------------------------------------------------------- protocolo alimentar

  async meuProtocolo(): Promise<Protocolo | null> {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("meu_protocolo");
    erro("carregar seu protocolo", error);
    return paraProtocolo(data as Linha | null);
  },

  async protocolosDasPacientes(): Promise<ResumoProtocolo[]> {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("protocolos_das_pacientes");
    erro("carregar os protocolos", error);
    return ((data ?? []) as Linha[]).map((linha) => ({
      pacienteId: texto(linha.pacienteId),
      nome: texto(linha.nome),
      situacao: linha.situacao === "publicado" ? "publicado" : "sem",
      temRascunho: linha.temRascunho === true,
      publicadoEm: textoOuNulo(linha.publicadoEm),
    }));
  },

  async protocoloDoPaciente(pacienteId: string): Promise<FichaProtocolo> {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("protocolo_do_paciente", { p_paciente: pacienteId });
    erro("abrir o protocolo", error);
    const ficha = (data ?? {}) as Linha;
    return {
      rascunho: paraProtocolo(ficha.rascunho as Linha | null),
      publicado: paraProtocolo(ficha.publicado as Linha | null),
      historico: ((ficha.historico ?? []) as Linha[]).map((v) => ({
        id: texto(v.id),
        titulo: texto(v.titulo),
        versao: numero(v.versao),
        publicadoEm: textoOuNulo(v.publicadoEm),
        atualizadoEm: texto(v.atualizadoEm),
      })),
    };
  },

  async salvarRascunhoProtocolo(
    pacienteId: string,
    titulo: string,
    conteudo: ConteudoProtocolo,
    ajustes: string | null,
  ) {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("salvar_rascunho_protocolo", {
      p_paciente: pacienteId,
      p_titulo: titulo,
      p_conteudo: conteudo,
      p_ajustes: ajustes,
    });
    erro("salvar o rascunho", error);
  },

  async publicarProtocolo(pacienteId: string) {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("publicar_protocolo", { p_paciente: pacienteId });
    erro("publicar o protocolo", error);
  },

  async definirAjustesProtocolo(pacienteId: string, ajustes: string | null) {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("definir_ajustes_protocolo", {
      p_paciente: pacienteId,
      p_ajustes: ajustes,
    });
    erro("salvar os ajustes", error);
  },

  async descartarRascunhoProtocolo(pacienteId: string) {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("descartar_rascunho_protocolo", { p_paciente: pacienteId });
    erro("descartar o rascunho", error);
  },

  async restaurarProtocolo(protocoloId: string) {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("restaurar_protocolo", { p_protocolo: protocoloId });
    erro("restaurar a versão", error);
  },

  async listarGruposProtocolo(): Promise<GrupoDoProtocolo[]> {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("listar_grupos_protocolo");
    erro("carregar os grupos", error);
    return ((data ?? []) as Linha[]).map((g) => ({
      id: texto(g.id),
      nome: texto(g.nome),
      itens: ((g.itens ?? []) as Linha[]).map((i) => ({
        alimento: texto(i.alimento),
        quantidade: texto(i.quantidade),
      })),
    }));
  },

  async salvarGrupoProtocolo(id: string | null, nome: string, itens: GrupoDoProtocolo["itens"]) {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("salvar_grupo_protocolo", {
      p_id: id,
      p_nome: nome,
      p_itens: itens,
    });
    erro("salvar o grupo", error);
  },

  async excluirGrupoProtocolo(id: string) {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("excluir_grupo_protocolo", { p_id: id });
    erro("apagar o grupo", error);
  },

  async minhaAvaliacao(): Promise<MinhaAvaliacao | null> {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("minha_avaliacao");
    erro("carregar sua avaliação", error);
    if (!data) return null;
    const linha = data as Linha;
    return {
      id: texto(linha.id),
      data: texto(linha.data),
      dados: (linha.dados ?? {}) as DadosAvaliacao,
      total: numero(linha.total),
      inicio: textoOuNulo(linha.inicio),
      historico: ((linha.historico ?? []) as Linha[]).map((h) => ({
        id: texto(h.id),
        data: texto(h.data),
        dados: (h.dados ?? {}) as DadosAvaliacao,
      })),
    };
  },

  async avaliacoesDoPaciente(pacienteId: string): Promise<AvaliacaoFisica[]> {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("avaliacoes_do_paciente", { p_paciente: pacienteId });
    erro("carregar as avaliações", error);
    return ((data ?? []) as Linha[]).map((a) => ({
      id: texto(a.id),
      data: texto(a.data),
      dados: (a.dados ?? {}) as DadosAvaliacao,
      publicada: a.publicada === true,
    }));
  },

  async salvarAvaliacaoFisica(
    id: string | null,
    pacienteId: string,
    data: string,
    dados: DadosAvaliacao,
    publicada: boolean,
  ) {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("salvar_avaliacao_fisica", {
      p_id: id,
      p_paciente: pacienteId,
      p_data: data,
      p_dados: dados,
      p_publicada: publicada,
    });
    erro("salvar a avaliação", error);
  },

  async excluirAvaliacaoFisica(id: string) {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("excluir_avaliacao_fisica", { p_id: id });
    erro("apagar a avaliação", error);
  },

  // ------------------------------------------------------- evolução de treino

  async meuTreino(): Promise<Treino | null> {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("meu_treino");
    erro("carregar seu treino", error);
    return data ? lerTreino(data as Linha) : null;
  },

  async possoEscreverTreino(): Promise<PermissaoDeTreino> {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("posso_escrever_treino");
    erro("conferir se você pode escrever o treino", error);
    const linha = (data ?? {}) as Linha;
    return {
      // `=== true`, e não "o que vier": uma resposta estranha do banco tem
      // de cair para "não pode". O pior caso vira um botão que não aparece,
      // e não uma tela que promete salvar e não salva.
      pode: linha.pode === true,
      motivo: (textoOuNulo(linha.motivo) as PermissaoDeTreino["motivo"]) ?? null,
      meuTreinoId: textoOuNulo(linha.meuTreinoId),
    };
  },

  async sessoesDeTreino(pacienteId?: string | null): Promise<SessaoDeTreino[]> {
    const sb = exigirSupabase();
    // `p_paciente` nulo quer dizer "as minhas". Mandar o id de outra pessoa
    // sendo paciente é recusado pelo BANCO, não pela tela — e é isso que a
    // bateria 05 prova.
    const { data, error } = await sb.rpc("sessoes_de_treino", {
      p_paciente: pacienteId ?? null,
      p_limite: 200,
    });
    erro("carregar os treinos", error);
    return ((data ?? []) as Linha[]).map(lerSessao);
  },

  async registrarSessaoTreino(
    id: string | null,
    pacienteId: string | null,
    treinoId: string | null,
    data: string,
    observacao: string,
    series: SerieParaSalvar[],
  ) {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("registrar_sessao_treino", {
      p_id: id,
      p_paciente: pacienteId,
      p_treino: treinoId,
      p_data: data,
      p_observacao: observacao,
      p_series: series,
    });
    erro("registrar o treino", error);
  },

  async excluirSessaoTreino(id: string) {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("excluir_sessao_treino", { p_id: id });
    erro("apagar o treino", error);
  },

  async treinosDoPaciente(pacienteId: string): Promise<Treino[]> {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("treinos_do_paciente", { p_paciente: pacienteId });
    erro("carregar os treinos", error);
    return ((data ?? []) as Linha[]).map(lerTreino);
  },

  async treinoLiberado(pacienteId: string): Promise<boolean> {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("treino_liberado", { p_paciente: pacienteId });
    erro("conferir a área de treino", error);
    return data === true;
  },

  async acessosDoPaciente(pacienteId: string) {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("acessos_do_paciente", { p_paciente: pacienteId });
    erro("carregar os acessos", error);
    const l = (data ?? {}) as Linha;
    return {
      rastreio: l.rastreio === true,
      treino: l.treino === true,
      // O desafio nasce LIGADO: na dúvida, o estado que não muda nada para
      // quem já estava participando.
      desafio: l.desafio !== false,
      protocolo: l.protocolo === true,
      avaliacao: l.avaliacao === true,
      metas: l.metas === true,
    };
  },

  async definirDesafioDoPaciente(pacienteId: string, ativo: boolean): Promise<boolean> {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("definir_desafio_do_paciente", {
      p_paciente: pacienteId,
      p_ativo: ativo,
    });
    erro("liberar o desafio", error);
    return data !== false;
  },

  async definirTreinoDoPaciente(pacienteId: string, ativo: boolean): Promise<boolean> {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("definir_treino_do_paciente", {
      p_paciente: pacienteId,
      p_ativo: ativo,
    });
    erro("liberar a área de treino", error);
    return data === true;
  },

  async salvarTreino(
    id: string | null,
    pacienteId: string | null,
    nome: string,
    observacao: string,
    ativo: boolean,
    exercicios: ExercicioParaSalvar[],
  ) {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("salvar_treino", {
      p_id: id,
      p_paciente: pacienteId,
      p_nome: nome,
      p_observacao: observacao,
      p_ativo: ativo,
      p_exercicios: exercicios,
    });
    erro("salvar o treino", error);
  },

  async excluirTreino(id: string) {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("excluir_treino", { p_id: id });
    erro("apagar o treino", error);
  },

  // --------------------------------------------- panorama e consultas

  async panoramaDosPacientes(): Promise<PanoramaDoPaciente[]> {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("panorama_dos_pacientes", { p_dias: 28 });
    erro("carregar o panorama", error);
    return ((data ?? []) as Linha[]).map(lerPanorama);
  },

  async exportarTudo(): Promise<unknown> {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("exportar_tudo");
    erro("gerar o backup", error);
    return data;
  },

  async oQueMudou(): Promise<OQueMudou | null> {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("o_que_mudou");
    erro("carregar o seu resumo", error);
    if (!data) return null;
    const l = data as Linha;
    return {
      temMarco: l.temMarco === true,
      desde: textoOuNulo(l.desde),
      dias: numeroOuNulo(l.dias),
      proximaConsulta: textoOuNulo(l.proximaConsulta),
      pesoAntes: numeroOuNulo(l.pesoAntes),
      pesoAgora: numeroOuNulo(l.pesoAgora),
      marcacoesDeMeta: numeroOuNulo(l.marcacoesDeMeta) ?? 0,
      metasAtivas: numeroOuNulo(l.metasAtivas) ?? 0,
      registrosDeRastreio: numeroOuNulo(l.registrosDeRastreio) ?? 0,
      alimentosTestados: numeroOuNulo(l.alimentosTestados) ?? 0,
      // NULO continua nulo: é "a aba não está liberada", que é diferente
      // de "ela não treinou".
      treinos: numeroOuNulo(l.treinos),
      minutosDeCardio: numeroOuNulo(l.minutosDeCardio),
    };
  },

  async consultasDe(pacienteId: string): Promise<Consulta[]> {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("consultas_de", { p_paciente: pacienteId });
    erro("carregar as consultas", error);
    return ((data ?? []) as Linha[]).map(lerConsulta);
  },

  async salvarConsulta(id: string | null, pacienteId: string | null, dados: ConsultaParaSalvar) {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("salvar_consulta", {
      p_id: id,
      p_paciente: pacienteId,
      p_data: dados.data || null,
      // Hora em branco fica NULA, nunca "00:00": nulo quer dizer "ela só
      // marcou o dia", e meia-noite quer dizer meia-noite.
      p_hora: dados.hora || null,
      p_tipo: dados.tipo,
      p_status: dados.status,
      p_resumo: dados.resumo,
      p_observacoes: dados.observacoes,
    });
    erro("salvar a consulta", error);
  },

  async excluirConsulta(id: string) {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("excluir_consulta", { p_id: id });
    erro("apagar a consulta", error);
  },

  // ------------------------------------------------- metas do acompanhamento

  async metasDe(pacienteId?: string | null): Promise<Meta[]> {
    const sb = exigirSupabase();
    // `p_paciente` nulo quer dizer "as minhas". Mandar o id de outra pessoa
    // sendo paciente é recusado pelo BANCO, não pela tela.
    const { data, error } = await sb.rpc("metas_de", {
      p_paciente: pacienteId ?? null,
      p_dias: 120,
    });
    erro("carregar as metas", error);
    return ((data ?? []) as Linha[]).map(lerMeta);
  },

  async salvarMeta(id: string | null, pacienteId: string | null, dados: MetaParaSalvar) {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("salvar_meta", {
      p_id: id,
      p_paciente: pacienteId,
      p_titulo: dados.titulo,
      p_descricao: dados.descricao,
      p_categoria: dados.categoria,
      p_frequencia: dados.frequencia,
      // Campo em branco vira NULO, nunca zero: alvo zero seria uma meta que
      // nasce cumprida.
      p_alvo: numeroOuNuloDeTexto(dados.alvo),
      p_unidade: dados.unidade,
      p_inicio: dados.inicio || null,
      p_prazo: dados.prazo || null,
      p_status: dados.status,
    });
    erro("salvar a meta", error);
  },

  async definirStatusMeta(id: string, status: StatusDaMeta): Promise<StatusDaMeta> {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("definir_status_meta", { p_id: id, p_status: status });
    erro("mudar o status da meta", error);
    // O que voltou é o que ficou GRAVADO, não o que o clique pediu.
    return (texto(data) || status) as StatusDaMeta;
  },

  async excluirMeta(id: string) {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("excluir_meta", { p_id: id });
    erro("apagar a meta", error);
  },

  async registrarMeta(metaId: string, data: string, quantidade: string, observacao: string) {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("registrar_meta", {
      p_meta: metaId,
      p_data: data || null,
      p_quantidade: numeroOuNuloDeTexto(quantidade),
      p_observacao: observacao,
    });
    erro("marcar a meta", error);
  },

  async apagarRegistroMeta(id: string) {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("apagar_registro_meta", { p_id: id });
    erro("desmarcar", error);
  },

  // --------------------------------------------------------- cardio e metas

  async sessoesDeCardio(pacienteId?: string | null): Promise<CardioSessao[]> {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("sessoes_de_cardio", {
      p_paciente: pacienteId ?? null,
      p_limite: 200,
    });
    erro("carregar o cardio", error);
    return ((data ?? []) as Linha[]).map((c) => ({
      id: texto(c.id),
      data: texto(c.data),
      tipo: texto(c.tipo),
      duracaoMin: numeroOuNulo(c.duracaoMin),
      distanciaKm: numeroOuNulo(c.distanciaKm),
      intensidade: textoOuNulo(c.intensidade),
      observacao: textoOuNulo(c.observacao),
    }));
  },

  async registrarCardio(
    id: string | null,
    pacienteId: string | null,
    data: string,
    tipo: string,
    duracaoMin: string,
    distanciaKm: string,
    intensidade: string,
    observacao: string,
  ) {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("registrar_cardio", {
      p_id: id,
      p_paciente: pacienteId,
      p_data: data,
      p_tipo: tipo,
      // Campo em branco vai NULO, não zero: a bicicleta da academia não dá
      // distância, e zero diria que ela andou zero quilômetro.
      p_duracao: aNumero(duracaoMin),
      p_distancia: aNumero(distanciaKm),
      p_intensidade: intensidade,
      p_observacao: observacao,
    });
    erro("registrar o cardio", error);
  },

  async excluirCardio(id: string) {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("excluir_cardio", { p_id: id });
    erro("apagar o registro", error);
  },

  async metasSemanais(pacienteId?: string | null): Promise<MetaSemanal[]> {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("metas_semanais_de", {
      p_paciente: pacienteId ?? null,
      p_semanas: 12,
    });
    erro("carregar as metas", error);
    return ((data ?? []) as Linha[]).map((m) => ({
      id: texto(m.id),
      semanaInicio: texto(m.semanaInicio),
      tipo: m.tipo === "cardio" ? "cardio" : "treino",
      alvo: numeroOuNulo(m.alvo) ?? 0,
      unidade: texto(m.unidade),
    }));
  },

  async definirMetaSemanal(
    pacienteId: string,
    semana: string,
    tipo: TipoDeMeta,
    alvo: string,
    unidade: string,
  ) {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("definir_meta_semanal", {
      p_paciente: pacienteId,
      p_semana: semana,
      p_tipo: tipo,
      p_alvo: aNumero(alvo),
      p_unidade: unidade,
    });
    erro("definir a meta", error);
  },

  async excluirMetaSemanal(id: string) {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("excluir_meta_semanal", { p_id: id });
    erro("apagar a meta", error);
  },

  // ---------------------------------------------------------------------
  // Questionários e check-in semanal
  // ---------------------------------------------------------------------

  async listarQuestionarios(): Promise<Questionario[]> {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("listar_questionarios");
    erro("carregar os questionários", error);
    return ((data ?? []) as Linha[]).map(paraQuestionario);
  },

  async salvarQuestionario(
    id: string | null,
    titulo: string,
    descricao: string | null,
    periodicidade: PeriodicidadeQuestionario,
    ativo: boolean,
    perguntas: PerguntaQuestionario[],
  ): Promise<string> {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("salvar_questionario", {
      p_id: id,
      p_titulo: titulo,
      p_descricao: descricao,
      p_periodicidade: periodicidade,
      p_ativo: ativo,
      p_perguntas: perguntas.map((p) => ({
        // Pergunta nova vai sem id; o banco cria. Mandar string vazia faria
        // o `::uuid` estourar.
        id: p.id ?? null,
        texto: p.texto,
        tipo: p.tipo,
        obrigatoria: p.obrigatoria,
        opcoes: p.opcoes,
        peso: p.peso,
        invertida: p.invertida,
      })),
    });
    erro("salvar o questionário", error);
    return String(data);
  },

  async definirQuestionarioDoPaciente(
    questionarioId: string,
    pacienteId: string,
    ativo: boolean,
  ): Promise<boolean> {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("definir_questionario_do_paciente", {
      p_questionario: questionarioId,
      p_paciente: pacienteId,
      p_ativo: ativo,
    });
    erro("atribuir o questionário", error);
    return data === true;
  },

  async meusQuestionarios(): Promise<MeuQuestionario[]> {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("meus_questionarios");
    erro("carregar seus questionários", error);
    return ((data ?? []) as Linha[]).map(paraMeuQuestionario);
  },

  async responderQuestionario(questionarioId: string, respostas: RespostaEnviada[]) {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("responder_questionario", {
      p_questionario: questionarioId,
      p_respostas: respostas.map((r) => ({
        perguntaId: r.perguntaId,
        numero: r.numero,
        texto: r.texto,
      })),
    });
    erro("enviar suas respostas", error);
  },

  // ---------------------------------------------------------------------
  // Exames
  // ---------------------------------------------------------------------

  async enviarExame(
    pacienteId: string | null,
    arquivo: File,
    data: string | null,
    descricao: string | null,
  ): Promise<void> {
    const sb = exigirSupabase();

    const recusa = porQueNaoServe(arquivo);
    if (recusa) throw new Error(recusa);

    // De quem é a pasta. Para a paciente é sempre a dela — e o banco
    // confere de novo, porque esta conta é do lado do navegador.
    let dona = pacienteId;
    if (!dona) {
      const { data, error } = await sb.rpc("minha_pasta_de_exames");
      erro("descobrir sua pasta", error);
      dona = textoOuNulo(data);
    }
    if (!dona) throw new Error("Não encontrei o cadastro da paciente.");

    const caminho = caminhoDoExame(dona, arquivo.name);
    const tipo = arquivo.type || tipoPelaExtensao(arquivo.name);

    const { error: erroEnvio } = await sb.storage.from("exames").upload(caminho, arquivo, {
      contentType: tipo,
      // `false`: nunca sobrescrever. Sobrescrever exame seria perder exame.
      upsert: false,
    });
    erro("enviar o arquivo", erroEnvio);

    const { error: erroRegistro } = await sb.rpc("registrar_exame", {
      p_paciente: pacienteId,
      p_caminho: caminho,
      p_nome: arquivo.name,
      p_tipo: tipo,
      p_tamanho: arquivo.size,
      p_data: data,
      p_descricao: descricao,
    });

    if (erroRegistro) {
      // O arquivo subiu e a linha não gravou. Sem esta limpeza, o balde
      // acumularia arquivos que nenhuma tela mostra e ninguém consegue
      // apagar — lixo invisível ocupando um plano de 1 GB.
      await sb.storage.from("exames").remove([caminho]);
      erro("registrar o exame", erroRegistro);
    }
  },

  async examesDoPaciente(pacienteId: string): Promise<Exame[]> {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("exames_do_paciente", { p_paciente: pacienteId });
    erro("carregar os exames", error);
    return ((data ?? []) as Linha[]).map(paraExame);
  },

  async meusExames(): Promise<Exame[]> {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("meus_exames");
    erro("carregar seus exames", error);
    return ((data ?? []) as Linha[]).map(paraExame);
  },

  async enderecoDoExame(caminho: string): Promise<string> {
    const sb = exigirSupabase();
    // Cinco minutos: tempo de abrir e ler, e curto o bastante para um
    // endereço que vazou não valer nada amanhã.
    const { data, error } = await sb.storage.from("exames").createSignedUrl(caminho, 300);
    erro("abrir o arquivo", error);
    if (!data?.signedUrl) throw new Error("Não consegui abrir este arquivo.");
    return data.signedUrl;
  },

  async apagarExame(id: string): Promise<void> {
    const sb = exigirSupabase();
    // A função devolve o caminho JUSTAMENTE para o arquivo poder ir junto.
    const { data, error } = await sb.rpc("apagar_exame", { p_id: id });
    erro("apagar o exame", error);
    const caminho = texto(data);
    if (caminho) await sb.storage.from("exames").remove([caminho]);
  },

  async espacoDosExames(): Promise<EspacoDosExames> {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("espaco_dos_exames");
    erro("carregar o espaço", error);
    const l = (data ?? {}) as Linha;
    return {
      arquivos: numero(l.arquivos),
      bytes: numero(l.bytes),
      pacientesComExame: numero(l.pacientesComExame),
    };
  },

  // ---------------------------------------------------------------------
  // Fases do método
  // ---------------------------------------------------------------------

  async listarFases(): Promise<Fase[]> {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("listar_fases");
    erro("carregar as fases", error);
    return ((data ?? []) as Linha[]).map((l) => ({
      id: texto(l.id),
      nome: texto(l.nome),
      descricao: textoOuNulo(l.descricao),
      ordem: numero(l.ordem),
      ativa: l.ativa !== false,
      pacientes: numero(l.pacientes),
      temHistorico: l.temHistorico === true,
    }));
  },

  async salvarFase(
    id: string | null,
    nome: string,
    descricao: string | null,
    ordem: number,
    ativa: boolean,
  ): Promise<string> {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("salvar_fase", {
      p_id: id,
      p_nome: nome,
      p_descricao: descricao,
      p_ordem: ordem,
      p_ativa: ativa,
    });
    erro("salvar a fase", error);
    return texto(data);
  },

  async excluirFase(id: string): Promise<string> {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("excluir_fase", { p_id: id });
    erro("excluir a fase", error);
    return texto(data);
  },

  async moverDeFase(
    pacienteId: string,
    faseId: string,
    inicio: string | null,
    observacao: string | null,
  ): Promise<void> {
    const sb = exigirSupabase();
    const { error } = await sb.rpc("mover_de_fase", {
      p_paciente: pacienteId,
      p_fase: faseId,
      p_inicio: inicio,
      p_observacao: observacao,
    });
    erro("mudar a fase", error);
  },

  async apagarMudancaDeFase(id: string): Promise<boolean> {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("apagar_mudanca_de_fase", { p_id: id });
    erro("apagar a mudança", error);
    return data === true;
  },

  async fasesDoPaciente(pacienteId: string): Promise<MudancaDeFase[]> {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("fases_do_paciente", { p_paciente: pacienteId });
    erro("carregar o histórico de fases", error);
    return ((data ?? []) as Linha[]).map((l) => ({
      id: texto(l.id),
      faseId: texto(l.faseId),
      fase: texto(l.fase),
      inicio: texto(l.inicio),
      observacao: textoOuNulo(l.observacao),
    }));
  },

  async minhaFase(): Promise<MinhaFase> {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("minha_fase");
    erro("carregar sua fase", error);
    const l = (data ?? {}) as Linha;
    return {
      temFase: l.temFase === true,
      atualId: textoOuNulo(l.atualId) ?? undefined,
      desde: textoOuNulo(l.desde) ?? undefined,
      fases: (Array.isArray(l.fases) ? (l.fases as Linha[]) : []).map((f) => ({
        id: texto(f.id),
        nome: texto(f.nome),
        descricao: textoOuNulo(f.descricao),
        ordem: numero(f.ordem),
        atual: f.atual === true,
      })),
    };
  },

  async painelFinanceiro(desde: string | null): Promise<PainelFinanceiro> {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("painel_financeiro", { p_desde: desde });
    erro("carregar o financeiro", error);
    const l = (data ?? {}) as Linha;
    const totais = (l.totais ?? {}) as Linha;
    return {
      cobrancas: (Array.isArray(l.cobrancas) ? (l.cobrancas as Linha[]) : []).map(paraCobranca),
      totais: {
        aberto: numero(totais.aberto),
        atrasado: numero(totais.atrasado),
        recebidoNoMes: numero(totais.recebidoNoMes),
        previstoNoMes: numero(totais.previstoNoMes),
      },
    };
  },

  async valoresDosPacientes(): Promise<ValorDoPaciente[]> {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("valores_dos_pacientes");
    erro("carregar os valores", error);
    return ((data ?? []) as Linha[]).map((l) => ({
      id: texto(l.id),
      nome: texto(l.nome),
      telefone: textoOuNulo(l.telefone),
      situacao: texto(l.situacao),
      valorMensal: l.valorMensal === null || l.valorMensal === undefined ? null : numero(l.valorMensal),
      diaDeVencimento:
        l.diaDeVencimento === null || l.diaDeVencimento === undefined
          ? null
          : numero(l.diaDeVencimento),
    }));
  },

  async gerarCobrancas(competencia: string): Promise<number> {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("gerar_cobrancas", { p_competencia: competencia });
    erro("gerar as cobranças", error);
    return numero(data);
  },

  async baixarCobranca(id: string, paga: boolean, forma: string | null, pagoEm: string | null) {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("baixar_cobranca", {
      p_id: id,
      p_paga: paga,
      p_forma: forma,
      p_pago_em: pagoEm,
    });
    erro("dar baixa", error);
    return texto(data);
  },

  async cancelarCobranca(id: string): Promise<boolean> {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("cancelar_cobranca", { p_id: id });
    erro("cancelar a cobrança", error);
    return data === true;
  },

  async registrarLembreteCobranca(id: string) {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("registrar_lembrete_cobranca", { p_id: id });
    erro("registrar o lembrete", error);
    const l = (data ?? {}) as Linha;
    return { lembradaEm: texto(l.lembradaEm), lembretes: numero(l.lembretes) };
  },

  async definirValorDoPaciente(pacienteId: string, valor: number | null, dia: number | null) {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("definir_valor_do_paciente", {
      p_paciente: pacienteId,
      p_valor: valor,
      p_dia: dia,
    });
    erro("definir o valor", error);
    const l = (data ?? {}) as Linha;
    return {
      valor: l.valor === null || l.valor === undefined ? null : numero(l.valor),
      dia: l.dia === null || l.dia === undefined ? null : numero(l.dia),
    };
  },

  async balancoFinanceiro(meses: number): Promise<Balanco> {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("balanco_financeiro", { p_meses: meses });
    erro("carregar o balanço", error);
    const l = (data ?? {}) as Linha;
    const totais = (l.totais ?? {}) as Linha;
    return {
      meses: (Array.isArray(l.meses) ? (l.meses as Linha[]) : []).map((m) => ({
        mes: texto(m.mes),
        total: numero(m.total),
        entradas: numero(m.entradas),
      })),
      porForma: (Array.isArray(l.porForma) ? (l.porForma as Linha[]) : []).map((f) => ({
        forma: texto(f.forma) as FormaDePagamento,
        total: numero(f.total),
        entradas: numero(f.entradas),
      })),
      totais: {
        noPeriodo: numero(totais.noPeriodo),
        noMes: numero(totais.noMes),
        mesPassado: numero(totais.mesPassado),
        mediaMensal: numero(totais.mediaMensal),
      },
      recebimentos: (Array.isArray(l.recebimentos) ? (l.recebimentos as Linha[]) : []).map(
        paraRecebimento,
      ),
    };
  },

  async registrarRecebimento(
    id: string | null,
    pacienteId: string | null,
    descricao: string | null,
    valor: number,
    data: string | null,
    forma: FormaDePagamento,
    observacao: string | null,
  ): Promise<string> {
    const sb = exigirSupabase();
    const { data: resposta, error } = await sb.rpc("registrar_recebimento", {
      p_id: id,
      p_paciente: pacienteId,
      p_descricao: descricao,
      p_valor: valor,
      p_data: data,
      p_forma: forma,
      p_observacao: observacao,
    });
    erro("registrar o recebimento", error);
    return texto(resposta);
  },

  async apagarRecebimento(id: string): Promise<boolean> {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("apagar_recebimento", { p_id: id });
    erro("apagar o recebimento", error);
    return data === true;
  },

  async marcarRevisado(envioId: string, revisado: boolean): Promise<boolean> {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("marcar_revisado", {
      p_envio: envioId,
      p_revisado: revisado,
    });
    erro("marcar como revisado", error);
    return data === true;
  },

  async questionariosDoPaciente(pacienteId: string): Promise<QuestionarioDoPaciente[]> {
    const sb = exigirSupabase();
    const { data, error } = await sb.rpc("questionarios_do_paciente", {
      p_paciente: pacienteId,
    });
    erro("carregar as respostas", error);
    return ((data ?? []) as Linha[]).map(paraQuestionarioDoPaciente);
  },

};

/**
 * O que a tela digitou, virando número para o banco.
 *
 * Vírgula vira ponto — ela escreve "3,2 km", não "3.2". E campo em branco
 * vai NULO, nunca zero: os dois significam coisas diferentes, e o banco
 * guarda a diferença.
 */
function aNumero(v: string): number | null {
  const t = v.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Número ou nulo, NUNCA zero por engano.
 *
 * `Number(null)` é 0 em JavaScript. Passando por aqui, um exercício sem
 * carga viraria um exercício de zero quilo — e zero soma como peso numa
 * conta de volume, enquanto "não tem carga" não soma nada.
 */
function numeroOuNulo(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Texto de campo para número, ou nulo.
 *
 * Em branco é NULO e não zero — a regra de sempre. E vírgula vira ponto:
 * ela digita "1,5" porque é assim que se escreve em português, e
 * `Number("1,5")` é `NaN`.
 */
function numeroOuNuloDeTexto(v: string): number | null {
  const limpo = (v ?? "").trim().replace(",", ".");
  if (limpo === "") return null;
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

function lerConsulta(linha: Linha): Consulta {
  return {
    id: texto(linha.id),
    data: texto(linha.data),
    hora: textoOuNulo(linha.hora),
    tipo: linha.tipo === "primeira" ? "primeira" : "retorno",
    status: ["agendada", "concluida", "faltou", "cancelada"].includes(texto(linha.status))
      ? (texto(linha.status) as Consulta["status"])
      : "agendada",
    resumo: textoOuNulo(linha.resumo),
    observacoes: textoOuNulo(linha.observacoes),
  };
}

function lerPanorama(linha: Linha): PanoramaDoPaciente {
  const consulta = (v: unknown) => {
    const c = (v ?? null) as Linha | null;
    return c && c.data ? { data: texto(c.data), hora: textoOuNulo(c.hora), tipo: texto(c.tipo) } : null;
  };
  const ultima = (linha.ultimaConsulta ?? null) as Linha | null;

  return {
    id: texto(linha.id),
    nome: texto(linha.nome),
    email: texto(linha.email),
    condicao: textoOuNulo(linha.condicao),
    fase: textoOuNulo(linha.fase),
    faseDesde: textoOuNulo(linha.faseDesde),
    situacao: texto(linha.situacao) as PanoramaDoPaciente["situacao"],
    dataInicio: textoOuNulo(linha.dataInicio),
    dataFim: textoOuNulo(linha.dataFim),
    diasRestantes: numeroOuNulo(linha.diasRestantes),
    proximaConsulta: consulta(linha.proximaConsulta),
    ultimaConsulta:
      ultima && ultima.data
        ? { data: texto(ultima.data), tipo: texto(ultima.tipo), resumo: textoOuNulo(ultima.resumo) }
        : null,
    ultimoRegistro: textoOuNulo(linha.ultimoRegistro),
    pesoInicial: numeroOuNulo(linha.pesoInicial),
    pesoAtual: numeroOuNulo(linha.pesoAtual),
    metas: ((linha.metas ?? []) as Linha[]).map(lerMeta),
  };
}

function lerMeta(linha: Linha): Meta {
  return {
    id: texto(linha.id),
    titulo: texto(linha.titulo),
    descricao: textoOuNulo(linha.descricao),
    categoria: textoOuNulo(linha.categoria),
    frequencia: linha.frequencia === "semanal" ? "semanal" : "diaria",
    alvo: numeroOuNulo(linha.alvo),
    unidade: textoOuNulo(linha.unidade),
    inicio: texto(linha.inicio),
    prazo: textoOuNulo(linha.prazo),
    status: ["ativa", "pausada", "concluida", "cancelada"].includes(texto(linha.status))
      ? (texto(linha.status) as Meta["status"])
      : "ativa",
    registros: ((linha.registros ?? []) as Linha[]).map((r) => ({
      id: texto(r.id),
      data: texto(r.data),
      quantidade: numeroOuNulo(r.quantidade),
      observacao: textoOuNulo(r.observacao),
    })),
  };
}

function lerTreino(linha: Linha): Treino {
  return {
    id: texto(linha.id),
    nome: texto(linha.nome),
    observacao: textoOuNulo(linha.observacao),
    ativo: linha.ativo === true,
    // Sem `origem` na resposta — a lista da nutricionista antes da 0032 —
    // o treino é dela: é o que era verdade para tudo que já existia.
    origem: linha.origem === "paciente" ? "paciente" : "nutricionista",
    podeEditar: linha.podeEditar === true,
    exercicios: ((linha.exercicios ?? []) as Linha[]).map((e, i) => ({
      id: texto(e.id),
      nome: texto(e.nome),
      ordem: numeroOuNulo(e.ordem) ?? i,
      seriesPlanejadas: numeroOuNulo(e.seriesPlanejadas),
      repeticoesMin: numeroOuNulo(e.repeticoesMin),
      repeticoesMax: numeroOuNulo(e.repeticoesMax),
      observacao: textoOuNulo(e.observacao),
    })),
  };
}

function lerSessao(linha: Linha): SessaoDeTreino {
  return {
    id: texto(linha.id),
    data: texto(linha.data),
    treinoId: textoOuNulo(linha.treinoId),
    observacao: textoOuNulo(linha.observacao),
    series: ((linha.series ?? []) as Linha[]).map((s, i) => ({
      id: texto(s.id),
      exercicioId: textoOuNulo(s.exercicioId),
      exercicioNome: texto(s.exercicioNome),
      numero: numeroOuNulo(s.numero) ?? i + 1,
      carga: numeroOuNulo(s.carga),
      repeticoes: numeroOuNulo(s.repeticoes),
      observacao: textoOuNulo(s.observacao),
    })),
  };
}

/**
 * O banco devolve a linha inteira; a tela quer os nomes do app.
 *
 * O conteúdo vem como veio — é documento dela, e mexer nele aqui seria mudar
 * a dieta de alguém no meio do caminho.
 */
function paraProtocolo(linha: Linha | null | undefined): Protocolo | null {
  if (!linha) return null;
  return {
    id: texto(linha.id),
    pacienteId: texto(linha.paciente_id ?? ""),
    titulo: texto(linha.titulo),
    conteudo: (linha.conteudo as ConteudoProtocolo | null) ?? CONTEUDO_VAZIO,
    ajustes: textoOuNulo(linha.ajustes),
    situacao: (linha.situacao as Protocolo["situacao"]) ?? "rascunho",
    versao: numero(linha.versao),
    atualizadoEm: texto(linha.atualizado_em),
    publicadoEm: textoOuNulo(linha.publicado_em),
  };
}


function paraCobranca(l: Linha): Cobranca {
  return {
    id: texto(l.id),
    pacienteId: texto(l.pacienteId),
    paciente: texto(l.paciente),
    telefone: textoOuNulo(l.telefone),
    email: textoOuNulo(l.email),
    lembradaEm: textoOuNulo(l.lembradaEm),
    lembretes: numero(l.lembretes),
    competencia: texto(l.competencia),
    valor: numero(l.valor),
    vencimento: texto(l.vencimento),
    status: texto(l.status) as StatusCobranca,
    situacao: texto(l.situacao) as SituacaoCobranca,
    pagoEm: textoOuNulo(l.pagoEm),
    forma: textoOuNulo(l.forma),
    observacao: textoOuNulo(l.observacao),
  };
}


function paraExame(l: Linha): Exame {
  return {
    id: texto(l.id),
    caminho: texto(l.caminho),
    nome: texto(l.nome),
    tipo: texto(l.tipo),
    tamanho: numero(l.tamanho),
    data: textoOuNulo(l.data),
    descricao: textoOuNulo(l.descricao),
    origem: texto(l.origem) === "paciente" ? "paciente" : "nutricionista",
    criadoEm: texto(l.criadoEm),
  };
}


function paraRecebimento(l: Linha): Recebimento {
  return {
    id: texto(l.id),
    pacienteId: textoOuNulo(l.pacienteId),
    paciente: textoOuNulo(l.paciente),
    cobrancaId: textoOuNulo(l.cobrancaId),
    deCobranca: l.deCobranca === true,
    descricao: textoOuNulo(l.descricao),
    valor: numero(l.valor),
    data: texto(l.data),
    forma: texto(l.forma) as FormaDePagamento,
    observacao: textoOuNulo(l.observacao),
  };
}
