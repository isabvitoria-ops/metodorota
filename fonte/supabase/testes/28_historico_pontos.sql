-- =============================================================================
-- Bateria do historico mensal de pontos (0059)
--
-- O que nao pode falhar:
--   * o mes de um ponto e o do DESAFIO dele (corrigir tarde nao muda o mes);
--   * ponto sem desafio cai no mes em que foi lancado;
--   * o saldo de cada mes e o de sempre ate o fim daquele mes;
--   * a janela mostra o mes atual e os N anteriores, mas o que esta fora dela
--     continua contando no saldo (nada e apagado);
--   * resgate nao e ponto "ganho", e aparece separado;
--   * so a nutricionista ve o placar de todas; a paciente ve so a propria.
-- =============================================================================

truncate resultados_teste;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000b1a01', 'hist-a@paciente.test'),
  ('00000000-0000-0000-0000-0000000b1a02', 'hist-b@paciente.test'),
  ('00000000-0000-0000-0000-0000000b1a03', 'hist-c@paciente.test'),
  ('00000000-0000-0000-0000-0000000b1a04', 'hist-d@paciente.test');
insert into pacientes (email, nome, plano_id, data_inicio, data_fim) values
  ('hist-a@paciente.test', 'Ana Historico', 'mensal', hoje_sp() - 5, hoje_sp() + 25),
  ('hist-b@paciente.test', 'Bia Historico', 'mensal', hoje_sp() - 5, hoje_sp() + 25),
  ('hist-c@paciente.test', 'Cida Historico', 'mensal', hoje_sp() - 5, hoje_sp() + 25),
  ('hist-d@paciente.test', 'Dora Historico', 'mensal', hoje_sp() - 5, hoje_sp() + 25);

create or replace function ana_h() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'hist-a@paciente.test' $$;
create or replace function bia_h() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'hist-b@paciente.test' $$;

-- Um desafio no mes passado e outro no atual. Como RASCUNHO: a trava de
-- sobreposicao so vale para desafios publicados, e o historico nao olha o status.
insert into desafios (nome, data_inicio, data_fim, status) values
  ('Hist Mes Passado', date_trunc('month', hoje_sp()::timestamp - interval '1 month')::date,
     (date_trunc('month', hoje_sp()::timestamp) - interval '1 day')::date, 'rascunho'),
  ('Hist Mes Atual', date_trunc('month', hoje_sp()::timestamp)::date,
     (date_trunc('month', hoje_sp()::timestamp) + interval '1 month - 1 day')::date, 'rascunho');

create or replace function dora_h() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'hist-d@paciente.test' $$;
create or replace function desafio_h(p_nome text) returns uuid language sql stable security definer as $$
  select id from desafios where nome = p_nome $$;
grant execute on function ana_h(), bia_h(), dora_h(), desafio_h(text) to anon, authenticated;

-- Ana: 40 + 20 no mes passado, MAIS uma correcao de 5 lancada HOJE para o desafio
-- do mes passado; no atual, 10 e um resgate de 50.
insert into pontos_lancamentos (paciente_id, desafio_id, pontos, tipo, descricao, criado_em) values
  (ana_h(), desafio_h('Hist Mes Passado'), 40, 'acao', 'a', now() - interval '25 days'),
  (ana_h(), desafio_h('Hist Mes Passado'), 20, 'acao', 'b', now() - interval '20 days'),
  (ana_h(), desafio_h('Hist Mes Passado'), 5, 'ajuste', 'correcao tardia', now()),
  (ana_h(), desafio_h('Hist Mes Atual'), 10, 'acao', 'c', now()),
  (ana_h(), desafio_h('Hist Mes Atual'), -50, 'resgate', 'kit', now());
-- Bia: ajuste avulso (sem desafio) no mes passado + 5 de ha 6 meses (fora da janela).
insert into pontos_lancamentos (paciente_id, desafio_id, pontos, tipo, descricao, criado_em) values
  (bia_h(), null, 25, 'ajuste', 'avulso', date_trunc('month', now()) - interval '10 days'),
  (bia_h(), null, 5, 'ajuste', 'antigo', date_trunc('month', now()) - interval '6 months');
-- Dora: 320 no mes passado, o bastante para o "Kit degustacao" (300).
insert into pontos_lancamentos (paciente_id, desafio_id, pontos, tipo, descricao, criado_em) values
  (dora_h(), desafio_h('Hist Mes Passado'), 320, 'acao', 'muito', now() - interval '15 days');

create or replace function mes_passado() returns date language sql stable as $$
  select date_trunc('month', hoje_sp()::timestamp - interval '1 month')::date $$;
create or replace function mes_atual() returns date language sql stable as $$
  select date_trunc('month', hoje_sp()::timestamp)::date $$;
grant execute on function mes_passado(), mes_atual() to anon, authenticated;

-- A nutricionista ---------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

-- helper: a linha de uma paciente num mes
create temp table _h on commit drop as
  select (m ->> 'mes')::date as mes, (r ->> 'pacienteId')::uuid as pid,
         (r ->> 'pontos')::int as pontos, (r ->> 'resgatou')::int as resgatou, (r ->> 'saldo')::int as saldo
    from jsonb_array_elements(historico_mensal_de_pontos(3)) m,
         jsonb_array_elements(m -> 'ranking') r;
grant select on _h to authenticated;

select teste('a janela tem o mes atual e os 3 anteriores (4 meses)',
  jsonb_array_length(historico_mensal_de_pontos(3)) = 4);
select teste('o mais recente vem primeiro', (historico_mensal_de_pontos(3) -> 0 ->> 'mes')::date = mes_atual());
select teste('Ana no mes passado: 40 + 20 + a correcao tardia de 5 = 65',
  (select pontos from _h where pid = ana_h() and mes = mes_passado()) = 65);
select teste('o saldo de Ana ao fim do mes passado e 65',
  (select saldo from _h where pid = ana_h() and mes = mes_passado()) = 65);
select teste('Ana no mes atual: ganhou 10, resgatou 50',
  (select pontos from _h where pid = ana_h() and mes = mes_atual()) = 10
  and (select resgatou from _h where pid = ana_h() and mes = mes_atual()) = 50);
select teste('o saldo de Ana hoje e 65 + 10 - 50 = 25',
  (select saldo from _h where pid = ana_h() and mes = mes_atual()) = 25);
select teste('ponto sem desafio cai no mes em que foi lancado (Bia, mes passado = 25)',
  (select pontos from _h where pid = bia_h() and mes = mes_passado()) = 25);
select teste('o que esta fora da janela continua no saldo (Bia: 25 + 5 = 30)',
  (select saldo from _h where pid = bia_h() and mes = mes_passado()) = 30);
select teste('Cida, sem nenhum ponto, nao aparece', not exists (select 1 from _h where pid = (select id from pacientes where email = 'hist-c@paciente.test')));
select teste('no mes passado, Ana vem na frente de Bia (65 contra 25)',
  (select min(ord) from (select row_number() over () as ord, (r ->> 'pacienteId')::uuid as pid
     from jsonb_array_elements((select m -> 'ranking' from jsonb_array_elements(historico_mensal_de_pontos(3)) m
                                  where (m ->> 'mes')::date = mes_passado())) r) t where pid = ana_h())
   < (select min(ord) from (select row_number() over () as ord, (r ->> 'pacienteId')::uuid as pid
     from jsonb_array_elements((select m -> 'ranking' from jsonb_array_elements(historico_mensal_de_pontos(3)) m
                                  where (m ->> 'mes')::date = mes_passado())) r) t where pid = bia_h()));
select teste('a recompensa alcancada vem junto: Dora (320) chegou ao Kit degustacao',
  (select r ->> 'recompensa' from jsonb_array_elements((select m -> 'ranking' from jsonb_array_elements(historico_mensal_de_pontos(3)) m
                                  where (m ->> 'mes')::date = mes_passado())) r
    where (r ->> 'pacienteId')::uuid = dora_h()) = 'Kit degustação');
select teste('quem nao chegou a 200 fica sem recompensa (Ana, 65)',
  (select r -> 'recompensa' = 'null'::jsonb from jsonb_array_elements((select m -> 'ranking' from jsonb_array_elements(historico_mensal_de_pontos(3)) m
                                  where (m ->> 'mes')::date = mes_passado())) r
    where (r ->> 'pacienteId')::uuid = ana_h()));
select teste('janela de 1 mes: so o atual e o passado', jsonb_array_length(historico_mensal_de_pontos(1)) = 2);
select teste('zero ou negativo vira 1', jsonb_array_length(historico_mensal_de_pontos(0)) = 2);
select teste('o teto e 12 meses (13 entradas)', jsonb_array_length(historico_mensal_de_pontos(99)) = 13);
select teste('o total do mes e a soma do que foi ganho',
  (select (m ->> 'total')::int from jsonb_array_elements(historico_mensal_de_pontos(3)) m where (m ->> 'mes')::date = mes_passado())
  >= 90);
commit;

-- Ana ve a propria evolucao --------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000b1a01', true);
select teste('4 meses, do mais antigo ao mais novo',
  jsonb_array_length(meu_historico_de_pontos(3)) = 4
  and (meu_historico_de_pontos(3) -> 0 ->> 'mes')::date < (meu_historico_de_pontos(3) -> 3 ->> 'mes')::date);
select teste('mes passado: 65 pontos e saldo 65',
  (select (m ->> 'pontos')::int = 65 and (m ->> 'saldo')::int = 65
     from jsonb_array_elements(meu_historico_de_pontos(3)) m where (m ->> 'mes')::date = mes_passado()));
select teste('mes atual: 10 pontos e saldo 25 (o resgate nao conta como ganho)',
  (select (m ->> 'pontos')::int = 10 and (m ->> 'saldo')::int = 25
     from jsonb_array_elements(meu_historico_de_pontos(3)) m where (m ->> 'mes')::date = mes_atual()));
select teste('meses sem ponto aparecem com zero, para a curva ter continuidade',
  (select count(*) from jsonb_array_elements(meu_historico_de_pontos(3)) m where (m ->> 'pontos')::int = 0) = 2);
select teste('ela NAO chama o placar da nutricionista',
  estado_de('select historico_mensal_de_pontos(3)') = '42501');
commit;

-- Bia ve so o dela; Cida (sem pontos) ve vazio -------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000b1a02', true);
select teste('Bia: mes passado 25, saldo 30 — nao enxerga os pontos da Ana',
  (select (m ->> 'pontos')::int = 25 and (m ->> 'saldo')::int = 30
     from jsonb_array_elements(meu_historico_de_pontos(3)) m where (m ->> 'mes')::date = mes_passado()));
commit;

begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000b1a03', true);
select teste('quem nunca pontuou recebe lista vazia (o cartao nem aparece)', meu_historico_de_pontos(3) = '[]'::jsonb);
commit;

-- Visitante --------------------------------------------------------------------------------------
begin;
set local role anon;
do $$
declare v_erro boolean;
begin
  v_erro := false;
  begin perform historico_mensal_de_pontos(3); exception when others then v_erro := true; end;
  perform teste('visitante NAO ve o placar', v_erro);
  v_erro := false;
  begin perform meu_historico_de_pontos(3); exception when others then v_erro := true; end;
  perform teste('visitante NAO ve evolucao', v_erro);
end;
$$;
commit;

select case when bool_and(passou) then count(*) || '/' || count(*) || ' verificacoes do historico de pontos passaram'
            else (count(*) filter (where not passou)) || ' verificacoes do historico de pontos falharam' end
    as resultado
from resultados_teste;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% verificacao(oes) do historico de pontos falharam', v_falhas;
  end if;
end;
$$;
