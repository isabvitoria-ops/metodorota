-- =============================================================================
-- CENTRAL DO PACIENTE — 0051: fechando o que a vistoria de 27/09 achou aberto
--
-- O Supabase dá EXECUTE explícito a `anon` e `authenticated` em toda função
-- nova de `public`. As migrações 0041, 0044 e 0045 concederam a
-- `authenticated` sem tirar de `anon`, e sete funções ficaram executáveis
-- por quem nem entrou. Testadas uma a uma como visitante: nenhuma devolvia
-- dado nem gravava — cada uma recusa lá dentro. Mas uma proteção que só
-- existe no corpo da função some no dia em que alguém mexer no corpo.
--
-- E duas auxiliares recebem o id de QUALQUER paciente sem conferir o dono:
--
--   * `reintroducao_json` — só não vazava porque, lá dentro, chama outra
--     função que confere. Proteção por acaso.
--   * `rastreio_ativo` — dizia "sim/não" sobre o rastreio de outra paciente.
--
-- As duas só são chamadas de dentro de funções `security definer`, que
-- rodam com a permissão do dono e não dependem desta. Tirar de
-- `authenticated` não muda nenhuma tela.
--
-- A bateria 21_permissoes_padrao.sql confere isto, com o banco de teste
-- agora imitando as permissões que o Supabase dá sozinho.
-- =============================================================================

revoke all on function meus_exames() from anon, public;
revoke all on function minha_pasta_de_exames() from anon, public;
revoke all on function apagar_exame(uuid) from anon, public;
revoke all on function registrar_exame(uuid, text, text, text, bigint, date, text) from anon, public;
revoke all on function meus_questionarios() from anon, public;
revoke all on function responder_questionario(uuid, jsonb) from anon, public;
revoke all on function minha_fase() from anon, public;

grant execute on function meus_exames() to authenticated;
grant execute on function minha_pasta_de_exames() to authenticated;
grant execute on function apagar_exame(uuid) to authenticated;
grant execute on function registrar_exame(uuid, text, text, text, bigint, date, text) to authenticated;
grant execute on function meus_questionarios() to authenticated;
grant execute on function responder_questionario(uuid, jsonb) to authenticated;
grant execute on function minha_fase() to authenticated;

revoke all on function reintroducao_json(uuid, boolean) from anon, authenticated, public;
revoke all on function rastreio_ativo(uuid) from anon, authenticated, public;

-- Conferência: deve voltar tudo "false" (nenhuma aberta).
select p.oid::regprocedure as funcao,
       has_function_privilege('anon', p.oid, 'execute') as visitante_executa
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('meus_exames', 'minha_pasta_de_exames', 'apagar_exame', 'registrar_exame',
                    'meus_questionarios', 'responder_questionario', 'minha_fase',
                    'reintroducao_json', 'rastreio_ativo');
