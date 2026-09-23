-- =============================================================================
-- Bateria dos cupons da Nutri (0048)
--
-- O que nao pode falhar:
--   * a lista de cupons existe e a paciente consegue ler (a tela do desafio
--     depende disso);
--   * a paciente nao altera a lista;
--   * desafio novo ja nasce com a acao "Usei o cupom da Nutri", 50 pontos,
--     uma vez por semana -- tanto herdando do ultimo quanto pelo molde.
-- =============================================================================

truncate resultados_teste;

select teste('a lista de cupons existe com os quatro cupons',
  (select jsonb_array_length(valor) from configuracoes where chave = 'cupons') = 4);
select teste('cada cupom tem marca e codigo',
  (select bool_and(c ? 'marca' and c ? 'codigo')
     from configuracoes, jsonb_array_elements(valor) c where chave = 'cupons'));
select teste('o codigo da Dux ficou como ela escreveu (minusculo)',
  (select bool_or(c->>'codigo' = 'pacisamarcal')
     from configuracoes, jsonb_array_elements(valor) c where chave = 'cupons'));

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000c001', 'cupom-a@paciente.test');
insert into pacientes (email, nome, plano_id, data_inicio, data_fim) values
  ('cupom-a@paciente.test', 'Carla Cupom', 'mensal', hoje_sp() - 5, hoje_sp() + 25);

-- A paciente le, mas nao mexe.
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000c001', true);
select teste('a paciente le os cupons',
  (select count(*) from configuracoes where chave = 'cupons') = 1);
update configuracoes set valor = '[]'::jsonb where chave = 'cupons';
commit;

select teste('e a tentativa dela de apagar nao pegou',
  (select jsonb_array_length(valor) from configuracoes where chave = 'cupons') = 4);

-- O desafio que ja estava rodando quando a 0048 entrou: a acao tem que
-- aparecer nele, e rodar a migracao de novo nao pode duplicar. (O desafio
-- desta bateria nasceu depois da 0048, entao repetimos aqui o trecho dela.)
insert into desafio_acoes
  (desafio_id, chave, nome, descricao, pontos, periodicidade, max_por_semana, ordem)
select d.id, 'cupom', 'Usei o cupom da Nutri', 'x', 50, 'semanal', 1,
       coalesce((select max(a.ordem) from desafio_acoes a where a.desafio_id = d.id), 0) + 1
from desafios d where d.data_fim >= hoje_sp()
on conflict (desafio_id, chave) do nothing;
insert into desafio_acoes
  (desafio_id, chave, nome, descricao, pontos, periodicidade, max_por_semana, ordem)
select d.id, 'cupom', 'Usei o cupom da Nutri', 'x', 50, 'semanal', 1, 99
from desafios d where d.data_fim >= hoje_sp()
on conflict (desafio_id, chave) do nothing;
select teste('o desafio em andamento ganha a acao do cupom uma vez so',
  (select bool_and(n = 1) from (
     select count(*) filter (where a.chave = 'cupom') n
     from desafios d left join desafio_acoes a on a.desafio_id = d.id
     where d.data_fim >= hoje_sp() group by d.id) x));
select teste('e ela entra no fim da lista, depois das outras',
  (select bool_and(a.ordem = (select max(ordem) from desafio_acoes b where b.desafio_id = a.desafio_id))
     from desafio_acoes a where a.chave = 'cupom'));

-- Desafio novo herdando do ultimo.
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
insert into desafios (id, nome, data_inicio, data_fim, status)
values ('00000000-0000-0000-0000-00000000c0d1', 'Desafio dos cupons',
        hoje_sp() + 400, hoje_sp() + 429, 'rascunho');
commit;

select teste('desafio novo herda a acao do cupom',
  exists (select 1 from desafio_acoes
          where desafio_id = '00000000-0000-0000-0000-00000000c0d1' and chave = 'cupom'
            and pontos = 50 and periodicidade = 'semanal' and max_por_semana = 1));

-- Desafio novo sem nenhum anterior com acoes: vale o molde.
begin;
delete from desafio_envios;
delete from desafio_acoes;
insert into desafios (id, nome, data_inicio, data_fim, status)
values ('00000000-0000-0000-0000-00000000c0d2', 'Desafio do molde',
        hoje_sp() + 500, hoje_sp() + 529, 'rascunho');
-- O que acontece aqui dentro e desfeito; os resultados saem por variavel do
-- psql, que sobrevive ao rollback.
select
  coalesce((select pontos from desafio_acoes
             where desafio_id = '00000000-0000-0000-0000-00000000c0d2' and chave = 'cupom') = 50,
           false) as molde_cupom,
  (select count(*) from desafio_acoes
    where desafio_id = '00000000-0000-0000-0000-00000000c0d2') = 6 as molde_seis
\gset
rollback;
select teste('o molde tambem traz a acao do cupom, valendo 50', :'molde_cupom'::boolean);
select teste('e o molde continua com as outras cinco', :'molde_seis'::boolean);

delete from desafios where id = '00000000-0000-0000-0000-00000000c0d1';
delete from desafio_acoes where chave = 'cupom' and descricao = 'x';

select
  count(*) filter (where passou) || '/' || count(*) || ' verificações dos cupons passaram'
    as resultado
from resultados_teste;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% verificação(ões) dos cupons falharam', v_falhas;
  end if;
end;
$$;
