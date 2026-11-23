-- =============================================================================
-- Bateria do carimbo do conteúdo (0084 + 0104)
--   * abrir o app (registrar_acesso) NÃO muda o carimbo — era o que fazia a
--     faixa "Atualização disponível" aparecer sem nada novo;
--   * o que a nutricionista muda e a paciente vê MUDA o carimbo.
-- =============================================================================

truncate resultados_teste;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000c4b01', 'carimbo-a@paciente.test');
insert into pacientes (email, nome, plano_id, data_inicio, data_fim) values
  ('carimbo-a@paciente.test', 'Ana Carimbo', 'mensal', hoje_sp() - 5, hoje_sp() + 25);

create temp table cb (nome text primary key, valor text);
grant all on cb to authenticated;

begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000c4b01', true);
insert into cb values ('antes', meu_carimbo_de_conteudo());
commit;

-- Ela abre o app: o banco grava o último acesso.
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000c4b01', true);
select registrar_acesso();
insert into cb values ('depois de abrir', meu_carimbo_de_conteudo());
commit;
select teste('abrir o app nao muda o carimbo (sem aviso falso)',
  (select valor from cb where nome = 'antes') = (select valor from cb where nome = 'depois de abrir'));

-- A nutricionista estende o plano dela: isso a paciente vê.
update pacientes set data_fim = data_fim + 30 where email = 'carimbo-a@paciente.test';
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000c4b01', true);
insert into cb values ('depois da nutri', meu_carimbo_de_conteudo());
commit;
select teste('o que a nutricionista muda continua mudando o carimbo',
  (select valor from cb where nome = 'depois de abrir') <> (select valor from cb where nome = 'depois da nutri'));

select case when bool_and(passou) then count(*) || '/' || count(*) || ' verificacoes do carimbo passaram'
            else (count(*) filter (where not passou)) || ' verificacoes do carimbo falharam' end
    as resultado
from resultados_teste;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% verificacao(oes) do carimbo falharam', v_falhas;
  end if;
end;
$$;
