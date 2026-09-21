import type {
  AcaoAdmin,
  AcaoDoDesafio,
  AlimentoDoMaterial,
  Alimento,
  CategoriaComerFora,
  Configuracoes,
  DesafioAdmin,
  EnvioPendente,
  Equivalencia,
  EventoHistorico,
  Favorito,
  Guia,
  IndicacaoPendente,
  LinhaDoRanking,
  MeuDesafio,
  NovoPaciente,
  NovoRegistroDeReintroducao,
  Paciente,
  Plano,
  MarcadorDoAlimento,
  Reintroducao,
  RegistroDeReintroducao,
  ItemDeReintroducao,
  ResumoIndicacao,
  StatusReintroducao,
} from "@/central/types";
import {
  semanaDoDesafio,
  situacaoDoDesafio,
  totalDeSemanas,
} from "@/central/utils/desafio";
import { armazenamentoLocal } from "@/central/utils/armazenamento";
import { calcularSituacao, diasEntre, hojeSaoPaulo } from "@/central/utils/situacao";
import { UNIDADES } from "./sementes/unidades";
import { GRUPOS } from "./sementes/grupos";
import { ALIMENTOS } from "./sementes/alimentos";
import { EQUIVALENCIAS } from "./sementes/equivalencias";
import { CATEGORIAS_COMER_FORA } from "./sementes/comerFora";
import { GUIAS } from "./sementes/guias";
import { PLANOS } from "./sementes/planos";
import { CONFIGURACOES } from "./sementes/configuracoes";
import { paraConfiguracoes } from "./mapeadores";
import type { AlteracaoPaciente, DadosCatalogo, Repositorio } from "./repositorio";
import type { ConteudoProtocolo, GrupoDoProtocolo, Protocolo } from "@/central/types/protocolo";

/**
 * Modo demonstração: o app inteiro funcionando sem banco nenhum.
 *
 * Serve a três coisas: abrir o projeto e ver tudo antes de configurar
 * serviço algum; rodar a bateria de testes de interface sem depender de
 * rede; e ter para onde voltar se um dia o Supabase estiver fora do ar
 * durante o desenvolvimento.
 *
 * O que for salvo aqui fica no navegador de quem está usando e não vai para
 * lugar nenhum — a tela avisa isso o tempo todo, para ninguém confundir
 * demonstração com produção.
 */

const guardaAlimentos = armazenamentoLocal<Alimento>("central:demo:alimentos:v1");
const guardaEquivalencias = armazenamentoLocal<Equivalencia>("central:demo:equivalencias:v1");
const guardaComerFora = armazenamentoLocal<CategoriaComerFora>("central:demo:comer-fora:v1");
const guardaGuias = armazenamentoLocal<Guia>("central:demo:guias:v1");
const guardaFavoritos = armazenamentoLocal<Favorito>("central:favoritos:v1");
const guardaPacientes = armazenamentoLocal<Paciente>("central:demo:pacientes:v1");
const guardaHistorico = armazenamentoLocal<EventoHistorico>("central:demo:historico:v1");
const guardaConfiguracoes = armazenamentoLocal<[string, unknown]>("central:demo:config:v1");
const guardaItensReintroducao =
  armazenamentoLocal<ItemDeReintroducao>("central:demo:reintroducao-itens:v1");
const guardaRegistrosReintroducao =
  armazenamentoLocal<RegistroDeReintroducao>("central:demo:reintroducao-registros:v1");

/** Combina a semente com o que foi editado no navegador, sem duplicar. */
function mesclar<T extends { id: string }>(semente: T[], salvos: T[]): T[] {
  const mapa = new Map(semente.map((x) => [x.id, x]));
  for (const item of salvos) mapa.set(item.id, item);
  return [...mapa.values()];
}

function configuracoesAtuais(): Configuracoes {
  const salvas = guardaConfiguracoes.ler();
  const linhas = CONFIGURACOES.map((c) => {
    const sobrescrita = salvas.find(([chave]) => chave === c.chave);
    return { chave: c.chave, valor: sobrescrita ? sobrescrita[1] : c.valor };
  });
  return paraConfiguracoes(linhas);
}

function registrar(pacienteId: string, evento: string, detalhe: Record<string, unknown> = {}): void {
  const historico = guardaHistorico.ler();
  historico.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    pacienteId,
    evento,
    detalhe,
    criadoEm: new Date().toISOString(),
  });
  guardaHistorico.escrever(historico.slice(0, 500));
}

/** Recalcula `situacao` e `diasRestantes` toda vez que a lista é lida. */
function comSituacao(paciente: Paciente, alertaDias: number): Paciente {
  const plano = PLANOS.find((p) => p.id === paciente.planoId);
  return {
    ...paciente,
    planoNome: plano?.nome ?? null,
    situacao: calcularSituacao(paciente, alertaDias),
    diasRestantes: diasEntre(hojeSaoPaulo(), paciente.dataFim),
  };
}

export const repositorioLocal: Repositorio = {
  async carregarCatalogo(): Promise<DadosCatalogo> {
    return {
      unidades: UNIDADES,
      grupos: GRUPOS,
      alimentos: mesclar(ALIMENTOS, guardaAlimentos.ler()),
      equivalencias: mesclar(EQUIVALENCIAS, guardaEquivalencias.ler()),
      categoriasComerFora: mesclar(CATEGORIAS_COMER_FORA, guardaComerFora.ler()),
      guias: mesclar(GUIAS, guardaGuias.ler()),
      configuracoes: configuracoesAtuais(),
    };
  },

  async listarFavoritos() {
    return guardaFavoritos.ler();
  },

  async salvarFavorito(favorito) {
    const atuais = guardaFavoritos.ler().filter((f) => f.id !== favorito.id);
    guardaFavoritos.escrever([favorito, ...atuais]);
  },

  async removerFavorito(id) {
    guardaFavoritos.escrever(guardaFavoritos.ler().filter((f) => f.id !== id));
  },

  async listarPlanos(): Promise<Plano[]> {
    return PLANOS.map((p) => ({ ...p, ativo: true }));
  },

  async listarPacientes() {
    const alerta = configuracoesAtuais().alertaVencimentoDias;
    return guardaPacientes
      .ler()
      .map((p) => comSituacao(p, alerta))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  },

  async criarPaciente(dados: NovoPaciente) {
    // O banco real tem chave única no e-mail. Repetir a regra aqui é o que
    // faz o modo demonstração ensinar o comportamento certo — sem isto, a
    // tela aceitaria em teste um cadastro que a produção recusa.
    const email = dados.email.toLowerCase().trim();
    if (guardaPacientes.ler().some((p) => p.email.toLowerCase() === email)) {
      throw new Error("duplicate key value violates unique constraint pacientes_email_key");
    }

    const paciente: Paciente = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      // Em modo demonstração não há e-mail nem conta: o paciente já nasce
      // vinculado, senão não daria para experimentar as telas seguintes.
      perfilId: `demo-${Date.now()}`,
      email,
      nome: dados.nome,
      telefone: dados.telefone ?? null,
      planoId: dados.planoId,
      planoNome: PLANOS.find((p) => p.id === dados.planoId)?.nome ?? null,
      dataInicio: dados.dataInicio,
      dataFim: dados.dataFim,
      status: "ativo",
      situacao: "ativo",
      diasRestantes: diasEntre(hojeSaoPaulo(), dados.dataFim),
      observacoes: dados.observacoes ?? null,
      ultimoAcesso: null,
      conviteEnviadoEm: new Date().toISOString(),
      criadoEm: new Date().toISOString(),
    };
    guardaPacientes.escrever([paciente, ...guardaPacientes.ler()]);
    registrar(paciente.id, "paciente_cadastrado", {
      plano: dados.planoId,
      inicio: dados.dataInicio,
      fim: dados.dataFim,
    });
    return comSituacao(paciente, configuracoesAtuais().alertaVencimentoDias);
  },

  async alterarPaciente(id, alteracao: AlteracaoPaciente) {
    const pacientes = guardaPacientes.ler();
    const antes = pacientes.find((p) => p.id === id);
    if (!antes) return;
    let depois = { ...antes, ...alteracao } as Paciente;

    // Mesma regra do banco: trocar o e-mail solta a conta que estava ligada,
    // e o acesso volta a depender de a pessoa entrar com o endereço novo.
    if (alteracao.email && alteracao.email.toLowerCase() !== antes.email.toLowerCase()) {
      depois = { ...depois, perfilId: null, status: "convite_pendente" };
    }
    guardaPacientes.escrever(pacientes.map((p) => (p.id === id ? depois : p)));

    if (alteracao.status && alteracao.status !== antes.status) {
      registrar(
        id,
        alteracao.status === "suspenso" ? "suspenso" : "reativado",
        { de: antes.status, para: alteracao.status },
      );
    } else if (alteracao.dataFim && alteracao.dataFim !== antes.dataFim) {
      registrar(id, "renovado", {
        fim_anterior: antes.dataFim,
        fim: alteracao.dataFim,
        plano: alteracao.planoId ?? antes.planoId,
      });
    }
  },

  async excluirPaciente(id) {
    guardaPacientes.escrever(guardaPacientes.ler().filter((p) => p.id !== id));
    guardaHistorico.escrever(guardaHistorico.ler().filter((e) => e.pacienteId !== id));
  },

  async registrarConvite(pacienteId) {
    const pacientes = guardaPacientes.ler();
    guardaPacientes.escrever(
      pacientes.map((p) =>
        p.id === pacienteId ? { ...p, conviteEnviadoEm: new Date().toISOString() } : p,
      ),
    );
    registrar(pacienteId, "convite_enviado");
  },

  async historicoDoPaciente(pacienteId) {
    return guardaHistorico.ler().filter((e) => e.pacienteId === pacienteId);
  },

  async salvarAlimento(alimento) {
    const salvos = guardaAlimentos.ler().filter((a) => a.id !== alimento.id);
    guardaAlimentos.escrever([...salvos, alimento]);
  },

  async salvarEquivalencia(equivalencia) {
    const salvas = guardaEquivalencias.ler().filter((e) => e.id !== equivalencia.id);
    guardaEquivalencias.escrever([...salvas, equivalencia]);
  },

  async salvarCategoriaComerFora(categoria) {
    const salvas = guardaComerFora.ler().filter((c) => c.id !== categoria.id);
    guardaComerFora.escrever([...salvas, categoria]);
  },

  async salvarGuia(guia) {
    const salvos = guardaGuias.ler().filter((g) => g.id !== guia.id);
    guardaGuias.escrever([...salvos, guia]);
  },

  async salvarConfiguracoes(configuracoes) {
    guardaConfiguracoes.escrever([
      ["nome_central", configuracoes.nomeCentral],
      ["frase_home", configuracoes.fraseHome],
      ["lema", configuracoes.lema],
      ["whatsapp", configuracoes.whatsapp],
      ["nome_nutricionista", configuracoes.nomeNutricionista],
      ["alerta_vencimento_dias", configuracoes.alertaVencimentoDias],
    ]);
  },

  async registrarAcesso() {
    /* não há o que registrar sem banco */
  },

  // ---------------------------------------------------------------- desafio
  //
  // A demonstração aprova na hora, e isso é uma diferença deliberada em
  // relação à produção: sem banco não há nutricionista para conferir, e um
  // checklist que nunca sai de "aguardando" não mostraria como a tela fica.
  // A faixa amarela do topo avisa o tempo todo que ali nada é de verdade.

  async meuDesafio() {
    const desafio = desafioDemo();
    const envios = guardaEnvios.ler();
    const semana = semanaDoDesafio(desafio.dataInicio, desafio.dataFim) ?? 1;

    const acoes: AcaoDoDesafio[] = ACOES_DEMO.map((a) => {
      const meus = envios.filter(
        (e) => e.acaoId === a.id && (a.periodicidade !== "semanal" || e.semana === semana),
      );
      const valendo = meus.filter((e) => e.status !== "recusado").length;
      return {
        ...a,
        envios: meus.map((meu) => ({
          id: meu.id,
          status: meu.status,
          semana: meu.semana,
          observacao: meu.observacao,
          motivoRecusa: null,
          enviadoEm: meu.enviadoEm,
          pontosConcedidos: meu.status === "aprovado" ? a.pontos : 0,
        })),
        podeMarcar:
          a.periodicidade === "semanal" ? valendo < a.maxPorSemana : valendo === 0,
        aprovadas: envios.filter((e) => e.acaoId === a.id && e.status === "aprovado").length,
      };
    });

    const pontosNoMes = acoes.reduce(
      (soma, a) => soma + a.envios.filter((e) => e.status === "aprovado").length * a.pontos,
      0,
    );
    // Um saldo antigo de exemplo, para a tela mostrar a diferença entre o
    // ponto do mês e o acumulado do programa.
    const saldoAcumulado = pontosNoMes + 145;

    const ranking: LinhaDoRanking[] = [
      { posicao: 1, nome: "Ana M.", pontos: 75, souEu: false },
      { posicao: 2, nome: "Maria S.", pontos: 70, souEu: false },
      { posicao: 3, nome: "Júlia R.", pontos: 65, souEu: false },
      { posicao: 4, nome: "Carla B.", pontos: 60, souEu: false },
      { posicao: 5, nome: "Você", pontos: pontosNoMes, souEu: true },
    ].sort((a, b) => b.pontos - a.pontos)
      .map((l, i) => ({ ...l, posicao: i + 1 }));

    const validadas = guardaIndicacoes.ler().filter((i) => i.status === "validada").length;
    const minha = ranking.find((l) => l.souEu)!;
    const acima = ranking.filter((l) => l.pontos > pontosNoMes).map((l) => l.pontos);

    return {
      temDesafio: true,
      desafio,
      pontosNoMes,
      saldoAcumulado,
      posicao: minha.posicao,
      pontosParaProxima: acima.length ? Math.min(...acima) - pontosNoMes : null,
      acoes,
      ranking,
      historico: envios
        .filter((e) => e.status === "aprovado")
        .map((e) => ({
          id: e.id,
          pontos: ACOES_DEMO.find((a) => a.id === e.acaoId)?.pontos ?? 0,
          descricao: ACOES_DEMO.find((a) => a.id === e.acaoId)?.nome ?? "",
          tipo: "acao" as const,
          criadoEm: e.enviadoEm,
        })),
      indicacoes: guardaIndicacoes.ler(),
      indicacoesValidadas: validadas,
      beneficiosIndicacao: BENEFICIOS_DEMO.map((b) => ({
        ...b,
        alcancado: validadas >= b.nivel,
      })),
      recompensas: RECOMPENSAS_DEMO.map((r) => ({ ...r, alcancada: saldoAcumulado >= r.pontos })),
    } satisfies MeuDesafio;
  },

  async enviarAcao(acaoId: string, observacao?: string | null) {
    const desafio = desafioDemo();
    const acao = ACOES_DEMO.find((a) => a.id === acaoId);
    if (!acao) throw new Error("Esta ação não está disponível.");
    const semana = acao.periodicidade === "semanal"
      ? semanaDoDesafio(desafio.dataInicio, desafio.dataFim)
      : null;
    const envios = guardaEnvios.ler();
    const jaFeitos = envios.filter(
      (e) => e.acaoId === acaoId && e.semana === semana && e.status !== "recusado",
    ).length;
    if (jaFeitos >= (acao.periodicidade === "semanal" ? acao.maxPorSemana : 1)) {
      throw new Error("Você já marcou esta ação o número de vezes desta semana.");
    }
    guardaEnvios.escrever([
      ...envios,
      {
        id: `envio-${Date.now()}`,
        acaoId,
        semana,
        status: "aprovado",
        observacao: observacao ?? null,
        enviadoEm: new Date().toISOString(),
      },
    ]);
  },

  async cancelarEnvio(envioId: string) {
    guardaEnvios.escrever(guardaEnvios.ler().filter((e) => e.id !== envioId));
  },

  async registrarIndicacao(nome: string) {
    guardaIndicacoes.escrever([
      ...guardaIndicacoes.ler(),
      {
        id: `ind-${Date.now()}`,
        nome,
        status: "registrada",
        pontos: 0,
        criadoEm: new Date().toISOString(),
      },
    ]);
  },

  async listarDesafios() {
    return [desafioDemoAdmin()];
  },

  async salvarDesafio() {
    throw new Error("Criar desafio precisa do banco. Configure o Supabase.");
  },

  async painelDoDesafio() {
    const envios = guardaEnvios.ler();
    return {
      elegiveis: 5,
      participantes: 5,
      semAcao: 1,
      pendentes: envios.filter((e) => e.status === "enviado").length,
      indicacoesPendentes: guardaIndicacoes.ler().filter((i) => i.status === "registrada").length,
      maiorPontuacao: 75,
      media: 54,
      acoesMaisFeitas: ACOES_DEMO.map((a) => ({
        nome: a.nome,
        total: envios.filter((e) => e.acaoId === a.id && e.status === "aprovado").length,
      })),
    };
  },

  async rankingDoDesafio() {
    return (await repositorioLocal.meuDesafio()).ranking ?? [];
  },

  async enviosPendentes(): Promise<EnvioPendente[]> {
    return [];
  },

  async aprovarEnvio() {
    /* na demonstração a aprovação já aconteceu no envio */
  },

  async recusarEnvio() {
    /* idem */
  },

  async acoesDoDesafio(): Promise<AcaoAdmin[]> {
    return ACOES_DEMO.map((a) => ({
      id: a.id,
      chave: a.chave,
      nome: a.nome,
      pontos: a.pontos,
      periodicidade: a.periodicidade,
      maxPorSemana: a.maxPorSemana,
      ativo: true,
    }));
  },

  async concederAcao() {
    throw new Error("Lançar ação por uma paciente precisa do banco. Configure o Supabase.");
  },

  async ajustarPontos() {
    throw new Error("Ajustar pontos precisa do banco. Configure o Supabase.");
  },

  async listarIndicacoes(): Promise<IndicacaoPendente[]> {
    return guardaIndicacoes.ler().map((i) => ({
      id: i.id,
      indicadoraNome: "Demonstração",
      nomeIndicada: i.nome,
      emailIndicada: null,
      telefoneIndicada: null,
      status: i.status,
      criadoEm: i.criadoEm,
    }));
  },

  async resumoIndicacoes(): Promise<ResumoIndicacao[]> {
    const lista = guardaIndicacoes.ler();
    if (lista.length === 0) return [];
    return [
      {
        pacienteId: "demo",
        nome: "Demonstração",
        validadas: lista.filter((i) => i.status === "validada").length,
        emAndamento: lista.filter((i) => i.status === "registrada" || i.status === "iniciou").length,
      },
    ];
  },

  async validarIndicacao(indicacaoId: string) {
    guardaIndicacoes.escrever(
      guardaIndicacoes.ler().map((i) =>
        i.id === indicacaoId ? { ...i, status: "validada" as const, pontos: 100 } : i,
      ),
    );
  },

  async recusarIndicacao(indicacaoId: string) {
    guardaIndicacoes.escrever(
      guardaIndicacoes.ler().map((i) =>
        i.id === indicacaoId ? { ...i, status: "recusada" as const } : i,
      ),
    );
  },
  // ------------------------------------------------- rastreabilidade alimentar
  //
  // Na demonstração a lista já vem montada com a semana 1 do material, para a
  // tela ter o que mostrar. No banco de verdade quem monta é a nutricionista,
  // paciente por paciente — e é essa a diferença que a faixa amarela do topo
  // avisa o tempo todo.

  async minhaReintroducao(): Promise<Reintroducao> {
    const itens = itensDemo();
    const registros = guardaRegistrosReintroducao.ler();
    return {
      ativo: true,
      previa: false,
      orientacao: ORIENTACAO_DEMO,
      inicio: registros.length > 0 ? menorData(registros) : null,
      semanaAtual: semanaDaReintroducaoDemo(hojeSaoPaulo(), registros),
      semanasComRegistro: [
        ...new Set(registros.map((r) => semanaDaReintroducaoDemo(r.data, registros))),
      ],
      itens: itens.map((i) => ({
        ...i,
        totalDeRegistros: registros.filter((r) => r.itemId === i.id).length,
        ultimoRegistro:
          registros
            .filter((r) => r.itemId === i.id)
            .map((r) => r.data)
            .sort()
            .at(-1) ?? null,
      })),
      registros: registros
        .map((r) => ({ ...r, semana: semanaDaReintroducaoDemo(r.data, registros) }))
        .sort((a, b) => (a.data === b.data ? 0 : a.data < b.data ? 1 : -1)),
    };
  },

  async registrarReintroducao(registro: NovoRegistroDeReintroducao) {
    let itemId = registro.itemId ?? null;
    let itemNome = itensDemo().find((i) => i.id === itemId)?.nome ?? "";

    if (!itemId) {
      const nome = registro.nomeNovo?.trim();
      if (!nome) throw new Error("Escolha um alimento ou escreva o nome.");
      itemId = `livre-${Date.now()}`;
      itemNome = nome;
      guardaItensReintroducao.escrever([
        ...guardaItensReintroducao.ler(),
        {
          id: itemId,
          alimentoId: null,
          nome,
          categoria: "outros",
          semanaSugerida: null,
          porcaoReferencia: null,
          observacaoMaterial: null,
          doCatalogo: false,
          ligadoDepois: false,
          status: "em_teste",
          notaNutri: null,
          ordem: 900,
          marcacao: MARCACAO_DEMO[nome.toLowerCase()] ?? [],
          totalDeRegistros: 0,
          ultimoRegistro: null,
        },
      ]);
    }

    guardaRegistrosReintroducao.escrever([
      ...guardaRegistrosReintroducao.ler(),
      {
        id: `reg-${Date.now()}`,
        itemId,
        itemNome,
        data: registro.data ?? hojeSaoPaulo(),
        horario: registro.horario ?? null,
        semana: 1,
        quantidade: registro.quantidade ?? null,
        preparo: registro.preparo ?? null,
        sintomas: registro.sintomas ?? [],
        intensidade: registro.intensidade ?? null,
        bristol: registro.bristol ?? null,
        observacao: registro.observacao ?? null,
        marcacao: MARCACAO_DEMO[itemNome.toLowerCase()] ?? [],
        criadoEm: new Date().toISOString(),
      },
    ]);
  },

  async editarRegistroReintroducao(registroId: string, registro: NovoRegistroDeReintroducao) {
    guardaRegistrosReintroducao.escrever(
      guardaRegistrosReintroducao.ler().map((r) =>
        r.id === registroId
          ? {
              ...r,
              data: registro.data ?? r.data,
              horario: registro.horario ?? null,
              quantidade: registro.quantidade ?? null,
              preparo: registro.preparo ?? null,
              sintomas: registro.sintomas ?? [],
              intensidade: registro.intensidade ?? null,
              bristol: registro.bristol ?? null,
              observacao: registro.observacao ?? null,
            }
          : r,
      ),
    );
  },

  async excluirRegistroReintroducao(registroId: string) {
    guardaRegistrosReintroducao.escrever(
      guardaRegistrosReintroducao.ler().filter((r) => r.id !== registroId),
    );
  },

  async marcarRelevanciaReintroducao(itemId: string, relevante: boolean) {
    const guardados = guardaItensReintroducao.ler();
    const jaGuardado = guardados.some((i) => i.id === itemId);
    const proximo: StatusReintroducao = relevante ? "nao_iniciado" : "nao_relevante";
    guardaItensReintroducao.escrever(
      jaGuardado
        ? guardados.map((i) => (i.id === itemId ? { ...i, status: proximo } : i))
        : [
            ...guardados,
            ...itensDoMaterialDemo()
              .filter((i) => i.id === itemId)
              .map((i) => ({ ...i, status: proximo })),
          ],
    );
  },

  async listarAlimentosDoMaterial(): Promise<AlimentoDoMaterial[]> {
    return MATERIAL_DEMO.map((a) => ({ ...a }));
  },

  async reintroducaoDoPaciente(): Promise<Reintroducao> {
    return repositorioLocal.minhaReintroducao();
  },

  async definirRastreioDoPaciente() {
    throw new Error("Ligar o rastreio precisa do banco. Configure o Supabase.");
  },

  async rastreiosAtivos() {
    return [];
  },

  async adicionarItensReintroducao() {
    throw new Error("Montar a lista de uma paciente precisa do banco. Configure o Supabase.");
  },

  async adicionarItemLivreReintroducao() {
    throw new Error("Montar a lista de uma paciente precisa do banco. Configure o Supabase.");
  },

  async removerItemReintroducao() {
    throw new Error("Mexer na lista de uma paciente precisa do banco. Configure o Supabase.");
  },

  async definirStatusReintroducao() {
    throw new Error("Classificar um alimento precisa do banco. Configure o Supabase.");
  },

  async ligarItemAoMapa() {
    throw new Error("Ligar ao Mapa precisa do banco. Configure o Supabase.");
  },

  async desligarItemDoMapa() {
    throw new Error("Desfazer a ligação precisa do banco. Configure o Supabase.");
  },

  async registrarReintroducaoPorPaciente(
    _pacienteId: string,
    registro: NovoRegistroDeReintroducao,
  ) {
    // Na demonstração há uma paciente só, então lançar "por ela" é lançar
    // no mesmo diário. O que muda de verdade — escrever na ficha de outra
    // pessoa — é o que o banco guarda, e está coberto pela bateria.
    await repositorioLocal.registrarReintroducao(registro);
  },

  async definirAcompanhamentoReintroducao() {
    throw new Error("Definir o acompanhamento precisa do banco. Configure o Supabase.");
  },

  // ------------------------------------------------------- protocolo alimentar

  async meuProtocolo(): Promise<Protocolo | null> {
    return {
      id: "demo",
      pacienteId: "demo",
      titulo: "Protocolo de emagrecimento",
      conteudo: PROTOCOLO_DEMO,
      ajustes: "Essa semana, trocar o lanche da tarde por fruta com castanha.",
      situacao: "publicado",
      versao: 1,
      atualizadoEm: new Date().toISOString(),
      publicadoEm: new Date().toISOString(),
    };
  },

  // Estas duas respondem na demonstração em vez de reclamar: sem elas a tela
  // de montar protocolo não abre, e é justamente a tela que precisa ser vista
  // antes de mexer na dieta de alguém. Salvar e publicar continuam exigindo
  // banco — em demonstração nada é salvo de verdade, e a faixa do topo avisa.
  async protocolosDasPacientes() {
    const pacientes = await repositorioLocal.listarPacientes();
    return pacientes.map((p) => ({
      pacienteId: p.id,
      nome: p.nome,
      situacao: "sem" as const,
      temRascunho: false,
      publicadoEm: null,
    }));
  },

  async protocoloDoPaciente() {
    return { rascunho: null, publicado: null, historico: [] };
  },

  async salvarRascunhoProtocolo() {
    throw new Error("Escrever protocolo precisa do banco. Configure o Supabase.");
  },

  async publicarProtocolo() {
    throw new Error("Publicar protocolo precisa do banco. Configure o Supabase.");
  },

  async definirAjustesProtocolo() {
    throw new Error("Mudar os ajustes precisa do banco. Configure o Supabase.");
  },

  async descartarRascunhoProtocolo() {
    throw new Error("Descartar rascunho precisa do banco. Configure o Supabase.");
  },

  async restaurarProtocolo() {
    throw new Error("Restaurar versão precisa do banco. Configure o Supabase.");
  },

  // Na demonstração os grupos vêm prontos, para a tela ter o que mostrar.
  async listarGruposProtocolo() {
    return GRUPOS_DEMO;
  },

  async salvarGrupoProtocolo() {
    throw new Error("Guardar grupo precisa do banco. Configure o Supabase.");
  },

  async excluirGrupoProtocolo() {
    throw new Error("Apagar grupo precisa do banco. Configure o Supabase.");
  },

  // Uma avaliação de exemplo, com os números do material dela, para a
  // demonstração mostrar a tela cheia.
  async minhaAvaliacao() {
    return {
      id: "demo",
      data: new Date().toISOString().slice(0, 10),
      total: 1,
      inicio: new Date().toISOString().slice(0, 10),
      dados: {
        metodo: "4 Pregas: Protocolo de Faulkner",
        peso: 47.8,
        altura: 159,
        idade: 22,
        percentualGordura: 10.9,
        massaGorda: 5.2,
        massaMagra: 42.6,
        imc: 18.9,
        somaDobras: 33.2,
        dobras: [
          { nome: "Tríceps", valor: "9,6 mm" },
          { nome: "Subescapular", valor: "8,0 mm" },
          { nome: "Supra-ilíaca", valor: "7,4 mm" },
          { nome: "Abdominal", valor: "8,2 mm" },
        ],
        circunferencias: [
          { nome: "Cintura", valor: "61,0 cm" },
          { nome: "Abdômen", valor: "63,0 cm" },
          { nome: "Quadril", valor: "87,0 cm" },
        ],
        observacao: null,
      },
    };
  },

  async avaliacoesDoPaciente() {
    return [];
  },

  async salvarAvaliacaoFisica() {
    throw new Error("Lançar avaliação precisa do banco. Configure o Supabase.");
  },

  async excluirAvaliacaoFisica() {
    throw new Error("Apagar avaliação precisa do banco. Configure o Supabase.");
  },
};

/** Dois grupos de exemplo, no formato que ela monta. */
const GRUPOS_DEMO: GrupoDoProtocolo[] = [
  {
    id: "g-frutas",
    nome: "Frutas",
    itens: [
      { alimento: "Banana", quantidade: "1 unidade" },
      { alimento: "Mamão", quantidade: "150g" },
      { alimento: "Morango", quantidade: "200g" },
      { alimento: "Uva", quantidade: "110g" },
    ],
  },
  {
    id: "g-carbo",
    nome: "Carboidratos do almoço e jantar",
    itens: [
      { alimento: "Arroz branco, cozido", quantidade: "130g" },
      { alimento: "Batata doce, cozida", quantidade: "180g" },
      { alimento: "Macarrão, cozido", quantidade: "130g" },
      { alimento: "Mandioca, cozida", quantidade: "130g" },
    ],
  },
];

/**
 * Um dia de protocolo para a demonstração.
 *
 * Escrito à mão, no mesmo formato que a tela dela monta: refeição, itens com
 * quantidade e substituições, observação presa à refeição, e o jantar com
 * duas versões. Serve para a demonstração mostrar a tela cheia sem banco
 * nenhum ligado.
 */
const PROTOCOLO_DEMO: ConteudoProtocolo = {
  orientacoes: [
    "Comer proteína em TODAS as refeições",
    "Beber muita água. Meta atual: 3L por dia",
  ],
  refeicoes: [
    {
      nome: "Café da manhã",
      opcoes: [
        {
          rotulo: "",
          itens: [
            {
              alimento: "Pão de forma",
              quantidade: "2 fatias - 50g",
              substituicoes: ["Tapioca - 70g", "Pão francês - 1 unidade"],
            },
            { alimento: "Ovo", quantidade: "2 unidades", substituicoes: ["Iogurte desnatado - 170g"] },
            { alimento: "Banana", quantidade: "1 unidade", substituicoes: ["Morango - 200g"] },
          ],
          notas: ["Chá de gengibre com limão depois da refeição."],
        },
      ],
    },
    {
      nome: "Almoço",
      opcoes: [
        {
          rotulo: "",
          itens: [
            { alimento: "Arroz cozido", quantidade: "150g", substituicoes: ["Batata doce cozida - 200g"] },
            {
              alimento: "Peito de frango grelhado",
              quantidade: "120g",
              substituicoes: ["Peixe branco grelhado - 140g"],
            },
          ],
          notas: ["VEGETAIS: liberados todos os que não são tubérculos, mínimo 100g."],
        },
      ],
    },
    {
      nome: "Jantar",
      opcoes: [
        {
          rotulo: "Padrão",
          itens: [
            { alimento: "Arroz cozido", quantidade: "150g", substituicoes: ["Macarrão - 130g"] },
            { alimento: "Carne de panela", quantidade: "100g", substituicoes: ["Patinho moído - 110g"] },
          ],
          notas: [],
        },
        {
          rotulo: "Hambúrguer",
          itens: [
            { alimento: "Pão de hambúrguer", quantidade: "60g", substituicoes: [] },
            { alimento: "Patinho moído", quantidade: "70g", substituicoes: [] },
            { alimento: "Queijo mussarela", quantidade: "20g", substituicoes: [] },
          ],
          notas: [],
        },
      ],
    },
  ],
  secoes: [
    {
      titulo: "ACORDE CEDO (ANTES DAS 9H)",
      paragrafos: ["Olhe para a luz natural logo ao acordar: abra a janela, sinta o dia."],
    },
  ],
};

// ------------------------------------------------- rastreabilidade: demonstração

const ORIENTACAO_DEMO =
  "Você não precisa conseguir reintroduzir todos os alimentos de uma vez. Esse processo é " +
  "individual e pode acontecer no seu ritmo, de acordo com a sua tolerância e com a orientação " +
  "da sua nutricionista.\n\nSe você não conseguir testar todos os alimentos nesta semana, tudo " +
  "bem. Podemos continuar na próxima.\n\nVocê também não precisa testar alimentos que não fazem " +
  "parte da sua alimentação ou que você não gosta.";

/** A semana 1 do material dela, que é o que a demonstração mostra. */
const MATERIAL_DEMO: AlimentoDoMaterial[] = [
  { id: "abacate", nome: "Abacate / avocado", categoria: "gorduras", semanaSugerida: 1,
    porcaoReferencia: "60g", observacao: null },
  { id: "pera", nome: "Pêra", categoria: "frutas", semanaSugerida: 1,
    porcaoReferencia: "175g", observacao: null },
  { id: "pessego", nome: "Pêssego", categoria: "frutas", semanaSugerida: 1,
    porcaoReferencia: "250g", observacao: null },
  { id: "manga", nome: "Manga", categoria: "frutas", semanaSugerida: 1,
    porcaoReferencia: "160g", observacao: null },
];

function itensDoMaterialDemo(): ItemDeReintroducao[] {
  return MATERIAL_DEMO.map((a, i) => ({
    id: a.id,
    alimentoId: a.id,
    nome: a.nome,
    categoria: a.categoria,
    semanaSugerida: a.semanaSugerida,
    porcaoReferencia: a.porcaoReferencia,
    observacaoMaterial: a.observacao,
    doCatalogo: true,
    ligadoDepois: false,
    status: "nao_iniciado" as StatusReintroducao,
    notaNutri: null,
    ordem: i + 1,
    marcacao: MARCACAO_DEMO[a.nome.toLowerCase()] ?? [],
    totalDeRegistros: 0,
    ultimoRegistro: null,
  }));
}

/** O material mais o que a paciente tiver acrescentado ou marcado na sessão. */
function itensDemo(): ItemDeReintroducao[] {
  const guardados = guardaItensReintroducao.ler();
  const base = itensDoMaterialDemo().map(
    (i) => guardados.find((g) => g.id === i.id) ?? i,
  );
  return [...base, ...guardados.filter((g) => !g.doCatalogo)];
}

function menorData(registros: RegistroDeReintroducao[]): string {
  return registros.map((r) => r.data).sort()[0] ?? hojeSaoPaulo();
}

/** A mesma conta do banco: só agrupa o tempo, não cobra nada. */
function semanaDaReintroducaoDemo(data: string, registros: RegistroDeReintroducao[]): number {
  if (registros.length === 0) return 1;
  const inicio = Date.parse(`${menorData(registros)}T00:00:00Z`);
  const dia = Date.parse(`${data}T00:00:00Z`);
  if (dia < inicio) return 1;
  return Math.floor((dia - inicio) / 86400000 / 7) + 1;
}

// ---------------------------------------------------------------- dados da demonstração

interface EnvioDemo {
  id: string;
  acaoId: string;
  semana: number | null;
  status: "enviado" | "aprovado" | "recusado";
  observacao: string | null;
  enviadoEm: string;
}

const guardaEnvios = armazenamentoLocal<EnvioDemo>("central:demo:desafio:envios:v1");
const guardaIndicacoes = armazenamentoLocal<{
  id: string;
  nome: string;
  status: "registrada" | "iniciou" | "validada" | "recusada";
  pontos: number;
  criadoEm: string;
}>("central:demo:desafio:indicacoes:v1");

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** O desafio do mês corrente, calculado — nada de "setembro" escrito à mão. */
function desafioDemo() {
  const hoje = hojeSaoPaulo();
  const [ano, mes] = hoje.split("-").map(Number) as [number, number];
  const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const fim = `${ano}-${String(mes).padStart(2, "0")}-${ultimo}`;
  return {
    id: "demo",
    nome: `Desafio de ${MESES[mes - 1]}`,
    descricao: "Um mês de constância. Marque o que você fez, e eu confiro.",
    lema: "Cada pequena ação conta.",
    regras:
      "O ranking mostra sua constância no desafio, não o seu resultado corporal. " +
      "Marcar uma ação não dá pontos na hora: eu confiro cada uma, e os pontos entram depois disso.",
    dataInicio: inicio,
    dataFim: fim,
    situacao: situacaoDoDesafio("ativo", inicio, fim),
    semanaAtual: semanaDoDesafio(inicio, fim),
    totalDeSemanas: totalDeSemanas(inicio, fim),
  };
}

function desafioDemoAdmin(): DesafioAdmin {
  return { ...desafioDemo(), status: "ativo" };
}

/** As mesmas cinco ações e pontuações do banco (0011 e 0013). */
const ACOES_DEMO = [
  { id: "a-questionario", chave: "questionario", nome: "Respondi meu questionário semanal",
    descricao: "Uma vez por semana.", pontos: 5, periodicidade: "semanal" as const,
    maxPorSemana: 1 },
  { id: "a-metas", chave: "metas", nome: "Cumpri minhas metas da semana",
    descricao: "Uma vez por semana.", pontos: 5, periodicidade: "semanal" as const,
    maxPorSemana: 1 },
  { id: "a-diario", chave: "diario", nome: "Enviei meu diário alimentar",
    descricao: "Duas vezes por semana.", pontos: 5, periodicidade: "semanal" as const,
    maxPorSemana: 2 },
  { id: "a-redes", chave: "redes", nome: "Compartilhei minha evolução e te marquei",
    descricao: "Uma vez por semana.", pontos: 10, periodicidade: "semanal" as const,
    maxPorSemana: 1 },
  { id: "a-indicacao", chave: "indicacao", nome: "Indiquei uma amiga",
    descricao: "Os pontos entram quando ela começa o acompanhamento.", pontos: 100,
    periodicidade: "evento" as const, maxPorSemana: 1 },
];

/**
 * A marcação dos quatro alimentos da demonstração, copiada da tabela dela.
 * No banco de verdade são 283 alimentos; aqui bastam estes para a tela
 * mostrar como a linha aparece quando há sintoma.
 */
const MARCACAO_DEMO: Record<string, MarcadorDoAlimento[]> = {
  "abacate / avocado": [
    { nome: "Histamina", nivel: "muito_alta" },
    { nome: "Oxalato", nivel: "muito_alta" },
  ],
  manga: [{ nome: "Oxalato", nivel: "alta" }],
  "pêra": [{ nome: "Histamina", nivel: "media" }],
  // Pêssego é baixo nos três: fica sem marcação, e é assim que deve ser.
};

/** A escada de benefícios da indicação (0013_desafio_ajustes.sql). */
const BENEFICIOS_DEMO = [
  { nivel: 1, texto: "100 pontos" },
  { nivel: 2, texto: "100 pontos + 20% de desconto na renovação do plano" },
  { nivel: 3, texto: "100 pontos + 1 consulta bônus" },
  { nivel: 4, texto: "100 pontos + 1 consulta bônus + 1 kit completo das marcas parceiras" },
];

const RECOMPENSAS_DEMO = [
  { id: "r200", pontos: 200, nome: "30 dias de acompanhamento", descricao: null },
  { id: "r300", pontos: 300, nome: "Kit degustação", descricao: "Dois produtos de marcas parceiras." },
  { id: "r400", pontos: 400, nome: "Consulta extra", descricao: null },
  { id: "r500", pontos: 500, nome: "Kit completo",
    descricao: "Um produto de cada marca parceira, mais um mimo exclusivo." },
];
