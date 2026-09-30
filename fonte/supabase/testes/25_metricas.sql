-- =============================================================================
-- Bateria das métricas de acompanhamento (0056)
--
-- As métricas contam a tabela INTEIRA, então o teste isola tudo: dentro de uma
-- transação apaga pacientes e recebimentos, monta um cenário de números
-- redondos, guarda o resultado em variáveis do psql (\gset) e desfaz. As
-- verificações rodam DEPOIS do rollback, sobre o que foi guardado — senão o
-- rollback levaria embora os próprios resultados dos testes.
--
-- Cenário (hoje = H):
--   Ativa 1     H-60 → H+30   mensal 400   pagou 400 + 400
--   Ativa 2     H-10 → H+5    mensal 600   pagou 200        (próxima do vencimento: também é ativa)
--   Encerrada 1 H-100 → H-10  (90 dias)    pagou 300
--   Encerrada 2 H-200 → H-100 (100 dias)   nunca pagou
--   Suspensa, Convite pendente: não contam em nada
--   Entrada avulsa de 1000 sem paciente: fora do ticket
-- Esperado: ativas 2; encerradas 2; permanência (90+100)/2 = 95 dias;
--           pagaram 3; recebido 1300; ticket 433,33; mensal médio 500.
-- =============================================================================

truncate resultados_teste;

begin;
delete from recebimentos;
delete from pacientes;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000fa001', 'm-ativa1@paciente.test'),
  ('00000000-0000-0000-0000-0000000fa002', 'm-ativa2@paciente.test'),
  ('00000000-0000-0000-0000-0000000fa003', 'm-enc1@paciente.test'),
  ('00000000-0000-0000-0000-0000000fa004', 'm-enc2@paciente.test'),
  ('00000000-0000-0000-0000-0000000fa005', 'm-susp@paciente.test');

insert into pacientes (email, nome, plano_id, data_inicio, data_fim, valor_mensal, status) values
  ('m-ativa1@paciente.test', 'Ativa Um',     'mensal', hoje_sp() - 60,  hoje_sp() + 30,  400, 'ativo'),
  ('m-ativa2@paciente.test', 'Ativa Dois',   'mensal', hoje_sp() - 10,  hoje_sp() + 5,   600, 'ativo'),
  ('m-enc1@paciente.test',   'Encerrada Um', 'mensal', hoje_sp() - 100, hoje_sp() - 10,  300, 'ativo'),
  ('m-enc2@paciente.test',   'Encerrada Dois','mensal', hoje_sp() - 200, hoje_sp() - 100, null, 'ativo'),
  ('m-susp@paciente.test',   'Suspensa',     'mensal', hoje_sp() - 20,  hoje_sp() + 20,  500, 'suspenso'),
  ('m-convite@paciente.test','Convite',      'mensal', hoje_sp(),       hoje_sp() + 30,  500, 'convite_pendente');

insert into recebimentos (paciente_id, valor)
  select id, 400 from pacientes where email = 'm-ativa1@paciente.test'
  union all select id, 400 from pacientes where email = 'm-ativa1@paciente.test'
  union all select id, 200 from pacientes where email = 'm-ativa2@paciente.test'
  union all select id, 300 from pacientes where email = 'm-enc1@paciente.test';
insert into recebimentos (paciente_id, valor, descricao) values (null, 1000, 'palestra');

set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select metricas_acompanhamento() ->> 'ativas' as m_ativas,
       metricas_acompanhamento() ->> 'encerradas' as m_encerradas,
       metricas_acompanhamento() ->> 'permanenciaMediaDias' as m_perm,
       metricas_acompanhamento() ->> 'pacientesQuePagaram' as m_pagaram,
       metricas_acompanhamento() ->> 'totalRecebido' as m_total,
       metricas_acompanhamento() ->> 'ticketMedio' as m_ticket,
       metricas_acompanhamento() ->> 'valorMensalMedioAtivas' as m_mensal \gset
rollback;

select teste('ativas: só quem tem acesso hoje (2, a próxima do vencimento conta)', :'m_ativas'::integer = 2);
select teste('encerradas: só as expiradas (2)', :'m_encerradas'::integer = 2);
select teste('permanência média das encerradas = 95 dias', :'m_perm'::numeric = 95.0);
select teste('pagaram: 3 pacientes distintas', :'m_pagaram'::integer = 3);
select teste('total recebido de pacientes = 1300 (a palestra avulsa fica de fora)', :'m_total'::numeric = 1300);
select teste('ticket médio = 1300 / 3 = 433,33', :'m_ticket'::numeric = 433.33);
select teste('valor mensal médio das ativas = 500', :'m_mensal'::numeric = 500.00);

-- Sem nenhuma encerrada nem pagamento: os números viram nulo, não zero.
begin;
delete from recebimentos;
delete from pacientes;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select (metricas_acompanhamento() -> 'ticketMedio') = 'null'::jsonb as v_ticket_nulo,
       (metricas_acompanhamento() -> 'permanenciaMediaDias') = 'null'::jsonb as v_perm_nula,
       (metricas_acompanhamento() ->> 'ativas')::integer = 0 as v_zero_ativas \gset
rollback;
select teste('sem pagamento, o ticket é nulo (não zero)', :'v_ticket_nulo'::boolean);
select teste('sem encerrada, a permanência é nula (não zero)', :'v_perm_nula'::boolean);
select teste('sem paciente, ativas = 0', :'v_zero_ativas'::boolean);

-- Só a nutricionista.
begin;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000fa009', 'm-intrusa@paciente.test')
  on conflict do nothing;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000fa009', true);
select estado_de('select metricas_acompanhamento()') as e_paciente \gset
rollback;
select teste('a paciente NÃO vê as métricas', :'e_paciente' = '42501');

begin;
set local role anon;
do $$
declare v_erro boolean := false;
begin
  begin perform metricas_acompanhamento();
  exception when others then v_erro := true; end;
  perform teste('visitante sem login NÃO vê as métricas', v_erro);
end;
$$;
commit;

select case when bool_and(passou) then count(*) || '/' || count(*) || ' verificacoes das metricas passaram'
            else (count(*) filter (where not passou)) || ' verificacoes das metricas falharam' end
    as resultado
from resultados_teste;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% verificacao(oes) das metricas falharam', v_falhas;
  end if;
end;
$$;
