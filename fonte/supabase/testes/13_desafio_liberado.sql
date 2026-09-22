-- =============================================================================
-- Bateria do interruptor do desafio (0038)
--
-- O desafio e o unico modulo sem porta natural: existindo desafio no mes,
-- ele aparece para TODA paciente. E e justamente o modulo em que estar
-- dentro pode fazer mal -- pontuacao, ranking e comparacao com outras
-- pessoas nao sao para toda paciente.
--
-- O que nao pode falhar:
--
--   * ele NASCE LIGADO. Nascendo desligado, a migracao tiraria todo mundo
--     de um desafio em andamento, em silencio, no minuto em que rodasse;
--   * desligado, a tela some E a escrita e recusada. Esconder o cartao nao
--     impede ninguem de chamar a funcao;
--   * so a nutricionista mexe no interruptor;
--   * uma paciente nao descobre, pelo id, quem esta dentro e quem esta fora.
-- =============================================================================

truncate resultados_teste;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000de01', 'desafio-a@paciente.test'),
  ('00000000-0000-0000-0000-00000000de02', 'desafio-b@paciente.test');

insert into pacientes (email, nome, plano_id, data_inicio, data_fim) values
  ('desafio-a@paciente.test', 'Vera Desafio', 'mensal', hoje_sp() - 5, hoje_sp() + 25),
  ('desafio-b@paciente.test', 'Iara Desafio', 'mensal', hoje_sp() - 5, hoje_sp() + 25);

create or replace function vera() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'desafio-a@paciente.test' $$;
create or replace function iara() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'desafio-b@paciente.test' $$;
grant execute on function vera(), iara() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Nasce LIGADO -- e e o oposto do treino, de proposito
-- -----------------------------------------------------------------------------
begin;
select teste('o desafio nasce ligado para quem ja existia',
  (select bool_and(desafio_liberado) from pacientes));
select teste('e a coluna tem default verdadeiro, que e o que vale na migracao',
  (select column_default from information_schema.columns
   where table_schema = 'public' and table_name = 'pacientes'
     and column_name = 'desafio_liberado') = 'true');
commit;

-- -----------------------------------------------------------------------------
-- So a nutricionista mexe
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000de01', true);

select teste('a paciente nao se desliga sozinha',
  estado_de(format('select definir_desafio_do_paciente(%L, false)', vera())) = '42501');
select teste('nem desliga outra',
  estado_de(format('select definir_desafio_do_paciente(%L, false)', iara())) = '42501');
select teste('nem escreve na coluna direto',
  nao_alterou('update pacientes set desafio_liberado = false'));

-- Saber o id da outra nao conta quem esta dentro.
select teste('ela nao descobre pelo id se a OUTRA esta liberada',
  desafio_liberado(iara()) = false);
select teste('mas sabe do proprio estado', desafio_liberado(vera()));
commit;

-- -----------------------------------------------------------------------------
-- Desligado: a tela some E a escrita e recusada
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select teste('a nutricionista desliga, e a funcao devolve o estado GRAVADO',
  definir_desafio_do_paciente(vera(), false) = false);
select teste('desligar uma nao desliga a outra', (select desafio_liberado from pacientes where id = iara()));
select teste('paciente que nao existe e recusada',
  estado_de('select definir_desafio_do_paciente(''00000000-0000-0000-0000-0000000000ee'', false)')
  = '22023');
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000de01', true);

select teste('o desafio some da tela dela', (meu_desafio() ->> 'temDesafio')::boolean = false);
select teste('e o atalho some do acesso', (meu_acesso() ->> 'desafio')::boolean = false);
-- A tela some SEM frase explicando: explicar seria informar que existe algo
-- do qual ela foi tirada.
select teste('e some sem contar que existe um desafio do qual ela ficou de fora',
  not (meu_desafio() ? 'desafio'));

-- A tranca de verdade: esconder o cartao nao impede ninguem de chamar.
select teste('marcar acao e recusado com o desafio desligado',
  estado_de(format('select enviar_acao(%L)',
    coalesce((select id from desafio_acoes limit 1),
             '00000000-0000-0000-0000-0000000000ee'::uuid))) = '42501');
commit;

-- -----------------------------------------------------------------------------
-- Religando, tudo volta
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select teste('a nutricionista religa', definir_desafio_do_paciente(vera(), true));
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000de01', true);
select teste('o atalho volta', (meu_acesso() ->> 'desafio')::boolean);
commit;

select
  count(*) filter (where passou) || '/' || count(*) || ' verificações do interruptor do desafio passaram'
    as resultado
from resultados_teste;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% verificação(ões) do interruptor do desafio falharam', v_falhas;
  end if;
end;
$$;
