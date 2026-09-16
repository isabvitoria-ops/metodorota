-- =============================================================================
-- CENTRAL DO PACIENTE — 0017: o lado da nutricionista, e as fechaduras
--
-- É aqui que ela monta a lista de cada paciente, muda status e lê a linha do
-- tempo. E é aqui que se garante o de sempre: uma paciente não vê o diário de
-- outra, e o visitante sem login não vê nada.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Montar a lista daquela paciente (§5)
-- -----------------------------------------------------------------------------

/** Puxa alimentos do catálogo para a lista da paciente. Repetido é ignorado. */
create or replace function adicionar_itens_reintroducao(p_paciente uuid, p_alimentos text[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base integer;
  v_incluidos integer;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista monta a lista.' using errcode = '42501';
  end if;
  if not exists (select 1 from pacientes where id = p_paciente) then
    raise exception 'Paciente não encontrada.' using errcode = '22023';
  end if;

  select coalesce(max(ordem), 0) into v_base
  from reintroducao_itens where paciente_id = p_paciente;

  with novos as (
    insert into reintroducao_itens (paciente_id, alimento_id, ordem)
    select p_paciente, a.id, v_base + row_number() over (order by a.ordem)
    from reintroducao_alimentos a
    where a.id = any (p_alimentos) and a.ativo
    on conflict (paciente_id, alimento_id) where alimento_id is not null
    do nothing
    returning 1
  )
  select count(*) into v_incluidos from novos;

  insert into reintroducao_acompanhamento (paciente_id)
  values (p_paciente) on conflict (paciente_id) do nothing;

  return v_incluidos;
end;
$$;

/** Um alimento que não está no material — o "entra na semana 5" dela. */
create or replace function adicionar_item_livre_reintroducao(p_paciente uuid, p_nome text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista monta a lista.' using errcode = '42501';
  end if;
  if coalesce(trim(p_nome), '') = '' then
    raise exception 'Escreva o nome do alimento.' using errcode = '22023';
  end if;

  insert into reintroducao_itens (paciente_id, nome_livre, ordem)
  values (p_paciente, trim(p_nome),
          coalesce((select max(ordem) + 1 from reintroducao_itens
                     where paciente_id = p_paciente), 1))
  returning id into v_id;

  insert into reintroducao_acompanhamento (paciente_id)
  values (p_paciente) on conflict (paciente_id) do nothing;

  return v_id;
end;
$$;

/**
 * Tirar um alimento da lista.
 *
 * Com registro no histórico, some o alimento E some o que a paciente
 * escreveu. Quando é isso que ela quer, 'nao_relevante' é o caminho — por
 * isso a recusa aqui explica a alternativa em vez de só negar.
 */
create or replace function remover_item_reintroducao(p_item uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista mexe na lista.' using errcode = '42501';
  end if;
  if exists (select 1 from reintroducao_registros where item_id = p_item) then
    raise exception 'Este alimento já tem registros. Marque como "não relevante" para tirá-lo da frente sem apagar o histórico.'
      using errcode = '22023';
  end if;
  delete from reintroducao_itens where id = p_item;
end;
$$;

/**
 * O status é dela (§12).
 *
 * Nenhum destes valores é atribuído por conta de um sintoma: ela lê o
 * histórico e decide. Os nomes são neutros de propósito — não existe
 * "proibido" nesta lista.
 */
create or replace function definir_status_reintroducao(
  p_item uuid,
  p_status text,
  p_nota text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista classifica.' using errcode = '42501';
  end if;
  update reintroducao_itens
     set status = p_status,
         nota_nutri = nullif(trim(p_nota), '')
   where id = p_item;
  if not found then
    raise exception 'Alimento não encontrado.' using errcode = '22023';
  end if;
end;
$$;

/** A ordem em que os alimentos aparecem para a paciente. */
create or replace function reordenar_reintroducao(p_itens uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista reordena.' using errcode = '42501';
  end if;
  update reintroducao_itens i
     set ordem = pos.n
    from unnest(p_itens) with ordinality as pos(id, n)
   where i.id = pos.id;
end;
$$;

/** Início do acompanhamento e o recado dela para aquela paciente. */
create or replace function definir_acompanhamento_reintroducao(
  p_paciente uuid,
  p_inicio date default null,
  p_orientacao text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista define o acompanhamento.' using errcode = '42501';
  end if;
  insert into reintroducao_acompanhamento (paciente_id, inicio, orientacao)
  values (p_paciente, p_inicio, nullif(trim(p_orientacao), ''))
  on conflict (paciente_id) do update
    set inicio = excluded.inicio,
        orientacao = excluded.orientacao;
end;
$$;

/** A linha do tempo de uma paciente, para a tela dela. */
create or replace function reintroducao_do_paciente(p_paciente uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê o acompanhamento de uma paciente.'
      using errcode = '42501';
  end if;
  return jsonb_build_object(
    'orientacao', (select orientacao from reintroducao_acompanhamento
                    where paciente_id = p_paciente)
  ) || reintroducao_json(p_paciente, false);
end;
$$;

-- -----------------------------------------------------------------------------
-- Quem vê o quê
-- -----------------------------------------------------------------------------

alter table reintroducao_alimentos enable row level security;
alter table reintroducao_acompanhamento enable row level security;
alter table reintroducao_itens enable row level security;
alter table reintroducao_registros enable row level security;

-- O catálogo é conteúdo: quem tem acesso válido lê.
drop policy if exists reintroducao_alimentos_leitura on reintroducao_alimentos;
create policy reintroducao_alimentos_leitura on reintroducao_alimentos for select
  using (e_admin() or (ativo and tem_acesso()));

drop policy if exists reintroducao_alimentos_admin on reintroducao_alimentos;
create policy reintroducao_alimentos_admin on reintroducao_alimentos for all
  using (e_admin()) with check (e_admin());

-- Diário é dado de paciente: cada uma lê o seu, e ninguém lê o da outra.
--
-- Repare no que NÃO existe: política de insert, update ou delete para
-- paciente. Tudo o que ela grava passa pelas funções, que conferem o acesso
-- e o dono antes de escrever.
do $$
declare t text;
begin
  foreach t in array array[
    'reintroducao_acompanhamento', 'reintroducao_itens', 'reintroducao_registros'
  ] loop
    execute format('drop policy if exists %I on %I', t || '_leitura', t);
    execute format(
      'create policy %I on %I for select using (e_admin() or (paciente_id = meu_paciente_id() and tem_acesso()))',
      t || '_leitura', t
    );
    execute format('drop policy if exists %I on %I', t || '_admin', t);
    execute format(
      'create policy %I on %I for all using (e_admin()) with check (e_admin())',
      t || '_admin', t
    );
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Permissões
-- -----------------------------------------------------------------------------

grant select on reintroducao_alimentos, reintroducao_acompanhamento,
  reintroducao_itens, reintroducao_registros to authenticated;
grant insert, update, delete on reintroducao_alimentos, reintroducao_acompanhamento,
  reintroducao_itens, reintroducao_registros to authenticated;

-- E nada disso chega ao visitante sem login.
do $$
declare t text;
begin
  foreach t in array array[
    'reintroducao_alimentos', 'reintroducao_acompanhamento',
    'reintroducao_itens', 'reintroducao_registros'
  ] loop
    execute format('revoke all on table %I from anon', t);
  end loop;
end;
$$;

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'sintomas_da_reintroducao', 'conferir_sintomas', 'inicio_da_reintroducao',
        'semana_da_reintroducao', 'reintroducao_json', 'minha_reintroducao',
        'registrar_reintroducao', 'editar_registro_reintroducao',
        'excluir_registro_reintroducao', 'marcar_relevancia_reintroducao',
        'adicionar_itens_reintroducao', 'adicionar_item_livre_reintroducao',
        'remover_item_reintroducao', 'definir_status_reintroducao',
        'reordenar_reintroducao', 'definir_acompanhamento_reintroducao',
        'reintroducao_do_paciente'
      )
  loop
    execute format('revoke all on function %s from anon, public', f.assinatura);
  end loop;
end;
$$;

-- `reintroducao_json` fica de fora: ela aceita o id de qualquer paciente e não
-- confere dono nenhum. É auxiliar das duas funções acima, que conferem — e é
-- exatamente por isso que ninguém a chama pela mão.
grant execute on function sintomas_da_reintroducao() to authenticated;
grant execute on function conferir_sintomas(text[]) to authenticated;
grant execute on function inicio_da_reintroducao(uuid) to authenticated;
grant execute on function semana_da_reintroducao(uuid, date) to authenticated;
grant execute on function minha_reintroducao() to authenticated;
grant execute on function registrar_reintroducao(uuid, text, date, time, text, text, text[], integer, integer, text) to authenticated;
grant execute on function editar_registro_reintroducao(uuid, date, time, text, text, text[], integer, integer, text) to authenticated;
grant execute on function excluir_registro_reintroducao(uuid) to authenticated;
grant execute on function marcar_relevancia_reintroducao(uuid, boolean) to authenticated;
grant execute on function adicionar_itens_reintroducao(uuid, text[]) to authenticated;
grant execute on function adicionar_item_livre_reintroducao(uuid, text) to authenticated;
grant execute on function remover_item_reintroducao(uuid) to authenticated;
grant execute on function definir_status_reintroducao(uuid, text, text) to authenticated;
grant execute on function reordenar_reintroducao(uuid[]) to authenticated;
grant execute on function definir_acompanhamento_reintroducao(uuid, date, text) to authenticated;
grant execute on function reintroducao_do_paciente(uuid) to authenticated;
