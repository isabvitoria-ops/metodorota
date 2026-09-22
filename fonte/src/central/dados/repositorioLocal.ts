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
import type { Fase, MudancaDeFase, MinhaFase } from "@/central/types/fase";
import type { Exame, EspacoDosExames } from "@/central/types/exame";
import { caminhoDoExame, porQueNaoServe, tipoPelaExtensao } from "@/central/utils/exames";
import type {
  PainelFinanceiro,
  ValorDoPaciente,
  Cobranca,
} from "@/central/types/financeiro";
import type {
  Questionario,
  PerguntaQuestionario,
  PeriodicidadeQuestionario,
  MeuQuestionario,
  RespostaEnviada,
  QuestionarioDoPaciente,
} from "@/central/types/questionario";
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
import type { Consulta } from "@/central/types/consulta";
import type { Meta } from "@/central/types/meta";
import type { PanoramaDoPaciente } from "@/central/types/panorama";
import type { CardioSessao, MetaSemanal, SessaoDeTreino, Treino } from "@/central/types/treino";
import type {
  ConteudoProtocolo,
  DadosAvaliacao,
  GrupoDoProtocolo,
  Protocolo,
} from "@/central/types/protocolo";

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

// Questionários da demo. Guardados de verdade, para a tela ser clicável sem
// banco -- ver os métodos lá embaixo.
interface AtribuicaoDemo {
  questionarioId: string;
  pacienteId: string;
}
interface EnvioQuestionarioDemo {
  id: string;
  revisado?: boolean;
  questionarioId: string;
  pacienteId: string;
  periodo: string;
  respondidoEm: string;
  respostas: RespostaEnviada[];
}
const guardaQuestionarios = armazenamentoLocal<Questionario>("central:demo:questionarios:v1");
const guardaAtribuicoes = armazenamentoLocal<AtribuicaoDemo>("central:demo:questionario-pacientes:v1");
const guardaEnviosQuest = armazenamentoLocal<EnvioQuestionarioDemo>("central:demo:questionario-envios:v1");

interface ValorDemo {
  id: string;
  valorMensal: number | null;
  diaDeVencimento: number | null;
}
const guardaCobrancas = armazenamentoLocal<Cobranca>("central:demo:cobrancas:v1");
const guardaValores = armazenamentoLocal<ValorDemo>("central:demo:valores:v1");

interface MudancaDemo {
  id: string;
  pacienteId: string;
  faseId: string;
  inicio: string;
  observacao: string | null;
}
const guardaFases = armazenamentoLocal<Fase>("central:demo:fases:v1");
const guardaMudancasDeFase = armazenamentoLocal<MudancaDemo>("central:demo:paciente-fases:v1");

interface ExameDemo extends Exame {
  pacienteId: string;
}
const guardaExames = armazenamentoLocal<ExameDemo>("central:demo:exames:v1");

/** Pela data DO EXAME; sem data, pelo envio. Mesma regra do banco. */
function ordenarExames<T extends { data: string | null; criadoEm: string }>(lista: T[]): T[] {
  return [...lista].sort((a, b) =>
    (b.data ?? b.criadoEm.slice(0, 10)).localeCompare(a.data ?? a.criadoEm.slice(0, 10)),
  );
}

/** A fase mais recente de uma paciente, ou nula. Mesma regra do banco. */
function faseAtualDe(pacienteId: string): string | null {
  const minhas = guardaMudancasDeFase
    .ler()
    .filter((m) => m.pacienteId === pacienteId)
    .sort((a, b) => b.inicio.localeCompare(a.inicio));
  return minhas[0]?.faseId ?? null;
}

/**
 * Quem é "a paciente logada" na demonstração.
 *
 * A demo não tem login de verdade: o lado da paciente sempre mostra a mesma
 * pessoa. Para o questionário isso importa, porque atribuir é ligar um
 * questionário a UMA paciente — e se os dois lados não concordassem sobre
 * quem ela é, atribuir na tela da nutricionista não apareceria na tela da
 * paciente, e pareceria defeito.
 *
 * Então a paciente da demo é a PRIMEIRA da lista. Quem experimenta cadastra
 * uma pessoa, atribui o check-in a ela e responde — o circuito fecha.
 *
 * Sem paciente nenhuma cadastrada, o identificador é fixo e nada casa, que é
 * o comportamento certo: não há a quem atribuir.
 */
/**
 * As pacientes da demonstração, derivadas do panorama.
 *
 * A demo tinha DUAS listas de paciente que não se conheciam: o panorama
 * (Acompanhamento) trazia quatro pessoas de mentira, e `listarPacientes`
 * (Pacientes, Protocolo, Metas, Questionários) começava vazia. Quem abria a
 * demonstração via quatro pacientes numa aba e "nenhuma paciente ainda" na
 * seguinte — e o prontuário de qualquer uma cadastrada por ela respondia
 * "não encontrei essa paciente", porque o prontuário lê pelo panorama.
 *
 * Derivar a lista do panorama faz as duas concordarem. Não é enfeite: sem
 * isso não há como experimentar montar um questionário e ler a resposta no
 * prontuário, que é justamente o circuito que a demonstração existe para
 * mostrar.
 */
function pacientesDaSemente(): Paciente[] {
  return PANORAMA_DEMO.map((p) => ({
    id: p.id,
    perfilId: p.id,
    email: p.email,
    nome: p.nome,
    telefone: null,
    planoId: "mensal",
    planoNome: "Mensal",
    // O panorama admite data nula (paciente sem período definido); a ficha
    // não. Hoje é o padrão honesto aqui: é uma semente de demonstração, e
    // uma data inventada no passado faria a situação parecer vencida.
    dataInicio: p.dataInicio ?? hojeLocal(),
    dataFim: p.dataFim ?? hojeLocal(),
    status: "ativo" as const,
    situacao: p.situacao,
    diasRestantes: p.diasRestantes,
    observacoes: null,
    condicao: p.condicao,
    ultimoAcesso: null,
    conviteEnviadoEm: null,
    criadoEm: p.dataInicio ?? hojeLocal(),
  }));
}

function pacienteDemoId(): string {
  // A MESMA lista que a tela da nutricionista mostra -- semente incluída.
  // Lendo só o que foi salvo no navegador, atribuir a uma paciente da
  // semente não apareceria do lado da paciente, e pareceria defeito.
  const primeira = mesclar(pacientesDaSemente(), guardaPacientes.ler())
    .slice()
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))[0];
  return primeira?.id ?? "demo-paciente";
}

const hojeLocal = (): string => new Date().toISOString().slice(0, 10);

/**
 * A segunda-feira da semana de um dia.
 *
 * Tem que dar o MESMO resultado do `semana_de()` do Postgres, senão a demo
 * e o banco discordariam sobre a que semana pertence uma resposta -- e a
 * demo deixaria de valer como ensaio do comportamento real.
 * `getUTCDay()` devolve 0 para domingo, então domingo recua 6 dias.
 */
function segundaDaSemana(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const diaDaSemana = d.getUTCDay();
  const recuo = diaDaSemana === 0 ? 6 : diaDaSemana - 1;
  d.setUTCDate(d.getUTCDate() - recuo);
  return d.toISOString().slice(0, 10);
}
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
    return mesclar(pacientesDaSemente(), guardaPacientes.ler())
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
      condicao: dados.condicao?.trim() || null,
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
          marcacaoDaNutri: false,
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

  async definirMarcacaoItem() {
    throw new Error("Gravar a marcação precisa do banco. Configure o Supabase.");
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

  /**
   * Três avaliações de exemplo, para a demonstração mostrar a EVOLUÇÃO.
   *
   * Com uma só, a tela apareceria sem coluna de comparação e sem a linha do
   * peso — e quem visse a demonstração concluiria que a evolução não existe.
   * Elas trazem de propósito uma dobra medida numa consulta e não na outra:
   * é o travessão, que é o caso que mais aparece na prática dela.
   */
  async minhaAvaliacao() {
    const historico = AVALIACOES_DEMO;
    const ultima = historico[0]!;
    return {
      id: ultima.id,
      data: ultima.data,
      total: historico.length,
      inicio: historico[historico.length - 1]!.data,
      dados: ultima.dados,
      historico,
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

  // ------------------------------------------------------- evolução de treino

  async meuTreino() {
    return TREINO_DEMO;
  },

  /**
   * Na demonstração existe um plano ATIVO da nutricionista — e por isso a
   * resposta aqui é "não pode", com o motivo certo.
   *
   * É o caminho mais valioso para a demonstração mostrar: quem abre quer ver
   * que o plano prescrito não é editável pela paciente. Escrever o treino
   * próprio, como toda escrita daqui, precisa do banco.
   */
  async possoEscreverTreino() {
    return {
      pode: false,
      motivo: "treino_da_nutricionista" as const,
      meuTreinoId: null,
    };
  },

  /**
   * As sessões da demonstração são o caso do enunciado: 60×6, 60×7, 60×8,
   * 60×10, 62×6, 62×7.
   *
   * De propósito: é a sequência em que "mais peso não é a única forma de
   * evoluir" fica visível. Com sessões aleatórias, quem visse a
   * demonstração não entenderia o que a tela está tentando mostrar.
   */
  async sessoesDeTreino() {
    return SESSOES_DEMO;
  },

  async registrarSessaoTreino() {
    throw new Error("Registrar treino precisa do banco. Configure o Supabase.");
  },

  async excluirSessaoTreino() {
    throw new Error("Apagar treino precisa do banco. Configure o Supabase.");
  },

  async treinosDoPaciente() {
    return TREINO_DEMO ? [TREINO_DEMO] : [];
  },

  async treinoLiberado() {
    // Na demonstração a área está ligada — é o que dá o que mostrar.
    return true;
  },

  async acessosDoPaciente() {
    return {
      rastreio: true,
      treino: true,
      desafio: true,
      protocolo: true,
      avaliacao: false,
      metas: true,
    };
  },

  async definirDesafioDoPaciente() {
    throw new Error("Liberar o desafio precisa do banco. Configure o Supabase.");
  },

  async definirTreinoDoPaciente() {
    throw new Error("Liberar a área de treino precisa do banco. Configure o Supabase.");
  },

  async salvarTreino() {
    throw new Error("Salvar treino precisa do banco. Configure o Supabase.");
  },

  async excluirTreino() {
    throw new Error("Apagar treino precisa do banco. Configure o Supabase.");
  },

  // --------------------------------------------- panorama e consultas

  /**
   * Quatro pacientes de demonstração, escolhidas para mostrar os quatro
   * status que a lista sabe dar: retorno hoje, retorno próximo, sem registro
   * recente e em dia. Com quatro parecidas, quem abre a demonstração não vê
   * que a lista faz alguma coisa.
   */
  async panoramaDosPacientes() {
    return PANORAMA_DEMO;
  },

  async exportarTudo() {
    throw new Error("O backup precisa do banco. Configure o Supabase.");
  },

  /** A demonstração tem marco e números: é o que dá o que mostrar. */
  async oQueMudou() {
    return {
      temMarco: true,
      desde: diasAtras(14),
      dias: 14,
      proximaConsulta: diasAtras(-1),
      pesoAntes: 75,
      pesoAgora: 72.8,
      marcacoesDeMeta: 8,
      metasAtivas: 3,
      registrosDeRastreio: 5,
      alimentosTestados: 3,
      treinos: 4,
      minutosDeCardio: 90,
    };
  },

  async consultasDe() {
    return CONSULTAS_DEMO;
  },

  async salvarConsulta() {
    throw new Error("Salvar consulta precisa do banco. Configure o Supabase.");
  },

  async excluirConsulta() {
    throw new Error("Apagar consulta precisa do banco. Configure o Supabase.");
  },

  // ------------------------------------------------- metas do acompanhamento

  /**
   * Três metas de demonstração, escolhidas para mostrar os três casos que a
   * tela trata de forma diferente: diária com alvo, semanal com alvo, e a
   * de "fez ou não fez". Com três metas parecidas, quem abre a demonstração
   * não vê que elas se comportam de jeitos diferentes.
   */
  async metasDe() {
    return METAS_ACOMPANHAMENTO_DEMO;
  },

  async salvarMeta() {
    throw new Error("Salvar meta precisa do banco. Configure o Supabase.");
  },

  async definirStatusMeta() {
    throw new Error("Mudar o status precisa do banco. Configure o Supabase.");
  },

  async excluirMeta() {
    throw new Error("Apagar meta precisa do banco. Configure o Supabase.");
  },

  async registrarMeta() {
    throw new Error("Marcar a meta precisa do banco. Configure o Supabase.");
  },

  async apagarRegistroMeta() {
    throw new Error("Desmarcar precisa do banco. Configure o Supabase.");
  },

  // --------------------------------------------------------- cardio e metas

  async sessoesDeCardio() {
    return CARDIO_DEMO;
  },

  async registrarCardio() {
    throw new Error("Registrar cardio precisa do banco. Configure o Supabase.");
  },

  async excluirCardio() {
    throw new Error("Apagar registro precisa do banco. Configure o Supabase.");
  },

  async metasSemanais() {
    return METAS_DEMO;
  },

  async definirMetaSemanal() {
    throw new Error("Definir meta precisa do banco. Configure o Supabase.");
  },

  async excluirMetaSemanal() {
    throw new Error("Apagar meta precisa do banco. Configure o Supabase.");
  },
  // ---------------------------------------------------------------------
  // Questionários e check-in semanal
  // ---------------------------------------------------------------------
  //
  // A demo guarda de verdade: a nutricionista monta um check-in, a paciente
  // responde, e a pontuação aparece — tudo em memória. Sem isto a tela de
  // questionário seria a única da Central impossível de experimentar sem
  // banco, e as que nascem assim nascem sem ninguém ter clicado nelas.

  async listarQuestionarios(): Promise<Questionario[]> {
    return guardaQuestionarios.ler().map((q) => ({
      ...q,
      pacientes: guardaAtribuicoes.ler().filter((a) => a.questionarioId === q.id).length,
      respostas: guardaEnviosQuest.ler().filter((e) => e.questionarioId === q.id).length,
      perguntas: q.perguntas.map((pg) => ({
        ...pg,
        respondida: guardaEnviosQuest
          .ler()
          .some((e) => e.respostas.some((r) => r.perguntaId === pg.id)),
      })),
    }));
  },

  async salvarQuestionario(
    id: string | null,
    titulo: string,
    descricao: string | null,
    periodicidade: PeriodicidadeQuestionario,
    ativo: boolean,
    perguntas: PerguntaQuestionario[],
  ): Promise<string> {
    const lista = guardaQuestionarios.ler();
    const idFinal = id ?? `q-${Date.now()}`;
    const comIds = perguntas.map((pg, i) => ({
      ...pg,
      id: pg.id ?? `pg-${idFinal}-${i}-${Date.now()}`,
    }));
    const novo: Questionario = {
      id: idFinal,
      titulo,
      descricao,
      periodicidade,
      ativo,
      criadoEm: new Date().toISOString(),
      pacientes: 0,
      respostas: 0,
      perguntas: comIds,
    };
    guardaQuestionarios.escrever(
      id === null ? [...lista, novo] : lista.map((q) => (q.id === id ? novo : q)),
    );
    return idFinal;
  },

  async definirQuestionarioDoPaciente(
    questionarioId: string,
    pacienteId: string,
    ativo: boolean,
  ): Promise<boolean> {
    const atuais = guardaAtribuicoes.ler();
    const tem = atuais.some(
      (a) => a.questionarioId === questionarioId && a.pacienteId === pacienteId,
    );
    if (ativo && !tem) {
      guardaAtribuicoes.escrever([...atuais, { questionarioId, pacienteId }]);
      return true;
    }
    if (!ativo && tem) {
      // Tira da lista, mas NÃO apaga os envios — igual ao banco.
      guardaAtribuicoes.escrever(
        atuais.filter(
          (a) => !(a.questionarioId === questionarioId && a.pacienteId === pacienteId),
        ),
      );
      return false;
    }
    return ativo;
  },

  async meusQuestionarios(): Promise<MeuQuestionario[]> {
    const semana = segundaDaSemana(hojeLocal());
    const meus = guardaAtribuicoes.ler().filter((a) => a.pacienteId === pacienteDemoId());
    return guardaQuestionarios
      .ler()
      .filter((q) => q.ativo && meus.some((a) => a.questionarioId === q.id))
      .map((q) => {
        const enviados = guardaEnviosQuest
          .ler()
          .filter((e) => e.questionarioId === q.id && e.pacienteId === pacienteDemoId());
        const periodo = q.periodicidade === "semanal" ? semana : hojeLocal();
        return {
          id: q.id,
          titulo: q.titulo,
          descricao: q.descricao,
          periodicidade: q.periodicidade,
          periodo,
          pendente: !enviados.some(
            (e) => q.periodicidade !== "semanal" || e.periodo === semana,
          ),
          // Peso e inversão NÃO saem daqui, igual ao banco.
          perguntas: q.perguntas.map((pg) => ({
            id: pg.id ?? "",
            texto: pg.texto,
            tipo: pg.tipo,
            obrigatoria: pg.obrigatoria,
            opcoes: pg.opcoes,
          })),
          enviados: enviados
            .map((e) => ({
              periodo: e.periodo,
              respondidoEm: e.respondidoEm,
              respostas: e.respostas,
            }))
            .sort((a, b) => b.periodo.localeCompare(a.periodo)),
        };
      });
  },

  async responderQuestionario(questionarioId: string, respostas: RespostaEnviada[]) {
    const q = guardaQuestionarios.ler().find((x) => x.id === questionarioId);
    if (!q) return;
    // O PERÍODO É CALCULADO AQUI, e não recebido — igual ao banco.
    const periodo = q.periodicidade === "semanal" ? segundaDaSemana(hojeLocal()) : hojeLocal();
    const atuais = guardaEnviosQuest.ler();
    const existente = atuais.find(
      (e) =>
        e.questionarioId === questionarioId &&
        e.pacienteId === pacienteDemoId() &&
        e.periodo === periodo,
    );
    if (existente) {
      // Reenviar na mesma semana atualiza; o que não veio continua lá.
      const porId = new Map(existente.respostas.map((r) => [r.perguntaId, r]));
      for (const r of respostas) porId.set(r.perguntaId, r);
      guardaEnviosQuest.escrever(
        atuais.map((e) =>
          e === existente
            ? { ...e, respondidoEm: new Date().toISOString(), respostas: [...porId.values()] }
            : e,
        ),
      );
      return;
    }
    guardaEnviosQuest.escrever([
      ...atuais,
      {
        id: `env-${Date.now()}`,
        questionarioId,
        pacienteId: pacienteDemoId(),
        periodo,
        respondidoEm: new Date().toISOString(),
        respostas,
      },
    ]);
  },

  // ---------------------------------------------------------------------
  // Exames
  // ---------------------------------------------------------------------
  //
  // A DEMONSTRAÇÃO NÃO GUARDA O ARQUIVO, só o registro. Guardar de verdade
  // exigiria pôr megabytes no `localStorage`, que estoura a cota do
  // navegador na segunda foto. A tela diz isso quando alguém tenta abrir —
  // um botão que baixasse arquivo vazio seria pior do que um aviso.

  async enviarExame(
    pacienteId: string | null,
    arquivo: File,
    data: string | null,
    descricao: string | null,
  ): Promise<void> {
    const recusa = porQueNaoServe(arquivo);
    if (recusa) throw new Error(recusa);
    const dona = pacienteId ?? pacienteDemoId();
    guardaExames.escrever([
      ...guardaExames.ler(),
      {
        id: `ex-${Date.now()}`,
        pacienteId: dona,
        caminho: caminhoDoExame(dona, arquivo.name),
        nome: arquivo.name,
        tipo: arquivo.type || tipoPelaExtensao(arquivo.name),
        tamanho: arquivo.size,
        data,
        descricao,
        origem: pacienteId === null ? ("paciente" as const) : ("nutricionista" as const),
        criadoEm: new Date().toISOString(),
      },
    ]);
  },

  async examesDoPaciente(pacienteId: string): Promise<Exame[]> {
    return ordenarExames(guardaExames.ler().filter((e) => e.pacienteId === pacienteId));
  },

  async meusExames(): Promise<Exame[]> {
    return ordenarExames(guardaExames.ler().filter((e) => e.pacienteId === pacienteDemoId()));
  },

  async enderecoDoExame(): Promise<string> {
    throw new Error(
      "Na demonstração o arquivo não é guardado de verdade — só o registro. No aplicativo publicado, o arquivo abre normalmente.",
    );
  },

  async apagarExame(id: string): Promise<void> {
    guardaExames.escrever(guardaExames.ler().filter((e) => e.id !== id));
  },

  async espacoDosExames(): Promise<EspacoDosExames> {
    const todos = guardaExames.ler();
    return {
      arquivos: todos.length,
      bytes: todos.reduce((t, e) => t + e.tamanho, 0),
      pacientesComExame: new Set(todos.map((e) => e.pacienteId)).size,
    };
  },

  // ---------------------------------------------------------------------
  // Fases do método
  // ---------------------------------------------------------------------

  async listarFases(): Promise<Fase[]> {
    const historico = guardaMudancasDeFase.ler();
    return guardaFases
      .ler()
      .map((f) => ({
        ...f,
        // Quantas estão NESTA fase agora: pela mudança mais recente de cada
        // paciente, e não por quantas já passaram — igual ao banco.
        pacientes: new Set(
          historico
            .filter((m) => m.faseId === f.id)
            .filter((m) => faseAtualDe(m.pacienteId) === f.id)
            .map((m) => m.pacienteId),
        ).size,
        temHistorico: historico.some((m) => m.faseId === f.id),
      }))
      .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR"));
  },

  async salvarFase(
    id: string | null,
    nome: string,
    descricao: string | null,
    ordem: number,
    ativa: boolean,
  ): Promise<string> {
    const lista = guardaFases.ler();
    const idFinal = id ?? `fase-${Date.now()}`;
    const nova: Fase = {
      id: idFinal,
      nome,
      descricao,
      ordem,
      ativa,
      pacientes: 0,
      temHistorico: false,
    };
    guardaFases.escrever(
      id === null ? [...lista, nova] : lista.map((f) => (f.id === id ? nova : f)),
    );
    return idFinal;
  },

  async excluirFase(id: string): Promise<string> {
    // Com histórico, desativa: apagar levaria o passado de quem passou por
    // ela. Igual ao banco.
    if (guardaMudancasDeFase.ler().some((m) => m.faseId === id)) {
      guardaFases.escrever(
        guardaFases.ler().map((f) => (f.id === id ? { ...f, ativa: false } : f)),
      );
      return "desativada";
    }
    guardaFases.escrever(guardaFases.ler().filter((f) => f.id !== id));
    return "apagada";
  },

  async moverDeFase(
    pacienteId: string,
    faseId: string,
    inicio: string | null,
    observacao: string | null,
  ): Promise<void> {
    const quando = inicio ?? hojeLocal();
    const atuais = guardaMudancasDeFase.ler();
    // O clique repetido não vira linha.
    if (atuais.some((m) => m.pacienteId === pacienteId && m.faseId === faseId && m.inicio === quando)) {
      return;
    }
    guardaMudancasDeFase.escrever([
      ...atuais,
      { id: `mud-${Date.now()}`, pacienteId, faseId, inicio: quando, observacao },
    ]);
  },

  async apagarMudancaDeFase(id: string): Promise<boolean> {
    const antes = guardaMudancasDeFase.ler();
    const depois = antes.filter((m) => m.id !== id);
    guardaMudancasDeFase.escrever(depois);
    return depois.length < antes.length;
  },

  async fasesDoPaciente(pacienteId: string): Promise<MudancaDeFase[]> {
    const fases = guardaFases.ler();
    return guardaMudancasDeFase
      .ler()
      .filter((m) => m.pacienteId === pacienteId)
      .map((m) => ({
        id: m.id,
        faseId: m.faseId,
        fase: fases.find((f) => f.id === m.faseId)?.nome ?? "(fase apagada)",
        inicio: m.inicio,
        observacao: m.observacao,
      }))
      .sort((a, b) => b.inicio.localeCompare(a.inicio));
  },

  async minhaFase(): Promise<MinhaFase> {
    const eu = pacienteDemoId();
    const atual = faseAtualDe(eu);
    if (atual === null) return { temFase: false, fases: [] };
    const mudanca = guardaMudancasDeFase
      .ler()
      .filter((m) => m.pacienteId === eu && m.faseId === atual)
      .sort((a, b) => b.inicio.localeCompare(a.inicio))[0];
    return {
      temFase: true,
      atualId: atual,
      desde: mudanca?.inicio,
      // As ativas MAIS a fase em que ela está, mesmo desativada — senão
      // desativar tiraria do mapa quem estava nela.
      fases: guardaFases
        .ler()
        .filter((f) => f.ativa || f.id === atual)
        .sort((a, b) => a.ordem - b.ordem)
        .map((f) => ({
          id: f.id,
          nome: f.nome,
          descricao: f.descricao,
          ordem: f.ordem,
          atual: f.id === atual,
        })),
    };
  },

  // ---------------------------------------------------------------------
  // Cobrança
  // ---------------------------------------------------------------------

  async painelFinanceiro(): Promise<PainelFinanceiro> {
    const hoje = hojeLocal();
    const mes = `${hoje.slice(0, 7)}-01`;
    const cobrancas = guardaCobrancas.ler().map((c) => ({
      ...c,
      // "atrasada" é CONTA, não coluna — igual ao banco. Ver a 0043.
      situacao:
        c.status === "paga"
          ? ("paga" as const)
          : c.status === "cancelada"
            ? ("cancelada" as const)
            : c.vencimento < hoje
              ? ("atrasada" as const)
              : ("aberta" as const),
    }));
    const soma = (f: (c: Cobranca) => boolean) =>
      cobrancas.filter(f).reduce((t, c) => t + c.valor, 0);
    return {
      cobrancas: cobrancas.sort((a, b) => b.vencimento.localeCompare(a.vencimento)),
      totais: {
        aberto: soma((c) => c.status === "aberta"),
        atrasado: soma((c) => c.status === "aberta" && c.vencimento < hoje),
        recebidoNoMes: soma((c) => c.status === "paga" && (c.pagoEm ?? "") >= mes),
        previstoNoMes: soma((c) => c.status !== "cancelada" && c.competencia === mes),
      },
    };
  },

  async valoresDosPacientes(): Promise<ValorDoPaciente[]> {
    const valores = guardaValores.ler();
    return mesclar(pacientesDaSemente(), guardaPacientes.ler())
      .filter((p) => p.status !== "suspenso")
      .map((p) => {
        const v = valores.find((x) => x.id === p.id);
        return {
          id: p.id,
          nome: p.nome,
          telefone: p.telefone,
          situacao: p.situacao,
          valorMensal: v?.valorMensal ?? null,
          diaDeVencimento: v?.diaDeVencimento ?? null,
        };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  },

  async gerarCobrancas(competencia: string): Promise<number> {
    const mes = `${(competencia || hojeLocal()).slice(0, 7)}-01`;
    const atuais = guardaCobrancas.ler();
    const valores = await repositorioLocal.valoresDosPacientes();
    const novas: Cobranca[] = [];
    for (const v of valores) {
      if (!v.valorMensal || v.valorMensal <= 0) continue;
      // Sem duplicar o mês, igual ao `on conflict` do banco.
      if (atuais.some((c) => c.pacienteId === v.id && c.competencia === mes)) continue;
      const d = String(v.diaDeVencimento ?? 10).padStart(2, "0");
      novas.push({
        id: `cob-${v.id}-${mes}`,
        pacienteId: v.id,
        paciente: v.nome,
        telefone: v.telefone,
        competencia: mes,
        valor: v.valorMensal,
        vencimento: `${mes.slice(0, 7)}-${d}`,
        status: "aberta",
        situacao: "aberta",
        pagoEm: null,
        forma: null,
        observacao: null,
      });
    }
    guardaCobrancas.escrever([...atuais, ...novas]);
    return novas.length;
  },

  async baixarCobranca(id: string, paga: boolean, forma: string | null, pagoEm: string | null) {
    guardaCobrancas.escrever(
      guardaCobrancas.ler().map((c) =>
        c.id === id
          ? {
              ...c,
              status: paga ? ("paga" as const) : ("aberta" as const),
              // Desfazer limpa a data e a forma, igual ao banco.
              pagoEm: paga ? (pagoEm ?? hojeLocal()) : null,
              forma: paga ? forma : null,
            }
          : c,
      ),
    );
    return paga ? "paga" : "aberta";
  },

  async cancelarCobranca(id: string): Promise<boolean> {
    let mudou = false;
    guardaCobrancas.escrever(
      guardaCobrancas.ler().map((c) => {
        // Paga não se cancela por engano.
        if (c.id !== id || c.status === "paga") return c;
        mudou = true;
        return { ...c, status: "cancelada" as const, pagoEm: null, forma: null };
      }),
    );
    return mudou;
  },

  async definirValorDoPaciente(pacienteId: string, valor: number | null, dia: number | null) {
    const atuais = guardaValores.ler().filter((v) => v.id !== pacienteId);
    guardaValores.escrever([
      ...atuais,
      { id: pacienteId, valorMensal: valor, diaDeVencimento: dia },
    ]);
    return { valor, dia };
  },

  async marcarRevisado(envioId: string, revisado: boolean): Promise<boolean> {
    const atuais = guardaEnviosQuest.ler();
    guardaEnviosQuest.escrever(
      atuais.map((e) => (e.id === envioId ? { ...e, revisado } : e)),
    );
    return revisado;
  },

  async questionariosDoPaciente(pacienteId: string): Promise<QuestionarioDoPaciente[]> {
    return guardaQuestionarios.ler().map((q) => ({
      id: q.id,
      titulo: q.titulo,
      periodicidade: q.periodicidade,
      ativo: q.ativo,
      atribuido: guardaAtribuicoes
        .ler()
        .some((a) => a.questionarioId === q.id && a.pacienteId === pacienteId),
      // Aqui peso e inversão VÃO: é a régua de quem pontua.
      perguntas: q.perguntas.map((pg) => ({
        id: pg.id ?? "",
        texto: pg.texto,
        tipo: pg.tipo,
        peso: pg.peso,
        invertida: pg.invertida,
        opcoes: pg.opcoes,
      })),
      envios: guardaEnviosQuest
        .ler()
        .filter((e) => e.questionarioId === q.id && e.pacienteId === pacienteId)
        .map((e) => ({
          id: e.id,
          periodo: e.periodo,
          respondidoEm: e.respondidoEm,
          revisado: e.revisado === true,
          respostas: e.respostas,
        }))
        .sort((a, b) => b.periodo.localeCompare(a.periodo)),
    }));
  },

};

/**
 * Cardio e metas da demonstração.
 *
 * As metas são as da SEMANA CORRENTE de propósito: metas de semana passada
 * não aparecem na tela (seria cobrança por uma semana que já acabou), e a
 * demonstração ficaria sem nada para mostrar.
 *
 * Os números são escolhidos para a tela mostrar os dois estados que
 * importam: uma meta ainda em andamento (3 de 4 treinos) e uma quase lá
 * (80 de 90 minutos).
 */
const CARDIO_DEMO: CardioSessao[] = (() => {
  const d = new Date();
  const segunda = new Date(d);
  segunda.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const dia = (n: number) => {
    const x = new Date(segunda);
    x.setDate(segunda.getDate() + n);
    return x.toISOString().slice(0, 10);
  };
  return [
    { id: "c3", data: dia(4), tipo: "Caminhada", duracaoMin: 20, distanciaKm: 2.1,
      intensidade: "Leve", observacao: null },
    { id: "c2", data: dia(2), tipo: "Bike", duracaoMin: 30, distanciaKm: null,
      intensidade: null, observacao: "Na academia" },
    { id: "c1", data: dia(0), tipo: "Caminhada", duracaoMin: 30, distanciaKm: 3.2,
      intensidade: "Leve", observacao: null },
  ];
})();

const METAS_DEMO: MetaSemanal[] = (() => {
  const d = new Date();
  const segunda = new Date(d);
  segunda.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const semana = segunda.toISOString().slice(0, 10);
  return [
    { id: "m1", semanaInicio: semana, tipo: "treino", alvo: 4, unidade: "treinos" },
    { id: "m2", semanaInicio: semana, tipo: "cardio", alvo: 90, unidade: "minutos" },
  ];
})();

function diasAtras(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function metaDemo(id: string, diasCumpridos: number[]): Meta {
  return {
    id,
    titulo: "Beber 2 litros de água",
    descricao: null,
    categoria: "Hidratação",
    frequencia: "diaria",
    alvo: 2,
    unidade: "litros",
    inicio: diasAtras(40),
    prazo: null,
    status: "ativa",
    registros: diasCumpridos.map((d) => ({
      id: `${id}-${d}`,
      data: diasAtras(d),
      quantidade: 2,
      observacao: null,
    })),
  };
}

/** Uma sequência de dias cumpridos, para a demonstração ter adesão de verdade. */
function seguidos(ate: number, passo = 1): number[] {
  const saida: number[] = [];
  for (let d = 1; d <= ate; d += passo) saida.push(d);
  return saida;
}

const PANORAMA_DEMO: PanoramaDoPaciente[] = [
  {
    id: "pac-mariana",
    fase: "Reintrodução",
    faseDesde: "2026-09-01",
    nome: "Mariana Silva",
    condicao: "SII",
    email: "mariana@exemplo.test",
    situacao: "ativo",
    dataInicio: diasAtras(60),
    dataFim: diasAtras(-30),
    diasRestantes: 30,
    proximaConsulta: { data: diasAtras(-1), hora: "15:00", tipo: "retorno" },
    ultimaConsulta: {
      data: diasAtras(14),
      tipo: "retorno",
      resumo: "Ajuste no jantar · manteve plano base",
    },
    ultimoRegistro: diasAtras(1),
    pesoInicial: 77,
    pesoAtual: 72.8,
    metas: [metaDemo("md1", seguidos(27))],
  },
  {
    id: "pac-juliana",
    fase: "Manutenção",
    faseDesde: "2026-08-15",
    nome: "Juliana Ferreira",
    condicao: "Emagrecimento",
    email: "juliana@exemplo.test",
    situacao: "ativo",
    dataInicio: diasAtras(90),
    dataFim: diasAtras(-60),
    diasRestantes: 60,
    proximaConsulta: null,
    ultimaConsulta: { data: diasAtras(7), tipo: "retorno", resumo: "Introduziu lanche da tarde" },
    ultimoRegistro: diasAtras(0),
    pesoInicial: 68,
    pesoAtual: 66.4,
    metas: [metaDemo("md2", seguidos(26))],
  },
  {
    id: "pac-renata",
    fase: "Restrição",
    faseDesde: "2026-09-10",
    nome: "Renata Costa",
    condicao: "SIBO",
    email: "renata@exemplo.test",
    situacao: "ativo",
    dataInicio: diasAtras(45),
    dataFim: diasAtras(-15),
    diasRestantes: 15,
    proximaConsulta: { data: diasAtras(-5), hora: null, tipo: "retorno" },
    ultimaConsulta: { data: diasAtras(30), tipo: "primeira", resumo: "Montou o plano base" },
    ultimoRegistro: diasAtras(12),
    pesoInicial: 81,
    pesoAtual: 80.2,
    metas: [metaDemo("md3", seguidos(27, 2))],
  },
  {
    id: "pac-ana",
    fase: null,
    faseDesde: null,
    nome: "Ana Luiza",
    condicao: "Acompanhamento geral",
    email: "ana@exemplo.test",
    situacao: "ativo",
    dataInicio: diasAtras(5),
    dataFim: diasAtras(-25),
    diasRestantes: 25,
    proximaConsulta: null,
    ultimaConsulta: { data: diasAtras(5), tipo: "primeira", resumo: "Primeira consulta" },
    ultimoRegistro: diasAtras(0),
    pesoInicial: null,
    pesoAtual: null,
    metas: [],
  },
];

const CONSULTAS_DEMO: Consulta[] = [
  {
    id: "c1",
    data: diasAtras(-1),
    hora: "15:00",
    tipo: "retorno",
    status: "agendada",
    resumo: null,
    observacoes: null,
  },
  {
    id: "c2",
    data: diasAtras(14),
    hora: "15:00",
    tipo: "retorno",
    status: "concluida",
    resumo: "Ajuste no jantar · manteve plano base · reforçar estratégia fim de semana",
    observacoes: "Relatou semana corrida no trabalho.",
  },
  {
    id: "c3",
    data: diasAtras(28),
    hora: null,
    tipo: "retorno",
    status: "concluida",
    resumo: "Perda de 1,2 kg · introduziu lanche da tarde · humor melhorou",
    observacoes: null,
  },
];

const METAS_ACOMPANHAMENTO_DEMO: Meta[] = [
  {
    id: "meta-agua",
    titulo: "Beber 2 litros de água",
    descricao: "Espalhar ao longo do dia, sem deixar tudo para a noite.",
    categoria: "Hidratação",
    frequencia: "diaria",
    alvo: 2,
    unidade: "litros",
    inicio: diasAtras(20),
    prazo: null,
    status: "ativa",
    registros: [
      { id: "r1", data: diasAtras(0), quantidade: 1.5, observacao: null },
      { id: "r2", data: diasAtras(1), quantidade: 2, observacao: null },
      { id: "r3", data: diasAtras(2), quantidade: 2, observacao: null },
      { id: "r4", data: diasAtras(4), quantidade: 1, observacao: "Dia corrido" },
    ],
  },
  {
    id: "meta-marmita",
    titulo: "Levar marmita para o trabalho",
    descricao: null,
    categoria: "Rotina",
    frequencia: "semanal",
    alvo: 3,
    unidade: "dias",
    inicio: diasAtras(20),
    prazo: null,
    status: "ativa",
    registros: [
      { id: "r5", data: diasAtras(0), quantidade: null, observacao: null },
      { id: "r6", data: diasAtras(2), quantidade: null, observacao: null },
    ],
  },
  {
    id: "meta-sono",
    titulo: "Dormir antes da meia-noite",
    descricao: null,
    categoria: null,
    frequencia: "diaria",
    alvo: null,
    unidade: null,
    inicio: diasAtras(10),
    prazo: null,
    status: "ativa",
    registros: [{ id: "r7", data: diasAtras(1), quantidade: null, observacao: null }],
  },
];

const TREINO_DEMO: Treino = {
  id: "treino-demo",
  nome: "Treino A — inferiores",
  observacao: "Aquecer 5 minutos antes.",
  ativo: true,
  origem: "nutricionista",
  podeEditar: false,
  exercicios: [
    {
      id: "ex-agacho",
      nome: "Agachamento",
      ordem: 0,
      seriesPlanejadas: 3,
      repeticoesMin: 8,
      repeticoesMax: 10,
      observacao: null,
    },
    {
      id: "ex-leg",
      nome: "Leg press",
      ordem: 1,
      seriesPlanejadas: 3,
      repeticoesMin: 10,
      repeticoesMax: 12,
      observacao: null,
    },
    {
      // Exercício sem carga: a coluna de carga fica em travessão, não em
      // zero — e a evolução dele é por repetição.
      id: "ex-prancha",
      nome: "Prancha",
      ordem: 2,
      seriesPlanejadas: 3,
      repeticoesMin: null,
      repeticoesMax: null,
      observacao: "Segundos, não repetições.",
    },
  ],
};

const SESSOES_DEMO: SessaoDeTreino[] = (() => {
  const diasAtras = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  };
  const dias = [17, 14, 10, 7, 3, 0];
  const agacho: [number, number][] = [
    [60, 6],
    [60, 7],
    [60, 8],
    [60, 10],
    [62, 6],
    [62, 7],
  ];
  return dias
    .map((dia, i) => {
      const [carga, reps] = agacho[i]!;
      return {
        id: `sessao-demo-${i}`,
        data: diasAtras(dia),
        treinoId: "treino-demo",
        observacao: null,
        series: [
          {
            id: `s-${i}-1`,
            exercicioId: "ex-agacho",
            exercicioNome: "Agachamento",
            numero: 1,
            carga,
            repeticoes: reps,
            observacao: null,
          },
          {
            id: `s-${i}-2`,
            exercicioId: "ex-leg",
            exercicioNome: "Leg press",
            numero: 1,
            carga: 80 + i * 5,
            repeticoes: 12,
            observacao: null,
          },
          {
            id: `s-${i}-3`,
            exercicioId: "ex-prancha",
            exercicioNome: "Prancha",
            numero: 1,
            carga: null,
            repeticoes: 30 + i * 5,
            observacao: null,
          },
        ],
      };
    })
    // Da mais nova para a mais antiga, como o banco entrega.
    .reverse();
})();

/**
 * As três avaliações da demonstração, da mais nova para a mais antiga — a
 * mesma ordem em que o banco as entrega.
 */
const AVALIACOES_DEMO: { id: string; data: string; dados: DadosAvaliacao }[] = (() => {
  const diasAtras = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  };
  return [
    {
      id: "demo-3",
      data: diasAtras(0),
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
    },
    {
      id: "demo-2",
      data: diasAtras(45),
      dados: {
        metodo: "4 Pregas: Protocolo de Faulkner",
        peso: 48.6,
        altura: 159,
        idade: 22,
        percentualGordura: 11.8,
        massaGorda: 5.7,
        massaMagra: 42.9,
        imc: 19.2,
        somaDobras: 36.1,
        dobras: [
          { nome: "Tríceps", valor: "10,4 mm" },
          { nome: "Subescapular", valor: "8,6 mm" },
          { nome: "Supra-ilíaca", valor: "8,3 mm" },
          { nome: "Abdominal", valor: "8,8 mm" },
        ],
        circunferencias: [
          { nome: "Cintura", valor: "62,5 cm" },
          { nome: "Abdômen", valor: "64,5 cm" },
          { nome: "Quadril", valor: "87,5 cm" },
        ],
        observacao: null,
      },
    },
    {
      id: "demo-1",
      data: diasAtras(110),
      dados: {
        metodo: "4 Pregas: Protocolo de Faulkner",
        peso: 50.2,
        altura: 159,
        idade: 21,
        percentualGordura: 13.4,
        massaGorda: 6.7,
        massaMagra: 43.5,
        imc: 19.8,
        somaDobras: 41.0,
        dobras: [
          { nome: "Tríceps", valor: "11,8 mm" },
          { nome: "Subescapular", valor: "9,4 mm" },
          { nome: "Supra-ilíaca", valor: "9,6 mm" },
          { nome: "Abdominal", valor: "10,2 mm" },
          // Medida nesta consulta e não nas seguintes: é o travessão.
          { nome: "Coxa", valor: "18,0 mm" },
        ],
        circunferencias: [
          { nome: "Cintura", valor: "64,0 cm" },
          { nome: "Abdômen", valor: "66,0 cm" },
          { nome: "Quadril", valor: "88,0 cm" },
        ],
        observacao: null,
      },
    },
  ];
})();

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
    marcacaoDaNutri: false,
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
