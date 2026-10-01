-- =============================================================================
-- 0059 — Histórico mensal de pontos
--
-- No primeiro dia do mês a nutricionista precisa saber quantos pontos cada
-- paciente fez no mês que acabou — para dar os presentes — e a paciente quer
-- ver a própria evolução de um mês para o outro.
--
-- NADA É GUARDADO A MAIS. O livro de pontos (`pontos_lancamentos`) já tem tudo
-- e nunca perde uma linha; o histórico é uma LEITURA dele, agrupada por mês.
-- Por isso setembro já aparece, sem ninguém ter "fechado" nada, e não há como
-- o histórico divergir do saldo.
--
-- DE QUE MÊS É UM PONTO: o do DESAFIO a que ele pertence (começo do desafio),
-- e não o dia em que foi lançado. Corrigir no dia 2 de outubro um ponto de
-- setembro continua sendo ponto de setembro. Ponto sem desafio (ajuste avulso)
-- cai no mês em que foi lançado.
--
-- JANELA DE 3 MESES. A tela mostra o mês atual e os 3 anteriores; o que é mais
-- velho sai da tela sozinho. NÃO é apagado: o livro de pontos é o saldo
-- oficial, e apagar linhas dele tiraria pontos de quem ganhou.
-- =============================================================================

/** O placar de cada mês, para a nutricionista. */
create or replace function historico_mensal_de_pontos(p_meses integer default 3)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_n integer := least(greatest(coalesce(p_meses, 3), 1), 12);
  v jsonb;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê o histórico de pontos.' using errcode = '42501';
  end if;

  with lanc as (
    select l.paciente_id, l.pontos, l.tipo,
           date_trunc('month',
             coalesce(d.data_inicio::timestamp, l.criado_em at time zone 'America/Sao_Paulo'))::date as mes
      from pontos_lancamentos l
      left join desafios d on d.id = l.desafio_id
  ),
  meses as (
    select (date_trunc('month', hoje_sp()::timestamp) - make_interval(months => g))::date as mes
      from generate_series(0, v_n) g
  ),
  por_paciente as (
    select m.mes, l.paciente_id, p.nome,
           coalesce(sum(l.pontos) filter (where l.tipo <> 'resgate'), 0) as ganhou,
           coalesce(-sum(l.pontos) filter (where l.tipo = 'resgate'), 0) as resgatou
      from meses m
      join lanc l on l.mes = m.mes
      join pacientes p on p.id = l.paciente_id
     group by m.mes, l.paciente_id, p.nome
  )
  select jsonb_agg(jsonb_build_object(
           'mes', m.mes,
           'total', coalesce((select sum(pp.ganhou) from por_paciente pp where pp.mes = m.mes), 0),
           'ranking', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'pacienteId', pp.paciente_id, 'nome', pp.nome,
                      'pontos', pp.ganhou, 'resgatou', pp.resgatou,
                      -- o saldo é o de sempre até o fim daquele mês
                      'saldo', sd.saldo,
                      -- a maior recompensa que esse saldo já alcançou (ou nulo)
                      'recompensa', (select r.nome from recompensas r
                                      where r.ativo and r.pontos <= sd.saldo
                                      order by r.pontos desc limit 1))
                    order by pp.ganhou desc, pp.nome)
               from por_paciente pp
               cross join lateral (
                 select coalesce(sum(l2.pontos), 0) as saldo from lanc l2
                  where l2.paciente_id = pp.paciente_id and l2.mes <= m.mes) sd
              where pp.mes = m.mes), '[]'::jsonb))
         order by m.mes desc)
    into v
    from meses m;

  return coalesce(v, '[]'::jsonb);
end;
$$;

/**
 * A minha evolução, para a paciente: pontos de cada mês e o saldo até ali,
 * do mais antigo para o mais novo. Vazio enquanto ela nunca pontuou.
 */
create or replace function meu_historico_de_pontos(p_meses integer default 3)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_n integer := least(greatest(coalesce(p_meses, 3), 1), 12);
  v_paciente uuid := meu_paciente_id();
  v jsonb;
begin
  if v_paciente is null or not tem_acesso() then
    return '[]'::jsonb;
  end if;
  if not exists (select 1 from pontos_lancamentos where paciente_id = v_paciente) then
    return '[]'::jsonb;
  end if;

  with lanc as (
    select l.pontos, l.tipo,
           date_trunc('month',
             coalesce(d.data_inicio::timestamp, l.criado_em at time zone 'America/Sao_Paulo'))::date as mes
      from pontos_lancamentos l
      left join desafios d on d.id = l.desafio_id
     where l.paciente_id = v_paciente
  ),
  meses as (
    select (date_trunc('month', hoje_sp()::timestamp) - make_interval(months => g))::date as mes
      from generate_series(0, v_n) g
  )
  select jsonb_agg(jsonb_build_object(
           'mes', m.mes,
           'pontos', coalesce((select sum(l.pontos) filter (where l.tipo <> 'resgate')
                                 from lanc l where l.mes = m.mes), 0),
           'saldo', coalesce((select sum(l.pontos) from lanc l where l.mes <= m.mes), 0))
         order by m.mes)
    into v
    from meses m;

  return coalesce(v, '[]'::jsonb);
end;
$$;

revoke all on function historico_mensal_de_pontos(integer) from anon, public;
grant execute on function historico_mensal_de_pontos(integer) to authenticated;
revoke all on function meu_historico_de_pontos(integer) from anon, public;
grant execute on function meu_historico_de_pontos(integer) to authenticated;

-- -----------------------------------------------------------------------------
-- Pequeno ajuste da conversa por refeição (0058)
--
-- `now()` devolve a hora em que a TRANSAÇÃO começou: duas mensagens gravadas na
-- mesma transação ficavam com a mesma hora, e a ordem entre elas dependia do id
-- (sorteado). `clock_timestamp()` dá o instante de cada gravação, e a conversa
-- passa a sair sempre na ordem em que foi escrita.
-- -----------------------------------------------------------------------------
alter table mensagens_refeicao alter column criado_em set default clock_timestamp();

