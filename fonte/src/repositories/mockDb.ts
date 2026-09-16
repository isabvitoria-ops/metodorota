import * as mocks from "@/data/mocks";
import type {
  AlertaClinico, CheckIn, Conversa, Mensagem, Nutricionista, Paciente, Plano, PostFeed,
  PreferenciasNotificacao, RegistroDiario, RespostaQuestionario, SessaoFoto, RegistroPeso,
} from "@/types";

/**
 * "Banco" em memória usado pelos repositories enquanto não há Supabase
 * plugado. Cada repository só fala com este arquivo — nenhum componente ou
 * service importa `@/data/mocks` diretamente. Trocar isto por chamadas
 * Supabase reais não deve exigir mudar nada fora de `repositories/`.
 */
function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export const db = {
  nutricionista: clone(mocks.NUTRICIONISTA) as Nutricionista,
  pacientes: clone(mocks.PACIENTES) as Paciente[],
  resumosAdesao: clone(mocks.RESUMOS_ADESAO),
  planos: [clone(mocks.PLANO_MARINA)] as Plano[],
  historicoVersoes: clone(mocks.HISTORICO_VERSOES_MARINA),
  montadorPools: { [mocks.PACIENTE_MARINA_ID]: clone(mocks.MONTADOR_POOL_MARINA) } as Record<string, typeof mocks.MONTADOR_POOL_MARINA>,
  fichasAlimento: clone(mocks.FICHAS_ALIMENTO),
  materiais: clone(mocks.MATERIAIS),
  artigosBiblioteca: clone(mocks.ARTIGOS_BIBLIOTECA),
  conversas: [clone(mocks.CONVERSA_MARINA)] as Conversa[],
  mensagens: clone(mocks.MENSAGENS_MARINA) as Mensagem[],
  posts: clone(mocks.POSTS_FEED) as PostFeed[],
  curtidas: clone(mocks.CURTIDAS_BASE) as Record<string, number>,
  curtidasPorPaciente: {} as Record<string, Set<string>>,
  templatesQuestionario: [clone(mocks.TEMPLATE_MENSAL)],
  respostasQuestionario: [] as RespostaQuestionario[],
  preferencias: { [mocks.PACIENTE_MARINA_ID]: clone(mocks.PREFERENCIAS_MARINA) } as Record<string, PreferenciasNotificacao>,
  consentimentos: clone(mocks.CONSENTIMENTOS),
  checkins: clone(mocks.HISTORICO_CHECKINS_MARINA) as CheckIn[],
  registrosDiario: clone(mocks.REGISTROS_DIARIO_INICIAIS) as RegistroDiario[],
  sessoesFoto: clone(mocks.SESSOES_FOTO_MARINA) as SessaoFoto[],
  pesos: [] as RegistroPeso[],
  alertasClinicos: [] as AlertaClinico[],
};

/** Simula latência de rede — mantém as telas honestas sobre precisar de estado de carregamento (briefing §7, §18). */
export function atraso(ms = 220): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let contadorId = 1000;
export function gerarId(prefixo: string): string {
  contadorId += 1;
  return `${prefixo}-${contadorId}`;
}

export function agoraISO(): string {
  return new Date().toISOString();
}
