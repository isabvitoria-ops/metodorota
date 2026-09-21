-- =============================================================================
-- Bateria do interruptor da aba de treino (0033)
--
-- "Os treinos vou liberar a aba só para alguns."
--
-- Esconder a aba no JavaScript não é controle de acesso: o endereço continua
-- lá, e quem digitar `/treino` entra. O que esta bateria prova é que, com a
-- aba desligada, NÃO ADIANTA entrar — o banco devolve vazio na leitura e
-- recusa toda escrita, em treino, sessão, cardio e meta.
--
-- E prova a outra metade, que é igualmente importante: desligar ESCONDE, não
-- apaga. Religando, tudo volta como estava, e a nutricionista continua vendo
-- o histórico da paciente o tempo todo.
-- =============================================================================

truncate resultados_teste;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000008b01', 'liberada@paciente.test'),
  ('00000000-0000-0000-0000-000000008b02', 'trancada@paciente.test');

insert into pacientes (email, nome, plano_id, data_inicio, data_fim) values
  ('liberada@paciente.test', 'Lia Liberada', 'mensal', hoje_sp() - 5, hoje_sp() + 25),
  ('trancada@paciente.test', 'Tina Trancada', 'mensal', hoje_sp() - 5, hoje_sp() + 25);

create or replace function lia() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'liberada@paciente.test' $$;
create or replace function tina() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'trancada@paciente.test' $$;
grant execute on function lia(), tina() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Nasce desligado, para todo mundo
-- -----------------------------------------------------------------------------
begin;
select teste('a aba de treino nasce desligada', not treino_liberado(lia()));
select teste('para todas as pacientes', not treino_liberado(tina()));
-- A coluna nasceu com `default false` num banco que já tinha pacientes: é o
-- caso real da publicação, e o que não pode acontecer é a aba aparecer para
-- todas no minuto em que a migração roda.
-- Contar as pacientes ligadas não serve aqui: as baterias anteriores rodam
-- no mesmo banco e já ligaram as delas. O que se quer provar é o DEFAULT da
-- coluna, que é o que decide o que aconteceu com quem já estava cadastrada
-- no minuto em que a migração rodou.
select teste('e a coluna nasce desligada, que é o caso de quem já era cadastrada',
  (select column_default from information_schema.columns
   where table_schema = 'public' and table_name = 'pacientes'
     and column_name = 'treino_liberado') = 'false');
commit;

-- -----------------------------------------------------------------------------
-- Só a nutricionista mexe no interruptor
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000008b02', true);

select teste('a paciente não libera a si mesma',
  estado_de(format('select definir_treino_do_paciente(%L, true)', tina())) = '42501');
select teste('nem libera outra',
  estado_de(format('select definir_treino_do_paciente(%L, true)', lia())) = '42501');
select teste('nem escreve na coluna direto',
  nao_alterou('update pacientes set treino_liberado = true'));
commit;

begin;
select teste('e depois de tentar, continua desligada', not treino_liberado(tina()));
commit;

-- -----------------------------------------------------------------------------
-- A nutricionista libera uma, e só uma
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select teste('ela liga a aba, e a função devolve o estado GRAVADO',
  definir_treino_do_paciente(lia(), true));
select teste('ligar uma não liga a outra', not treino_liberado(tina()));
select teste('paciente que não existe é recusada',
  estado_de('select definir_treino_do_paciente(''00000000-0000-0000-0000-0000000000ee'', true)')
  = '22023');
commit;

-- -----------------------------------------------------------------------------
-- A liberada usa a área inteira
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000008b01', true);

select teste('o atalho aparece para ela', (meu_acesso() ->> 'treino')::boolean);
select teste('e ela pode escrever o treino dela',
  (posso_escrever_treino() ->> 'pode')::boolean);

select salvar_treino(null, null, 'Meu treino', null, true,
  jsonb_build_array(jsonb_build_object('nome', 'Supino', 'seriesPlanejadas', '3')));
select registrar_sessao_treino(null, null, (meu_treino() ->> 'id')::uuid, hoje_sp(), null,
  jsonb_build_array(jsonb_build_object('exercicioNome', 'Supino', 'numero', '1',
                                       'carga', '30', 'repeticoes', '10')));
select registrar_cardio(null, null, hoje_sp(), 'Caminhada', '30', null, null, null);

select teste('o treino dela existe', meu_treino() is not null);
select teste('a sessão dela existe', jsonb_array_length(sessoes_de_treino()) = 1);
select teste('o cardio dela existe', jsonb_array_length(sessoes_de_cardio()) = 1);
commit;

-- -----------------------------------------------------------------------------
-- A trancada não alcança NADA, por caminho nenhum
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000008b02', true);

select teste('o atalho NÃO aparece para ela', (meu_acesso() ->> 'treino')::boolean = false);

-- Digitar o endereço na mão não ajuda: as funções que a tela chamaria
-- respondem vazio.
select teste('o treino dela volta nulo', meu_treino() is null);
select teste('as sessões voltam vazias', sessoes_de_treino() = '[]'::jsonb);
select teste('o cardio volta vazio', sessoes_de_cardio() = '[]'::jsonb);
select teste('as metas voltam vazias', metas_semanais_de() = '[]'::jsonb);
select teste('e o banco diz que ela não pode escrever',
  (posso_escrever_treino() ->> 'pode')::boolean is false
  and (posso_escrever_treino() ->> 'motivo') = 'nao_liberado');

-- E as escritas são RECUSADAS, não ignoradas em silêncio.
select teste('ela não escreve treino',
  estado_de('select salvar_treino(null, null, ''Meu'', null, true,
    ''[{"nome":"X"}]''::jsonb)') = '42501');
select teste('ela não registra sessão',
  estado_de(format('select registrar_sessao_treino(null, null, null, %L, null,
    ''[{"exercicioNome":"X","numero":"1"}]''::jsonb)', hoje_sp())) = '42501');
select teste('ela não registra cardio',
  estado_de(format('select registrar_cardio(null, null, %L, ''Caminhada'', ''30'',
    null, null, null)', hoje_sp())) = '42501');

-- A Lia ESTÁ liberada neste ponto. Perguntando pelo id dela, a Tina tem de
-- receber "não" — senão dava para varrer os ids e descobrir, uma por uma,
-- quem está com a área ligada.
select teste('e não descobre pelo id se a OUTRA está liberada',
  treino_liberado(lia()) = false);
select teste('a trancada não enxerga a sessão da liberada',
  (select count(*) from treino_sessoes) = 0);
select teste('nem o cardio da liberada', (select count(*) from cardio_sessoes) = 0);
commit;

-- -----------------------------------------------------------------------------
-- Desligar ESCONDE, não apaga
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select teste('a nutricionista desliga', not definir_treino_do_paciente(lia(), false));
select teste('e continua vendo o histórico dela, aba ligada ou não',
  jsonb_array_length(sessoes_de_treino(lia())) = 1
  and jsonb_array_length(treinos_do_paciente(lia())) = 1);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000008b01', true);
select teste('do lado da paciente, a área fecha na hora', meu_treino() is null);
select teste('e a sessão que ela registrou some da tela dela',
  sessoes_de_treino() = '[]'::jsonb);
select teste('ela não apaga mais a própria sessão com a aba desligada',
  estado_de(format('select excluir_sessao_treino(%L)',
    (select id from treino_sessoes))) = '42501');
commit;

begin;
select teste('mas NADA foi apagado do banco',
  (select count(*) from treino_sessoes where paciente_id = lia()) = 1
  and (select count(*) from treinos where paciente_id = lia()) = 1
  and (select count(*) from cardio_sessoes where paciente_id = lia()) = 1);
commit;

-- Religando, tudo volta como estava.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select definir_treino_do_paciente(lia(), true);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000008b01', true);
select teste('religando, o treino volta', (meu_treino() ->> 'nome') = 'Meu treino');
select teste('a sessão volta', jsonb_array_length(sessoes_de_treino()) = 1);
select teste('e o cardio volta', jsonb_array_length(sessoes_de_cardio()) = 1);
commit;

select
  count(*) filter (where passou) || '/' || count(*) || ' verificações do interruptor de treino passaram'
    as resultado
from resultados_teste;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% verificação(ões) do interruptor de treino falharam', v_falhas;
  end if;
end;
$$;
