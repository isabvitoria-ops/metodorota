-- =============================================================================
-- Bateria do realinhamento (0107): apagar marcadores de exame de uma data.
--   * o app chama com `p_paciente` e funciona (em produção dava erro);
--   * só a nutricionista apaga (em produção qualquer conta logada apagava).
-- (A junção do "Ligar ao Mapa" já é testada na bateria 03.)
-- =============================================================================

truncate resultados_teste;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000f4b01', 'mk-a@paciente.test');
insert into pacientes (email, nome, plano_id, data_inicio, data_fim) values
  ('mk-a@paciente.test', 'Ana Marcador', 'mensal', hoje_sp() - 5, hoje_sp() + 25);
create or replace function mk_ana() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'mk-a@paciente.test' $$;
create or replace function mk_total() returns integer language sql stable security definer as $$
  select count(*)::integer from marcadores_exame where paciente_id = mk_ana() $$;
grant execute on function mk_ana(), mk_total() to anon, authenticated;

insert into marcadores_exame (paciente_id, data, codigo, nome, valor, unidade)
values (mk_ana(), date '2026-11-01', 'ferritina', 'Ferritina', 30, 'ng/mL'),
       (mk_ana(), date '2026-11-01', 'b12', 'Vitamina B12', 300, 'pg/mL');

begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000f4b01', true);
select teste('a paciente NAO apaga marcadores',
  estado_de(format($q$select apagar_marcadores_da_data(p_paciente => %L, p_data => '2026-11-01')$q$, mk_ana())) = '42501');
commit;
select teste('e os marcadores continuam la', mk_total() = 2);

begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select teste('a nutricionista apaga pelo nome que o app usa (p_paciente)',
  apagar_marcadores_da_data(p_paciente => mk_ana(), p_data => date '2026-11-01') = 2);
commit;
select teste('e os marcadores da data sairam', mk_total() = 0);

begin;
set local role anon;
set local search_path = public;
do $$
declare v_erro boolean := false;
begin
  begin perform apagar_marcadores_da_data(mk_ana(), date '2026-11-01'); exception when others then v_erro := true; end;
  perform teste('visitante nao apaga', v_erro);
end;
$$;
commit;

select case when bool_and(passou) then count(*) || '/' || count(*) || ' verificacoes do realinhamento passaram'
            else (count(*) filter (where not passou)) || ' verificacoes do realinhamento falharam' end
    as resultado
from resultados_teste;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% verificacao(oes) do realinhamento falharam', v_falhas;
  end if;
end;
$$;
