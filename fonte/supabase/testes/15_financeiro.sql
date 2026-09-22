-- =============================================================================
-- Bateria da cobranca (0043)
--
-- O que nao pode falhar:
--
--   * a PACIENTE nao ve nada. Nem a cobranca dela, nem a das outras, nem o
--     painel. Cobranca dentro do aplicativo de acompanhamento misturaria a
--     relacao clinica com a comercial na tela de registrar sintoma;
--   * apertar "gerar" duas vezes no mesmo mes NAO cria cobranca dobrada --
--     e ela vai apertar de novo so para conferir;
--   * "atrasada" e CONTA, nao coluna. Sem agendador, um status gravado
--     ficaria eternamente "aberta" e a tela mentiria;
--   * desfazer a baixa limpa a data e a forma: cobranca aberta com data de
--     pagamento e contraditoria, e um dia alguem somaria isso;
--   * cancelar nao apaga: cobranca que some nao deixa rastro.
-- =============================================================================

truncate resultados_teste;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000cb01', 'cobranca-a@paciente.test'),
  ('00000000-0000-0000-0000-00000000cb02', 'cobranca-b@paciente.test');

insert into pacientes (email, nome, plano_id, data_inicio, data_fim) values
  ('cobranca-a@paciente.test', 'Carla Cobranca', 'mensal', hoje_sp() - 5, hoje_sp() + 25),
  ('cobranca-b@paciente.test', 'Bruna Cobranca', 'mensal', hoje_sp() - 5, hoje_sp() + 25);

create or replace function carla() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'cobranca-a@paciente.test' $$;
create or replace function bruna() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'cobranca-b@paciente.test' $$;
-- `security definer` porque dentro da sessao da paciente a RLS esconde a
-- linha e um `select` simples devolveria NULL -- comparar com NULL faz o
-- teste passar por engano.
create or replace function quantas_cobrancas(p_paciente uuid) returns integer
  language sql stable security definer as $$
  select count(*)::integer from cobrancas where paciente_id = p_paciente $$;
create or replace function cobranca_de(p_paciente uuid) returns uuid
  language sql stable security definer as $$
  select id from cobrancas where paciente_id = p_paciente order by competencia desc limit 1 $$;
create or replace function status_da_cobranca(p_id uuid) returns text
  language sql stable security definer as $$
  select status from cobrancas where id = p_id $$;
create or replace function pago_em_da(p_id uuid) returns date
  language sql stable security definer as $$
  select pago_em from cobrancas where id = p_id $$;
create or replace function forma_da(p_id uuid) returns text
  language sql stable security definer as $$
  select forma from cobrancas where id = p_id $$;
create or replace function vencimento_da(p_id uuid) returns date
  language sql stable security definer as $$
  select vencimento from cobrancas where id = p_id $$;

grant execute on function carla(), bruna(), quantas_cobrancas(uuid), cobranca_de(uuid),
  status_da_cobranca(uuid), pago_em_da(uuid), forma_da(uuid), vencimento_da(uuid)
  to anon, authenticated;

-- -----------------------------------------------------------------------------
-- So a nutricionista
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000cb01', true);

select teste('a paciente nao define o proprio valor',
  estado_de(format('select definir_valor_do_paciente(%L, 1, 10)', carla())) = '42501');
select teste('nem gera cobranca',
  estado_de('select gerar_cobrancas(null)') = '42501');
select teste('nem ve o painel',
  estado_de('select painel_financeiro(null)') = '42501');
select teste('nem escreve na tabela',
  nao_alterou(format('insert into cobrancas (paciente_id, competencia, valor, vencimento)
                      values (%L, hoje_sp(), 1, hoje_sp())', carla())));
commit;

-- -----------------------------------------------------------------------------
-- Gerar: uma vez por mes, por mais que ela aperte
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select teste('sem valor combinado, ninguem entra na cobranca',
  gerar_cobrancas(hoje_sp()) = 0);
select teste('e as duas aparecem na lista de "sem valor"',
  jsonb_array_length(painel_financeiro(null) -> 'semValor') >= 2);

select definir_valor_do_paciente(carla(), 300, 5);
select definir_valor_do_paciente(bruna(), 250, 20);

select teste('agora gera as duas', gerar_cobrancas(hoje_sp()) = 2);
select teste('apertar de novo NAO cria cobranca dobrada', gerar_cobrancas(hoje_sp()) = 0);
select teste('e continua uma por paciente', quantas_cobrancas(carla()) = 1);

select teste('o vencimento respeita o dia dela',
  extract(day from vencimento_da(cobranca_de(carla()))) = 5);
select teste('e o da outra tambem',
  extract(day from vencimento_da(cobranca_de(bruna()))) = 20);

select teste('dia de vencimento acima de 28 e recusado',
  estado_de(format('select definir_valor_do_paciente(%L, 300, 31)', carla())) = '22023');
select teste('valor negativo e recusado',
  estado_de(format('select definir_valor_do_paciente(%L, -5, 5)', carla())) = '22023');
commit;

-- -----------------------------------------------------------------------------
-- "Atrasada" e conta, nao coluna
-- -----------------------------------------------------------------------------
begin;
select teste('vencida ontem le como atrasada',
  situacao_cobranca('aberta', hoje_sp() - 1) = 'atrasada');
select teste('vencendo nos proximos dias le como vencendo',
  situacao_cobranca('aberta', hoje_sp() + 3) = 'vencendo');
select teste('longe do vencimento le como aberta',
  situacao_cobranca('aberta', hoje_sp() + 40) = 'aberta');
select teste('paga vencida NAO vira atrasada',
  situacao_cobranca('paga', hoje_sp() - 30) = 'paga');
select teste('cancelada vencida tambem nao',
  situacao_cobranca('cancelada', hoje_sp() - 30) = 'cancelada');
commit;

-- -----------------------------------------------------------------------------
-- Baixa, e desfazer a baixa
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select teste('nasce aberta', status_da_cobranca(cobranca_de(carla())) = 'aberta');
select teste('a baixa devolve o estado GRAVADO',
  baixar_cobranca(cobranca_de(carla()), true, 'pix', null) = 'paga');
select teste('a data do pagamento e hoje quando nao foi informada',
  pago_em_da(cobranca_de(carla())) = hoje_sp());
select teste('a forma foi guardada', forma_da(cobranca_de(carla())) = 'pix');

select teste('desfazer volta para aberta',
  baixar_cobranca(cobranca_de(carla()), false, null, null) = 'aberta');
select teste('e LIMPA a data de pagamento', pago_em_da(cobranca_de(carla())) is null);
select teste('e limpa a forma tambem', forma_da(cobranca_de(carla())) is null);

select teste('cobranca que nao existe e recusada',
  estado_de(format('select baixar_cobranca(%L, true, null, null)',
    '00000000-0000-0000-0000-0000000000fd')) = '22023');
commit;

-- -----------------------------------------------------------------------------
-- Cancelar nao apaga
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select teste('cancela', cancelar_cobranca(cobranca_de(bruna())));
select teste('e a linha CONTINUA existindo', quantas_cobrancas(bruna()) = 1);
select teste('com status cancelada',
  status_da_cobranca(cobranca_de(bruna())) = 'cancelada');

select baixar_cobranca(cobranca_de(carla()), true, 'pix', null);
select teste('cobranca PAGA nao pode ser cancelada por engano',
  not cancelar_cobranca(cobranca_de(carla())));
select teste('e continua paga', status_da_cobranca(cobranca_de(carla())) = 'paga');
commit;

-- -----------------------------------------------------------------------------
-- Os totais
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select teste('o recebido do mes conta a paga',
  (painel_financeiro(null) -> 'totais' ->> 'recebidoNoMes')::numeric = 300);
select teste('a cancelada NAO entra no previsto',
  (painel_financeiro(null) -> 'totais' ->> 'previstoNoMes')::numeric = 300);
select teste('e nao sobra nada em aberto',
  (painel_financeiro(null) -> 'totais' ->> 'aberto')::numeric = 0);
select teste('a lista traz as duas cobrancas',
  jsonb_array_length(painel_financeiro(null) -> 'cobrancas') = 2);
select teste('com o nome da paciente junto, para a tela nao ter que buscar',
  (painel_financeiro(null) -> 'cobrancas' -> 0) ? 'paciente');
commit;

-- -----------------------------------------------------------------------------
-- A paciente continua sem ver nada
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000cb01', true);

select teste('a paciente nao le a propria cobranca', (select count(*) from cobrancas) = 0);
select teste('nem da baixa na propria',
  estado_de(format('select baixar_cobranca(%L, true, null, null)', cobranca_de(carla()))) = '42501');
select teste('nem cancela a propria',
  estado_de(format('select cancelar_cobranca(%L)', cobranca_de(carla()))) = '42501');
-- O valor da PROPRIA ficha ela alcanca, e esta documentado no 0043 por que
-- isso e aceitavel (ela sabe quanto paga -- e ela quem paga). O que nao
-- pode e alcancar o das OUTRAS, e e isso que se verifica aqui.
select teste('ela so alcanca a propria linha, nunca a das outras',
  (select count(*) from pacientes) = 1);
select teste('e nao ve os valores pela funcao da nutricionista',
  estado_de('select valores_dos_pacientes()') = '42501');
select teste('a condicao entrou na visao -- a ficha mostrava vazio antes',
  exists (select 1 from information_schema.columns
           where table_name = 'pacientes_visao' and column_name = 'condicao'));
commit;

select
  count(*) filter (where passou) || '/' || count(*) || ' verificações da cobrança passaram'
    as resultado
from resultados_teste;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% verificação(ões) da cobrança falharam', v_falhas;
  end if;
end;
$$;
