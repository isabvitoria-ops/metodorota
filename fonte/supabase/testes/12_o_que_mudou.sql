-- =============================================================================
-- Bateria do "o que mudou desde a ultima consulta" (0037)
--
-- Duas coisas nao podem falhar:
--
--   * a funcao conta SO o que e da propria paciente. Ela nao recebe
--     parametro nenhum de proposito -- nao ha id para mandar errado --, e
--     esta bateria confirma que duas pacientes recebem numeros diferentes;
--   * sem consulta concluida nao ha marco, e a resposta e vazia em vez de
--     inventar "os ultimos 30 dias".
-- =============================================================================

truncate resultados_teste;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000dd01', 'mudou-a@paciente.test'),
  ('00000000-0000-0000-0000-00000000dd02', 'mudou-b@paciente.test');

insert into pacientes (email, nome, plano_id, data_inicio, data_fim) values
  ('mudou-a@paciente.test', 'Lia Mudou', 'mensal', hoje_sp() - 60, hoje_sp() + 30),
  ('mudou-b@paciente.test', 'Sol Mudou', 'mensal', hoje_sp() - 60, hoje_sp() + 30);

create or replace function lia_m() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'mudou-a@paciente.test' $$;
create or replace function sol_m() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'mudou-b@paciente.test' $$;
grant execute on function lia_m(), sol_m() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Sem consulta concluida nao ha marco
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000dd01', true);
select teste('sem consulta concluida, nao ha marco',
  (o_que_mudou() ->> 'temMarco')::boolean = false);
select teste('e nada mais e devolvido junto',
  not (o_que_mudou() ? 'dias'));
commit;

-- Consulta AGENDADA nao serve de marco: ela ainda nao aconteceu.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select salvar_consulta(null, lia_m(), hoje_sp() + 3, null, 'retorno', 'agendada', null, null);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000dd01', true);
select teste('consulta agendada nao vira marco',
  (o_que_mudou() ->> 'temMarco')::boolean = false);
commit;

-- -----------------------------------------------------------------------------
-- Com consulta concluida, as contagens comecam nela
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select salvar_consulta(null, lia_m(), hoje_sp() - 14, null, 'retorno', 'concluida', 'Ajuste', null);
select salvar_meta(null, lia_m(), 'Agua', null, null, 'diaria', 2, 'litros',
  hoje_sp() - 30, null, 'ativa');
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000dd01', true);
select teste('agora ha marco, e ele e a consulta concluida',
  (o_que_mudou() ->> 'temMarco')::boolean
  and (o_que_mudou() ->> 'desde') = (hoje_sp() - 14)::text);
select teste('e os dias sao contados do marco ate hoje',
  (o_que_mudou() ->> 'dias')::integer = 14);
select teste('a proxima consulta agendada vem junto',
  (o_que_mudou() ->> 'proximaConsulta') = (hoje_sp() + 3)::text);

-- Marcacoes: uma ANTES do marco e duas depois. So as duas contam.
select registrar_meta((select id from metas where paciente_id = lia_m() limit 1),
  hoje_sp() - 20, 2, null);
select registrar_meta((select id from metas where paciente_id = lia_m() limit 1),
  hoje_sp() - 5, 2, null);
select registrar_meta((select id from metas where paciente_id = lia_m() limit 1),
  hoje_sp() - 2, 2, null);

select teste('so as marcacoes DEPOIS do marco entram na conta',
  (o_que_mudou() ->> 'marcacoesDeMeta')::integer = 2);
select teste('as metas ativas vem junto',
  (o_que_mudou() ->> 'metasAtivas')::integer = 1);
commit;

-- -----------------------------------------------------------------------------
-- O treino so conta com a aba liberada
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000dd01', true);
-- Com a aba desligada, "0 treinos" seria cobranca por uma porta que ela
-- nao tem. NULO diz "nao se aplica"; zero diria "voce nao treinou".
select teste('com a aba de treino desligada, treinos vem NULO e nao zero',
  (o_que_mudou() -> 'treinos') = 'null'::jsonb);
select teste('e os minutos de cardio tambem',
  (o_que_mudou() -> 'minutosDeCardio') = 'null'::jsonb);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select definir_treino_do_paciente(lia_m(), true);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000dd01', true);
select teste('liberada a aba, treinos passa a ser um numero',
  (o_que_mudou() ->> 'treinos')::integer = 0);
commit;

-- -----------------------------------------------------------------------------
-- Cada paciente recebe os SEUS numeros
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000dd02', true);
-- A funcao nao aceita parametro: nao ha id para mandar errado. O que ela
-- recebe e o marco DELA, que nao existe.
select teste('a outra paciente nao herda o marco da primeira',
  (o_que_mudou() ->> 'temMarco')::boolean = false);
commit;

begin;
set local role anon;
select teste('quem nao esta logado nao recebe nada', recusou('select o_que_mudou()'));
commit;

select
  count(*) filter (where passou) || '/' || count(*) || ' verificações do "o que mudou" passaram'
    as resultado
from resultados_teste;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% verificação(ões) do "o que mudou" falharam', v_falhas;
  end if;
end;
$$;
