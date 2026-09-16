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
};
