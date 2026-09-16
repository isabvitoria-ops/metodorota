-- =============================================================================
-- CENTRAL DO PACIENTE — 0021: rastreio é para quem precisa, e a marcação é só
-- dos alimentos do Mapa
--
-- Dois pedidos dela, e os dois vão na mesma direção: menos coisa na frente de
-- quem não precisa dela.
--
-- 1. NEM TODA PACIENTE FAZ RASTREAMENTO
--
--    O módulo passa a ser ligado paciente por paciente. Desligado — que é como
--    todo mundo começa — a paciente não vê o atalho, não vê a tela e não tem
--    o que responder. Para quem não tem queixa intestinal, o módulo
--    simplesmente não existe.
--
-- 2. A MARCAÇÃO SÓ VALE PARA OS ALIMENTOS DO MAPA
--
--    A Tabela de oxalato, histamina e lectina tem 283 alimentos; o Mapa de
--    Reintrodução tem 64. Vinho, tomate, café e companhia estão na Tabela e
--    não fazem parte do protocolo de reintrodução — e por isso não devem
--    aparecer marcados.
--
--    O que sai daqui é a busca por nome: um alimento que a paciente digitasse
--    como "champagne" casava com a linha da Tabela e ganhava marcação. Agora
--    só recebe marcação o alimento que veio do Mapa e tem ligação explícita.
--    A Tabela inteira continua guardada, para o dia em que ela quiser ligar
--    mais algum — mas ligar é decisão dela, não semelhança de nome.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. O interruptor
-- -----------------------------------------------------------------------------

alter table reintroducao_acompanhamento
  add column if not exists ativo boolean not null default false;

/** Quem tem rastreio ligado. Sem linha de acompanhamento, está desligado. */
create or replace function rastreio_ativo(p_paciente uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select a.ativo from reintroducao_acompanhamento a where a.paciente_id = p_paciente),
    false
  );
$$;

revoke all on function rastreio_ativo(uuid) from anon, public;
grant execute on function rastreio_ativo(uuid) to authenticated;

create or replace function definir_rastreio_do_paciente(p_paciente uuid, p_ativo boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista liga ou desliga o rastreio.' using errcode = '42501';
  end if;
  if not exists (select 1 from pacientes where id = p_paciente) then
    raise exception 'Paciente não encontrada.' using errcode = '22023';
  end if;

  insert into reintroducao_acompanhamento (paciente_id, ativo)
  values (p_paciente, p_ativo)
  on conflict (paciente_id) do update set ativo = excluded.ativo;
end;
$$;

revoke all on function definir_rastreio_do_paciente(uuid, boolean) from anon, public;
grant execute on function definir_rastreio_do_paciente(uuid, boolean) to authenticated;

/** Quem já está com o rastreio ligado, para a lista de pacientes dela. */
create or replace function rastreios_ativos()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê isso.' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_agg(a.paciente_id), '[]'::jsonb)
    from reintroducao_acompanhamento a where a.ativo
  );
end;
$$;

revoke all on function rastreios_ativos() from anon, public;
grant execute on function rastreios_ativos() to authenticated;

-- Montar a lista de alguém é decidir que aquela paciente faz o rastreio. Sem
-- isto, ela cadastraria dez alimentos, a paciente continuaria sem ver nada e
-- a conclusão seria "o app não funciona" — que foi exatamente o que aconteceu
-- com o desafio antes do 0012.
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

  insert into reintroducao_acompanhamento (paciente_id, ativo)
  values (p_paciente, true)
  on conflict (paciente_id) do update set ativo = true;

  return v_incluidos;
end;
$$;

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

  insert into reintroducao_acompanhamento (paciente_id, ativo)
  values (p_paciente, true)
  on conflict (paciente_id) do update set ativo = true;

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- A tela da paciente respeita o interruptor
-- -----------------------------------------------------------------------------

/**
 * Desligado, a paciente não registra nada.
 *
 * A conferência fica aqui e não só na tela: com o módulo desligado, o botão
 * some — e quem chamasse a função por fora também não passa.
 */
create or replace function registrar_reintroducao(
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
  v_paciente uuid;
  v_item uuid;
  v_id uuid;
begin
  if not tem_acesso() then
    raise exception 'Seu acesso não está liberado.' using errcode = '42501';
  end if;
  v_paciente := meu_paciente_id();
  if v_paciente is null then
    raise exception 'Não encontrei seu cadastro de paciente.' using errcode = '42501';
  end if;
  if not rastreio_ativo(v_paciente) then
    raise exception 'A rastreabilidade não está ativa para você.' using errcode = '42501';
  end if;

  if p_item is not null then
    select i.id into v_item from reintroducao_itens i
     where i.id = p_item and i.paciente_id = v_paciente;
    if v_item is null then
      raise exception 'Este alimento não está na sua lista.' using errcode = '42501';
    end if;
  elsif coalesce(trim(p_nome_novo), '') <> '' then
    insert into reintroducao_itens (paciente_id, nome_livre, status, ordem)
    values (v_paciente, trim(p_nome_novo), 'em_teste',
            coalesce((select max(ordem) + 1 from reintroducao_itens
                       where paciente_id = v_paciente), 1))
    returning id into v_item;
  else
    raise exception 'Escolha um alimento ou escreva o nome.' using errcode = '22023';
  end if;

  insert into reintroducao_registros
    (item_id, paciente_id, data, horario, quantidade, preparo,
     sintomas, intensidade, bristol, observacao)
  values
    (v_item, v_paciente, coalesce(p_data, hoje_sp()), p_horario,
     nullif(trim(p_quantidade), ''), nullif(trim(p_preparo), ''),
     conferir_sintomas(p_sintomas), p_intensidade, p_bristol,
     nullif(trim(p_observacao), ''))
  returning id into v_id;

  update reintroducao_itens set status = 'em_teste'
   where id = v_item and status = 'nao_iniciado';

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. A marcação só dos alimentos do Mapa
--
-- A busca por nome sai de cena. Ela existia para alcançar o alimento que a
-- paciente digitasse, e é justamente por ali que "champagne" entrava.
-- -----------------------------------------------------------------------------

drop function if exists marcador_por_nome(text);
drop function if exists normalizar_nome(text);

create or replace function reintroducao_json(p_paciente uuid, p_previa boolean default false)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'ativo', p_previa or rastreio_ativo(p_paciente),
    'previa', p_previa,
    'inicio', inicio_da_reintroducao(p_paciente),
    'semanaAtual', semana_da_reintroducao(p_paciente, hoje_sp()),
    'semanasComRegistro', (
      select coalesce(jsonb_agg(distinct semana_da_reintroducao(p_paciente, r.data)), '[]'::jsonb)
      from reintroducao_registros r where r.paciente_id = p_paciente
    ),
    'itens', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', i.id,
        'alimentoId', i.alimento_id,
        'nome', coalesce(a.nome, i.nome_livre),
        'categoria', coalesce(a.categoria, 'outros'),
        'semanaSugerida', a.semana_sugerida,
        'porcaoReferencia', a.porcao_referencia,
        'observacaoMaterial', a.observacao,
        'doCatalogo', i.alimento_id is not null,
        'status', i.status,
        'notaNutri', i.nota_nutri,
        'ordem', i.ordem,
        -- Só o que veio do Mapa e tem ligação explícita. Alimento digitado
        -- fica sem marcação, mesmo que exista um nome igual na Tabela.
        'marcacao', marcacao_do_alimento(a.marcador_id),
        'totalDeRegistros', (
          select count(*) from reintroducao_registros r where r.item_id = i.id
        ),
        'ultimoRegistro', (
          select max(r.data) from reintroducao_registros r where r.item_id = i.id
        )
      ) order by i.ordem, coalesce(a.nome, i.nome_livre)), '[]'::jsonb)
      from reintroducao_itens i
      left join reintroducao_alimentos a on a.id = i.alimento_id
      where i.paciente_id = p_paciente
    ),
    'registros', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', r.id,
        'itemId', r.item_id,
        'itemNome', coalesce(a.nome, i.nome_livre),
        'data', r.data,
        'horario', to_char(r.horario, 'HH24:MI'),
        'semana', semana_da_reintroducao(p_paciente, r.data),
        'quantidade', r.quantidade,
        'preparo', r.preparo,
        'sintomas', to_jsonb(r.sintomas),
        'intensidade', r.intensidade,
        'bristol', r.bristol,
        'observacao', r.observacao,
        'marcacao', marcacao_do_alimento(a.marcador_id),
        'criadoEm', r.criado_em
      ) order by r.data desc, r.horario desc nulls last, r.criado_em desc), '[]'::jsonb)
      from reintroducao_registros r
      join reintroducao_itens i on i.id = r.item_id
      left join reintroducao_alimentos a on a.id = i.alimento_id
      where r.paciente_id = p_paciente
    )
  );
$$;

-- -----------------------------------------------------------------------------
-- O app inteiro precisa saber, e numa chamada que ele já faz
--
-- O atalho da tela inicial some quando o rastreio está desligado. Pendurar
-- isso em `meu_acesso()` custa um campo numa leitura que já acontece; uma
-- chamada só para isso custaria uma volta de rede em toda abertura do app.
-- -----------------------------------------------------------------------------

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
    -- A nutricionista enxerga sempre, para conferir a tela da paciente.
    'rastreio', e_admin() or coalesce(rastreio_ativo(meu_paciente_id()), false)
  );
$$;

grant execute on function meu_acesso() to authenticated;

/**
 * Com o rastreio desligado, a tela da paciente volta vazia.
 *
 * Os dados dela continuam guardados — desligar não apaga histórico, e religar
 * traz tudo de volta. O que muda é que o app para de entregar: se a
 * nutricionista desligou, a paciente não vê nem o que já tinha registrado,
 * e é isso que "não faz rastreamento" quer dizer.
 */
create or replace function minha_reintroducao()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
  v_previa boolean;
  v_orientacao text;
begin
  v_paciente := meu_paciente_id();
  v_previa := v_paciente is null and e_admin();

  if v_paciente is null and not v_previa then
    return jsonb_build_object('ativo', false, 'previa', false, 'orientacao', null,
                              'itens', '[]'::jsonb, 'registros', '[]'::jsonb);
  end if;

  if not v_previa and not rastreio_ativo(v_paciente) then
    return jsonb_build_object('ativo', false, 'previa', false, 'orientacao', null,
                              'itens', '[]'::jsonb, 'registros', '[]'::jsonb);
  end if;

  select valor #>> '{}' into v_orientacao
  from configuracoes where chave = 'reintroducao_orientacao';

  return jsonb_build_object('orientacao', coalesce(
    (select nullif(trim(a.orientacao), '') from reintroducao_acompanhamento a
      where a.paciente_id = v_paciente),
    v_orientacao
  )) || reintroducao_json(v_paciente, v_previa);
end;
$$;

grant execute on function minha_reintroducao() to authenticated;

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('rastreio_ativo', 'definir_rastreio_do_paciente',
                        'rastreios_ativos', 'minha_reintroducao', 'meu_acesso',
                        'reintroducao_json', 'registrar_reintroducao',
                        'adicionar_itens_reintroducao', 'adicionar_item_livre_reintroducao')
  loop
    execute format('revoke all on function %s from anon, public', f.assinatura);
  end loop;
end;
$$;

grant execute on function meu_acesso() to authenticated;
grant execute on function minha_reintroducao() to authenticated;
grant execute on function registrar_reintroducao(uuid, text, date, time, text, text, text[], integer, integer, text) to authenticated;
grant execute on function adicionar_itens_reintroducao(uuid, text[]) to authenticated;
grant execute on function adicionar_item_livre_reintroducao(uuid, text) to authenticated;
grant execute on function rastreio_ativo(uuid) to authenticated;
grant execute on function definir_rastreio_do_paciente(uuid, boolean) to authenticated;
grant execute on function rastreios_ativos() to authenticated;
