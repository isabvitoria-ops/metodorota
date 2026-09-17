-- =============================================================================
-- CENTRAL DO PACIENTE — 0022: protocolo alimentar
--
-- A nutricionista calcula a dieta fora, do jeito dela, e cola o resultado
-- aqui. O app NÃO calcula nada: não guarda caloria, não guarda macro, não
-- guarda porção. Ele guarda o que ela escreveu e mostra bonito para a
-- paciente — que era a razão de existir disto, ter um aplicativo só em vez
-- de dois.
--
-- O protocolo inteiro cabe num `jsonb`. Isso é decisão, não preguiça:
--
--   * ele é um documento, não uma planilha. Ninguém vai pesquisar "todas as
--     pacientes que comem tapioca no café" — vai abrir o protocolo de uma
--     paciente e ler de cima a baixo;
--   * editar é reescrever o documento, e não costurar quinze tabelas;
--   * o formato dela muda (hoje três colunas, amanhã quatro). Um documento
--     acompanha; um esquema rígido vira migração toda vez.
--
-- Três situações, e só uma delas a paciente enxerga:
--
--   rascunho   — ela está montando. Ninguém mais vê.
--   publicado  — no ar para a paciente. No máximo um por paciente.
--   arquivado  — versão anterior. Fica de história, só para a nutricionista.
-- =============================================================================

create table if not exists protocolos (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes (id) on delete cascade,
  titulo text not null default 'Protocolo alimentar',
  conteudo jsonb not null default '{"orientacoes":[],"refeicoes":[],"secoes":[]}'::jsonb,
  -- Recado curto que aparece em destaque em cima do protocolo. Serve para o
  -- ajuste de uma semana sem refazer o documento inteiro.
  ajustes text,
  situacao text not null default 'rascunho'
    check (situacao in ('rascunho', 'publicado', 'arquivado')),
  versao integer not null default 1,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  publicado_em timestamptz
);

create index if not exists protocolos_por_paciente on protocolos (paciente_id, situacao);

-- Um rascunho e um publicado por paciente. Arquivado pode ter quantos vierem.
create unique index if not exists protocolo_um_rascunho
  on protocolos (paciente_id) where situacao = 'rascunho';
create unique index if not exists protocolo_um_publicado
  on protocolos (paciente_id) where situacao = 'publicado';

alter table protocolos enable row level security;

-- A paciente lê o protocolo publicado dela, e mais nada: nem rascunho (que
-- ainda está sendo escrito), nem arquivado (que já foi substituído), nem o
-- de outra paciente. Quem garante isso é esta política, não a ausência de
-- botão na tela.
drop policy if exists protocolos_nutri on protocolos;
create policy protocolos_nutri on protocolos for all
  using (e_admin()) with check (e_admin());

drop policy if exists protocolos_paciente on protocolos;
create policy protocolos_paciente on protocolos for select
  using (situacao = 'publicado' and paciente_id = meu_paciente_id());

grant select, insert, update, delete on protocolos to authenticated;
revoke all on table protocolos from anon;

-- -----------------------------------------------------------------------------
-- Lado da paciente
-- -----------------------------------------------------------------------------

/**
 * O protocolo da paciente, ou nulo.
 *
 * Nulo não é erro: é a paciente que ainda não recebeu dieta, e a tela dela
 * não deve nem mostrar o atalho nesse caso.
 */
create or replace function meu_protocolo()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(p) - 'paciente_id'
  from protocolos p
  where p.situacao = 'publicado'
    and p.paciente_id = meu_paciente_id();
$$;

revoke all on function meu_protocolo() from anon, public;
grant execute on function meu_protocolo() to authenticated;

/** Tem protocolo publicado? Entra no `meu_acesso()` para a home decidir. */
create or replace function tenho_protocolo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from protocolos
    where situacao = 'publicado' and paciente_id = meu_paciente_id()
  );
$$;

revoke all on function tenho_protocolo() from anon, public;
grant execute on function tenho_protocolo() to authenticated;

-- -----------------------------------------------------------------------------
-- Lado da nutricionista
-- -----------------------------------------------------------------------------

/**
 * O que a tela de edição precisa: o rascunho (se houver), o publicado (se
 * houver) e a lista das versões anteriores.
 *
 * Vem tudo numa chamada só porque a tela mostra tudo junto — e porque uma
 * volta de rede a menos, no celular dela, é meio segundo a menos de espera.
 */
create or replace function protocolo_do_paciente(p_paciente uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista abre o protocolo de um paciente.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'rascunho', (select to_jsonb(p) from protocolos p
                  where p.paciente_id = p_paciente and p.situacao = 'rascunho'),
    'publicado', (select to_jsonb(p) from protocolos p
                   where p.paciente_id = p_paciente and p.situacao = 'publicado'),
    'historico', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'titulo', p.titulo, 'versao', p.versao,
               'publicadoEm', p.publicado_em, 'atualizadoEm', p.atualizado_em)
             order by p.versao desc)
      from protocolos p
      where p.paciente_id = p_paciente and p.situacao = 'arquivado'
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function protocolo_do_paciente(uuid) from anon, public;
grant execute on function protocolo_do_paciente(uuid) to authenticated;

/**
 * Salva o rascunho. Cria se não existir, sobrescreve se existir.
 *
 * Salvar nunca publica. A paciente só passa a ver quando ela apertar
 * publicar, e essa separação é de propósito: metade de um protocolo colado
 * é pior do que nenhum.
 */
create or replace function salvar_rascunho_protocolo(
  p_paciente uuid,
  p_titulo text,
  p_conteudo jsonb,
  p_ajustes text default null
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
    raise exception 'Só a nutricionista escreve protocolo.' using errcode = '42501';
  end if;

  if not exists (select 1 from pacientes where id = p_paciente) then
    raise exception 'Paciente não encontrado.' using errcode = 'P0002';
  end if;

  if p_conteudo is null or jsonb_typeof(p_conteudo) <> 'object' then
    raise exception 'O conteúdo do protocolo precisa ser um objeto.' using errcode = '22023';
  end if;

  insert into protocolos (paciente_id, titulo, conteudo, ajustes, situacao)
  values (p_paciente, coalesce(nullif(trim(p_titulo), ''), 'Protocolo alimentar'),
          p_conteudo, p_ajustes, 'rascunho')
  on conflict (paciente_id) where situacao = 'rascunho'
  do update set titulo = excluded.titulo,
                conteudo = excluded.conteudo,
                ajustes = excluded.ajustes,
                atualizado_em = now()
  returning id into v_id;

  return (select to_jsonb(p) from protocolos p where p.id = v_id);
end;
$$;

revoke all on function salvar_rascunho_protocolo(uuid, text, jsonb, text) from anon, public;
grant execute on function salvar_rascunho_protocolo(uuid, text, jsonb, text) to authenticated;

/**
 * Publica o rascunho.
 *
 * O que estava publicado vira arquivado — não some. Se ela publicar uma
 * dieta errada, a anterior está a um clique de voltar, e é isso que faz
 * publicar deixar de ser assustador.
 */
create or replace function publicar_protocolo(p_paciente uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rascunho protocolos;
  v_versao integer;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista publica protocolo.' using errcode = '42501';
  end if;

  select * into v_rascunho from protocolos
  where paciente_id = p_paciente and situacao = 'rascunho';

  if v_rascunho.id is null then
    raise exception 'Não há rascunho para publicar.' using errcode = 'P0002';
  end if;

  if jsonb_array_length(coalesce(v_rascunho.conteudo -> 'refeicoes', '[]'::jsonb)) = 0 then
    raise exception 'O protocolo não tem nenhuma refeição.' using errcode = '22023';
  end if;

  -- O próprio rascunho já nasce com versao = 1; contá-lo aqui faria a
  -- primeira publicação sair como versão 2. Só o que já foi ao ar conta.
  select coalesce(max(versao), 0) + 1 into v_versao
  from protocolos
  where paciente_id = p_paciente and situacao in ('publicado', 'arquivado');

  update protocolos set situacao = 'arquivado', atualizado_em = now()
  where paciente_id = p_paciente and situacao = 'publicado';

  update protocolos
  set situacao = 'publicado', versao = v_versao,
      publicado_em = now(), atualizado_em = now()
  where id = v_rascunho.id;

  return (select to_jsonb(p) from protocolos p where p.id = v_rascunho.id);
end;
$$;

revoke all on function publicar_protocolo(uuid) from anon, public;
grant execute on function publicar_protocolo(uuid) to authenticated;

/**
 * Muda só o recado de ajustes do protocolo que já está no ar.
 *
 * É o atalho para "essa semana troca o lanche": chega na paciente na hora,
 * sem versão nova e sem refazer o documento.
 */
create or replace function definir_ajustes_protocolo(p_paciente uuid, p_ajustes text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista muda os ajustes.' using errcode = '42501';
  end if;

  update protocolos
  set ajustes = nullif(trim(coalesce(p_ajustes, '')), ''), atualizado_em = now()
  where paciente_id = p_paciente and situacao = 'publicado';

  if not found then
    raise exception 'Este paciente não tem protocolo publicado.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function definir_ajustes_protocolo(uuid, text) from anon, public;
grant execute on function definir_ajustes_protocolo(uuid, text) to authenticated;

/** Joga o rascunho fora. O que está publicado não se mexe. */
create or replace function descartar_rascunho_protocolo(p_paciente uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista descarta rascunho.' using errcode = '42501';
  end if;
  delete from protocolos where paciente_id = p_paciente and situacao = 'rascunho';
end;
$$;

revoke all on function descartar_rascunho_protocolo(uuid) from anon, public;
grant execute on function descartar_rascunho_protocolo(uuid) to authenticated;

/**
 * Traz uma versão antiga de volta como rascunho.
 *
 * Não republica sozinho: ela olha, mexe se quiser, e publica. Voltar uma
 * dieta para o ar sem ela conferir seria decidir no lugar dela.
 */
create or replace function restaurar_protocolo(p_protocolo uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antigo protocolos;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista restaura protocolo.' using errcode = '42501';
  end if;

  select * into v_antigo from protocolos where id = p_protocolo;
  if v_antigo.id is null then
    raise exception 'Versão não encontrada.' using errcode = 'P0002';
  end if;

  return salvar_rascunho_protocolo(
    v_antigo.paciente_id, v_antigo.titulo, v_antigo.conteudo, v_antigo.ajustes
  );
end;
$$;

revoke all on function restaurar_protocolo(uuid) from anon, public;
grant execute on function restaurar_protocolo(uuid) to authenticated;

/**
 * Quem tem protocolo, e em que pé está.
 *
 * A tela da nutricionista abre com a lista das pacientes; sem isto ela teria
 * de abrir uma por uma para lembrar quem ainda não recebeu dieta.
 */
create or replace function protocolos_das_pacientes()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê a lista.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'pacienteId', pa.id,
             'nome', pa.nome,
             'situacao', coalesce(
               (select p.situacao from protocolos p
                 where p.paciente_id = pa.id and p.situacao = 'publicado'), 'sem'),
             'temRascunho', exists (
               select 1 from protocolos p
                where p.paciente_id = pa.id and p.situacao = 'rascunho'),
             'publicadoEm', (select p.publicado_em from protocolos p
                              where p.paciente_id = pa.id and p.situacao = 'publicado')
           ) order by pa.nome)
    from pacientes pa
  ), '[]'::jsonb);
end;
$$;

revoke all on function protocolos_das_pacientes() from anon, public;
grant execute on function protocolos_das_pacientes() to authenticated;

-- -----------------------------------------------------------------------------
-- O app precisa saber, e numa chamada que ele já faz
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
    -- A nutricionista enxerga sempre, para conferir a tela da paciente.
    'protocolo', e_admin() or tenho_protocolo()
  );
$$;

grant execute on function meu_acesso() to authenticated;
