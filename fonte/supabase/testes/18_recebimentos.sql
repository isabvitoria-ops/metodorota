-- =============================================================================
-- Bateria do livro-caixa e do balanco (0046)
--
-- A ARMADILHA QUE ESTE MODULO EXISTE PARA EVITAR: duas listas separadas --
-- cobrancas de um lado, avulsos do outro -- somadas no fim. Ela marca a
-- cobranca como paga E registra o PIX que recebeu, porque sao a mesma
-- entrada vista de dois lugares. O balanco mostra o dobro, e ela nao tem
-- como saber, porque os dois numeros estao certos cada um por si.
--
-- Por isso: um livro-caixa so. Dar baixa CRIA a linha; desfazer APAGA.
--
-- O que nao pode falhar:
--
--   * dar baixa duas vezes nao vira dinheiro duas vezes;
--   * desfazer a baixa TIRA do caixa -- senao o dinheiro continuaria somado
--     depois de ela dizer que nao entrou;
--   * a entrada que nasceu de cobranca nao se edita nem se apaga pelo lado
--     avulso, senao os dois lugares discordariam sobre o mesmo dinheiro;
--   * "recebido no mes" e o MESMO numero nas duas telas;
--   * mes sem entrada aparece no balanco com zero, e nao sumido.
-- =============================================================================

truncate resultados_teste;

-- AS BATERIAS DIVIDEM O BANCO, e a 15 deixa cobrancas pagas para tras --
-- que AGORA criam recebimentos, porque a baixa passou a alimentar o caixa.
-- Sem limpar, as contas desta bateria comecariam de um saldo que nao e
-- dela, e os numeros fechariam por acaso ou falhariam sem motivo aparente.
--
-- Foi exatamente isso que aconteceu na primeira vez que rodei: 17 falhas
-- que pareciam defeito do modulo e eram heranca da bateria anterior.
delete from recebimentos;
delete from cobrancas;
update pacientes set valor_mensal = null, dia_de_vencimento = null;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000cd01', 'caixa-a@paciente.test');

insert into pacientes (email, nome, plano_id, data_inicio, data_fim) values
  ('caixa-a@paciente.test', 'Carmen Caixa', 'mensal', hoje_sp() - 5, hoje_sp() + 25);

create or replace function carmen() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'caixa-a@paciente.test' $$;
create or replace function cobranca_da_carmen() returns uuid
  language sql stable security definer as $$
  select id from cobrancas where paciente_id = carmen() order by competencia desc limit 1 $$;
create or replace function quantos_recebimentos() returns integer
  language sql stable security definer as $$
  select count(*)::integer from recebimentos $$;
create or replace function total_no_caixa() returns numeric
  language sql stable security definer as $$
  select coalesce(sum(valor), 0) from recebimentos $$;
create or replace function recebimento_da_cobranca() returns uuid
  language sql stable security definer as $$
  select id from recebimentos where cobranca_id is not null limit 1 $$;
create or replace function recebimento_avulso() returns uuid
  language sql stable security definer as $$
  select id from recebimentos where cobranca_id is null order by criado_em limit 1 $$;

grant execute on function carmen(), cobranca_da_carmen(), quantos_recebimentos(),
  total_no_caixa(), recebimento_da_cobranca(), recebimento_avulso() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- So a nutricionista
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000cd01', true);

select teste('a paciente nao registra recebimento',
  estado_de('select registrar_recebimento(null, null, null, 100, null, null, null)') = '42501');
select teste('nem ve o balanco',
  estado_de('select balanco_financeiro(6)') = '42501');
select teste('nem le a tabela', (select count(*) from recebimentos) = 0);
select teste('nem escreve nela',
  nao_alterou($q$insert into recebimentos (valor) values (1)$q$));
commit;

-- -----------------------------------------------------------------------------
-- Entrada avulsa
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select registrar_recebimento(null, carmen(), 'Pacote trimestral', 900, hoje_sp(), 'pix', null);
select teste('registrou', quantos_recebimentos() = 1);
select teste('e o caixa soma', total_no_caixa() = 900);

-- Entrada que NAO vem de paciente: palestra, material.
select registrar_recebimento(null, null, 'Palestra', 500, hoje_sp(), 'transferencia', null);
select teste('entrada sem paciente e permitida', quantos_recebimentos() = 2);

select teste('valor zero e recusado',
  estado_de(format('select registrar_recebimento(null, %L, null, 0, null, %L, null)',
    carmen(), 'pix')) = '22023');
select teste('valor negativo e recusado',
  estado_de(format('select registrar_recebimento(null, %L, null, -50, null, %L, null)',
    carmen(), 'pix')) = '22023');
select teste('forma inventada e recusada',
  estado_de(format('select registrar_recebimento(null, %L, null, 10, null, %L, null)',
    carmen(), 'bitcoin')) = '22023');
select teste('paciente que nao existe e recusada',
  estado_de(format('select registrar_recebimento(null, %L, null, 10, null, %L, null)',
    '00000000-0000-0000-0000-0000000000cc', 'pix')) = '22023');
commit;

-- -----------------------------------------------------------------------------
-- A BAIXA ALIMENTA O CAIXA -- e nao conta duas vezes
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select definir_valor_do_paciente(carmen(), 300, 10);
select gerar_cobrancas(hoje_sp());
select teste('a cobranca nasceu, e NAO entrou no caixa ainda', quantos_recebimentos() = 2);

select baixar_cobranca(cobranca_da_carmen(), true, 'cartao', null);
select teste('dar baixa criou a entrada no caixa', quantos_recebimentos() = 3);
select teste('com o valor da cobranca', total_no_caixa() = 1700);
select teste('e com a forma informada na baixa',
  (select forma from recebimentos where cobranca_id = cobranca_da_carmen()) = 'cartao');

-- O defeito que este modulo existe para evitar.
select baixar_cobranca(cobranca_da_carmen(), true, 'cartao', null);
select teste('DAR BAIXA DUAS VEZES nao vira dinheiro duas vezes', quantos_recebimentos() = 3);
select teste('e o total nao dobrou', total_no_caixa() = 1700);

-- Desfazer tira do caixa.
select baixar_cobranca(cobranca_da_carmen(), false, null, null);
select teste('desfazer a baixa TIRA do caixa', quantos_recebimentos() = 2);
select teste('e o total volta', total_no_caixa() = 1400);

select baixar_cobranca(cobranca_da_carmen(), true, 'pix', null);
select teste('e dar baixa de novo devolve', total_no_caixa() = 1700);
commit;

-- -----------------------------------------------------------------------------
-- A entrada que veio de cobranca nao se mexe pelo lado avulso
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select teste('nao se edita por registrar_recebimento',
  estado_de(format('select registrar_recebimento(%L, null, %L, 50, null, %L, null)',
    recebimento_da_cobranca(), 'mexido', 'pix')) = '42501');
select teste('nem se apaga por apagar_recebimento',
  estado_de(format('select apagar_recebimento(%L)', recebimento_da_cobranca())) = '42501');
select teste('e continua la', total_no_caixa() = 1700);

select teste('mas a avulsa se apaga normalmente',
  apagar_recebimento(recebimento_avulso()));
select teste('e o caixa cai', total_no_caixa() = 800);
select teste('recebimento que nao existe some sem estourar',
  not apagar_recebimento('00000000-0000-0000-0000-0000000000cb'));
commit;

-- -----------------------------------------------------------------------------
-- As duas telas contam o MESMO
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select teste('"recebido no mes" bate entre o painel de cobranca e o balanco',
  (painel_financeiro(null) -> 'totais' ->> 'recebidoNoMes')::numeric
  = (balanco_financeiro(6) -> 'totais' ->> 'noMes')::numeric);
select teste('e e o total do caixa deste mes',
  (balanco_financeiro(6) -> 'totais' ->> 'noMes')::numeric = total_no_caixa());
commit;

-- -----------------------------------------------------------------------------
-- O balanco
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select teste('pede 6 meses, recebe 6 meses',
  jsonb_array_length(balanco_financeiro(6) -> 'meses') = 6);
select teste('MES SEM ENTRADA aparece com zero, e nao sumido',
  (select count(*) from jsonb_array_elements(balanco_financeiro(6) -> 'meses') x
    where (x ->> 'total')::numeric = 0) >= 4);
select teste('o mes atual e o ultimo da serie',
  (balanco_financeiro(6) -> 'meses' -> 5 ->> 'mes')::date
    = date_trunc('month', hoje_sp()::timestamp)::date);

select teste('as formas de pagamento sao separadas',
  jsonb_array_length(balanco_financeiro(6) -> 'porForma') >= 1);
select teste('e somam o total do periodo',
  (select sum((x ->> 'total')::numeric)
     from jsonb_array_elements(balanco_financeiro(6) -> 'porForma') x)
  = (balanco_financeiro(6) -> 'totais' ->> 'noPeriodo')::numeric);

-- A media exclui o mes corrente, que ainda esta acontecendo.
select teste('a media NAO inclui o mes em curso',
  (balanco_financeiro(6) -> 'totais' ->> 'mediaMensal')::numeric = 0);

select teste('a lista de recebimentos vem junto',
  jsonb_array_length(balanco_financeiro(6) -> 'recebimentos') = 2);
select teste('marcando qual veio de cobranca',
  (select count(*) from jsonb_array_elements(balanco_financeiro(6) -> 'recebimentos') x
    where (x ->> 'deCobranca')::boolean) = 1);
select teste('com o nome da paciente junto, quando ha paciente',
  (select count(*) from jsonb_array_elements(balanco_financeiro(6) -> 'recebimentos') x
    where x ->> 'paciente' is not null) >= 1);
select teste('pedir mais de 36 meses nao estoura',
  jsonb_array_length(balanco_financeiro(999) -> 'meses') = 36);
select teste('pedir zero meses devolve pelo menos um',
  jsonb_array_length(balanco_financeiro(0) -> 'meses') = 1);
commit;

-- -----------------------------------------------------------------------------
-- Apagar a cobranca leva a entrada junto
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select teste('antes, o caixa tem a entrada da cobranca', total_no_caixa() = 800);
delete from cobrancas where id = cobranca_da_carmen();
select teste('apagar a cobranca tira a entrada do caixa junto -- sem linha orfa',
  quantos_recebimentos() = 1);
commit;

select
  count(*) filter (where passou) || '/' || count(*) || ' verificações do caixa passaram'
    as resultado
from resultados_teste;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% verificação(ões) do caixa falharam', v_falhas;
  end if;
end;
$$;
