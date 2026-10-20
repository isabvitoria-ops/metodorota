-- =============================================================================
-- CENTRAL DO PACIENTE — 0080: interruptores de Restrições e FODMAP
--
-- "Não é todo paciente que precisa ver as restrições" — e o FODMAP é a mesma
-- história. Ambos nascem DESLIGADOS: quem não tem restrição cadastrada não
-- precisa de uma tela vazia, e o FODMAP é para quem faz rastreio intestinal,
-- não para todo mundo.
--
-- O padrão é o mesmo do treino (0033) e do desafio (0038): coluna boolean
-- na tabela `pacientes`, uma função de leitura (nutricionista + própria),
-- uma de toggle (nutricionista), e as funções de consulta e interruptor
-- atualizadas para incluir os novos campos.
-- =============================================================================

-- 1) Colunas novas
alter table pacientes
  add column if not exists restricoes_liberado boolean not null default false;

alter table pacientes
  add column if not exists fodmap_liberado boolean not null default false;

-- 2) Leitura: quem tem restrições liberadas
create or replace function restricoes_liberado(p_paciente uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_paciente is null then false
    when e_admin() or p_paciente = meu_paciente_id() then
      coalesce((select p.restricoes_liberado from pacientes p where p.id = p_paciente), false)
    else false
  end;
$$;

revoke all on function restricoes_liberado(uuid) from anon, public;
grant execute on function restricoes_liberado(uuid) to authenticated;

-- 3) Leitura: quem tem FODMAP liberado
create or replace function fodmap_liberado(p_paciente uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_paciente is null then false
    when e_admin() or p_paciente = meu_paciente_id() then
      coalesce((select p.fodmap_liberado from pacientes p where p.id = p_paciente), false)
    else false
  end;
$$;

revoke all on function fodmap_liberado(uuid) from anon, public;
grant execute on function fodmap_liberado(uuid) to authenticated;

-- 4) Toggle: a nutricionista liga e desliga restrições
create or replace function definir_restricoes_do_paciente(p_paciente uuid, p_ativo boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista libera as restrições.' using errcode = '42501';
  end if;
  if not exists (select 1 from pacientes where id = p_paciente) then
    raise exception 'Paciente não encontrada.' using errcode = '22023';
  end if;

  update pacientes set restricoes_liberado = coalesce(p_ativo, false) where id = p_paciente;

  return (select restricoes_liberado from pacientes where id = p_paciente);
end;
$$;

revoke all on function definir_restricoes_do_paciente(uuid, boolean) from anon, public;
grant execute on function definir_restricoes_do_paciente(uuid, boolean) to authenticated;

-- 5) Toggle: a nutricionista liga e desliga o FODMAP
create or replace function definir_fodmap_do_paciente(p_paciente uuid, p_ativo boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista libera o FODMAP.' using errcode = '42501';
  end if;
  if not exists (select 1 from pacientes where id = p_paciente) then
    raise exception 'Paciente não encontrada.' using errcode = '22023';
  end if;

  update pacientes set fodmap_liberado = coalesce(p_ativo, false) where id = p_paciente;

  return (select fodmap_liberado from pacientes where id = p_paciente);
end;
$$;

revoke all on function definir_fodmap_do_paciente(uuid, boolean) from anon, public;
grant execute on function definir_fodmap_do_paciente(uuid, boolean) to authenticated;

-- 6) meu_acesso() ganha `restricoes` e `fodmap`
create or replace function meu_acesso()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'autenticado', auth.uid() is not null,
    'perfilId', auth.uid(),
    'papel', coalesce((select papel from perfis where id = auth.uid()), 'paciente'),
    'nome', (select coalesce(pa.nome, pe.nome) from perfis pe
             left join pacientes pa on pa.perfil_id = pe.id where pe.id = auth.uid()),
    'email', (select email::text from perfis where id = auth.uid()),
    'temAcesso', tem_acesso() or e_admin(),
    'situacao', coalesce(
      (select situacao_paciente(p.status, p.perfil_id, p.data_inicio, p.data_fim)
         from pacientes p where p.perfil_id = auth.uid()),
      case when e_admin() then 'admin' else 'sem_cadastro' end
    ),
    'dataInicio', (select data_inicio from pacientes where perfil_id = auth.uid()),
    'dataFim', (select data_fim from pacientes where perfil_id = auth.uid()),
    'diasRestantes', (select data_fim - hoje_sp() from pacientes where perfil_id = auth.uid()),
    'plano', (select pl.nome from pacientes p join planos pl on pl.id = p.plano_id
               where p.perfil_id = auth.uid()),
    'rastreio', e_admin() or coalesce(rastreio_ativo(meu_paciente_id()), false),
    'protocolo', e_admin() or tenho_protocolo(),
    'avaliacao', e_admin() or tenho_avaliacao(),
    'treino', e_admin() or tenho_treino(),
    'metas', e_admin() or tenho_metas(),
    'desafio', e_admin() or coalesce(desafio_liberado(meu_paciente_id()), true),
    'restricoes', e_admin() or coalesce(restricoes_liberado(meu_paciente_id()), false),
    'fodmap', e_admin() or coalesce(fodmap_liberado(meu_paciente_id()), false)
  );
$$;

grant execute on function meu_acesso() to authenticated;

-- 7) acessos_do_paciente() ganha restrições e FODMAP
create or replace function acessos_do_paciente(p_paciente uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê os acessos.' using errcode = '42501';
  end if;
  if not exists (select 1 from pacientes where id = p_paciente) then
    raise exception 'Paciente não encontrada.' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'rastreio', coalesce(rastreio_ativo(p_paciente), false),
    'treino', coalesce(treino_liberado(p_paciente), false),
    'desafio', coalesce(desafio_liberado(p_paciente), true),
    'restricoes', coalesce(restricoes_liberado(p_paciente), false),
    'fodmap', coalesce(fodmap_liberado(p_paciente), false),
    -- Estado, não interruptor: existe porque ela publicou conteúdo.
    'protocolo', exists (
      select 1 from protocolos where paciente_id = p_paciente and situacao = 'publicado'),
    'avaliacao', exists (
      select 1 from avaliacoes_fisicas where paciente_id = p_paciente and publicada),
    'metas', exists (
      select 1 from metas where paciente_id = p_paciente
        and status in ('ativa', 'pausada', 'concluida'))
  );
end;
$$;

revoke all on function acessos_do_paciente(uuid) from anon, public;
grant execute on function acessos_do_paciente(uuid) to authenticated;

-- 8) minhas_restricoes() agora respeita o interruptor
create or replace function minhas_restricoes()
returns setof restricoes_alimentares
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
begin
  v_paciente := meu_paciente_id();
  if v_paciente is null then return; end if;
  if not restricoes_liberado(v_paciente) then return; end if;

  return query
    select * from restricoes_alimentares
    where paciente_id = v_paciente
    order by criado_em;
end;
$$;

revoke all on function minhas_restricoes() from anon, public;
grant execute on function minhas_restricoes() to authenticated;
