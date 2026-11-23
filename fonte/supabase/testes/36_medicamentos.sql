-- =============================================================================
-- Bateria de medicamentos × nutrientes (0101)
--   * a base de partida entra PARA CONFERIR, com fonte em cada nutriente;
--   * só a nutricionista lê e escreve a base e os medicamentos da paciente;
--   * a paciente não vê nem os próprios medicamentos; visitante, nada.
-- =============================================================================

truncate resultados_teste;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000d9e01', 'med-a@paciente.test');
insert into pacientes (email, nome, plano_id, data_inicio, data_fim) values
  ('med-a@paciente.test', 'Ana Remedio', 'mensal', hoje_sp() - 30, hoje_sp() + 25);

create or replace function md_ana() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'med-a@paciente.test' $$;
create or replace function md_total_paciente() returns integer language sql stable security definer as $$
  select count(*)::integer from paciente_medicamentos where paciente_id = md_ana() $$;
create or replace function md_base_conferida() returns integer language sql stable security definer as $$
  select count(*)::integer from base_medicamentos where conferido_em is not null $$;
grant execute on function md_ana(), md_total_paciente(), md_base_conferida() to anon, authenticated;

select teste('a base de partida entrou com IBP e metformina',
  (select count(*) from base_medicamentos where nome in ('Inibidores da bomba de prótons (IBP)', 'Metformina')) = 2);
select teste('e entrou PARA CONFERIR, nenhuma conferida', md_base_conferida() = 0);
select teste('todo nutriente da base tem fonte',
  not exists (select 1 from base_medicamentos b, jsonb_array_elements(b.nutrientes) n
               where coalesce(trim(n ->> 'fonte'), '') = '' or coalesce(trim(n ->> 'nutriente'), '') = ''));
select teste('omeprazol casa com a classe IBP',
  exists (select 1 from base_medicamentos where 'omeprazol' = any(termos)));

-- Nutricionista -----------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
insert into paciente_medicamentos (paciente_id, nome, dose, horario, desde, prescrito_por)
values (md_ana(), 'Omeprazol', '20 mg', '1 vez ao dia, em jejum', '03/2026', 'gastro');
select teste('a nutricionista registra o medicamento da paciente', md_total_paciente() = 1);
update base_medicamentos set conferido_em = hoje_sp() where nome = 'Metformina';
select teste('a nutricionista marca uma entrada como conferida', md_base_conferida() = 1);
select teste('tipo desconhecido e recusado',
  estado_de($q$insert into paciente_medicamentos (paciente_id, nome, tipo) values (md_ana(), 'x', 'vacina')$q$) = '23514');
select teste('nutrientes precisa ser lista',
  estado_de($q$insert into base_medicamentos (nome, nutrientes) values ('x', '{}'::jsonb)$q$) = '23514');
commit;

-- Paciente ----------------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000d9e01', true);
select teste('a paciente NAO ve os proprios medicamentos', (select count(*) from paciente_medicamentos) = 0);
select teste('nem a base', (select count(*) from base_medicamentos) = 0);
select teste('a paciente NAO escreve medicamento',
  estado_de($q$insert into paciente_medicamentos (paciente_id, nome) values (md_ana(), 'x')$q$) = '42501');
update base_medicamentos set conferido_em = null;
commit;
select teste('e o update dela nao mexeu na base', md_base_conferida() = 1);
select teste('nem nos medicamentos', md_total_paciente() = 1);

-- Visitante ---------------------------------------------------------------------
begin;
set local role anon;
set local search_path = public;
do $$
declare v_erro boolean;
begin
  v_erro := false;
  begin perform count(*) from paciente_medicamentos; exception when others then v_erro := true; end;
  perform teste('visitante nao le medicamento', v_erro);
  v_erro := false;
  begin perform count(*) from base_medicamentos; exception when others then v_erro := true; end;
  perform teste('visitante nao le a base', v_erro);
end;
$$;
commit;

-- Apagar a paciente apaga os medicamentos dela.
delete from pacientes where id = md_ana();
select teste('apagar a paciente leva os medicamentos junto',
  not exists (select 1 from paciente_medicamentos p left join pacientes x on x.id = p.paciente_id where x.id is null));

select case when bool_and(passou) then count(*) || '/' || count(*) || ' verificacoes dos medicamentos passaram'
            else (count(*) filter (where not passou)) || ' verificacoes dos medicamentos falharam' end
    as resultado
from resultados_teste;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% verificacao(oes) dos medicamentos falharam', v_falhas;
  end if;
end;
$$;
