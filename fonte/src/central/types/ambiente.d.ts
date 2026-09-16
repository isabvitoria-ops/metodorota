/// <reference types="vite/client" />

/**
 * Variáveis de ambiente do app (§64 do briefing).
 *
 * Só entra aqui o que PODE aparecer no navegador. Tudo que começa com
 * `VITE_` é embutido no pacote e fica visível para quem abrir o código-fonte
 * da página — por isso a chave de serviço do Supabase (`service_role`) nunca
 * pode ser declarada aqui nem em lugar nenhum do frontend. A chave anônima
 * pode: ela é pública por desenho, e quem protege os dados é a política de
 * acesso do banco, não o segredo da chave.
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** "1" reativa o app antigo de acompanhamento em /consultorio. Fora de produção. */
  readonly VITE_APP_ANTIGO?: string;
  /** "hash" troca as rotas para `#/rota` — usado só pelo build de demonstração. */
  readonly VITE_ROTEADOR?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
