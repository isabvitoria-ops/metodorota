-- =============================================================================
-- CENTRAL DO PACIENTE — 0024: avaliação física
--
-- "Ao lado do protocolo, um negocinho clicável, que a paciente clica para
-- ver a última avaliação física dela."
--
-- A conta é feita FORA daqui, na ferramenta de cálculo. Esta tabela guarda o
-- resultado que a nutricionista lançou: as medidas, as dobras, o método que
-- ela usou e o percentual que deu. O app não recalcula nada — se
-- recalculasse, um dia mostraria um número diferente do que ela entregou na
-- consulta, e quem estaria certo seria impossível dizer.
--
-- Uma linha por avaliação. O histórico é o ponto: "cada retorno mostra a
-- variação" é o que o material dela promete à paciente.
-- =============================================================================

create table if not exists avaliacoes_fisicas (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes (id) on delete cascade,
  data date not null default hoje_sp(),
  /**
   * { metodo, peso, altura, idade, percentualGordura, massaGorda,
   *   massaMagra, imc, somaDobras, dobras: [{nome, valor}],
   *   circunferencias: [{nome, valor}], observacao }
   *
   * Documento, não planilha: o conjunto de dobras muda com o protocolo, e
   * uma coluna por dobra viraria migração a cada material novo.
   */
  dados jsonb not null default '{}'::jsonb,
  publicada boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists avaliacoes_por_paciente
  on avaliacoes_fisicas (paciente_id, data desc);

alter table avaliacoes_fisicas enable row level security;

drop policy if exists avaliacoes_nutri on avaliacoes_fisicas;
create policy avaliacoes_nutri on avaliacoes_fisicas for all
  using (e_admin()) with check (e_admin());

-- A paciente lê as avaliações publicadas dela, e mais nada. Rascunho de
-- avaliação não aparece: um percentual lançado pela metade não pode chegar
-- em quem vai lê-lo sobre o próprio corpo.
drop policy if exists avaliacoes_paciente on avaliacoes_fisicas;
create policy avaliacoes_paciente on avaliacoes_fisicas for select
  using (publicada and paciente_id = meu_paciente_id());

grant select, insert, update, delete on avaliacoes_fisicas to authenticated;
revoke all on table avaliacoes_fisicas from anon;

/** A última avaliação publicada da paciente, e quantas vieram antes. */
create or replace function minha_avaliacao()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
  v_ultima avaliacoes_fisicas;
  v_total integer;
begin
  v_paciente := meu_paciente_id();
  if v_paciente is null then return null; end if;

  select * into v_ultima from avaliacoes_fisicas
  where paciente_id = v_paciente and publicada
  order by data desc, criado_em desc
  limit 1;

  if v_ultima.id is null then return null; end if;

  select count(*) into v_total from avaliacoes_fisicas
  where paciente_id = v_paciente and publicada;

  return jsonb_build_object(
    'id', v_ultima.id,
    'data', v_ultima.data,
    'dados', v_ultima.dados,
    'total', v_total,
    -- A data da primeira: é o "ponto de partida" do material dela.
    'inicio', (select min(data) from avaliacoes_fisicas
                where paciente_id = v_paciente and publicada)
  );
end;
$$;

revoke all on function minha_avaliacao() from anon, public;
grant execute on function minha_avaliacao() to authenticated;

/** Tem avaliação publicada? Entra no `meu_acesso()` para a tela decidir. */
create or replace function tenho_avaliacao()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from avaliacoes_fisicas
    where publicada and paciente_id = meu_paciente_id()
  );
$$;

revoke all on function tenho_avaliacao() from anon, public;
grant execute on function tenho_avaliacao() to authenticated;

create or replace function avaliacoes_do_paciente(p_paciente uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê as avaliações.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', a.id, 'data', a.data, 'dados', a.dados, 'publicada', a.publicada)
           order by a.data desc, a.criado_em desc)
    from avaliacoes_fisicas a where a.paciente_id = p_paciente
  ), '[]'::jsonb);
end;
$$;

revoke all on function avaliacoes_do_paciente(uuid) from anon, public;
grant execute on function avaliacoes_do_paciente(uuid) to authenticated;

create or replace function salvar_avaliacao_fisica(
  p_id uuid,
  p_paciente uuid,
  p_data date,
  p_dados jsonb,
  p_publicada boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista lança avaliação.' using errcode = '42501';
  end if;

  if not exists (select 1 from pacientes where id = p_paciente) then
    raise exception 'Paciente não encontrado.' using errcode = 'P0002';
  end if;

  if p_dados is null or jsonb_typeof(p_dados) <> 'object' then
    raise exception 'Os dados da avaliação precisam ser um objeto.' using errcode = '22023';
  end if;

  if p_id is null then
    insert into avaliacoes_fisicas (paciente_id, data, dados, publicada)
    values (p_paciente, coalesce(p_data, hoje_sp()), p_dados, coalesce(p_publicada, false))
    returning id into v_id;
  else
    update avaliacoes_fisicas
    set data = coalesce(p_data, data),
        dados = p_dados,
        publicada = coalesce(p_publicada, publicada),
        atualizado_em = now()
    where id = p_id and paciente_id = p_paciente
    returning id into v_id;

    if v_id is null then
      raise exception 'Avaliação não encontrada.' using errcode = 'P0002';
    end if;
  end if;

  return (select jsonb_build_object('id', a.id, 'data', a.data, 'dados', a.dados,
                                    'publicada', a.publicada)
          from avaliacoes_fisicas a where a.id = v_id);
end;
$$;

revoke all on function salvar_avaliacao_fisica(uuid, uuid, date, jsonb, boolean) from anon, public;
grant execute on function salvar_avaliacao_fisica(uuid, uuid, date, jsonb, boolean) to authenticated;

create or replace function excluir_avaliacao_fisica(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista apaga avaliação.' using errcode = '42501';
  end if;
  delete from avaliacoes_fisicas where id = p_id;
end;
$$;

revoke all on function excluir_avaliacao_fisica(uuid) from anon, public;
grant execute on function excluir_avaliacao_fisica(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- O acesso passa a dizer se há avaliação, para a tela não oferecer porta vazia
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
    'rastreio', e_admin() or coalesce(rastreio_ativo(meu_paciente_id()), false),
    'protocolo', e_admin() or tenho_protocolo(),
    'avaliacao', e_admin() or tenho_avaliacao()
  );
$$;

grant execute on function meu_acesso() to authenticated;
