-- =============================================================================
-- CENTRAL DO PACIENTE — 0025: registro retroativo, lançado pela nutricionista
--
-- "Pelo meu acesso eu quero conseguir lançar os retroativos. Por exemplo,
-- ela já testou uma gama de alimentos, teve um que já testou mais de uma
-- vez."
--
-- POR QUE ISTO PRECISA EXISTIR. Até aqui só a paciente escrevia no diário:
-- `registrar_reintroducao` acha a paciente por `meu_paciente_id()`, e a
-- nutricionista não tem um. Quem fez rastreio no papel antes de o aplicativo
-- existir chega nele com o histórico do lado de fora, e não havia por onde
-- trazê-lo — só pedindo à paciente que redigitasse semanas de diário.
--
-- O QUE ISTO NÃO MUDA. A paciente continua dona do diário dela: as funções
-- dela não foram tocadas. Esta é uma porta a mais, fechada com `e_admin()`,
-- e que exige dizer de QUAL paciente se está falando — não há como escrever
-- no diário errado por engano de sessão.
-- =============================================================================

create or replace function registrar_reintroducao_admin(
  p_paciente uuid,
  p_item uuid default null,
  p_nome_novo text default null,
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
  uuid, uuid, text, date, time, text, text, text[], integer, integer, text
) from anon, public;
grant execute on function registrar_reintroducao_admin(
  uuid, uuid, text, date, time, text, text, text[], integer, integer, text
) to authenticated;
