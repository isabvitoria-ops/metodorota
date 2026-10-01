-- =============================================================================
-- Bateria da indicacao pela nutricionista, do acumulado no ranking e da
-- limpeza dos pontos antigos (0061)
--
-- O que nao pode falhar:
--   * so a nutricionista registra indicacao por outra pessoa, e ela cai na
--     lista como qualquer indicacao (registrada), podendo ser validada (+100);
--   * o ranking traz o acumulado (mes do desafio + 3 anteriores), sem contar
--     resgate, e nao mostra quem nao e do desafio;
--   * a limpeza SO mostra enquanto nao confirmada; confirmada, arquiva antes de
--     apagar, tira so o que e anterior ao corte e nao mexe nas indicacoes;
--   * paciente e visitante nao limpam nem registram por outra.
-- =============================================================================

truncate resultados_teste;
delete from pontos_lancamentos;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000b3a01', 'lim-a@paciente.test'),
  ('00000000-0000-0000-0000-0000000b3a02', 'lim-b@paciente.test');
insert into pacientes (email, nome, plano_id, data_inicio, data_fim) values
  ('lim-a@paciente.test', 'Camila Limpeza', 'mensal', hoje_sp() - 5, hoje_sp() + 25),
  ('lim-b@paciente.test', 'Dani Limpeza', 'mensal', hoje_sp() - 5, hoje_sp() + 25);

create or replace function cam() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'lim-a@paciente.test' $$;
create or replace function dani() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'lim-b@paciente.test' $$;
create or replace function mes_rel(p_atras integer) returns date language sql stable as $$
  select (date_trunc('month', hoje_sp()::timestamp) - make_interval(months => p_atras))::date $$;
create or replace function des_lim(p_nome text) returns uuid language sql stable security definer as $$
  select id from desafios where nome = p_nome $$;
grant execute on function cam(), dani(), mes_rel(integer), des_lim(text) to anon, authenticated;

-- Desafios como RASCUNHO (a trava de sobreposicao so vale para os publicados; o
-- historico e o acumulado nao olham o status): atual, -1, -2, -4 e -5 meses.
insert into desafios (nome, data_inicio, data_fim, status) values
  ('Lim Atual', mes_rel(0), (mes_rel(0) + interval '1 month - 1 day')::date, 'rascunho'),
  ('Lim M1', mes_rel(1), (mes_rel(1) + interval '1 month - 1 day')::date, 'rascunho'),
  ('Lim M2', mes_rel(2), (mes_rel(2) + interval '1 month - 1 day')::date, 'rascunho'),
  ('Lim M4', mes_rel(4), (mes_rel(4) + interval '1 month - 1 day')::date, 'rascunho'),
  ('Lim M5', mes_rel(5), (mes_rel(5) + interval '1 month - 1 day')::date, 'rascunho');

-- Camila: 100 este mes, 200 no mes passado, 50 ha dois meses, 400 ha 4 meses (antigo),
-- 30 ha 5 meses (antigo) e um resgate de 60 este mes. Dani: 10 este mes e 70 antigos.
insert into pontos_lancamentos (paciente_id, desafio_id, pontos, tipo, descricao) values
  (cam(), des_lim('Lim Atual'), 100, 'acao', 'a'),
  (cam(), des_lim('Lim M1'), 200, 'acao', 'b'),
  (cam(), des_lim('Lim M2'), 50, 'acao', 'c'),
  (cam(), des_lim('Lim M4'), 400, 'acao', 'antigo 1'),
  (cam(), des_lim('Lim M5'), 30, 'acao', 'antigo 2'),
  (cam(), des_lim('Lim Atual'), -60, 'resgate', 'kit'),
  (dani(), des_lim('Lim Atual'), 10, 'acao', 'd'),
  (dani(), des_lim('Lim M4'), 70, 'acao', 'antigo 3');

-- Indicacao pela nutricionista ----------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select registrar_indicacao_por(cam(), '  Fulana de Tal ', 'fulana@x.test', '31999990000') as ind_id
\gset
select teste('a nutricionista registra a indicacao por Camila',
  (select nome_indicada = 'Fulana de Tal' and status = 'registrada' and paciente_indicadora_id = cam()
     and email_indicada = 'fulana@x.test' from indicacoes where id = :'ind_id'::uuid));
select teste('sem nome, recusa', estado_de($q$select registrar_indicacao_por(cam(), '   ')$q$) = '22023');
select teste('paciente que nao existe, recusa',
  estado_de($q$select registrar_indicacao_por('00000000-0000-0000-0000-00000000dead', 'X')$q$) = '22023');
select validar_indicacao(:'ind_id'::uuid);
select teste('e pode ser validada em seguida (+pontos para Camila)',
  (select status = 'validada' and pontos_concedidos > 0 from indicacoes where id = :'ind_id'::uuid));
commit;

begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000b3a02', true);
select teste('paciente NAO registra indicacao por outra pessoa',
  estado_de($q$select registrar_indicacao_por(cam(), 'Qualquer')$q$) = '42501');
select teste('paciente NAO limpa pontos', estado_de($q$select limpar_pontos_antigos(true)$q$) = '42501');
commit;

begin;
set local role anon;
do $$
declare v_erro boolean := false;
begin
  begin perform registrar_indicacao_por('00000000-0000-0000-0000-00000000dead', 'X'); exception when others then v_erro := true; end;
  perform teste('visitante NAO registra indicacao por outra', v_erro);
  v_erro := false;
  begin perform limpar_pontos_antigos(false); exception when others then v_erro := true; end;
  perform teste('visitante NAO ve a limpeza', v_erro);
end;
$$;
commit;

-- Acumulado no ranking -------------------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select teste('ranking do mes atual: Camila 40 pontos no desafio (100 - 60 do resgate lancado nele)',
  (select pontos = 40 from ranking_do_desafio(des_lim('Lim Atual')) where paciente_id = cam()));
select teste('acumulado de Camila: 100 + 200 + 50 (+ a indicacao validada, que e outro desafio) = a soma dos 4 meses, SEM o resgate e sem os 4/5 meses atras',
  (select acumulado >= 350 and acumulado < 750 from ranking_do_desafio(des_lim('Lim Atual')) where paciente_id = cam()));
select teste('o antigo (4 e 5 meses atras) NAO entra no acumulado de Dani: so os 10 deste mes',
  (select acumulado = 10 from ranking_do_desafio(des_lim('Lim Atual')) where paciente_id = dani()));
commit;

-- Limpeza -----------------------------------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select limpar_pontos_antigos(false) as previa
\gset
select (select count(*) from pontos_lancamentos where descricao like 'antigo%') as antes_n
\gset
commit;

select teste('a previa conta so o antigo (3 linhas: 400 + 30 da Camila e 70 da Dani)',
  (:'previa'::jsonb ->> 'linhas')::int = 3 and (:'previa'::jsonb ->> 'pontos')::int = 500
  and (:'previa'::jsonb ->> 'pacientes')::int = 2);
select teste('a previa NAO apaga nada', :'antes_n'::int = 3 and (select count(*) from pontos_arquivo) = 0);
select teste('o corte e o 1o dia do mes de hoje - 3 meses', (:'previa'::jsonb ->> 'corte')::date = mes_rel(3));
select teste('a previa diz que nao apagou', (:'previa'::jsonb ->> 'apagou')::boolean = false);

begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select limpar_pontos_antigos(true) as feito
\gset
commit;

select teste('confirmada, apagou', (:'feito'::jsonb ->> 'apagou')::boolean);
select teste('o antigo saiu do livro de pontos', (select count(*) from pontos_lancamentos where descricao like 'antigo%') = 0);
select teste('e foi PARA o arquivo, inteiro, com a data', (select count(*) from pontos_arquivo where descricao like 'antigo%' and arquivado_em is not null) = 3);
select teste('o que e da janela ficou (Camila: 100, 200, 50 e o resgate)',
  (select count(*) from pontos_lancamentos where paciente_id = cam() and descricao in ('a', 'b', 'c', 'kit')) = 4);
select teste('o saldo de Camila agora e so o da janela (100 + 200 + 50 - 60, mais a indicacao validada)',
  (select coalesce(sum(pontos), 0) from pontos_lancamentos where paciente_id = cam()) >= 290);
select teste('a indicacao validada continua la (a escada nao zera)',
  (select count(*) from indicacoes where paciente_indicadora_id = cam() and status = 'validada') = 1);

begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select limpar_pontos_antigos(true) as de_novo
\gset
commit;
select teste('rodar de novo nao faz nada', (:'de_novo'::jsonb ->> 'linhas')::int = 0 and not (:'de_novo'::jsonb ->> 'apagou')::boolean);
select teste('a paciente NAO le o arquivo (so a nutricionista)',
  (select count(*) from information_schema.role_table_grants where table_name = 'pontos_arquivo' and grantee = 'anon') = 0);

select case when bool_and(passou) then count(*) || '/' || count(*) || ' verificacoes da indicacao e da limpeza passaram'
            else (count(*) filter (where not passou)) || ' verificacoes da indicacao e da limpeza falharam' end
    as resultado
from resultados_teste;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% verificacao(oes) da indicacao e da limpeza falharam', v_falhas;
  end if;
end;
$$;
