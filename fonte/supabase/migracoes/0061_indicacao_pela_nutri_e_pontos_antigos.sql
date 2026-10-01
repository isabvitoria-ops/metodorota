-- =============================================================================
-- 0061 — Indicação lançada pela nutricionista, acumulado no ranking e limpeza
--                dos pontos antigos
--
-- 1. A nutricionista não conseguia lançar "a paciente X indicou a Fulana": só a
--    própria paciente registrava indicação. Agora ela registra POR a paciente,
--    com o nome da indicada, e valida (os 100 pontos) no mesmo gesto, se quiser.
--
-- 2. O ranking mostra, além dos pontos do mês (o número grande), o ACUMULADO:
--    o mês do desafio e os 3 anteriores — exatamente o que fica guardado depois
--    da limpeza do item 3. Resgate não conta como ponto ganho.
--
-- 3. A cada 3 meses ela reinicia o que é antigo. `limpar_pontos_antigos` tira do
--    saldo tudo o que for ANTERIOR ao 1º dia do mês de (hoje − 3 meses): em
--    outubro, sai junho para trás e ficam julho, agosto, setembro e outubro.
--    Nada se perde às cegas: as linhas vão para `pontos_arquivo` antes de saírem
--    do livro de pontos, e a função sem confirmação só MOSTRA o que sairia.
--    As indicações validadas não são tocadas (a escada de benefícios continua
--    somando ao longo do tempo).
-- =============================================================================

-- 1. Indicação lançada pela nutricionista ---------------------------------------
create or replace function registrar_indicacao_por(
  p_paciente uuid,
  p_nome text,
  p_email text default null,
  p_telefone text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista registra indicação por outra pessoa.' using errcode = '42501';
  end if;
  if not exists (select 1 from pacientes where id = p_paciente) then
    raise exception 'Paciente não encontrada.' using errcode = '22023';
  end if;
  if coalesce(trim(p_nome), '') = '' then
    raise exception 'Escreva o nome de quem foi indicada.' using errcode = '22023';
  end if;

  -- Indicar também é participar (mesma regra de quando a própria paciente indica).
  if desafio_atual() is not null then
    insert into desafio_participantes (desafio_id, paciente_id)
    values (desafio_atual(), p_paciente)
    on conflict (desafio_id, paciente_id) do nothing;
  end if;

  insert into indicacoes
    (desafio_id, paciente_indicadora_id, nome_indicada, email_indicada, telefone_indicada)
  values
    (desafio_atual(), p_paciente, trim(p_nome), nullif(trim(p_email), ''), nullif(trim(p_telefone), ''))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function registrar_indicacao_por(uuid, text, text, text) from anon, public;
grant execute on function registrar_indicacao_por(uuid, text, text, text) to authenticated;

-- 2. Acumulado no ranking -------------------------------------------------------
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
           between (mes.inicio - interval '3 months')::date and mes.inicio
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

-- 3. Pontos antigos --------------------------------------------------------------
create table if not exists pontos_arquivo (
  like pontos_lancamentos including defaults,
  arquivado_em timestamptz not null default now(),
  arquivado_por uuid
);

comment on table pontos_arquivo is
  'Pontos que saíram do saldo na limpeza de 3 em 3 meses. Ficam aqui para poder consultar ou devolver.';

alter table pontos_arquivo enable row level security;
revoke all on pontos_arquivo from anon;
grant select on pontos_arquivo to authenticated;
drop policy if exists pontos_arquivo_admin on pontos_arquivo;
create policy pontos_arquivo_admin on pontos_arquivo for select using (e_admin());

/**
 * Mostra (p_confirmar = false) ou faz (true) a limpeza dos pontos antigos.
 * Devolve: corte (1º dia do mês a partir do qual tudo fica), linhas, pacientes,
 * pontos que sairiam, quantas pacientes ficariam com saldo NEGATIVO (resgate
 * dentro da janela cujos pontos ganhos eram antigos) e se apagou de fato.
 */
create or replace function limpar_pontos_antigos(p_confirmar boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_corte date := (date_trunc('month', hoje_sp()::timestamp) - interval '3 months')::date;
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

revoke all on function limpar_pontos_antigos(boolean) from anon, public;
grant execute on function limpar_pontos_antigos(boolean) to authenticated;
