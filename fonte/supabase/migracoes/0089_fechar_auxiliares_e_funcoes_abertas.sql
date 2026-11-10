-- =============================================================================
-- 0089 — Fechando o que a vistoria de 09/11 achou aberto
--
-- 1) AUXILIARES DE TREINO CHAMÁVEIS POR QUALQUER UM.
--    `_inserir_exercicios_treino(treino, exercicios)` e
--    `_inserir_series_sessao(sessao, series)` são `security definer`, apagam e
--    regravam os exercícios de um treino (ou as séries de uma sessão) e NÃO
--    conferem de quem é o treino. Estavam executáveis por conta logada e até
--    por visitante sem login: quem soubesse o id de um treino alheio apagava
--    os exercícios dele. O id é um uuid, difícil de adivinhar — mas uma
--    proteção que depende de ninguém descobrir um número não é proteção.
--
--    Elas só são chamadas de dentro de `salvar_treino` e
--    `registrar_sessao_treino`, que são `security definer`, conferem o dono e
--    rodam com a permissão do dono da função. Tirar o acesso de fora não muda
--    nenhuma tela. (`_st_inserir_ex` e `_teste_ddl` são sobras do mesmo tipo.)
--
-- 2) FUNÇÕES `security definer` EXECUTÁVEIS POR VISITANTE.
--    As migrações de treino v2, Hot Slim e check-in concederam a
--    `authenticated` sem tirar de `anon` — o mesmo defeito que a 0051 fechou
--    em setembro. Aqui o fecho é por varredura, e não por lista: a próxima
--    função esquecida também é pega.
--
-- A bateria 21_permissoes_padrao.sql confere o item 2.
-- =============================================================================

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('_inserir_exercicios_treino', '_inserir_series_sessao', '_st_inserir_ex', '_teste_ddl')
  loop
    execute format('revoke all on function %s from anon, authenticated, public', f.assinatura);
  end loop;

  for f in
    select p.oid::regprocedure as assinatura
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      left join pg_depend d on d.objid = p.oid and d.deptype = 'e'
     where n.nspname = 'public'
       and p.prosecdef
       and d.objid is null                       -- não mexe em função de extensão
       and has_function_privilege('anon', p.oid, 'execute')
  loop
    execute format('revoke all on function %s from anon, public', f.assinatura);
    execute format('grant execute on function %s to authenticated', f.assinatura);
  end loop;
end;
$$;
