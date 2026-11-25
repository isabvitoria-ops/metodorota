-- =============================================================================
-- Bateria das marcas do "Precisa de um oi" (0108):
--   * a nutricionista marca, troca a marca e desmarca;
--   * a paciente não lê nem escreve marca nenhuma (nem a dela);
--   * visitante não chega na tabela;
--   * apagar a paciente leva a marca junto.
-- =============================================================================

truncate resultados_teste;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000f5e01', 'qe-a@paciente.test');
insert into pacientes (email, nome, plano_id, data_inicio, data_fim) values
  ('qe-a@paciente.test', 'Ana Esfriou', 'mensal', hoje_sp() - 5, hoje_sp() + 25);
create or replace function qe_ana() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'qe-a@paciente.test' $$;
create or replace function qe_total() returns integer language sql stable security definer as $$
  select count(*)::integer from marcas_quem_esfriou $$;
grant execute on function qe_ana(), qe_total() to anon, authenticated;

-- A nutricionista marca, troca e desmarca.
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
insert into marcas_quem_esfriou (paciente_id, como, assinatura) values (qe_ana(), 'ignorado', 'Cobrança venceu em 28/10.');
select teste('a nutricionista marca', (select count(*) from marcas_quem_esfriou) = 1);
insert into marcas_quem_esfriou (paciente_id, como, assinatura) values (qe_ana(), 'feito', 'Cobrança venceu em 28/10.')
  on conflict (paciente_id) do update set como = excluded.como, assinatura = excluded.assinatura, em = excluded.em, atualizado_em = now();
select teste('e troca a marca (uma por paciente)', (select como from marcas_quem_esfriou where paciente_id = qe_ana()) = 'feito');
select teste('o dia vem de hoje em Sao Paulo', (select em from marcas_quem_esfriou where paciente_id = qe_ana()) = hoje_sp());
commit;

-- Marca com valor que não existe é recusada.
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select teste('so feito ou ignorado',
  estado_de(format($q$insert into marcas_quem_esfriou (paciente_id, como, assinatura) values (%L, 'talvez', 'x')
    on conflict (paciente_id) do update set como = excluded.como$q$, qe_ana())) = '23514');
commit;

-- A paciente não vê nem escreve.
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000f5e01', true);
select teste('a paciente nao ve marca nenhuma (nem a dela)', (select count(*) from marcas_quem_esfriou) = 0);
select teste('a paciente nao escreve marca',
  estado_de(format($q$insert into marcas_quem_esfriou (paciente_id, como, assinatura) values (%L, 'feito', 'x')
    on conflict (paciente_id) do update set como = excluded.como$q$, qe_ana())) = '42501');
delete from marcas_quem_esfriou;
commit;
select teste('e o apagar da paciente nao levou nada', qe_total() = 1);

-- Visitante não chega na tabela.
begin;
set local role anon;
set local search_path = public;
do $$
declare v_erro boolean := false;
begin
  begin perform count(*) from marcas_quem_esfriou; exception when others then v_erro := true; end;
  perform teste('visitante nao le', v_erro);
end;
$$;
commit;

-- A nutricionista desmarca.
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
delete from marcas_quem_esfriou where paciente_id = qe_ana();
commit;
select teste('a nutricionista desmarca', qe_total() = 0);

-- Apagar a paciente leva a marca junto.
insert into marcas_quem_esfriou (paciente_id, como, assinatura) values (qe_ana(), 'feito', 'x');
delete from pacientes where id = qe_ana();
select teste('apagar a paciente leva a marca', qe_total() = 0);

select case when bool_and(passou) then count(*) || '/' || count(*) || ' verificacoes das marcas do quem esfriou passaram'
            else (count(*) filter (where not passou)) || ' verificacoes das marcas do quem esfriou falharam' end
    as resultado
from resultados_teste;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% verificacao(oes) das marcas do quem esfriou falharam', v_falhas;
  end if;
end;
$$;
