-- =============================================================================
-- Bateria de "quem esfriou" (0103), com as regras dela:
--   1. check-in só entra com PRAZO VENCIDO; sem prazo, não entra;
--   2. em teste e sem rastreio há mais de 7 dias (7 dias exatos ainda não);
--   3. cobrança aberta e vencida (paga não entra);
--   4. com acesso e sem retorno marcado (com retorno marcado não entra);
--   * quem está em dia não aparece; só a nutricionista abre.
-- =============================================================================

truncate resultados_teste;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000f9e01', 'esf-a@paciente.test'),
  ('00000000-0000-0000-0000-0000000f9e02', 'esf-b@paciente.test');
insert into pacientes (email, nome, plano_id, data_inicio, data_fim, telefone) values
  ('esf-a@paciente.test', 'Ana Esfriou', 'mensal', hoje_sp() - 30, hoje_sp() + 25, '31999990000'),
  ('esf-b@paciente.test', 'Bia Em Dia', 'mensal', hoje_sp() - 30, hoje_sp() + 25, null),
  ('esf-c@paciente.test', 'Cris Vencida', 'mensal', hoje_sp() - 90, hoje_sp() - 10, null);

create or replace function es_id(p_email text) returns uuid language sql stable security definer as $$
  select id from pacientes where email = p_email $$;
grant execute on function es_id(text) to anon, authenticated;

-- A Bia está em dia: retorno marcado e nada pendente.
insert into consultas (paciente_id, data, tipo, status) values (es_id('esf-b@paciente.test'), hoje_sp() + 3, 'retorno', 'agendada');

create or replace function es_linha(p_nome text) returns jsonb language plpgsql stable security definer as $$
declare v jsonb;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
  select x into v from jsonb_array_elements(quem_esfriou()) x where x ->> 'nome' = p_nome;
  return v;
end; $$;

-- Com acesso e sem retorno: só o aviso 4.
select teste('com acesso e sem retorno marcado: aviso para a nutricionista',
  (es_linha('Ana Esfriou') ->> 'semRetorno')::boolean);
select teste('quem esta em dia nao aparece', es_linha('Bia Em Dia') is null);
select teste('quem esta sem acesso nao entra no "sem retorno"', es_linha('Cris Vencida') is null);
select teste('e o telefone vem junto, para o WhatsApp', es_linha('Ana Esfriou') ->> 'telefone' = '31999990000');

-- 1. Check-in: sem prazo não entra; com prazo vencido, entra.
insert into questionarios (titulo, periodicidade) values ('Check-in Esfriou', 'semanal');
insert into questionario_pacientes (questionario_id, paciente_id)
select id, es_id('esf-a@paciente.test') from questionarios where titulo = 'Check-in Esfriou';
select teste('check-in sem prazo nao entra', jsonb_array_length(es_linha('Ana Esfriou') -> 'checkins') = 0);
-- Prazo de 1 dia: vence na segunda. Só está vencido se hoje já passou da segunda.
update questionarios set prazo_dias = 1 where titulo = 'Check-in Esfriou';
select teste('com prazo vencido e sem resposta, entra (ou ainda nao venceu, se hoje e segunda)',
  case when hoje_sp() > semana_de(hoje_sp())
       then jsonb_array_length(es_linha('Ana Esfriou') -> 'checkins') = 1
            and (es_linha('Ana Esfriou') -> 'checkins' -> 0 ->> 'venceuEm')::date = semana_de(hoje_sp())
       else jsonb_array_length(es_linha('Ana Esfriou') -> 'checkins') = 0 end);
update questionarios set prazo_dias = 7 where titulo = 'Check-in Esfriou';
select teste('prazo que ainda nao venceu nao entra', jsonb_array_length(es_linha('Ana Esfriou') -> 'checkins') = 0);
update questionarios set prazo_dias = 1 where titulo = 'Check-in Esfriou';
insert into questionario_envios (questionario_id, paciente_id, periodo, respondido_em)
select id, es_id('esf-a@paciente.test'), semana_de(hoje_sp()), now() from questionarios where titulo = 'Check-in Esfriou';
select teste('respondeu (mesmo atrasada), sai', jsonb_array_length(es_linha('Ana Esfriou') -> 'checkins') = 0);

-- 2. Reintrodução: em teste e sem rastreio.
insert into reintroducao_itens (paciente_id, nome_livre, status) values (es_id('esf-a@paciente.test'), 'Feijao Esfriou', 'em_teste');
insert into reintroducao_registros (paciente_id, item_id, data, sintomas)
select es_id('esf-a@paciente.test'), id, hoje_sp() - 7, '{nenhum}' from reintroducao_itens where nome_livre = 'Feijao Esfriou';
select teste('rastreio de exatos 7 dias atras ainda nao entra', es_linha('Ana Esfriou') -> 'reintroducao' = 'null'::jsonb);
update reintroducao_registros set data = hoje_sp() - 8 where paciente_id = es_id('esf-a@paciente.test');
select teste('8 dias sem rastreio com alimento em teste: entra, com o nome e a data',
  es_linha('Ana Esfriou') -> 'reintroducao' -> 'emTeste' = '["Feijao Esfriou"]'::jsonb
  and (es_linha('Ana Esfriou') -> 'reintroducao' ->> 'ultimoRastreio')::date = hoje_sp() - 8);
update reintroducao_itens set status = 'bem_tolerado' where nome_livre = 'Feijao Esfriou';
select teste('sem alimento em teste, nao entra', es_linha('Ana Esfriou') -> 'reintroducao' = 'null'::jsonb);

-- 3. Cobrança: aberta e vencida entra; paga não.
insert into cobrancas (paciente_id, competencia, valor, vencimento)
values (es_id('esf-c@paciente.test'), date_trunc('month', hoje_sp())::date, 350, hoje_sp() - 3);
select teste('cobranca vencida entra, mesmo sem acesso',
  jsonb_array_length(es_linha('Cris Vencida') -> 'cobrancas') = 1
  and (es_linha('Cris Vencida') -> 'cobrancas' -> 0 ->> 'valor')::numeric = 350);
select teste('e quem esta sem acesso nao entra no check-in nem no "sem retorno"',
  jsonb_array_length(es_linha('Cris Vencida') -> 'checkins') = 0 and not (es_linha('Cris Vencida') ->> 'semRetorno')::boolean);
update cobrancas set status = 'paga' where paciente_id = es_id('esf-c@paciente.test');
select teste('cobranca paga sai', es_linha('Cris Vencida') is null);

-- 4. Marcou retorno: sai.
insert into consultas (paciente_id, data, tipo, status) values (es_id('esf-a@paciente.test'), hoje_sp() + 10, 'retorno', 'agendada');
select teste('marcou retorno, sai da lista', es_linha('Ana Esfriou') is null);

-- Só a nutricionista --------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000f9e01', true);
select teste('a paciente NAO abre a lista', estado_de($q$select quem_esfriou()$q$) = '42501');
commit;
begin;
set local role anon;
set local search_path = public;
do $$
declare v_erro boolean := false;
begin
  begin perform quem_esfriou(); exception when others then v_erro := true; end;
  perform teste('visitante nao abre a lista', v_erro);
end;
$$;
commit;

select case when bool_and(passou) then count(*) || '/' || count(*) || ' verificacoes de quem esfriou passaram'
            else (count(*) filter (where not passou)) || ' verificacoes de quem esfriou falharam' end
    as resultado
from resultados_teste;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% verificacao(oes) de quem esfriou falharam', v_falhas;
  end if;
end;
$$;
