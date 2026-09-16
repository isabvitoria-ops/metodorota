-- =============================================================================
-- CENTRAL DO PACIENTE — 0009: o que a tela do desafio lê
--
-- Uma função só, como `meu_acesso()`. A tela pergunta e obedece: ela não soma
-- ponto, não decide posição e não sabe a regra. Se um dia a regra mudar, muda
-- aqui e a tela acompanha sem saber que mudou.
-- =============================================================================

create or replace function meu_desafio()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_desafio desafios;
  v_paciente uuid;
  v_semana integer;
  v_pontos_mes integer;
  v_saldo integer;
  v_posicao integer;
  v_proxima integer;
begin
  v_paciente := meu_paciente_id();
  select * into v_desafio from desafios where id = desafio_atual();

  -- Saldo acumulado existe mesmo sem desafio no ar: ele é do programa, não do mês.
  v_saldo := coalesce(saldo_de_pontos(v_paciente), 0);

  if v_desafio.id is null then
    return jsonb_build_object(
      'temDesafio', false,
      'saldoAcumulado', v_saldo,
      'recompensas', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', r.id, 'pontos', r.pontos, 'nome', r.nome, 'descricao', r.descricao,
          'alcancada', v_saldo >= r.pontos
        ) order by r.ordem), '[]'::jsonb)
        from recompensas r where r.ativo
      )
    );
  end if;

  v_semana := semana_do_desafio(v_desafio.id);
  v_pontos_mes := coalesce(pontos_no_desafio(v_paciente, v_desafio.id), 0);

  select posicao into v_posicao
  from ranking_do_desafio(v_desafio.id) where sou_eu;

  -- Quantos pontos faltam para alcançar quem está logo acima.
  select min(pontos) - v_pontos_mes into v_proxima
  from ranking_do_desafio(v_desafio.id)
  where pontos > v_pontos_mes;

  return jsonb_build_object(
    'temDesafio', true,
    'desafio', jsonb_build_object(
      'id', v_desafio.id,
      'nome', v_desafio.nome,
      'descricao', v_desafio.descricao,
      'lema', v_desafio.lema,
      'regras', v_desafio.regras,
      'dataInicio', v_desafio.data_inicio,
      'dataFim', v_desafio.data_fim,
      'situacao', situacao_desafio(v_desafio.status, v_desafio.data_inicio, v_desafio.data_fim),
      'semanaAtual', v_semana,
      'totalDeSemanas', total_de_semanas(v_desafio.id)
    ),
    'pontosNoMes', v_pontos_mes,
    'saldoAcumulado', v_saldo,
    'posicao', v_posicao,
    'pontosParaProxima', v_proxima,
    'acoes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id,
        'chave', a.chave,
        'nome', a.nome,
        'descricao', a.descricao,
        'pontos', a.pontos,
        'periodicidade', a.periodicidade,
        -- O envio desta semana, quando a ação é semanal; o do desafio, quando não é.
        'envio', (
          select jsonb_build_object(
            'id', e.id, 'status', e.status, 'semana', e.semana,
            'observacao', e.observacao, 'motivoRecusa', e.motivo_recusa,
            'enviadoEm', e.enviado_em, 'pontosConcedidos', e.pontos_concedidos
          )
          from desafio_envios e
          where e.acao_id = a.id and e.paciente_id = v_paciente
            and (a.periodicidade <> 'semanal' or e.semana = v_semana)
            and e.status <> 'recusado'
          order by e.enviado_em desc limit 1
        ),
        -- Quantas vezes já pontuou nesta ação, para a tela mostrar o histórico.
        'aprovadas', (
          select count(*) from desafio_envios e
          where e.acao_id = a.id and e.paciente_id = v_paciente and e.status = 'aprovado'
        )
      ) order by a.ordem), '[]'::jsonb)
      from desafio_acoes a
      where a.desafio_id = v_desafio.id and a.ativo
    ),
    'ranking', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'posicao', r.posicao, 'nome', r.nome, 'pontos', r.pontos, 'souEu', r.sou_eu
      ) order by r.posicao, r.nome), '[]'::jsonb)
      from ranking_do_desafio(v_desafio.id) r
    ),
    'historico', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', l.id, 'pontos', l.pontos, 'descricao', l.descricao,
        'tipo', l.tipo, 'criadoEm', l.criado_em
      ) order by l.criado_em desc), '[]'::jsonb)
      from pontos_lancamentos l
      where l.paciente_id = v_paciente and l.desafio_id = v_desafio.id
    ),
    'indicacoes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', i.id, 'nome', i.nome_indicada, 'status', i.status,
        'pontos', i.pontos_concedidos, 'criadoEm', i.criado_em
      ) order by i.criado_em desc), '[]'::jsonb)
      from indicacoes i where i.paciente_indicadora_id = v_paciente
    ),
    'recompensas', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', r.id, 'pontos', r.pontos, 'nome', r.nome, 'descricao', r.descricao,
        'alcancada', v_saldo >= r.pontos
      ) order by r.ordem), '[]'::jsonb)
      from recompensas r where r.ativo
    )
  );
end;
$$;

grant execute on function meu_desafio() to authenticated;

-- -----------------------------------------------------------------------------
-- O que o painel da nutricionista lê
-- -----------------------------------------------------------------------------

create or replace function painel_do_desafio(p_desafio uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_desafio desafios;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê o painel.' using errcode = '42501';
  end if;
  select * into v_desafio from desafios where id = p_desafio;

  return jsonb_build_object(
    'elegiveis', (
      select count(*) from pacientes p
      where situacao_paciente(p.status, p.perfil_id, p.data_inicio, p.data_fim)
            in ('ativo', 'proximo_do_vencimento')
    ),
    'participantes', (
      select count(*) from desafio_participantes where desafio_id = p_desafio
    ),
    'semAcao', (
      select count(*) from desafio_participantes dp
      where dp.desafio_id = p_desafio
        and not exists (
          select 1 from desafio_envios e
          where e.desafio_id = p_desafio and e.paciente_id = dp.paciente_id
        )
    ),
    'pendentes', (
      select count(*) from desafio_envios
      where desafio_id = p_desafio and status = 'enviado'
    ),
    'indicacoesPendentes', (
      select count(*) from indicacoes
      where status in ('registrada', 'iniciou')
    ),
    'maiorPontuacao', (
      select coalesce(max(pontos), 0) from ranking_do_desafio(p_desafio)
    ),
    'media', (
      select coalesce(round(avg(pontos))::int, 0) from ranking_do_desafio(p_desafio)
    ),
    'acoesMaisFeitas', (
      -- Cast para int: ordenar por texto poria '9' na frente de '10'.
      select coalesce(jsonb_agg(x order by (x->>'total')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('nome', a.nome, 'total', count(e.id)) as x
        from desafio_acoes a
        left join desafio_envios e on e.acao_id = a.id and e.status = 'aprovado'
        where a.desafio_id = p_desafio
        group by a.nome
      ) t
    )
  );
end;
$$;

grant execute on function painel_do_desafio(uuid) to authenticated;
