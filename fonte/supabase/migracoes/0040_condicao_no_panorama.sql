-- =============================================================================
-- CENTRAL DO PACIENTE — 0040: a condição entra no panorama
--
-- A 0039 criou a coluna; esta faz a lista enxergar.
--
-- O corpo abaixo é o mesmo da 0035, com uma linha a mais: `create or
-- replace` substitui a função inteira, não existe "aplicar um pedaço".
-- =============================================================================

create or replace function panorama_dos_pacientes(p_dias integer default 28)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_desde date;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê o panorama.' using errcode = '42501';
  end if;

  v_desde := hoje_sp() - greatest(coalesce(p_dias, 28), 1);

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id,
      'nome', p.nome,
      'email', p.email,
      -- A condicao entra aqui para a lista poder agrupar e para a ficha
      -- marcar as pacientes antigas, que nasceram sem o campo.
      'condicao', p.condicao,
      'situacao', situacao_paciente(p.status, p.perfil_id, p.data_inicio, p.data_fim),
      'dataInicio', p.data_inicio,
      'dataFim', p.data_fim,
      'diasRestantes', p.data_fim - hoje_sp(),

      -- A próxima consulta AGENDADA, de hoje em diante. Consulta de ontem
      -- que ninguém marcou como concluída não vira "próximo retorno".
      'proximaConsulta', (
        select jsonb_build_object('data', c.data, 'hora', c.hora, 'tipo', c.tipo)
        from consultas c
        where c.paciente_id = p.id and c.status = 'agendada' and c.data >= hoje_sp()
        order by c.data, c.hora nulls last limit 1
      ),

      'ultimaConsulta', (
        select jsonb_build_object('data', c.data, 'tipo', c.tipo, 'resumo', c.resumo)
        from consultas c
        where c.paciente_id = p.id and c.status = 'concluida'
        order by c.data desc limit 1
      ),

      -- O dia mais recente em que ela registrou QUALQUER coisa. É o que
      -- responde "sem registro recente" sem precisar de quatro consultas.
      'ultimoRegistro', greatest(
        (select max(r.data) from meta_registros r
           join metas m on m.id = r.meta_id where m.paciente_id = p.id),
        (select max(s.data) from treino_sessoes s where s.paciente_id = p.id),
        (select max(c2.data) from cardio_sessoes c2 where c2.paciente_id = p.id),
        (select max(rr.data) from reintroducao_registros rr where rr.paciente_id = p.id)
      ),

      -- Peso: o primeiro e o último de que há registro publicado. A avaliação
      -- guarda tudo em `dados`, e o peso mora lá dentro.
      'pesoInicial', (
        select (a.dados ->> 'peso')::numeric from avaliacoes_fisicas a
        where a.paciente_id = p.id and a.publicada and (a.dados ->> 'peso') is not null
        order by a.data limit 1
      ),
      'pesoAtual', (
        select (a.dados ->> 'peso')::numeric from avaliacoes_fisicas a
        where a.paciente_id = p.id and a.publicada and (a.dados ->> 'peso') is not null
        order by a.data desc limit 1
      ),

      -- As metas com os registros do período, CRUAS. A adesão é contada na
      -- tela, pelo mesmo código que a paciente vê.
      'metas', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', m.id, 'titulo', m.titulo, 'descricao', m.descricao,
                 'categoria', m.categoria, 'frequencia', m.frequencia,
                 'alvo', m.alvo, 'unidade', m.unidade, 'inicio', m.inicio,
                 'prazo', m.prazo, 'status', m.status,
                 'registros', coalesce((
                   select jsonb_agg(jsonb_build_object(
                            'id', r.id, 'data', r.data,
                            'quantidade', r.quantidade, 'observacao', r.observacao)
                          order by r.data desc)
                   from meta_registros r
                   where r.meta_id = m.id and r.data >= v_desde
                 ), '[]'::jsonb)))
        from metas m where m.paciente_id = p.id and m.status = 'ativa'
      ), '[]'::jsonb)
    ) order by p.nome)
    from pacientes p
  ), '[]'::jsonb);
end;
$$;

revoke all on function panorama_dos_pacientes(integer) from anon, public;
grant execute on function panorama_dos_pacientes(integer) to authenticated;
