-- =============================================================================
-- CENTRAL DO PACIENTE — 0023: grupos de alimentos do protocolo
--
-- "Preciso de um banco de dados com alimentos já salvos, tipo grupo de frutas
-- já com porção, grupo de carbos pro almoço."
--
-- É a lista que ela monta UMA vez e usa em toda paciente: dezessete frutas
-- com a porção de cada uma, sete fontes de carboidrato para o almoço. Sem
-- isto ela redigita a mesma lista a cada protocolo.
--
-- O QUE ESTA TABELA NÃO É
--
-- Não é tabela nutricional. Não há caloria, macro nem composição em lugar
-- nenhum — só nome e quantidade, escritos por ela. O aplicativo continua sem
-- calcular dieta, que é a regra desde o começo: quem calcula é a
-- nutricionista, fora daqui.
--
-- CÓPIA, NÃO LIGAÇÃO
--
-- Ao entrar num protocolo, o grupo é copiado para dentro dele. Mexer no
-- grupo depois NÃO muda o protocolo de ninguém que já recebeu — a dieta que
-- a paciente está seguindo não pode mudar sozinha porque ela ajustou uma
-- lista. Quando quiser propagar, ela entra no protocolo e acrescenta o grupo
-- de novo.
-- =============================================================================

create table if not exists grupos_protocolo (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  -- [{ "alimento": "Banana", "quantidade": "1 unidade" }, …]
  itens jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index if not exists grupo_protocolo_nome on grupos_protocolo (lower(nome));

alter table grupos_protocolo enable row level security;

-- A paciente não lê esta tabela. Ela não precisa: o que vale para a dieta
-- dela já foi copiado para dentro do protocolo dela.
drop policy if exists grupos_protocolo_nutri on grupos_protocolo;
create policy grupos_protocolo_nutri on grupos_protocolo for all
  using (e_admin()) with check (e_admin());

grant select, insert, update, delete on grupos_protocolo to authenticated;
revoke all on table grupos_protocolo from anon;

create or replace function listar_grupos_protocolo()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê os grupos.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object('id', g.id, 'nome', g.nome, 'itens', g.itens)
                     order by g.nome)
    from grupos_protocolo g
  ), '[]'::jsonb);
end;
$$;

revoke all on function listar_grupos_protocolo() from anon, public;
grant execute on function listar_grupos_protocolo() to authenticated;

/**
 * Cria ou atualiza um grupo. Sem `p_id`, cria.
 *
 * Grupo sem nome não entra: a lista dela é encontrada pelo nome, e um grupo
 * chamado "" some no meio dos outros.
 */
create or replace function salvar_grupo_protocolo(
  p_id uuid,
  p_nome text,
  p_itens jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_nome text := nullif(trim(coalesce(p_nome, '')), '');
begin
  if not e_admin() then
    raise exception 'Só a nutricionista escreve grupos.' using errcode = '42501';
  end if;

  if v_nome is null then
    raise exception 'O grupo precisa de um nome.' using errcode = '22023';
  end if;

  if p_itens is null or jsonb_typeof(p_itens) <> 'array' then
    raise exception 'A lista de alimentos do grupo precisa ser uma lista.' using errcode = '22023';
  end if;

  if p_id is null then
    insert into grupos_protocolo (nome, itens) values (v_nome, p_itens)
    returning id into v_id;
  else
    update grupos_protocolo
    set nome = v_nome, itens = p_itens, atualizado_em = now()
    where id = p_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Grupo não encontrado.' using errcode = 'P0002';
    end if;
  end if;

  return (select jsonb_build_object('id', g.id, 'nome', g.nome, 'itens', g.itens)
          from grupos_protocolo g where g.id = v_id);
end;
$$;

revoke all on function salvar_grupo_protocolo(uuid, text, jsonb) from anon, public;
grant execute on function salvar_grupo_protocolo(uuid, text, jsonb) to authenticated;

/**
 * Apaga o grupo.
 *
 * Os protocolos que já usaram esse grupo não sentem nada: eles guardam a
 * cópia, não uma ligação. Apagar aqui é tirar da lista de atalhos dela.
 */
create or replace function excluir_grupo_protocolo(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista apaga grupos.' using errcode = '42501';
  end if;
  delete from grupos_protocolo where id = p_id;
end;
$$;

revoke all on function excluir_grupo_protocolo(uuid) from anon, public;
grant execute on function excluir_grupo_protocolo(uuid) to authenticated;
