-- =============================================================================
-- Bateria do lembrete de cobranca (0047)
--
-- O que nao pode falhar:
--   * so a nutricionista registra lembrete;
--   * lembrete so em cobranca ABERTA -- lembrar de uma paga e cobrar quem
--     nao deve;
--   * cada aperto conta, e o painel devolve quando foi e quantas vezes,
--     junto com o e-mail da paciente (o botao precisa dele).
-- =============================================================================

truncate resultados_teste;

-- As baterias dividem o banco: comecar sem cobrancas de outras.
delete from recebimentos;
delete from cobrancas;
update pacientes set valor_mensal = null, dia_de_vencimento = null;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000ce01', 'lembra-a@paciente.test');

insert into pacientes (email, nome, telefone, plano_id, data_inicio, data_fim) values
  ('lembra-a@paciente.test', 'Lara Lembrete', '31999990000', 'mensal', hoje_sp() - 5, hoje_sp() + 25);

create or replace function lara() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'lembra-a@paciente.test' $$;
create or replace function cobranca_da_lara() returns uuid
  language sql stable security definer as $$
  select id from cobrancas where paciente_id = lara() order by competencia desc limit 1 $$;
create or replace function lembretes_da_lara() returns integer
  language sql stable security definer as $$
  select lembretes from cobrancas where id = cobranca_da_lara() $$;
grant execute on function lara(), cobranca_da_lara(), lembretes_da_lara() to anon, authenticated;

-- Admin cria a cobranca.
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select definir_valor_do_paciente(lara(), 250, 10);
select gerar_cobrancas(hoje_sp());
select teste('a cobranca nasce sem lembrete', lembretes_da_lara() = 0);
commit;

-- A paciente nao registra.
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000ce01', true);
select teste('a paciente nao registra lembrete',
  estado_de(format('select registrar_lembrete_cobranca(%L)', cobranca_da_lara())) = '42501');
commit;

select teste('e a tentativa nao contou', lembretes_da_lara() = 0);

-- A nutricionista registra.
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select teste('o primeiro aperto devolve 1',
  (registrar_lembrete_cobranca(cobranca_da_lara()) ->> 'lembretes')::int = 1);
select teste('o segundo devolve 2',
  (registrar_lembrete_cobranca(cobranca_da_lara()) ->> 'lembretes')::int = 2);

select teste('o painel traz o e-mail',
  (select c ->> 'email' from jsonb_array_elements(painel_financeiro() -> 'cobrancas') c
    where c ->> 'id' = cobranca_da_lara()::text) = 'lembra-a@paciente.test');
select teste('o painel traz quantas vezes',
  (select (c ->> 'lembretes')::int from jsonb_array_elements(painel_financeiro() -> 'cobrancas') c
    where c ->> 'id' = cobranca_da_lara()::text) = 2);
select teste('e quando foi',
  (select c ->> 'lembradaEm' from jsonb_array_elements(painel_financeiro() -> 'cobrancas') c
    where c ->> 'id' = cobranca_da_lara()::text) is not null);

select baixar_cobranca(cobranca_da_lara(), true, 'pix', null);
select teste('cobranca paga nao recebe lembrete',
  estado_de(format('select registrar_lembrete_cobranca(%L)', cobranca_da_lara())) = 'P0002');
select teste('cobranca que nao existe tambem nao',
  estado_de(format('select registrar_lembrete_cobranca(%L)',
    '00000000-0000-0000-0000-0000000000cc')) = 'P0002');
commit;

select teste('o aperto recusado nao contou', lembretes_da_lara() = 2);

delete from recebimentos;
delete from cobrancas;

select
  count(*) filter (where passou) || '/' || count(*) || ' verificações do lembrete passaram'
    as resultado
from resultados_teste;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% verificação(ões) do lembrete falharam', v_falhas;
  end if;
end;
$$;
