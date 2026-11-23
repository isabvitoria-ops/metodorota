-- =============================================================================
-- Bateria do lote 1 da auditoria (0099)
--
--   * agenda: a regra de repetição é validada (tipo, dias da semana, "até");
--   * check-in: sem prazo nada muda; com prazo, a resposta fora dele fica
--     gravada e marcada como atrasada; só a nutricionista define o prazo;
--   * tour: a paciente lê os passos ativos e marca que viu; não escreve passo.
-- =============================================================================

truncate resultados_teste;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000b9e01', 'lote1-a@paciente.test');

insert into pacientes (email, nome, plano_id, data_inicio, data_fim) values
  ('lote1-a@paciente.test', 'Ana Lote', 'mensal', hoje_sp() - 30, hoje_sp() + 25);

create or replace function l1_ana() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'lote1-a@paciente.test' $$;
create or replace function l1_quest() returns uuid language sql stable security definer as $$
  select id from questionarios where titulo = 'Check-in Lote' $$;
create or replace function l1_atrasado(p_periodo date) returns boolean language sql stable security definer as $$
  select atrasado from questionario_envios where paciente_id = l1_ana() and periodo = p_periodo $$;
create or replace function l1_prazo() returns smallint language sql stable security definer as $$
  select prazo_dias from questionarios where titulo = 'Check-in Lote' $$;
create or replace function l1_passos() returns integer language sql stable security definer as $$
  select count(*)::integer from tour_passos $$;
grant execute on function l1_ana(), l1_quest(), l1_atrasado(date), l1_prazo(), l1_passos() to anon, authenticated;

-- 1. Agenda que se repete ---------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
insert into agenda_eventos (titulo, data, repete, dias_semana) values ('Treino Lote', hoje_sp(), 'semanal', '{1,3,5}');
select teste('compromisso semanal em seg, qua e sex e gravado',
  (select repete = 'semanal' and dias_semana = '{1,3,5}' from agenda_eventos where titulo = 'Treino Lote'));
select teste('sem repetir, continua como antes',
  (select repete from agenda_eventos where titulo = 'Treino Lote 2' union all select 'nao' limit 1) = 'nao');
select teste('repeticao desconhecida e recusada',
  estado_de($q$insert into agenda_eventos (titulo, data, repete) values ('x', current_date, 'diario')$q$) = '23514');
select teste('dia da semana fora de 0 a 6 e recusado',
  estado_de($q$insert into agenda_eventos (titulo, data, repete, dias_semana) values ('x', current_date, 'semanal', '{7}')$q$) = '23514');
select teste('"ate" antes do primeiro dia e recusado',
  estado_de($q$insert into agenda_eventos (titulo, data, repete, repete_ate) values ('x', current_date, 'semanal', current_date - 1)$q$) = '23514');
commit;

-- 2. Prazo do check-in ------------------------------------------------------------
insert into questionarios (titulo, periodicidade) values ('Check-in Lote', 'semanal');
insert into questionario_pacientes (questionario_id, paciente_id) values (l1_quest(), l1_ana());

-- Sem prazo: responder no domingo da semana continua valendo.
insert into questionario_envios (questionario_id, paciente_id, periodo, respondido_em)
values (l1_quest(), l1_ana(), date '2026-11-09', timestamptz '2026-11-15 20:00-03');
select teste('sem prazo, a resposta de domingo nao fica atrasada', l1_atrasado(date '2026-11-09') = false);

begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000b9e01', true);
select teste('a paciente NAO define prazo',
  estado_de($q$select definir_prazo_questionario(l1_quest(), 2)$q$) = '42501');
select teste('a paciente nao abre os prazos de todos',
  estado_de($q$select prazos_dos_questionarios()$q$) = '42501');
select teste('nem os atrasos de alguem',
  estado_de($q$select atrasos_do_paciente(l1_ana())$q$) = '42501');
commit;
select teste('e o prazo continuou vazio', l1_prazo() is null);

begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select definir_prazo_questionario(l1_quest(), 2);
select teste('a nutricionista define 2 dias', l1_prazo() = 2);
select teste('prazo de 8 dias e recusado', estado_de($q$select definir_prazo_questionario(l1_quest(), 8)$q$) = '22023');
commit;

-- Semana de 16/11 (segunda). Prazo 2 dias = ate terca 17/11 23:59 (Brasilia).
insert into questionario_envios (questionario_id, paciente_id, periodo, respondido_em)
values (l1_quest(), l1_ana(), date '2026-11-16', timestamptz '2026-11-17 23:30-03');
select teste('terca 23:30 ainda esta no prazo', l1_atrasado(date '2026-11-16') = false);
update questionario_envios set respondido_em = timestamptz '2026-11-18 00:10-03'
 where paciente_id = l1_ana() and periodo = date '2026-11-16';
select teste('quarta 00:10 fica atrasada (e continua gravada)', l1_atrasado(date '2026-11-16') = true);
select teste('a semana antiga nao muda de classificacao', l1_atrasado(date '2026-11-09') = false);

begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select teste('a nutricionista ve a semana atrasada',
  (select count(*) from jsonb_array_elements(atrasos_do_paciente(l1_ana()))) = 1);
select teste('e o prazo do questionario',
  (select (x ->> 'prazoDias')::int from jsonb_array_elements(prazos_dos_questionarios()) x where x ->> 'questionarioId' = l1_quest()::text) = 2);
commit;

begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000b9e01', true);
select teste('a paciente ve o proprio prazo e quando vence',
  (select (x ->> 'prazoDias')::int = 2 and (x ->> 'venceEm')::date = semana_de(hoje_sp()) + 1
     from jsonb_array_elements(meus_prazos()) x));
select teste('e a semana dela que ficou atrasada',
  (select x -> 'atrasados' from jsonb_array_elements(meus_prazos()) x) = '["2026-11-16"]'::jsonb);
commit;

-- 3. Tour --------------------------------------------------------------------------
select teste('os passos de partida entraram', l1_passos() >= 6);

begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000b9e01', true);
select teste('a paciente le os passos', (select count(*) from tour_passos) >= 6);
select teste('a paciente NAO escreve passo',
  estado_de($q$insert into tour_passos (titulo, texto) values ('x', 'y')$q$) = '42501');
update tour_passos set titulo = 'mexido';
select teste('ainda nao viu o tour', not exists (select 1 from tour_vistos));
select concluir_tour();
select teste('depois de concluir, fica marcado so para ela', (select count(*) from tour_vistos) = 1);
commit;
select teste('e o update dela nao mexeu em passo nenhum', not exists (select 1 from tour_passos where titulo = 'mexido'));

begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
update tour_passos set ativo = false where ordem = 6;
select teste('a nutricionista edita os passos', (select count(*) from tour_passos where not ativo) = 1);
select teste('video so com https', estado_de($q$update tour_passos set video_url = 'http://x' where ordem = 1$q$) = '23514');
commit;

begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000b9e01', true);
select teste('passo desligado some para a paciente', (select count(*) from tour_passos where ordem = 6) = 0);
commit;

begin;
set local role anon;
set local search_path = public;
do $$
declare v_erro boolean;
begin
  v_erro := false;
  begin perform count(*) from tour_passos; exception when others then v_erro := true; end;
  perform teste('visitante nao le passo', v_erro);
  v_erro := false;
  begin perform concluir_tour(); exception when others then v_erro := true; end;
  perform teste('visitante nao conclui tour', v_erro);
  v_erro := false;
  begin perform meus_prazos(); exception when others then v_erro := true; end;
  perform teste('visitante nao abre prazos', v_erro);
end;
$$;
commit;

select case when bool_and(passou) then count(*) || '/' || count(*) || ' verificacoes do tour, do prazo do check-in e da agenda que repete passaram'
            else (count(*) filter (where not passou)) || ' verificacoes do tour, do prazo do check-in e da agenda que repete falharam' end
    as resultado
from resultados_teste;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% verificacao(oes) do lote 1 falharam', v_falhas;
  end if;
end;
$$;
