/**
 * Rotas da Central.
 *
 * A Central ocupa a raiz do site: o paciente recebe um link e cai direto
 * nela, sem caminho extra para decorar. As telas de conta ficam ao lado, e a
 * área da nutricionista embaixo de `/admin`.
 *
 * `/central/...` continua respondendo por compatibilidade com links que já
 * tenham sido enviados — ele redireciona para o caminho novo.
 */
export const rotas = {
  home: "/",
  trocas: "/trocas",
  /** Abre a calculadora já com o alimento escolhido. */
  trocaCom: (alimentoId: string) => `/trocas?de=${encodeURIComponent(alimentoId)}`,
  substituicoes: "/substituicoes",
  grupo: (grupoId: string) => `/substituicoes/${grupoId}`,
  comerFora: "/comer-fora",
  categoria: (categoriaId: string) => `/comer-fora/${categoriaId}`,
  estabelecimento: (categoriaId: string, estabelecimentoId: string) =>
    `/comer-fora/${categoriaId}/${estabelecimentoId}`,
  opcao: (categoriaId: string, opcaoId: string) =>
    `/comer-fora/${categoriaId}?opcao=${encodeURIComponent(opcaoId)}`,
  // `guias` saiu a pedido dela. O endereço antigo não vira redirecionamento
  // porque não há para onde mandar: cai no `*` e volta para a tela inicial,
  // que é o destino certo para um link que não existe mais.
  protocolo: "/protocolo",
  avaliacao: "/avaliacao",
  treino: "/evolucao",
  metas: "/metas",
  documentos: "/documentos",
  desafio: "/desafio",
  rastreabilidade: "/rastreabilidade",
  salvos: "/salvos",
  busca: (consulta?: string) => (consulta ? `/busca?q=${encodeURIComponent(consulta)}` : "/busca"),
  diagnostico: "/diagnostico",

  // Conta
  entrar: "/entrar",
  definirSenha: "/definir-senha",
  recuperarSenha: "/recuperar-senha",
  semAcesso: "/sem-acesso",

  // Área da nutricionista
  admin: "/admin",
  adminPacientes: "/admin/pacientes",
  adminPaciente: (id: string) => `/admin/pacientes/${id}`,
  adminAlimentos: "/admin/alimentos",
  adminEquivalencias: "/admin/equivalencias",
  adminConteudos: "/admin/conteudos",
  adminConfiguracoes: "/admin/configuracoes",
  adminDesafios: "/admin/desafios",
  adminRastreabilidade: "/admin/rastreabilidade",
  adminProtocolos: "/admin/protocolos",
  adminProtocolo: (pacienteId: string) => `/admin/protocolos/${pacienteId}`,
  adminTreinos: "/admin/treinos",
  adminMetas: "/admin/metas",
  adminTreino: (pacienteId: string) => `/admin/treinos/${pacienteId}`,
};

/** Prefixo antigo, mantido para não quebrar link já enviado a paciente. */
export const PREFIXO_ANTIGO = "/central";
