-- =============================================================================
-- CENTRAL DO PACIENTE — 0027: lançar retroativo escolhendo do Mapa
--
-- "Eu já tenho uma lista de alimentos que ela já testou e já falou sintoma
-- comigo. Eu quero adicionar eles e colocar quais foram os sintomas."
--
-- O FURO QUE ISTO FECHA. A 0025 já deixava lançar retroativo, mas por dois
-- caminhos só: um alimento que já estava na lista da paciente, ou um nome
-- digitado. O nome digitado nasce SEM ligação com o Mapa — ou seja, sem
-- oxalato, histamina e lectina. Transcrevendo vinte alimentos do papel por
-- esse caminho, ela recriaria exatamente o problema que acabamos de
-- consertar, vinte vezes, e só descobriria depois.
--
-- Agora há um terceiro caminho: escolher o alimento do Mapa. Ele entra na
-- lista da paciente já ligado, e o registro nasce com a marcação.
-- =============================================================================

-- A assinatura muda. Trocar por `create or replace` deixaria as duas versões
-- no banco e a chamada por nome ficaria ambígua, então a antiga sai primeiro.
drop function if exists registrar_reintroducao_admin(
  uuid, uuid, text, date, time, text, text, text[], integer, integer, text
);

create or replace function registrar_reintroducao_admin(
  p_paciente uuid,
  p_item uuid default null,
  p_nome_novo text default null,
  p_alimento text default null,
  p_data date default null,
  p_horario time default null,
  p_quantidade text default null,
  p_preparo text default null,
  p_sintomas text[] default '{}',
  p_intensidade integer default null,
  p_bristol integer default null,
  p_observacao text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item uuid;
  v_id uuid;
  v_data date;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista lança registro por outra pessoa.'
      using errcode = '42501';
  end if;

  if not exists (select 1 from pacientes where id = p_paciente) then
    raise exception 'Paciente não encontrado.' using errcode = 'P0002';
  end if;

  v_data := coalesce(p_data, hoje_sp());

  -- Retroativo é para trás. Uma data no futuro aqui é quase sempre o ano
  -- digitado errado, e o estrago não apareceria: o registro cairia numa
  -- semana lá na frente e sumiria da linha do tempo sem dar erro nenhum.
  if v_data > hoje_sp() then
    raise exception 'Esta data está no futuro (%). Registro retroativo é para trás.', v_data
      using errcode = '22023';
  end if;

  if p_item is not null then
    select i.id into v_item from reintroducao_itens i
     where i.id = p_item and i.paciente_id = p_paciente;
    if v_item is null then
      raise exception 'Este alimento não está na lista desta paciente.' using errcode = '42501';
    end if;

  elsif coalesce(trim(p_alimento), '') <> '' then
    -- Do Mapa: entra na lista já ligado, e por isso já com marcação. Se a
    -- paciente já o tiver, o registro vai no item que existe em vez de
    -- criar um segundo — o índice único da 0014 não permitiria, e duplicar
    -- a linha seria pior que reaproveitá-la.
    if not exists (select 1 from reintroducao_alimentos where id = p_alimento) then
      raise exception 'Este alimento não está no Mapa.' using errcode = 'P0002';
    end if;

    select i.id into v_item from reintroducao_itens i
     where i.paciente_id = p_paciente and i.alimento_id = p_alimento;

    if v_item is null then
      insert into reintroducao_itens (paciente_id, alimento_id, status, ordem)
      values (p_paciente, p_alimento, 'em_teste',
              coalesce((select max(ordem) + 1 from reintroducao_itens
                         where paciente_id = p_paciente), 1))
      returning id into v_item;
    end if;

  elsif coalesce(trim(p_nome_novo), '') <> '' then
    -- Mesma regra da paciente: alimento fora da lista entra como item dela.
    -- Repare que NÃO há reaproveitamento por nome parecido — dois itens com
    -- o mesmo nome são preferíveis a um registro pendurado no alimento
    -- errado.
    insert into reintroducao_itens (paciente_id, nome_livre, status, ordem)
    values (p_paciente, trim(p_nome_novo), 'em_teste',
            coalesce((select max(ordem) + 1 from reintroducao_itens
                       where paciente_id = p_paciente), 1))
    returning id into v_item;
  else
    raise exception 'Escolha um alimento ou escreva o nome.' using errcode = '22023';
  end if;

  insert into reintroducao_registros
    (item_id, paciente_id, data, horario, quantidade, preparo,
     sintomas, intensidade, bristol, observacao)
  values
    (v_item, p_paciente, v_data, p_horario,
     nullif(trim(p_quantidade), ''), nullif(trim(p_preparo), ''),
     conferir_sintomas(p_sintomas), p_intensidade, p_bristol,
     nullif(trim(p_observacao), ''))
  returning id into v_id;

  -- Mesma regra da função da paciente: 'em_teste' é constatação, não
  -- conclusão, e o que ela já tiver classificado fica como está.
  update reintroducao_itens set status = 'em_teste'
   where id = v_item and status = 'nao_iniciado';

  return v_id;
end;
$$;

revoke all on function registrar_reintroducao_admin(
  uuid, uuid, text, text, date, time, text, text, text[], integer, integer, text
) from anon, public;
grant execute on function registrar_reintroducao_admin(
  uuid, uuid, text, text, date, time, text, text, text[], integer, integer, text
) to authenticated;
