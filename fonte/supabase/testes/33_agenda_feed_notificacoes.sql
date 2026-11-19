-- =============================================================================
-- Bateria da agenda (0097), do feed de fotos e das notificacoes (0098)
--
--   * so a nutricionista le e grava a agenda; paciente nao ve nem a linha;
--   * o feed traz as fotos de TODAS, com o nome, e so para a nutricionista;
--   * as notificacoes juntam o que as pacientes fizeram e marcam o que e novo;
--   * paciente e visitante nao chamam nenhuma das tres funcoes.
-- =============================================================================

truncate resultados_teste;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000a9e01', 'agenda-a@paciente.test'),
  ('00000000-0000-0000-0000-0000000a9e02', 'agenda-b@paciente.test');

insert into pacientes (email, nome, plano_id, data_inicio, data_fim) values
  ('agenda-a@paciente.test', 'Ana Agenda', 'mensal', hoje_sp() - 5, hoje_sp() + 25),
  ('agenda-b@paciente.test', 'Bia Agenda', 'mensal', hoje_sp() - 5, hoje_sp() + 25);

create or replace function ag_ana() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'agenda-a@paciente.test' $$;
create or replace function ag_bia() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'agenda-b@paciente.test' $$;
create or replace function ag_eventos() returns integer language sql stable security definer as $$
  select count(*)::integer from agenda_eventos $$;
grant execute on function ag_ana(), ag_bia(), ag_eventos() to anon, authenticated;

-- A nutricionista usa a agenda ------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
insert into agenda_eventos (titulo, tipo, data, hora_inicio, hora_fim) values ('Dentista', 'pessoal', hoje_sp(), '14:00', '15:00');
insert into agenda_eventos (titulo, tipo, data, paciente_id) values ('Visita', 'visita', hoje_sp() + 1, ag_ana());
select teste('ela grava compromissos', (select count(*) from agenda_eventos) = 2);
select teste('sem nome e recusado', estado_de($q$insert into agenda_eventos (titulo, data) values ('  ', current_date)$q$) = '23514');
select teste('fim antes do inicio e recusado',
  estado_de($q$insert into agenda_eventos (titulo, data, hora_inicio, hora_fim) values ('x', current_date, '10:00', '09:00')$q$) = '23514');
select teste('fim sem inicio e recusado',
  estado_de($q$insert into agenda_eventos (titulo, data, hora_fim) values ('x', current_date, '09:00')$q$) = '23514');
select teste('tipo desconhecido e recusado',
  estado_de($q$insert into agenda_eventos (titulo, data, tipo) values ('x', current_date, 'festa')$q$) = '23514');
commit;

-- A paciente nao ve a agenda ---------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000a9e01', true);
select teste('paciente nao le nenhum compromisso, nem o da visita dela', (select count(*) from agenda_eventos) = 0);
select teste('paciente nao grava', estado_de($q$insert into agenda_eventos (titulo, data) values ('x', current_date)$q$) = '42501');
update agenda_eventos set titulo = 'trocado';
delete from agenda_eventos;
commit;
select teste('e nao altera nem apaga', ag_eventos() = 2 and not exists (select 1 from agenda_eventos where titulo = 'trocado'));

-- Atividade das pacientes (como dono, direto nas tabelas) --------------------------
insert into diario_fotos (paciente_id, caminho, refeicao, data) values
  (ag_ana(), ag_ana()::text || '/a1.jpg', 'almoco', hoje_sp()),
  (ag_bia(), ag_bia()::text || '/b1.jpg', 'jantar', hoje_sp());
insert into cardio_sessoes (paciente_id, tipo, duracao_min) values (ag_bia(), 'Caminhada', 30);
insert into mensagens_refeicao (paciente_id, refeicao, autor, texto) values
  (ag_ana(), 'Almoço', 'paciente', 'Posso trocar o arroz?'),
  (ag_ana(), 'Almoço', 'nutri', 'Pode, pela batata.');

-- O feed e as notificacoes da nutricionista ---------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select teste('o feed traz as fotos das duas',
  (select count(*) from jsonb_array_elements(diario_de_todas(30, 300)) f where f ->> 'pacienteNome' like '% Agenda') = 2);
select teste('com o nome de quem mandou',
  (select bool_and(f ? 'pacienteNome' and f ->> 'pacienteNome' <> '') from jsonb_array_elements(diario_de_todas(30, 300)) f));
select teste('o limite e respeitado', jsonb_array_length(diario_de_todas(30, 1)) = 1);
select teste('as notificacoes trazem foto, cardio e a mensagem dela',
  (select count(*) from jsonb_array_elements(notificacoes_da_nutri(14)) n
    where n ->> 'pacienteNome' like '% Agenda') = 4);
select teste('a mensagem da propria nutri nao vira notificacao',
  (select count(*) from jsonb_array_elements(notificacoes_da_nutri(14)) n where n ->> 'tipo' = 'mensagem' and n ->> 'pacienteNome' = 'Ana Agenda') = 1);
select teste('antes de abrir, tudo e novo',
  (select bool_and((n ->> 'nova')::boolean) from jsonb_array_elements(notificacoes_da_nutri(14)) n));
select teste('marcar como visto devolve a hora', marcar_notificacoes_vistas() is not null);
commit;

begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select teste('depois de ver, nada e novo',
  not (select bool_or((n ->> 'nova')::boolean) from jsonb_array_elements(notificacoes_da_nutri(14)) n));
commit;

-- Paciente e visitante nao alcancam -----------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000a9e01', true);
select teste('paciente nao abre o feed de todas', estado_de('select diario_de_todas(30, 300)') = '42501');
select teste('paciente nao abre as notificacoes', estado_de('select notificacoes_da_nutri(14)') = '42501');
select teste('paciente nao marca como visto', estado_de('select marcar_notificacoes_vistas()') = '42501');
select teste('paciente nao le a tabela de vistas', (select count(*) from notificacoes_vistas) = 0);
commit;

begin;
set local role anon;
set local search_path = public;
do $$
declare v_erro boolean := false;
begin
  begin perform diario_de_todas(30, 300); exception when others then v_erro := true; end;
  perform teste('visitante NAO abre o feed', v_erro);
  v_erro := false;
  begin perform count(*) from agenda_eventos; exception when others then v_erro := true; end;
  perform teste('visitante NAO le a agenda', v_erro);
  v_erro := false;
  begin perform notificacoes_da_nutri(14); exception when others then v_erro := true; end;
  perform teste('visitante NAO abre as notificacoes', v_erro);
end;
$$;
commit;

select case when bool_and(passou) then count(*) || '/' || count(*) || ' verificacoes da agenda, do feed e das notificacoes passaram'
            else (count(*) filter (where not passou)) || ' verificacoes da agenda, do feed e das notificacoes falharam' end
    as resultado
from resultados_teste;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% verificacao(oes) da agenda, do feed e das notificacoes falharam', v_falhas;
  end if;
end;
$$;
