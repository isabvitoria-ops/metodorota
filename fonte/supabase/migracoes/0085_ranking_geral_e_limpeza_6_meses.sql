-- Duas mudanças pedidas pela Isabela:
--
-- 1. Ranking geral — todas as pacientes com saldo, independente de terem
--    pontuado no mês. Quem não pontuou no desafio selecionado mas tem saldo
--    remanescente aparece também.
--
-- 2. Limpeza de 6 em 6 meses (era 3 em 3). O acumulado no ranking do desafio
--    acompanha: passa a cobrir o mês do desafio e os 6 anteriores.

-- 1. ranking_do_desafio: acumulado passa a cobrir 6 meses --------------------------------

drop function if exists ranking_do_desafio(uuid);

create function ranking_do_desafio(p_desafio uuid)
returns table (
  posicao integer,
  paciente_id uuid,
  nome text,
  pontos integer,
  sou_eu boolean,
  acumulado integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not coalesce(e_admin() or tem_acesso(), false) then
    raise exception 'Seu acesso não está liberado.' using errcode = '42501';
  end if;
  return query
  with mes as (
    select date_trunc('month', d.data_inicio::timestamp)::date as inicio
      from desafios d where d.id = p_desafio
  ),
  envolvidas as (
    select dp.paciente_id from desafio_participantes dp where dp.desafio_id = p_desafio
    union
    select l.paciente_id from pontos_lancamentos l where l.desafio_id = p_desafio
  ),
  somas as (
    select p.id, p.nome, coalesce(sum(l.pontos), 0)::int as pontos
    from envolvidas e
    join pacientes p on p.id = e.paciente_id
    left join pontos_lancamentos l on l.paciente_id = p.id and l.desafio_id = p_desafio
    group by p.id, p.nome
  ),
  acum as (
    select l.paciente_id, sum(l.pontos) filter (where l.tipo <> 'resgate')::int as total
      from pontos_lancamentos l
      left join desafios dd on dd.id = l.desafio_id
      cross join mes
     where date_trunc('month',
             coalesce(dd.data_inicio::timestamp, l.criado_em at time zone 'America/Sao_Paulo'))::date
           between (mes.inicio - interval '6 months')::date and mes.inicio
     group by l.paciente_id
  )
  select rank() over (order by s.pontos desc)::int, s.id,
         nome_para_ranking(s.nome), s.pontos, s.id = meu_paciente_id(),
         coalesce(a.total, 0)
  from somas s
  left join acum a on a.paciente_id = s.id
  order by s.pontos desc, s.nome;
end;
$$;

revoke all on function ranking_do_desafio(uuid) from anon, public;
grant execute on function ranking_do_desafio(uuid) to authenticated;

-- 2. ranking_geral: todas as pacientes com saldo != 0 -----------------------------------

create or replace function ranking_geral()
returns table (
  posicao integer,
  paciente_id uuid,
  nome text,
  saldo integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê o ranking geral.' using errcode = '42501';
  end if;
  return query
  select rank() over (order by s.total desc)::int,
         s.id, s.nome_completo, s.total
  from (
    select p.id, p.nome as nome_completo,
           coalesce(sum(l.pontos), 0)::int as total
      from pacientes p
      left join pontos_lancamentos l on l.paciente_id = p.id
     group by p.id, p.nome
    having coalesce(sum(l.pontos), 0) <> 0
  ) s
  order by s.total desc, s.nome_completo;
end;
$$;

revoke all on function ranking_geral() from anon, public;
grant execute on function ranking_geral() to authenticated;

-- 3. limpar_pontos_antigos: de 3 para 6 meses -------------------------------------------

create or replace function limpar_pontos_antigos(p_confirmar boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_corte date := (date_trunc('month', hoje_sp()::timestamp) - interval '6 months')::date;
  v_linhas integer;
  v_pacientes integer;
  v_pontos integer;
  v_negativas integer;
  v_ids uuid[];
begin
  if not e_admin() then
    raise exception 'Só a nutricionista limpa os pontos antigos.' using errcode = '42501';
  end if;

  select coalesce(array_agg(l.id), '{}') into v_ids
    from pontos_lancamentos l
    left join desafios d on d.id = l.desafio_id
   where date_trunc('month',
           coalesce(d.data_inicio::timestamp, l.criado_em at time zone 'America/Sao_Paulo'))::date < v_corte;

  select count(*), count(distinct l.paciente_id), coalesce(sum(l.pontos), 0)
    into v_linhas, v_pacientes, v_pontos
    from pontos_lancamentos l where l.id = any (v_ids);

  select count(*) into v_negativas from (
    select l.paciente_id
      from pontos_lancamentos l
     where not (l.id = any (v_ids))
     group by l.paciente_id
    having sum(l.pontos) < 0) t;

  if p_confirmar and v_linhas > 0 then
    insert into pontos_arquivo
    select l.*, now(), auth.uid() from pontos_lancamentos l where l.id = any (v_ids);
    delete from pontos_lancamentos l where l.id = any (v_ids);
  end if;

  return jsonb_build_object(
    'corte', v_corte, 'linhas', v_linhas, 'pacientes', v_pacientes,
    'pontos', v_pontos, 'saldoNegativo', v_negativas,
    'apagou', p_confirmar and v_linhas > 0);
end;
$$;
