-- =============================================================================
-- Bateria das restrições cruzadas com as trocas (0105)
--   * a nutricionista liga a restrição aos alimentos da troca;
--   * a paciente lê SÓ alimento, tipo e origem (sem notas), mesmo com a área
--     "Minhas restrições" desligada;
--   * a paciente não lê restrição de outra; visitante, nada;
--   * a restrição antiga, sem ligação, continua igual.
-- =============================================================================

truncate resultados_teste;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000d4b01', 'rt-a@paciente.test'),
  ('00000000-0000-0000-0000-0000000d4b02', 'rt-b@paciente.test');
insert into pacientes (email, nome, plano_id, data_inicio, data_fim) values
  ('rt-a@paciente.test', 'Ana Restricao', 'mensal', hoje_sp() - 5, hoje_sp() + 25),
  ('rt-b@paciente.test', 'Bia Restricao', 'mensal', hoje_sp() - 5, hoje_sp() + 25);

create or replace function rt_id(p_email text) returns uuid language sql stable security definer as $$
  select id from pacientes where email = p_email $$;
grant execute on function rt_id(text) to anon, authenticated;

begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select salvar_restricao(rt_id('rt-a@paciente.test'), null, 'alergia', 'Amendoim', 'grave', 'nota so da nutri',
                        array['amendoim', 'pasta-de-amendoim']);
select salvar_restricao(rt_id('rt-a@paciente.test'), null, 'intolerancia', 'Pao frances', 'moderada', null,
                        array['pao-frances'], 'rastreio');
-- Do jeito antigo (sem ligação): continua funcionando.
select salvar_restricao(rt_id('rt-a@paciente.test'), null, 'preferencia', 'Jilo', 'leve', null);
select salvar_restricao(rt_id('rt-b@paciente.test'), null, 'alergia', 'Camarao', 'grave', null, array['camarao']);
select teste('a nutricionista ve a ligacao e a origem',
  (select x -> 'alimentoIds' = '["pao-frances"]'::jsonb and x ->> 'origem' = 'rastreio'
     from jsonb_array_elements(restricoes_do_paciente(rt_id('rt-a@paciente.test'))) x where x ->> 'alimento' = 'Pao frances'));
select teste('a restricao sem ligacao fica com lista vazia e origem consulta',
  (select x -> 'alimentoIds' = '[]'::jsonb and x ->> 'origem' = 'consulta'
     from jsonb_array_elements(restricoes_do_paciente(rt_id('rt-a@paciente.test'))) x where x ->> 'alimento' = 'Jilo'));
select teste('origem desconhecida e recusada',
  estado_de(format($q$select salvar_restricao(%L, null, 'alergia', 'x', 'leve', null, '{}', 'chute')$q$, rt_id('rt-a@paciente.test'))) = '23514');
-- Editar sem mandar a ligação mantém a ligação.
select salvar_restricao(rt_id('rt-a@paciente.test'),
  (select (x ->> 'id')::uuid from jsonb_array_elements(restricoes_do_paciente(rt_id('rt-a@paciente.test'))) x where x ->> 'alimento' = 'Amendoim'),
  'alergia', 'Amendoim', 'grave', 'nota so da nutri', null, null);
select teste('editar sem mandar os alimentos mantem a ligacao',
  (select jsonb_array_length(x -> 'alimentoIds') = 2
     from jsonb_array_elements(restricoes_do_paciente(rt_id('rt-a@paciente.test'))) x where x ->> 'alimento' = 'Amendoim'));
commit;

-- A área de restrições DESLIGADA para a Ana: a troca respeita mesmo assim.
update pacientes set restricoes_liberado = false where email = 'rt-a@paciente.test';

begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000d4b01', true);
select teste('a paciente recebe os 3 alimentos ligados, mesmo com a area desligada',
  jsonb_array_length(meus_alimentos_restritos()) = 3);
select teste('com tipo e origem',
  exists (select 1 from jsonb_array_elements(meus_alimentos_restritos()) x
           where x ->> 'alimentoId' = 'pao-frances' and x ->> 'tipo' = 'intolerancia' and x ->> 'origem' = 'rastreio'));
select teste('e sem as notas da nutricionista',
  not exists (select 1 from jsonb_array_elements(meus_alimentos_restritos()) x where x ? 'notas'));
select teste('nem a restricao da outra paciente',
  not exists (select 1 from jsonb_array_elements(meus_alimentos_restritos()) x where x ->> 'alimentoId' = 'camarao'));
select teste('a paciente NAO salva restricao',
  estado_de(format($q$select salvar_restricao(%L, null, 'alergia', 'x', 'leve', null)$q$, rt_id('rt-a@paciente.test'))) = '42501');
commit;

begin;
set local role anon;
set local search_path = public;
do $$
declare v_erro boolean := false;
begin
  begin perform meus_alimentos_restritos(); exception when others then v_erro := true; end;
  perform teste('visitante nao le', v_erro);
end;
$$;
commit;

select case when bool_and(passou) then count(*) || '/' || count(*) || ' verificacoes das restricoes nas trocas passaram'
            else (count(*) filter (where not passou)) || ' verificacoes das restricoes nas trocas falharam' end
    as resultado
from resultados_teste;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% verificacao(oes) das restricoes nas trocas falharam', v_falhas;
  end if;
end;
$$;
