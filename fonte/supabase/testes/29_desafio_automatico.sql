-- =============================================================================
-- Bateria do desafio do mes automatico e da posicao no mes (0060)
--
-- O que nao pode falhar:
--   * sem desafio cobrindo o mes, `garantir_desafio_do_mes` cria o do mes, com o
--     texto do ultimo e as acoes copiadas, e e idempotente;
--   * nao cria se ja ha desafio no mes, se nao ha modelo, se foi uma pausa
--     longa ou se ela desligou (`desafio_automatico` = nao);
--   * visitante nao chama; sessao sem login nao cria nada;
--   * a evolucao da paciente traz posicao e participantes, com empate dividindo
--     o lugar, e quem nao pontuou no mes fica sem posicao.
-- =============================================================================

truncate resultados_teste;

-- GARANTIR O DESAFIO DO MES --------------------------------------------------------------------
-- Tudo dentro de uma transacao desfeita no fim (os desafios das outras baterias
-- nao podem atrapalhar nem ficar alterados); os resultados saem por \gset.
begin;
update desafios set status = 'rascunho' where status <> 'rascunho';
delete from configuracoes where chave = 'desafio_automatico';

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000b2a01', 'auto-a@paciente.test');
insert into pacientes (email, nome, plano_id, data_inicio, data_fim) values
  ('auto-a@paciente.test', 'Ana Automatica', 'mensal', hoje_sp() - 5, hoje_sp() + 25);

set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000b2a01', true);
select garantir_desafio_do_mes() is null as sem_modelo
\gset
reset role;

-- O modelo: o desafio do mes passado, no ar.
insert into desafios (nome, descricao, lema, regras, data_inicio, data_fim, status) values
  ('Modelo do mes passado', 'descricao do modelo', 'lema do modelo', 'regras do modelo',
   date_trunc('month', hoje_sp()::timestamp - interval '1 month')::date,
   (date_trunc('month', hoje_sp()::timestamp) - interval '1 day')::date, 'ativo');

set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000b2a01', true);
select garantir_desafio_do_mes() as novo
\gset
select garantir_desafio_do_mes() is null as segunda_vez
\gset
reset role;

select
  (:'novo' <> '') as criou,
  (select nome = 'Desafio de ' || (array['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho',
      'Agosto','Setembro','Outubro','Novembro','Dezembro'])[extract(month from hoje_sp())::int]
     from desafios where id = nullif(:'novo', '')::uuid) as nome_certo,
  (select status = 'ativo' from desafios where id = nullif(:'novo', '')::uuid) as no_ar,
  (select data_inicio = date_trunc('month', hoje_sp()::timestamp)::date
      and data_fim = (date_trunc('month', hoje_sp()::timestamp) + interval '1 month - 1 day')::date
     from desafios where id = nullif(:'novo', '')::uuid) as periodo_do_mes,
  (select lema = 'lema do modelo' and descricao = 'descricao do modelo' and regras = 'regras do modelo'
     from desafios where id = nullif(:'novo', '')::uuid) as copiou_texto,
  (select count(*) > 0 from desafio_acoes where desafio_id = nullif(:'novo', '')::uuid) as copiou_acoes,
  (select count(*) = 1 from desafios
    where status <> 'rascunho' and data_inicio = date_trunc('month', hoje_sp()::timestamp)::date) as so_um
\gset
rollback;

select teste('sem nenhum desafio para copiar, nao cria nada', :'sem_modelo'::boolean);
select teste('sem desafio no mes, cria o do mes', :'criou'::boolean);
select teste('o nome e "Desafio de <mes>"', :'nome_certo'::boolean);
select teste('nasce no ar', :'no_ar'::boolean);
select teste('cobre o mes inteiro, do dia 1 ao ultimo dia', :'periodo_do_mes'::boolean);
select teste('copia lema, descricao e regras do ultimo', :'copiou_texto'::boolean);
select teste('as acoes tambem vem (o gatilho copia)', :'copiou_acoes'::boolean);
select teste('chamar de novo nao faz nada', :'segunda_vez'::boolean);
select teste('e continua um so desafio no mes', :'so_um'::boolean);

-- QUANDO NAO CRIA ------------------------------------------------------------------------------
-- 1. ja ha desafio no mes (um que comeca no meio dele tambem conta).
begin;
update desafios set status = 'rascunho' where status <> 'rascunho';
insert into desafios (nome, lema, data_inicio, data_fim, status) values
  ('Ja existe', 'x', hoje_sp(), hoje_sp() + 3, 'ativo');
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000b2a01', true);
select garantir_desafio_do_mes() is null as nao_duplica
\gset
reset role;
rollback;
select teste('ja ha desafio tocando o mes: nao cria outro', :'nao_duplica'::boolean);

-- 2. uma pausa longa nao e virada de mes.
begin;
update desafios set status = 'rascunho' where status <> 'rascunho';
insert into desafios (nome, lema, data_inicio, data_fim, status) values
  ('Faz tempo', 'x', hoje_sp() - 200, hoje_sp() - 170, 'encerrado');
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000b2a01', true);
select garantir_desafio_do_mes() is null as nao_ressuscita
\gset
reset role;
rollback;
select teste('o ultimo terminou ha meses (pausa): nao ressuscita sozinho', :'nao_ressuscita'::boolean);

-- 3. ela desligou.
begin;
update desafios set status = 'rascunho' where status <> 'rascunho';
insert into desafios (nome, lema, data_inicio, data_fim, status) values
  ('Mes passado', 'x', hoje_sp() - 40, (date_trunc('month', hoje_sp()::timestamp) - interval '1 day')::date, 'encerrado');
insert into configuracoes (chave, valor) values ('desafio_automatico', '"nao"'::jsonb)
  on conflict (chave) do update set valor = excluded.valor;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000b2a01', true);
select garantir_desafio_do_mes() is null as desligado
\gset
reset role;
rollback;
select teste('com `desafio_automatico` = nao, nao cria', :'desligado'::boolean);

-- 4. sem login e visitante.
begin;
update desafios set status = 'rascunho' where status <> 'rascunho';
insert into desafios (nome, lema, data_inicio, data_fim, status) values
  ('Mes passado', 'x', hoje_sp() - 40, (date_trunc('month', hoje_sp()::timestamp) - interval '1 day')::date, 'encerrado');
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '', true);
select garantir_desafio_do_mes() is null as sem_login
\gset
reset role;
rollback;
select teste('sessao sem login nao cria nada', :'sem_login'::boolean);

begin;
set local role anon;
do $$
declare v_erro boolean := false;
begin
  begin perform garantir_desafio_do_mes(); exception when others then v_erro := true; end;
  perform teste('visitante NAO chama a funcao', v_erro);
end;
$$;
commit;

-- POSICAO NO MES -------------------------------------------------------------------------------
-- A posicao e entre TODAS as pacientes; os pontos que as baterias anteriores
-- deixaram neste banco de teste sairiam na conta. Comeco do zero.
delete from pontos_lancamentos;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000b2b01', 'pos-a@paciente.test'),
  ('00000000-0000-0000-0000-0000000b2b02', 'pos-b@paciente.test'),
  ('00000000-0000-0000-0000-0000000b2b03', 'pos-c@paciente.test'),
  ('00000000-0000-0000-0000-0000000b2b04', 'pos-d@paciente.test');
insert into pacientes (email, nome, plano_id, data_inicio, data_fim) values
  ('pos-a@paciente.test', 'Ana Posicao', 'mensal', hoje_sp() - 5, hoje_sp() + 25),
  ('pos-b@paciente.test', 'Bia Posicao', 'mensal', hoje_sp() - 5, hoje_sp() + 25),
  ('pos-c@paciente.test', 'Cida Posicao', 'mensal', hoje_sp() - 5, hoje_sp() + 25),
  ('pos-d@paciente.test', 'Dora Posicao', 'mensal', hoje_sp() - 5, hoje_sp() + 25);

create or replace function pos(p text) returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'pos-' || p || '@paciente.test' $$;
create or replace function desafio_pos() returns uuid language sql stable security definer as $$
  select id from desafios where nome = 'Pos Mes Passado' $$;
create or replace function mes_pos() returns date language sql stable as $$
  select date_trunc('month', hoje_sp()::timestamp - interval '1 month')::date $$;
grant execute on function pos(text), desafio_pos(), mes_pos() to anon, authenticated;

insert into desafios (nome, data_inicio, data_fim, status) values
  ('Pos Mes Passado', date_trunc('month', hoje_sp()::timestamp - interval '1 month')::date,
     (date_trunc('month', hoje_sp()::timestamp) - interval '1 day')::date, 'rascunho');

-- Ana e Bia empatam em 65 (1o lugar); Cida faz 30 (3o); Dora so tem ponto de outro mes.
insert into pontos_lancamentos (paciente_id, desafio_id, pontos, tipo, descricao) values
  (pos('a'), desafio_pos(), 65, 'acao', 'a'),
  (pos('b'), desafio_pos(), 40, 'acao', 'b1'),
  (pos('b'), desafio_pos(), 25, 'acao', 'b2'),
  (pos('c'), desafio_pos(), 30, 'acao', 'c'),
  (pos('d'), null, 10, 'ajuste', 'avulso de outro mes');
update pontos_lancamentos set criado_em = now() - interval '5 months'
 where paciente_id = pos('d');

begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000b2b01', true);
select teste('Ana: 65 pontos no mes passado, em 1o lugar',
  (select (m ->> 'pontos')::int = 65 and (m ->> 'posicao')::int = 1
     from jsonb_array_elements(meu_historico_de_pontos(3)) m where (m ->> 'mes')::date = mes_pos()));
select teste('3 participantes pontuaram no mes passado',
  (select (m ->> 'participantes')::int = 3 from jsonb_array_elements(meu_historico_de_pontos(3)) m
    where (m ->> 'mes')::date = mes_pos()));
select teste('o mes atual (sem ponto dela) fica sem posicao',
  (select (m -> 'posicao') = 'null'::jsonb from jsonb_array_elements(meu_historico_de_pontos(3)) m
    where (m ->> 'mes')::date = date_trunc('month', hoje_sp()::timestamp)::date));
commit;

begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000b2b02', true);
select teste('o empate divide o lugar: Bia (40 + 25 = 65) tambem e 1a',
  (select (m ->> 'pontos')::int = 65 and (m ->> 'posicao')::int = 1
     from jsonb_array_elements(meu_historico_de_pontos(3)) m where (m ->> 'mes')::date = mes_pos()));
commit;

begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000b2b03', true);
select teste('Cida: 30 pontos, 3o lugar (depois do empate, pula o 2o)',
  (select (m ->> 'posicao')::int = 3 from jsonb_array_elements(meu_historico_de_pontos(3)) m
    where (m ->> 'mes')::date = mes_pos()));
commit;

begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000b2b04', true);
select teste('Dora nao pontuou no mes passado: sem posicao, mas a lista vem (para o grafico)',
  (select (m ->> 'pontos')::int = 0 and (m -> 'posicao') = 'null'::jsonb
     from jsonb_array_elements(meu_historico_de_pontos(3)) m where (m ->> 'mes')::date = mes_pos()));
commit;

-- LANCAR DEPOIS DO FIM DO MES ------------------------------------------------------------------
-- Corrigir no dia seguinte um ponto do mes passado continua sendo ponto do mes passado.
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select ajustar_pontos(pos('c'), 15, 'lancado depois', desafio_pos());
commit;
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000b2b03', true);
select teste('ponto lancado hoje para o desafio do mes passado entra no mes passado (Cida: 30 + 15 = 45)',
  (select (m ->> 'pontos')::int = 45 from jsonb_array_elements(meu_historico_de_pontos(3)) m
    where (m ->> 'mes')::date = mes_pos()));
select teste('e Cida continua em 3o (45 contra 65 e 65)',
  (select (m ->> 'posicao')::int = 3 from jsonb_array_elements(meu_historico_de_pontos(3)) m
    where (m ->> 'mes')::date = mes_pos()));
commit;

select case when bool_and(passou) then count(*) || '/' || count(*) || ' verificacoes do desafio automatico passaram'
            else (count(*) filter (where not passou)) || ' verificacoes do desafio automatico falharam' end
    as resultado
from resultados_teste;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% verificacao(oes) do desafio automatico falharam', v_falhas;
  end if;
end;
$$;
