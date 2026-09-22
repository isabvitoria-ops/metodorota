-- =============================================================================
-- Bateria do backup (0036)
--
-- `exportar_tudo()` devolve a clinica inteira numa resposta so. E o alvo
-- mais valioso do banco: uma chamada bem-sucedida por quem nao deveria
-- entrega todas as pacientes, todos os prontuarios e todas as anotacoes de
-- uma vez. O que esta bateria prova e que so a nutricionista consegue.
-- =============================================================================

truncate resultados_teste;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000bac01', 'backup@paciente.test');

insert into pacientes (email, nome, plano_id, data_inicio, data_fim) values
  ('backup@paciente.test', 'Bruna Backup', 'mensal', hoje_sp() - 5, hoje_sp() + 25);

-- -----------------------------------------------------------------------------
-- A paciente nao baixa backup
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000bac01', true);

select teste('a paciente nao baixa o backup',
  estado_de('select exportar_tudo()') = '42501');
commit;

-- Quem nao esta logado tambem nao.
begin;
set local role anon;
select teste('quem nao esta logado nao baixa o backup',
  recusou('select exportar_tudo()'));
commit;

-- -----------------------------------------------------------------------------
-- A nutricionista baixa, e vem tudo
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select teste('o backup traz a versao e a data', (exportar_tudo() ->> 'versao') = '1'
  and (exportar_tudo() ->> 'gerado_em') is not null);

select teste('as pacientes entram no backup',
  jsonb_array_length(exportar_tudo() -> 'pacientes') = (select count(*) from pacientes));

select teste('e nenhuma tabela do backup volta nula',
  not exists (
    select 1 from jsonb_each(exportar_tudo()) e
    where jsonb_typeof(e.value) = 'null'));

-- O que NAO pode estar no arquivo.
select teste('o backup nao leva senha nem token',
  not (exportar_tudo()::text ilike '%encrypted_password%')
  and not (exportar_tudo() ::text ilike '%refresh_token%'));

-- As tabelas de dado clinico tem de estar todas la: faltar uma so seria
-- descobrir no dia da restauracao.
select teste('as tabelas de dado clinico estao todas no backup',
  (exportar_tudo() ? 'avaliacoes_fisicas') and (exportar_tudo() ? 'protocolos')
  and (exportar_tudo() ? 'consultas') and (exportar_tudo() ? 'metas')
  and (exportar_tudo() ? 'meta_registros') and (exportar_tudo() ? 'treino_sessoes')
  and (exportar_tudo() ? 'treino_series') and (exportar_tudo() ? 'cardio_sessoes')
  and (exportar_tudo() ? 'reintroducao_registros') and (exportar_tudo() ? 'reintroducao_itens'));
commit;

select
  count(*) filter (where passou) || '/' || count(*) || ' verificações do backup passaram'
    as resultado
from resultados_teste;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% verificação(ões) do backup falharam', v_falhas;
  end if;
end;
$$;
