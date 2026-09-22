-- =============================================================================
-- CENTRAL DO PACIENTE — 0037: o que mudou desde a última consulta
--
-- Item 3 da lista aprovada. A auditoria procurou isso no concorrente e não
-- achou em lugar nenhum: nenhum resumo voltado à PRÓPRIA paciente do tipo
-- "o que mudou desde a sua última consulta".
--
-- É percepção de valor: a paciente abre o aplicativo e vê, em números que
-- ela mesma produziu, que alguém está acompanhando.
--
-- SÓ CONTAGEM, NENHUM JUÍZO. A função devolve números; quem escreve a frase
-- é a tela, e nenhuma frase diz se o número é bom ou ruim. Perder peso é
-- objetivo de umas pacientes e não de outras; "você melhorou" seria o
-- aplicativo decidindo o que é melhorar.
--
-- E NADA AQUI É NOVO NO BANCO: tudo já estava guardado. O que faltava era
-- alguém perguntar "desde quando" e contar.
--
-- O MARCO É A ÚLTIMA CONSULTA CONCLUÍDA, e não "os últimos 30 dias": é a
-- régua que faz sentido para ela ("desde que nos vimos"), e é a régua que a
-- profissional usa na consulta seguinte. Sem consulta registrada, não há
-- marco — e aí a resposta é vazia em vez de inventada.
-- =============================================================================

create or replace function o_que_mudou()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
  v_desde date;
  v_peso_antes numeric;
  v_peso_agora numeric;
begin
  v_paciente := meu_paciente_id();
  if v_paciente is null then return null; end if;

  select c.data into v_desde
  from consultas c
  where c.paciente_id = v_paciente and c.status = 'concluida'
  order by c.data desc limit 1;

  -- Sem consulta concluída não há "desde a última consulta". Devolver os
  -- últimos 30 dias no lugar seria responder outra pergunta com a cara
  -- desta — e ela não teria como saber da troca.
  if v_desde is null then
    return jsonb_build_object('temMarco', false);
  end if;

  select (a.dados ->> 'peso')::numeric into v_peso_antes
  from avaliacoes_fisicas a
  where a.paciente_id = v_paciente and a.publicada
    and (a.dados ->> 'peso') is not null and a.data <= v_desde
  order by a.data desc limit 1;

  select (a.dados ->> 'peso')::numeric into v_peso_agora
  from avaliacoes_fisicas a
  where a.paciente_id = v_paciente and a.publicada
    and (a.dados ->> 'peso') is not null and a.data > v_desde
  order by a.data desc limit 1;

  return jsonb_build_object(
    'temMarco', true,
    'desde', v_desde,
    'dias', hoje_sp() - v_desde,

    'proximaConsulta', (
      select c.data from consultas c
      where c.paciente_id = v_paciente and c.status = 'agendada' and c.data >= hoje_sp()
      order by c.data limit 1
    ),

    -- Peso: só existe quando há avaliação dos DOIS lados do marco. Com uma
    -- ponta só não há variação, e mostrar o peso atual sozinho responderia
    -- "quanto você pesa" em vez de "o que mudou".
    'pesoAntes', v_peso_antes,
    'pesoAgora', v_peso_agora,

    'marcacoesDeMeta', (
      select count(*) from meta_registros r
      join metas m on m.id = r.meta_id
      where m.paciente_id = v_paciente and r.data > v_desde
    ),
    'metasAtivas', (
      select count(*) from metas
      where paciente_id = v_paciente and status = 'ativa'
    ),

    'registrosDeRastreio', (
      select count(*) from reintroducao_registros
      where paciente_id = v_paciente and data > v_desde
    ),
    'alimentosTestados', (
      select count(distinct item_id) from reintroducao_registros
      where paciente_id = v_paciente and data > v_desde
    ),

    -- O treino só conta quando a aba está liberada para ela: com a aba
    -- desligada, "0 treinos" seria cobrança por uma porta que ela não tem.
    'treinos', case when treino_liberado(v_paciente) then (
      select count(*) from treino_sessoes
      where paciente_id = v_paciente and data > v_desde
    ) else null end,
    'minutosDeCardio', case when treino_liberado(v_paciente) then (
      select coalesce(sum(duracao_min), 0) from cardio_sessoes
      where paciente_id = v_paciente and data > v_desde
    ) else null end
  );
end;
$$;

revoke all on function o_que_mudou() from anon, public;
grant execute on function o_que_mudou() to authenticated;
