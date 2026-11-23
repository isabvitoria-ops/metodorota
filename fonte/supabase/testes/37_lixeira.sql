-- =============================================================================
-- Bateria da lixeira de 30 dias (0102)
--   * apagar a paciente leva tudo dela para a lixeira, e restaurar devolve
--     TUDO (registros, filhos de filhos, o compromisso da agenda religado);
--   * restaurar não cria "cadastrada" falso nem muda a marca de atrasado;
--   * receita, grupo de protocolo e exame (da nutricionista) também vão;
--   * o exame que a paciente mandou e ela apaga continua indo de vez;
--   * só a nutricionista vê e mexe; esvaziar pede EXCLUIR; 30 dias e some.
-- =============================================================================

truncate resultados_teste;
delete from lixeira; -- sobras de outras baterias (ex.: o exame da 17)

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000e9e01', 'lix-a@paciente.test');
insert into pacientes (email, nome, plano_id, data_inicio, data_fim) values
  ('lix-a@paciente.test', 'Ana Lixeira', 'mensal', hoje_sp() - 30, hoje_sp() + 25);

create or replace function lx_ana() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'lix-a@paciente.test' $$;
create or replace function lx_conta(p_sql text) returns integer language plpgsql stable security definer as $$
declare n integer; begin execute p_sql into n; return n; end; $$;
grant execute on function lx_ana(), lx_conta(text) to anon, authenticated;

-- A vida dela no app: metas com registros (filho de filho), consulta,
-- reintrodução (item e registro), check-in atrasado, um exame, um
-- compromisso da agenda ligado a ela (on delete set null).
insert into metas (paciente_id, titulo, frequencia, alvo, unidade, inicio, status)
values (lx_ana(), 'Agua Lixeira', 'diaria', 2, 'litros', hoje_sp() - 10, 'ativa');
insert into meta_registros (meta_id, data, quantidade)
select id, hoje_sp() - 1, 2 from metas where titulo = 'Agua Lixeira';
insert into consultas (paciente_id, data, tipo, status, resumo) values (lx_ana(), hoje_sp() - 5, 'retorno', 'concluida', 'Combinado Lixeira');
insert into reintroducao_itens (paciente_id, nome_livre, status) values (lx_ana(), 'Lactose Lixeira', 'bem_tolerado');
insert into reintroducao_registros (paciente_id, item_id, data, sintomas, bristol)
select lx_ana(), id, hoje_sp() - 2, '{gases}', 4 from reintroducao_itens where nome_livre = 'Lactose Lixeira';
insert into questionarios (titulo, periodicidade) values ('Check-in Lixeira', 'semanal');
insert into questionario_envios (questionario_id, paciente_id, periodo, respondido_em, atrasado)
select id, lx_ana(), date '2026-11-09', timestamptz '2026-11-10 10:00-03', false from questionarios where titulo = 'Check-in Lixeira';
-- Marca de atrasado gravada no passado com outro prazo: tem de voltar igual.
update questionario_envios set atrasado = true where paciente_id = lx_ana();
alter table questionario_envios disable trigger marcar_envio_atrasado;
update questionario_envios set atrasado = true where paciente_id = lx_ana();
alter table questionario_envios enable trigger marcar_envio_atrasado;
insert into exames (paciente_id, caminho, nome, tipo, tamanho, data, origem)
values (lx_ana(), 'lix/exame.pdf', 'Hemograma', 'application/pdf', 100, date '2026-10-02', 'nutricionista');
insert into agenda_eventos (titulo, data, paciente_id) values ('Visita Lixeira', hoje_sp(), lx_ana());

select teste('antes: a ficha tem metas, registros, consulta, reintrodução, check-in e exame',
  lx_conta($q$select (select count(*) from metas where paciente_id = lx_ana())
               + (select count(*) from meta_registros r join metas m on m.id = r.meta_id where m.paciente_id = lx_ana())
               + (select count(*) from consultas where paciente_id = lx_ana())
               + (select count(*) from reintroducao_registros where paciente_id = lx_ana())
               + (select count(*) from questionario_envios where paciente_id = lx_ana())
               + (select count(*) from exames where paciente_id = lx_ana())$q$) = 6);

-- Paciente e visitante não mexem ---------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000e9e01', true);
select teste('a paciente NAO manda ninguem para a lixeira', estado_de($q$select lixeira_apagar_paciente(lx_ana())$q$) = '42501');
select teste('a paciente NAO lista a lixeira', estado_de($q$select lixeira_itens()$q$) = '42501');
select teste('a paciente NAO le a tabela da lixeira', (select count(*) from lixeira) = 0);
commit;

-- A nutricionista apaga a paciente -------------------------------------------------
create temp table lx_ids (nome text, id uuid);
grant all on lx_ids to authenticated;
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
insert into lx_ids select 'paciente', lixeira_apagar_paciente(lx_ana());
select teste('a paciente sumiu do cadastro', lx_ana() is null);
select teste('e levou tudo dela junto, como antes',
  lx_conta($q$select count(*) from metas where titulo = 'Agua Lixeira'$q$) = 0
  and lx_conta($q$select count(*) from consultas where resumo = 'Combinado Lixeira'$q$) = 0);
select teste('o compromisso da agenda ficou sem paciente',
  (select paciente_id from agenda_eventos where titulo = 'Visita Lixeira') is null);
select teste('aparece na lixeira com 30 dias',
  (select (x ->> 'diasRestantes')::int = 30 and x ->> 'titulo' = 'Ana Lixeira' from jsonb_array_elements(lixeira_itens()) x where x ->> 'tipo' = 'paciente'));
select lixeira_restaurar((select id from lx_ids where nome = 'paciente'));
commit;

select teste('restaurar devolve a paciente', lx_ana() is not null);
select teste('e devolve tudo: metas, registros (filho de filho), consulta, reintrodução, check-in e exame',
  lx_conta($q$select (select count(*) from metas where paciente_id = lx_ana())
               + (select count(*) from meta_registros r join metas m on m.id = r.meta_id where m.paciente_id = lx_ana())
               + (select count(*) from consultas where paciente_id = lx_ana())
               + (select count(*) from reintroducao_registros where paciente_id = lx_ana())
               + (select count(*) from questionario_envios where paciente_id = lx_ana())
               + (select count(*) from exames where paciente_id = lx_ana())$q$) = 6);
select teste('o registro de reintrodução continua ligado ao item',
  lx_conta($q$select count(*) from reintroducao_registros r join reintroducao_itens i on i.id = r.item_id where i.nome_livre = 'Lactose Lixeira'$q$) = 1);
select teste('o compromisso da agenda voltou a ser dela',
  (select paciente_id from agenda_eventos where titulo = 'Visita Lixeira') = lx_ana());
select teste('a marca de atrasado voltou igual',
  (select atrasado from questionario_envios where paciente_id = lx_ana()) = true);
select teste('o histórico não ganhou um "cadastrada" falso, e sim "restaurada"',
  lx_conta($q$select count(*) from historico_admin where paciente_id = lx_ana() and evento = 'paciente_cadastrado'$q$) = 1
  and lx_conta($q$select count(*) from historico_admin where paciente_id = lx_ana() and evento = 'restaurada_da_lixeira'$q$) = 1);
select teste('e saiu da lixeira', lx_conta('select count(*) from lixeira') = 0);

-- Exame: o da nutricionista vai para a lixeira e o arquivo fica -------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select teste('apagar exame pela nutricionista nao manda remover o arquivo',
  apagar_exame((select id from exames where caminho = 'lix/exame.pdf')) is null);
select teste('o exame foi para a lixeira com nome e data',
  (select x ->> 'titulo' from jsonb_array_elements(lixeira_itens()) x where x ->> 'tipo' = 'exame') = 'Hemograma de 02/10/2026');
select teste('apagar de vez devolve o arquivo para remover',
  (select lixeira_apagar_de_vez(lixeira_ultimo((select (dados -> 'exames' -> 0 ->> 'id')::uuid from lixeira where tipo = 'exame'))))
    = '[{"balde": "exames", "caminho": "lix/exame.pdf"}]'::jsonb);
commit;

-- O que a paciente mandou, ela apaga de vez (como antes) ----------------------------------
insert into exames (paciente_id, caminho, nome, tipo, tamanho, origem)
values (lx_ana(), 'lix/dela.pdf', 'Meu exame', 'application/pdf', 100, 'paciente');
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000e9e01', true);
select teste('a paciente apaga o exame dela de vez, sem lixeira',
  apagar_exame((select id from exames where caminho = 'lix/dela.pdf')) = 'lix/dela.pdf');
commit;
select teste('e nada dela foi para a lixeira', lx_conta('select count(*) from lixeira') = 0);

-- Receita e grupo de protocolo -----------------------------------------------------------
insert into receitas (titulo, categoria) values ('Bolo Lixeira', 'doce');
insert into grupos_protocolo (nome) values ('Grupo Lixeira');
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
insert into lx_ids select 'receita', lixeira_apagar_receita((select id from receitas where titulo = 'Bolo Lixeira'));
select excluir_grupo_protocolo((select id from grupos_protocolo where nome = 'Grupo Lixeira'));
select teste('receita e grupo foram para a lixeira',
  (select count(*) from jsonb_array_elements(lixeira_itens()) x where x ->> 'tipo' in ('receita', 'grupo_protocolo')) = 2);
select lixeira_restaurar((select id from lx_ids where nome = 'receita'));
commit;
select teste('a receita voltou', lx_conta($q$select count(*) from receitas where titulo = 'Bolo Lixeira'$q$) = 1);

-- Restaurar com o e-mail já usado por outra paciente: avisa, não estraga --------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
insert into lx_ids select 'de novo', lixeira_apagar_paciente(lx_ana());
commit;
insert into pacientes (email, nome, plano_id, data_inicio, data_fim) values
  ('lix-a@paciente.test', 'Outra Ana', 'mensal', hoje_sp(), hoje_sp() + 30);
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select teste('restaurar com e-mail repetido avisa em vez de quebrar',
  estado_de($q$select lixeira_restaurar((select id from lx_ids where nome = 'de novo'))$q$) = '23505');
select teste('e o item continua na lixeira',
  (select count(*) from jsonb_array_elements(lixeira_itens()) x where x ->> 'tipo' = 'paciente') = 1);
select teste('esvaziar sem digitar EXCLUIR e recusado', estado_de($q$select lixeira_esvaziar('sim')$q$) = '22023');
commit;

-- 30 dias e some ------------------------------------------------------------------------
update lixeira set apagado_em = now() - interval '31 days' where tipo = 'paciente';
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select lixeira_limpar_vencidos();
select teste('passou de 30 dias, sumiu de vez',
  (select count(*) from jsonb_array_elements(lixeira_itens()) x where x ->> 'tipo' = 'paciente') = 0);
select teste('o grupo (de hoje) continua', (select count(*) from jsonb_array_elements(lixeira_itens())) = 1);
select lixeira_esvaziar('EXCLUIR');
select teste('esvaziar com EXCLUIR apaga tudo', jsonb_array_length(lixeira_itens()) = 0);
commit;

-- Visitante ------------------------------------------------------------------------------
begin;
set local role anon;
set local search_path = public;
do $$
declare v_erro boolean;
begin
  v_erro := false;
  begin perform lixeira_itens(); exception when others then v_erro := true; end;
  perform teste('visitante nao abre a lixeira', v_erro);
  v_erro := false;
  begin perform count(*) from lixeira; exception when others then v_erro := true; end;
  perform teste('visitante nao le a tabela', v_erro);
end;
$$;
commit;

select case when bool_and(passou) then count(*) || '/' || count(*) || ' verificacoes da lixeira passaram'
            else (count(*) filter (where not passou)) || ' verificacoes da lixeira falharam' end
    as resultado
from resultados_teste;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% verificacao(oes) da lixeira falharam', v_falhas;
  end if;
end;
$$;
