-- =============================================================================
-- CENTRAL DO PACIENTE — 0029: a avaliação física com histórico
--
-- "E ao longo do tempo, com várias avaliações, quero que vá gerando
-- evoluções."
--
-- A tela da paciente recebia só a ÚLTIMA avaliação. Com uma avaliação só
-- não há evolução nenhuma para mostrar, e buscar as anteriores uma a uma
-- seria uma ida ao banco por consulta feita.
--
-- Então `minha_avaliacao()` passa a devolver, junto, o histórico publicado
-- dela: data e dados de cada avaliação, da mais nova para a mais antiga.
-- São poucas linhas por paciente — uma por consulta — e é o que permite a
-- coluna por avaliação e a linha do peso no tempo.
--
-- O QUE NÃO MUDA, e é de propósito:
--
--   * a RLS continua a mesma. Só entra avaliação PUBLICADA e só da própria
--     paciente. Rascunho não vaza por este caminho novo;
--   * nada é recalculado aqui. Os números são os que a nutricionista
--     lançou; o app só os mostra lado a lado;
--   * as chaves antigas (`id`, `data`, `dados`, `total`, `inicio`)
--     continuam no mesmo lugar, com o mesmo significado. Uma versão antiga
--     da tela continua funcionando contra esta função.
-- =============================================================================

create or replace function minha_avaliacao()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
  v_ultima avaliacoes_fisicas;
  v_total integer;
begin
  v_paciente := meu_paciente_id();
  if v_paciente is null then return null; end if;

  select * into v_ultima from avaliacoes_fisicas
  where paciente_id = v_paciente and publicada
  order by data desc, criado_em desc
  limit 1;

  if v_ultima.id is null then return null; end if;

  select count(*) into v_total from avaliacoes_fisicas
  where paciente_id = v_paciente and publicada;

  return jsonb_build_object(
    'id', v_ultima.id,
    'data', v_ultima.data,
    'dados', v_ultima.dados,
    'total', v_total,
    'inicio', (select min(data) from avaliacoes_fisicas
                where paciente_id = v_paciente and publicada),
    -- O histórico inteiro, da mais nova para a mais antiga — a mesma ordem
    -- de `avaliacoes_do_paciente`, para as duas telas lerem igual.
    'historico', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'data', a.data, 'dados', a.dados)
             order by a.data desc, a.criado_em desc)
      from avaliacoes_fisicas a
      where a.paciente_id = v_paciente and a.publicada
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function minha_avaliacao() from anon, public;
grant execute on function minha_avaliacao() to authenticated;
