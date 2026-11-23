-- =============================================================================
-- Bateria dos relatórios para o médico (0106)
--   * a nutricionista guarda e lê a cópia; a paciente não lê nem a dela;
--   * período ao contrário é recusado; visitante, nada;
--   * apagar a paciente pela lixeira guarda e devolve os relatórios.
-- =============================================================================

truncate resultados_teste;
delete from lixeira;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000e4b01', 'rm-a@paciente.test');
insert into pacientes (email, nome, plano_id, data_inicio, data_fim) values
  ('rm-a@paciente.test', 'Ana Relatorio', 'mensal', hoje_sp() - 5, hoje_sp() + 25);
create or replace function rm_ana() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'rm-a@paciente.test' $$;
create or replace function rm_total() returns integer language sql stable security definer as $$
  select count(*)::integer from relatorios_medico where paciente_id = rm_ana() $$;
grant execute on function rm_ana(), rm_total() to anon, authenticated;

begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
insert into relatorios_medico (paciente_id, de, ate, medico, dados)
values (rm_ana(), hoje_sp() - 90, hoje_sp(), 'Dr. Teste', '{"paciente": "Ana Relatorio"}');
select teste('a nutricionista guarda a copia', (select count(*) from relatorios_medico) = 1);
select teste('periodo ao contrario e recusado',
  estado_de(format($q$insert into relatorios_medico (paciente_id, de, ate, dados) values (%L, current_date, current_date - 1, '{}')$q$, rm_ana())) = '23514');
commit;

begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000e4b01', true);
select teste('a paciente NAO le o relatorio dela', (select count(*) from relatorios_medico) = 0);
select teste('nem grava',
  estado_de(format($q$insert into relatorios_medico (paciente_id, de, ate, dados) values (%L, current_date, current_date, '{}')$q$, rm_ana())) = '42501');
commit;

begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select lixeira_restaurar(lixeira_apagar_paciente(rm_ana()));
commit;
select teste('apagar e restaurar a paciente devolve o relatorio', rm_total() = 1);

begin;
set local role anon;
set local search_path = public;
do $$
declare v_erro boolean := false;
begin
  begin perform count(*) from relatorios_medico; exception when others then v_erro := true; end;
  perform teste('visitante nao le', v_erro);
end;
$$;
commit;

select case when bool_and(passou) then count(*) || '/' || count(*) || ' verificacoes dos relatorios passaram'
            else (count(*) filter (where not passou)) || ' verificacoes dos relatorios falharam' end
    as resultado
from resultados_teste;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% verificacao(oes) dos relatorios falharam', v_falhas;
  end if;
end;
$$;
