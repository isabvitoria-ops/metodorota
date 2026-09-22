-- =============================================================================
-- Bateria das metas do acompanhamento (0034)
--
-- O que não pode falhar nunca:
--
--   * a paciente vê as metas DELA e nenhuma outra;
--   * a paciente NÃO cria, não edita, não apaga e não muda o status de meta
--     nenhuma -- nem da dela. A meta é decisão clínica; ela mudando o alvo
--     mudaria a régua do próprio acompanhamento;
--   * a paciente MARCA o que fez, e só na meta dela. Saber o id da meta de
--     outra não ajuda em nada;
--   * meta pausada, concluída ou cancelada não recebe marcação nova.
-- =============================================================================

truncate resultados_teste;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000009a01', 'metas-a@paciente.test'),
  ('00000000-0000-0000-0000-000000009a02', 'metas-b@paciente.test');

insert into pacientes (email, nome, plano_id, data_inicio, data_fim) values
  ('metas-a@paciente.test', 'Ana Metas', 'mensal', hoje_sp() - 5, hoje_sp() + 25),
  ('metas-b@paciente.test', 'Rita Metas', 'mensal', hoje_sp() - 5, hoje_sp() + 25);

create or replace function ana() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'metas-a@paciente.test' $$;
create or replace function rita() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'metas-b@paciente.test' $$;

-- `security definer` pelo motivo de sempre: na sessão da Rita a RLS esconde
-- a meta da Ana, e um atalho comum devolveria NULO. O teste provaria que
-- "mexer na meta de ninguém é recusado" -- verdadeiro e inútil. O que se
-- quer provar é que SABER o id da outra não ajuda.
--
-- O TITULO, e nao "a primeira por data": as metas desta bateria nascem na
-- MESMA transacao, entao `criado_em` e identico em todas e "order by
-- criado_em limit 1" e sorteio. Foi assim que o teste do "meta pausada nao
-- recebe marcacao" passou a pausar uma meta e a tentar marcar em outra.
create or replace function meta_de(p_paciente uuid, p_titulo text) returns uuid
language sql stable security definer as $$
  select id from metas where paciente_id = p_paciente and titulo = p_titulo limit 1 $$;

/** A meta de um titulo dentro do jsonb devolvido por `metas_de`. */
create or replace function na_lista(p_lista jsonb, p_titulo text) returns jsonb
language sql immutable as $$
  select e from jsonb_array_elements(p_lista) e where e ->> 'titulo' = p_titulo limit 1 $$;

grant execute on function ana(), rita(), meta_de(uuid, text), na_lista(jsonb, text)
  to anon, authenticated;

-- -----------------------------------------------------------------------------
-- A profissional cria a meta
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select salvar_meta(null, ana(), 'Beber 2 litros de água', 'Espalhar ao longo do dia.',
  'Hidratação', 'diaria', 2, 'litros', hoje_sp() - 3, hoje_sp() + 27, 'ativa');
select salvar_meta(null, ana(), 'Levar marmita', null, 'Rotina', 'semanal', 3, 'dias',
  hoje_sp() - 3, null, 'ativa');
-- Sem alvo: é meta de "fez ou não fez".
select salvar_meta(null, ana(), 'Dormir antes da meia-noite', null, null, 'diaria',
  null, null, hoje_sp(), null, 'ativa');
select salvar_meta(null, rita(), 'Meta da Rita', null, null, 'diaria', 1, 'vez',
  hoje_sp(), null, 'ativa');

select teste('a meta nasce com o texto que ela escreveu',
  (na_lista(metas_de(ana()), 'Beber 2 litros de água') ->> 'descricao')
  = 'Espalhar ao longo do dia.');
select teste('a Ana ficou com três metas', jsonb_array_length(metas_de(ana())) = 3);
select teste('a categoria e a unidade sao livres, e ficam gravadas',
  (na_lista(metas_de(ana()), 'Beber 2 litros de água') ->> 'categoria') = 'Hidratação'
  and (na_lista(metas_de(ana()), 'Beber 2 litros de água') ->> 'unidade') = 'litros');
select teste('meta sem alvo fica com alvo NULO, nunca zero',
  (select alvo from metas where titulo = 'Dormir antes da meia-noite') is null);

-- Alvo zero seria uma meta que nasce cumprida.
select salvar_meta(null, ana(), 'Alvo zero', null, null, 'diaria', 0, 'x', hoje_sp(), null, 'ativa');
select teste('alvo zero vira NULO em vez de virar meta cumprida de nascenca',
  (select alvo from metas where titulo = 'Alvo zero') is null);

select teste('meta sem titulo e recusada',
  estado_de(format('select salvar_meta(null, %L, ''  '', null, null, ''diaria'', null, null, null, null, null)', ana()))
  = '22023');
select teste('prazo antes do inicio e recusado pelo banco',
  recusou(format('select salvar_meta(null, %L, ''Invertida'', null, null, ''diaria'', null, null,
    %L::date, %L::date, ''ativa'')', ana(), hoje_sp(), hoje_sp() - 5)));

-- Frequência desconhecida nao derruba a gravacao: quem digitou a meta
-- inteira nao pode perder o texto por causa do que a tela mandou.
select salvar_meta(null, ana(), 'Frequencia torta', null, null, 'mensal', null, null,
  hoje_sp(), null, 'ativa');
select teste('frequencia desconhecida vira o padrao, e o texto nao se perde',
  (select frequencia from metas where titulo = 'Frequencia torta') = 'diaria');
commit;

-- -----------------------------------------------------------------------------
-- A paciente vê as dela, e só as dela
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000009a01', true);

select teste('o atalho de metas aparece para ela', (meu_acesso() ->> 'metas')::boolean);
select teste('ela recebe as metas dela', jsonb_array_length(metas_de()) = 5);
select teste('e nao ve a tabela da outra', (select count(*) from metas) = 5);
select teste('pedir as metas da outra pelo id e recusado',
  estado_de(format('select metas_de(%L)', rita())) = '42501');

-- "A meta e decisao clinica."
select teste('ela nao cria meta para si mesma',
  estado_de(format('select salvar_meta(null, %L, ''Minha meta'', null, null, ''diaria'',
    null, null, null, null, ''ativa'')', ana())) = '42501');
select teste('ela nao edita a meta dela',
  estado_de(format('select salvar_meta(%L, %L, ''Editada'', null, null, ''diaria'',
    null, null, null, null, ''ativa'')', meta_de(ana(), 'Beber 2 litros de água'), ana())) = '42501');
select teste('ela nao muda o status da meta',
  estado_de(format('select definir_status_meta(%L, ''concluida'')', meta_de(ana(), 'Beber 2 litros de água'))) = '42501');
select teste('ela nao apaga a meta',
  estado_de(format('select excluir_meta(%L)', meta_de(ana(), 'Beber 2 litros de água'))) = '42501');
select teste('nem altera a tabela direto', nao_alterou('update metas set alvo = 99'));
select teste('nem insere meta direto na tabela',
  recusou(format('insert into metas (paciente_id, titulo) values (%L, ''Na marra'')', ana())));
commit;

-- -----------------------------------------------------------------------------
-- Ela MARCA o que fez
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000009a01', true);

select registrar_meta(meta_de(ana(), 'Beber 2 litros de água'), hoje_sp(), 1, 'Primeira garrafa');
select registrar_meta(meta_de(ana(), 'Beber 2 litros de água'), hoje_sp(), 0.5, null);
select registrar_meta(meta_de(ana(), 'Beber 2 litros de água'), hoje_sp() - 1, 2, null);

select teste('as marcacoes dela entram',
  (select count(*) from meta_registros where meta_id = meta_de(ana(), 'Beber 2 litros de água')) = 3);
select teste('e voltam na leitura, da mais nova para a mais velha',
  jsonb_array_length(na_lista(metas_de(), 'Beber 2 litros de água') -> 'registros') = 3
  and (na_lista(metas_de(), 'Beber 2 litros de água') -> 'registros' -> 0 ->> 'data')
      = hoje_sp()::text);

-- Marcar no futuro nao.
select teste('marcar amanha e recusado',
  estado_de(format('select registrar_meta(%L, %L::date, 1, null)',
    meta_de(ana(), 'Beber 2 litros de água'), hoje_sp() + 1)) = '22007');

-- Saber o id da meta da outra nao ajuda.
select teste('ela nao marca na meta da OUTRA paciente',
  estado_de(format('select registrar_meta(%L, null, 1, null)', meta_de(rita(), 'Meta da Rita'))) = '42501');
select teste('e a recusa nao deixou registro nenhum',
  (select count(*) from meta_registros r
   join metas m on m.id = r.meta_id where m.paciente_id = rita()) = 0);

-- Apagar a propria marcacao: pode.
select apagar_registro_meta((select id from meta_registros
                             where meta_id = meta_de(ana(), 'Beber 2 litros de água') order by criado_em desc limit 1));
select teste('ela desmarca o que marcou',
  (select count(*) from meta_registros where meta_id = meta_de(ana(), 'Beber 2 litros de água')) = 2);
commit;

-- A Rita, do lado dela, nao alcanca nada disso.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000009a02', true);

select teste('a outra paciente ve so a meta dela', (select count(*) from metas) = 1);
select teste('e registro nenhum da primeira', (select count(*) from meta_registros) = 0);
-- `nao_alterou` NAO serve aqui: `select f(...)` devolve uma linha sempre,
-- e o teste passaria sem provar nada. Quem prova e a contagem depois.
select apagar_registro_meta(meta_de(ana(), 'Beber 2 litros de água'));
select teste('apagar pelo id da outra nao apaga nada',
  (select count(*) from meta_registros) = 0);
commit;

begin;
select teste('as marcacoes da Ana continuam la depois da tentativa',
  (select count(*) from meta_registros r join metas m on m.id = r.meta_id
   where m.paciente_id = ana()) = 2);
commit;

-- -----------------------------------------------------------------------------
-- Pausar fecha a marcacao; nada e apagado
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select teste('a profissional pausa, e a funcao devolve o status GRAVADO',
  definir_status_meta(meta_de(ana(), 'Beber 2 litros de água'), 'pausada') = 'pausada');
select teste('status desconhecido e recusado',
  estado_de(format('select definir_status_meta(%L, ''dormindo'')', meta_de(ana(), 'Beber 2 litros de água'))) = '22023');
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000009a01', true);
select teste('meta pausada nao recebe marcacao nova',
  estado_de(format('select registrar_meta(%L, null, 1, null)', meta_de(ana(), 'Beber 2 litros de água'))) = '42501');
select teste('mas o que ela ja tinha marcado continua visivel',
  jsonb_array_length(na_lista(metas_de(), 'Beber 2 litros de água') -> 'registros') = 2);
commit;

-- -----------------------------------------------------------------------------
-- Apagar leva junto o que dependia
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select excluir_meta(meta_de(ana(), 'Beber 2 litros de água'));
select teste('apagar a meta leva as marcacoes dela',
  (select count(*) from meta_registros where meta_id not in (select id from metas)) = 0);
delete from pacientes where id = ana();
select teste('excluir a paciente leva as metas dela',
  (select count(*) from metas where paciente_id not in (select id from pacientes)) = 0);
commit;

select
  count(*) filter (where passou) || '/' || count(*) || ' verificações das metas passaram'
    as resultado
from resultados_teste;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% verificação(ões) das metas falharam', v_falhas;
  end if;
end;
$$;
