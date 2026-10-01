-- =============================================================================
-- 0060 — O desafio do mês nasce sozinho, e a paciente vê a posição do mês
--
-- O desafio vai durar anos. Em 1º de outubro o de setembro acabou, ninguém
-- tinha criado o do mês, e "Indiquei uma amiga" sumiu da lista: sem desafio no
-- ar não há ação para lançar. Isto não pode depender de ela lembrar.
--
-- SEM AGENDADOR, DE PROPÓSITO (mesma decisão da 0041). `garantir_desafio_do_mes`
-- é uma função que se explica sozinha: se hoje não há desafio cobrindo o mês, ela
-- cria o do mês; se há, não faz nada. Quem abre o aplicativo a chama — a
-- nutricionista na área do desafio, a paciente na tela dela — então o desafio
-- existe antes de alguém precisar dele, sem tarefa de madrugada para falhar em
-- silêncio.
--
-- QUANDO ELA NÃO CRIA (para nunca ressuscitar o que ela parou de propósito):
--   * já existe desafio (publicado) tocando este mês;
--   * não há nenhum desafio anterior para copiar o texto;
--   * o último terminou há mais de 45 dias antes deste mês: foi uma pausa, não
--     uma virada de mês;
--   * a configuração `desafio_automatico` está em "nao".
-- Nesses casos a tela continua oferecendo o botão "Criar o desafio de <mês>".
-- =============================================================================

create or replace function garantir_desafio_do_mes()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hoje date := hoje_sp();
  v_inicio date := date_trunc('month', v_hoje::timestamp)::date;
  v_fim date := (date_trunc('month', v_hoje::timestamp) + interval '1 month - 1 day')::date;
  v_meses text[] := array['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                          'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  v_modelo desafios;
  v_id uuid;
begin
  if auth.uid() is null then
    return null;
  end if;

  if coalesce((select valor #>> '{}' from configuracoes where chave = 'desafio_automatico'), 'sim') = 'nao' then
    return null;
  end if;

  -- Duas pessoas abrindo o app no mesmo segundo não criam dois desafios.
  perform pg_advisory_xact_lock(hashtext('garantir_desafio_do_mes'));

  if exists (
    select 1 from desafios
     where status <> 'rascunho' and data_inicio <= v_fim and data_fim >= v_inicio
  ) then
    return null;
  end if;

  select * into v_modelo from desafios
   where status <> 'rascunho'
   order by data_inicio desc
   limit 1;
  if not found then
    return null;
  end if;
  if v_modelo.data_fim < v_inicio - 45 then
    return null;
  end if;

  -- As ações o gatilho `copiar_acoes` copia do desafio mais recente.
  insert into desafios (nome, descricao, lema, regras, data_inicio, data_fim, status)
  values ('Desafio de ' || v_meses[extract(month from v_hoje)::int],
          v_modelo.descricao, v_modelo.lema, v_modelo.regras, v_inicio, v_fim, 'ativo')
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function garantir_desafio_do_mes() from anon, public;
grant execute on function garantir_desafio_do_mes() to authenticated;

-- -----------------------------------------------------------------------------
-- A evolução da paciente ganha a POSIÇÃO de cada mês
--
-- "Em setembro você fez 120 pontos e ficou em 2º lugar" — para que, quando a
-- nutricionista entregar o presente, a paciente saiba por quê. A posição segue
-- a regra do ranking (empate divide o lugar). Só quem pontuou no mês tem
-- posição; quem não pontuou fica sem.
-- -----------------------------------------------------------------------------
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
  do_mes as (
    select m.mes, l.paciente_id,
           coalesce(sum(l.pontos) filter (where l.tipo <> 'resgate'), 0) as ganhou
      from meses m
      join lanc l on l.mes = m.mes
     group by m.mes, l.paciente_id
  )
  select jsonb_agg(jsonb_build_object(
           'mes', m.mes,
           'pontos', coalesce(eu.ganhou, 0),
           'saldo', coalesce((select sum(l.pontos) from lanc l
                               where l.paciente_id = v_paciente and l.mes <= m.mes), 0),
           'posicao', case when coalesce(eu.ganhou, 0) > 0 then
                        1 + (select count(*) from do_mes o where o.mes = m.mes and o.ganhou > eu.ganhou)
                      end,
           'participantes', (select count(*) from do_mes o where o.mes = m.mes and o.ganhou > 0))
         order by m.mes)
    into v
    from meses m
    left join do_mes eu on eu.mes = m.mes and eu.paciente_id = v_paciente;

  return coalesce(v, '[]'::jsonb);
end;
$$;

revoke all on function meu_historico_de_pontos(integer) from anon, public;
grant execute on function meu_historico_de_pontos(integer) to authenticated;
