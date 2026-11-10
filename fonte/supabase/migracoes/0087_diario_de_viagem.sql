-- =============================================================================
-- 0087 — Rota Viagem: o diário da viagem chega à nutricionista
--
-- O diário do guia ficava só no aparelho da paciente: para a nutricionista
-- ver, a paciente tinha de mandar foto da tela. Agora cada dia preenchido é
-- gravado aqui, e a nutricionista lê na ficha (aba Viagem), dia a dia.
--
--   * Uma linha por paciente e por dia. Preencher de novo o mesmo dia
--     substitui; apagar todos os campos apaga a linha.
--   * A paciente não lê nem escreve na tabela: só pelas funções, que conferem
--     que é ela mesma e que o Rota Viagem está ligado para ela.
--   * Os números têm faixa no banco (0 a 10, Bristol 1 a 7): o que a tela
--     manda errado é recusado, não guardado.
--
-- De carona: a 0086 deixou `viagem_liberado(uuid)` aberta para quem não entrou.
-- =============================================================================

create table if not exists viagem_diario (
  paciente_id   uuid not null references pacientes(id) on delete cascade,
  dia           date not null,
  onde          text,
  inchaco       smallint check (inchaco between 0 and 10),
  dor           smallint check (dor between 0 and 10),
  azia          smallint check (azia between 0 and 10),
  evacuacoes    smallint check (evacuacoes between 0 and 30),
  bristol       smallint check (bristol between 1 and 7),
  observacoes   text,
  atualizado_em timestamptz not null default now(),
  primary key (paciente_id, dia)
);

alter table viagem_diario enable row level security;

drop policy if exists viagem_diario_admin on viagem_diario;
create policy viagem_diario_admin on viagem_diario
  for all using (e_admin()) with check (e_admin());

revoke all on function viagem_liberado(uuid) from anon, public;
grant execute on function viagem_liberado(uuid) to authenticated;

-- Um dia do diário, do jeito que a tela lê.
create or replace function viagem_diario_json(p_paciente uuid)
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'dia', d.dia,
           'onde', d.onde,
           'inchaco', d.inchaco,
           'dor', d.dor,
           'azia', d.azia,
           'evacuacoes', d.evacuacoes,
           'bristol', d.bristol,
           'observacoes', d.observacoes,
           'atualizadoEm', d.atualizado_em
         ) order by d.dia), '[]'::jsonb)
    from viagem_diario d
   where d.paciente_id = p_paciente;
$$;

-- Auxiliar: recebe o id de QUALQUER paciente sem conferir o dono. Só é chamada
-- de dentro das funções abaixo, que conferem.
revoke all on function viagem_diario_json(uuid) from anon, authenticated, public;

-- -----------------------------------------------------------------------------
-- Paciente
-- -----------------------------------------------------------------------------
create or replace function meu_diario_de_viagem()
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_paciente uuid := meu_paciente_id();
begin
  if v_paciente is null or not coalesce(
       (select viagem_liberado from pacientes where id = v_paciente), false) then
    return '[]'::jsonb;
  end if;
  return viagem_diario_json(v_paciente);
end;
$$;

revoke all on function meu_diario_de_viagem() from anon, public;
grant execute on function meu_diario_de_viagem() to authenticated;

create or replace function anotar_diario_de_viagem(p_dia date, p_dados jsonb)
returns timestamptz
language plpgsql security definer
set search_path = public
as $$
declare
  v_paciente uuid := meu_paciente_id();
  v_quando   timestamptz := now();
  v_onde     text := nullif(btrim(left(coalesce(p_dados ->> 'onde', ''), 120)), '');
  v_obs      text := nullif(btrim(left(coalesce(p_dados ->> 'observacoes', ''), 2000)), '');
  v_inchaco  smallint := nullif(p_dados ->> 'inchaco', '')::smallint;
  v_dor      smallint := nullif(p_dados ->> 'dor', '')::smallint;
  v_azia     smallint := nullif(p_dados ->> 'azia', '')::smallint;
  v_evac     smallint := nullif(p_dados ->> 'evacuacoes', '')::smallint;
  v_bristol  smallint := nullif(p_dados ->> 'bristol', '')::smallint;
begin
  if v_paciente is null or not coalesce(
       (select viagem_liberado from pacientes where id = v_paciente), false) then
    raise exception 'O diário de viagem não está disponível para esta conta.' using errcode = '42501';
  end if;
  if p_dia is null or p_dia < hoje_sp() - 400 or p_dia > hoje_sp() + 400 then
    raise exception 'Data fora do período da viagem.' using errcode = '22023';
  end if;

  -- Dia esvaziado some, em vez de ficar uma linha em branco na ficha.
  if v_onde is null and v_obs is null and v_inchaco is null and v_dor is null
     and v_azia is null and v_evac is null and v_bristol is null then
    delete from viagem_diario where paciente_id = v_paciente and dia = p_dia;
    return v_quando;
  end if;

  insert into viagem_diario
    (paciente_id, dia, onde, inchaco, dor, azia, evacuacoes, bristol, observacoes, atualizado_em)
  values
    (v_paciente, p_dia, v_onde, v_inchaco, v_dor, v_azia, v_evac, v_bristol, v_obs, v_quando)
  on conflict (paciente_id, dia) do update set
    onde = excluded.onde,
    inchaco = excluded.inchaco,
    dor = excluded.dor,
    azia = excluded.azia,
    evacuacoes = excluded.evacuacoes,
    bristol = excluded.bristol,
    observacoes = excluded.observacoes,
    atualizado_em = excluded.atualizado_em;

  return v_quando;
end;
$$;

revoke all on function anotar_diario_de_viagem(date, jsonb) from anon, public;
grant execute on function anotar_diario_de_viagem(date, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- Nutricionista: o Rota Viagem de uma paciente (interruptor, ficha e diário)
-- -----------------------------------------------------------------------------
create or replace function viagem_do_paciente(p_paciente uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê o Rota Viagem da paciente.' using errcode = '42501';
  end if;
  if not exists (select 1 from pacientes where id = p_paciente) then
    raise exception 'Paciente não encontrada.' using errcode = '22023';
  end if;

  return (
    select jsonb_build_object(
      'liberado', p.viagem_liberado,
      'ficha', p.viagem_ficha,
      'diario', viagem_diario_json(p.id)
    )
      from pacientes p
     where p.id = p_paciente
  );
end;
$$;

revoke all on function viagem_do_paciente(uuid) from anon, public;
grant execute on function viagem_do_paciente(uuid) to authenticated;
