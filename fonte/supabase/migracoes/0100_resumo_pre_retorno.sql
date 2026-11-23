-- 0100 — Resumo pré-retorno (N28, aprovado por ela em 23/11/2026).
--
-- Clicou no Retorno na Agenda, abre o que mudou desde a ÚLTIMA CONSULTA
-- CONCLUÍDA — o mesmo marco da 0037, agora do lado da nutricionista.
-- Sem consulta concluída, não há marco e a resposta diz isso em vez de
-- inventar um período.
--
-- SÓ DADOS E CONTAGENS. Nenhuma frase diz se está bom ou ruim, e nada aqui
-- é gerado por IA. A pontuação do check-in é feita na tela, com a mesma
-- conta que a ficha já usa (utils/pontuacaoQuestionario.ts).
--
-- Só para e_admin(). A paciente não chama esta função.

create or replace function public.resumo_pre_retorno(p_paciente uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_marco date;
  v_combinado text;
  v_proxima jsonb;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê o resumo.' using errcode = '42501';
  end if;

  select jsonb_build_object('data', c.data, 'hora', to_char(c.hora, 'HH24:MI'), 'tipo', c.tipo)
    into v_proxima
    from consultas c
   where c.paciente_id = p_paciente and c.status = 'agendada' and c.data >= hoje_sp()
   order by c.data, c.hora nulls last
   limit 1;

  select c.data, coalesce(nullif(trim(c.resumo), ''), nullif(trim(c.observacoes), ''))
    into v_marco, v_combinado
    from consultas c
   where c.paciente_id = p_paciente and c.status = 'concluida'
   order by c.data desc, c.hora desc nulls last
   limit 1;

  if v_marco is null then
    return jsonb_build_object('temMarco', false, 'proximaConsulta', v_proxima);
  end if;

  return jsonb_build_object(
    'temMarco', true,
    'desde', v_marco,
    'dias', hoje_sp() - v_marco,
    'combinado', v_combinado,
    'proximaConsulta', v_proxima,
    -- Bristol: quantas vezes cada tipo apareceu nos registros desde o marco.
    'bristol', coalesce((
      select jsonb_object_agg(b.bristol::text, b.n)
        from (select r.bristol, count(*) n from reintroducao_registros r
               where r.paciente_id = p_paciente and r.data >= v_marco and r.bristol is not null
               group by r.bristol) b
    ), '{}'::jsonb),
    'registrosComBristol', (select count(*) from reintroducao_registros r
                             where r.paciente_id = p_paciente and r.data >= v_marco and r.bristol is not null),
    -- Sintomas: o código de cada um e quantas vezes ("nenhum" não conta).
    'sintomas', coalesce((
      select jsonb_object_agg(s.sintoma, s.n)
        from (select x.sintoma, count(*) n
                from reintroducao_registros r, unnest(r.sintomas) as x(sintoma)
               where r.paciente_id = p_paciente and r.data >= v_marco and x.sintoma <> 'nenhum'
               group by x.sintoma) s
    ), '{}'::jsonb),
    -- Reintrodução: os itens que mudaram de situação desde o marco.
    'reintroducao', coalesce((
      select jsonb_agg(jsonb_build_object('nome', coalesce(a.nome, i.nome_livre), 'status', i.status) order by i.atualizado_em)
        from reintroducao_itens i
        left join reintroducao_alimentos a on a.id = i.alimento_id
       where i.paciente_id = p_paciente
         and i.atualizado_em::date >= v_marco
         and i.status in ('bem_tolerado', 'tolerancia_parcial', 'sintomas_observados', 'nao_tolerado', 'necessita_reavaliacao')
    ), '[]'::jsonb),
    'restricoesNovas', coalesce((
      select jsonb_agg(jsonb_build_object('tipo', r.tipo, 'alimento', r.alimento) order by r.criado_em)
        from restricoes_alimentares r
       where r.paciente_id = p_paciente and r.criado_em::date >= v_marco
    ), '[]'::jsonb),
    -- Metas ativas: em quantos dias ela marcou desde o marco.
    'metas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'titulo', m.titulo, 'frequencia', m.frequencia,
               'diasMarcados', (select count(distinct mr.data) from meta_registros mr where mr.meta_id = m.id and mr.data >= v_marco)))
        from metas m
       where m.paciente_id = p_paciente and m.status = 'ativa'
    ), '[]'::jsonb),
    -- Os dias em que ela registrou alguma coisa (para a tela achar as lacunas).
    'diasComRegistro', coalesce((
      select jsonb_agg(d order by d) from (
        select r.data d from reintroducao_registros r where r.paciente_id = p_paciente and r.data >= v_marco
        union select h.data from hidratacao_registros h where h.paciente_id = p_paciente and h.data >= v_marco
        union select f.data from diario_fotos f where f.paciente_id = p_paciente and f.data >= v_marco
        union select mr.data from meta_registros mr join metas m on m.id = mr.meta_id where m.paciente_id = p_paciente and mr.data >= v_marco
        union select (e.respondido_em at time zone 'America/Sao_Paulo')::date from questionario_envios e where e.paciente_id = p_paciente and e.respondido_em::date >= v_marco
        union select (t.criado_em at time zone 'America/Sao_Paulo')::date from treino_sessoes t where t.paciente_id = p_paciente and t.criado_em::date >= v_marco
      ) x
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.resumo_pre_retorno(uuid) from public, anon;
grant execute on function public.resumo_pre_retorno(uuid) to authenticated;
