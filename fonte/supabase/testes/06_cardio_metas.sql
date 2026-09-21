-- =============================================================================
-- Bateria do cardio e das metas semanais
--
-- A distinção que esta bateria existe para provar:
--
--   * CARDIO é registro da paciente — ela cria, altera e apaga o dela;
--   * META é decisão da profissional — a paciente LÊ e mais nada.
--
-- E, como sempre, que uma paciente não alcança nada da outra, nem sabendo
-- o id dela.
-- =============================================================================

truncate resultados_teste;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000c101', 'cardio-a@paciente.test'),
  ('00000000-0000-0000-0000-00000000c102', 'cardio-b@paciente.test');

insert into pacientes (email, nome, plano_id, data_inicio, data_fim) values
  ('cardio-a@paciente.test', 'Carol Cardio', 'mensal', hoje_sp() - 5, hoje_sp() + 25),
  ('cardio-b@paciente.test', 'Bete Cardio', 'mensal', hoje_sp() - 5, hoje_sp() + 25);

-- `security definer` pelo mesmo motivo da bateria do treino: o teste quer
-- provar que SABER o id da outra não ajuda, e sem isto ele provaria que
-- "pedir a lista de ninguém é recusado" — verdadeiro e inútil.
create or replace function carol() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'cardio-a@paciente.test' $$;
create or replace function bete() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'cardio-b@paciente.test' $$;
grant execute on function carol(), bete() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- A semana começa na segunda
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select teste('segunda continua segunda', segunda_da_semana(date '2026-09-21') = date '2026-09-21');
select teste('quarta volta para a segunda', segunda_da_semana(date '2026-09-23') = date '2026-09-21');
-- Com `dow` em vez de `isodow`, domingo viraria o começo da semana e a
-- semana de quem treina no fim de semana ficaria partida ao meio.
select teste('domingo pertence à semana que passou',
  segunda_da_semana(date '2026-09-27') = date '2026-09-21');
select teste('e a segunda seguinte abre semana nova',
  segunda_da_semana(date '2026-09-28') = date '2026-09-28');
commit;

-- -----------------------------------------------------------------------------
-- A paciente registra o cardio dela
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c101', true);

select registrar_cardio(null, null, hoje_sp() - 2, 'Caminhada', 30, 3.2, 'Leve', null);
select registrar_cardio(null, null, hoje_sp(), 'Bike', 40, null, null, 'Na academia');

select teste('as duas sessões dela ficaram', jsonb_array_length(sessoes_de_cardio()) = 2);
select teste('a mais nova vem primeiro',
  (sessoes_de_cardio() -> 0 ->> 'tipo') = 'Bike');
-- A bicicleta da academia não dá distância. Zero diria que ela andou zero
-- quilômetro, que é afirmação diferente de "não dá para medir aqui".
select teste('distância em branco fica NULA, não zero',
  (sessoes_de_cardio() -> 0 -> 'distanciaKm') = 'null'::jsonb);
select teste('e a distância que existe foi guardada',
  (sessoes_de_cardio() -> 1 ->> 'distanciaKm')::numeric = 3.2);

select teste('não dá para registrar cardio no futuro',
  recusou('select registrar_cardio(null, null, hoje_sp() + 1, ''Corrida'', 20, null, null, null)'));
select teste('duração negativa é recusada pelo banco',
  recusou('select registrar_cardio(null, null, hoje_sp(), ''Corrida'', -10, null, null, null)'));

select teste('ela não define meta para si mesma',
  recusou(format('select definir_meta_semanal(%L, hoje_sp(), ''treino'', 4, ''treinos'')', carol())));
select teste('e o erro é de permissão',
  estado_de(format('select definir_meta_semanal(%L, hoje_sp(), ''treino'', 4, ''treinos'')', carol()))
  = '42501');
commit;

-- -----------------------------------------------------------------------------
-- A profissional define a meta
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

-- Definida numa QUARTA: tem que cair na segunda daquela semana, senão a
-- mesma meta posta em dois dias viraria duas semanas diferentes.
select definir_meta_semanal(carol(), date '2026-09-23', 'treino', 4, 'treinos');
select teste('a meta é normalizada para a segunda',
  (select semana_inicio from metas_semanais where paciente_id = carol() and tipo = 'treino')
  = date '2026-09-21');

select definir_meta_semanal(carol(), date '2026-09-21', 'cardio', 90, 'minutos');
select teste('cabem duas metas na semana: uma de treino e uma de cardio',
  (select count(*) from metas_semanais where paciente_id = carol()) = 2);

-- Definir de novo REFAZ, não duplica: duas metas de treino na mesma semana
-- fariam a tela mostrar "3/4" e "3/5" lado a lado, e nenhuma seria a resposta.
select definir_meta_semanal(carol(), date '2026-09-25', 'treino', 5, 'treinos');
select teste('redefinir a mesma semana troca o alvo em vez de criar outra',
  (select count(*) from metas_semanais where paciente_id = carol() and tipo = 'treino') = 1
  and (select alvo from metas_semanais where paciente_id = carol() and tipo = 'treino') = 5);

select teste('meta zerada é recusada',
  recusou(format('select definir_meta_semanal(%L, hoje_sp(), ''treino'', 0, ''treinos'')', carol())));
select teste('e o motivo é dado inválido, não outro qualquer',
  estado_de(format('select definir_meta_semanal(%L, hoje_sp(), ''treino'', 0, ''treinos'')', carol()))
  = '22023');
select teste('tipo de meta desconhecido é recusado',
  recusou(format('select definir_meta_semanal(%L, hoje_sp(), ''alongamento'', 3, ''vezes'')', carol())));
commit;

-- -----------------------------------------------------------------------------
-- A paciente lê a meta, e não a muda
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c101', true);

select teste('ela vê as duas metas dela', jsonb_array_length(metas_semanais_de()) = 2);
select teste('com o alvo que a profissional pôs',
  (select (m ->> 'alvo')::numeric from jsonb_array_elements(metas_semanais_de()) m
    where m ->> 'tipo' = 'treino') = 5);

-- "Não pode alterar metas definidas pelo profissional."
select teste('ela não altera a meta', nao_alterou('update metas_semanais set alvo = 1'));
select teste('ela não apaga a meta', nao_alterou('delete from metas_semanais'));
select teste('nem pela função', recusou('select excluir_meta_semanal((select id from metas_semanais limit 1))'));
select teste('e o atalho de evolução aparece para ela', (meu_acesso() ->> 'treino')::boolean);
commit;

-- -----------------------------------------------------------------------------
-- O que a paciente B alcança: nada
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c102', true);

select teste('a B não vê o cardio da A', (select count(*) from cardio_sessoes) = 0);
select teste('nem as metas da A', (select count(*) from metas_semanais) = 0);
select teste('e as listas dela voltam vazias',
  sessoes_de_cardio() = '[]'::jsonb and metas_semanais_de() = '[]'::jsonb);
select teste('e sem meta nenhuma o atalho não aparece',
  (meu_acesso() ->> 'treino')::boolean = false);

select teste('pedir o cardio da A pelo id é recusado',
  estado_de(format('select sessoes_de_cardio(%L)', carol())) = '42501');
select teste('pedir as metas da A pelo id é recusado',
  estado_de(format('select metas_semanais_de(%L)', carol())) = '42501');

-- A porta menos óbvia: registrar na ficha da outra mandando o id dela.
select registrar_cardio(null, carol(), hoje_sp(), 'Invasão', 10, null, null, null);
select teste('mandar o id da outra grava na ficha de quem chamou',
  jsonb_array_length(sessoes_de_cardio()) = 1
  and (sessoes_de_cardio() -> 0 ->> 'tipo') = 'Invasão');
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select teste('e a ficha da A continua com as duas sessões dela',
  jsonb_array_length(sessoes_de_cardio(carol())) = 2);

delete from pacientes where email = 'cardio-a@paciente.test';
select teste('excluir a paciente leva o cardio dela',
  (select count(*) from cardio_sessoes where paciente_id not in (select id from pacientes)) = 0);
select teste('e as metas dela',
  (select count(*) from metas_semanais where paciente_id not in (select id from pacientes)) = 0);
commit;

select
  count(*) filter (where passou) || '/' || count(*) || ' verificações do cardio e das metas passaram'
    as resultado
from resultados_teste;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% verificação(ões) do cardio e das metas falharam', v_falhas;
  end if;
end;
$$;
