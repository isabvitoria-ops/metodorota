-- =============================================================================
-- Bateria do resumo pré-retorno (0100)
--   * sem consulta concluída, não há marco (e nada é inventado);
--   * com marco, conta só o que veio depois dele;
--   * só a nutricionista abre; paciente e visitante, não.
-- =============================================================================

truncate resultados_teste;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000c9e01', 'resumo-a@paciente.test');
insert into pacientes (email, nome, plano_id, data_inicio, data_fim) values
  ('resumo-a@paciente.test', 'Ana Resumo', 'mensal', hoje_sp() - 60, hoje_sp() + 25);

create or replace function rs_ana() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'resumo-a@paciente.test' $$;
grant execute on function rs_ana() to anon, authenticated;

begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select teste('sem consulta concluida, nao ha marco', (resumo_pre_retorno(rs_ana()) ->> 'temMarco')::boolean = false);
commit;

insert into consultas (paciente_id, data, tipo, status, resumo) values
  (rs_ana(), hoje_sp() - 30, 'primeira', 'concluida', 'antiga'),
  (rs_ana(), hoje_sp() - 10, 'retorno', 'concluida', 'Ajuste no jantar'),
  (rs_ana(), hoje_sp() + 1, 'retorno', 'agendada', null);
insert into reintroducao_itens (paciente_id, nome_livre, status) values (rs_ana(), 'Lactose Resumo', 'bem_tolerado');
insert into reintroducao_registros (paciente_id, item_id, data, sintomas, bristol)
select rs_ana(), id, hoje_sp() - 20, '{gases}', 6 from reintroducao_itens where nome_livre = 'Lactose Resumo';
insert into reintroducao_registros (paciente_id, item_id, data, sintomas, bristol)
select rs_ana(), id, hoje_sp() - 5, '{gases}', 4 from reintroducao_itens where nome_livre = 'Lactose Resumo';
insert into reintroducao_registros (paciente_id, item_id, data, sintomas, bristol)
select rs_ana(), id, hoje_sp() - 3, '{nenhum}', 4 from reintroducao_itens where nome_livre = 'Lactose Resumo';
insert into restricoes_alimentares (paciente_id, tipo, alimento) values (rs_ana(), 'intolerancia', 'Leite');

begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select teste('o marco e a ultima consulta concluida', (resumo_pre_retorno(rs_ana()) ->> 'desde')::date = hoje_sp() - 10);
select teste('com o combinado dela', resumo_pre_retorno(rs_ana()) ->> 'combinado' = 'Ajuste no jantar');
select teste('e a proxima consulta', (resumo_pre_retorno(rs_ana()) -> 'proximaConsulta' ->> 'data')::date = hoje_sp() + 1);
select teste('bristol so depois do marco', resumo_pre_retorno(rs_ana()) -> 'bristol' = '{"4": 2}'::jsonb);
select teste('sintomas sem o "nenhum"', resumo_pre_retorno(rs_ana()) -> 'sintomas' = '{"gases": 1}'::jsonb);
select teste('a reintroducao que mudou', jsonb_array_length(resumo_pre_retorno(rs_ana()) -> 'reintroducao') = 1);
select teste('a restricao nova', jsonb_array_length(resumo_pre_retorno(rs_ana()) -> 'restricoesNovas') = 1);
select teste('os dias com registro', jsonb_array_length(resumo_pre_retorno(rs_ana()) -> 'diasComRegistro') = 2);
commit;

begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000c9e01', true);
select teste('a paciente NAO abre o resumo', estado_de($q$select resumo_pre_retorno(rs_ana())$q$) = '42501');
commit;

begin;
set local role anon;
set local search_path = public;
do $$
declare v_erro boolean := false;
begin
  begin perform resumo_pre_retorno(rs_ana()); exception when others then v_erro := true; end;
  perform teste('visitante NAO abre o resumo', v_erro);
end;
$$;
commit;

select case when bool_and(passou) then count(*) || '/' || count(*) || ' verificacoes do resumo pre-retorno passaram'
            else (count(*) filter (where not passou)) || ' verificacoes do resumo pre-retorno falharam' end
    as resultado
from resultados_teste;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% verificacao(oes) do resumo pre-retorno falharam', v_falhas;
  end if;
end;
$$;
