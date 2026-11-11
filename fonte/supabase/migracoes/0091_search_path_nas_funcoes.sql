-- =============================================================================
-- 0091 — Toda função do aplicativo com `search_path` fixo
--
-- Doze funções ficaram sem `search_path`: a família do treino (`salvar_treino`,
-- `meu_treino`, `meus_treinos`, `registrar_sessao_treino`, `sessoes_de_treino`,
-- `treinos_do_paciente`, as auxiliares `_inserir_*`) e
-- `apagar_marcadores_da_data`. Nove delas são `security definer`: rodam com a
-- permissão do dono, e sem `search_path` fixo procuram tabelas e funções no
-- caminho de quem chamou. É o aviso "Function Search Path Mutable" do painel
-- do Supabase, e a mesma trava que a 0010 pôs nas funções do desafio.
--
-- Nenhuma dessas funções usa nada fora do esquema `public` (conferido no
-- banco em 11/11), então fixar em `public` não muda o que elas fazem.
--
-- O fecho é por varredura, como na 0089: a próxima função criada sem a trava
-- também é pega quando esta migração rodar de novo. Função de extensão fica
-- de fora.
-- =============================================================================

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      left join pg_depend d on d.objid = p.oid and d.deptype = 'e'
     where n.nspname = 'public'
       and p.prokind = 'f'
       and d.objid is null
       and not exists (
         select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%'
       )
  loop
    execute format('alter function %s set search_path = public', f.assinatura);
  end loop;
end;
$$;
