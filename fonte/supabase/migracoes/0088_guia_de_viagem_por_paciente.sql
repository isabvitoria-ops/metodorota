-- =============================================================================
-- 0088 — Rota Viagem: o guia vira dado, um por paciente
--
-- Na 0086 o interruptor era por paciente, mas o TEXTO do guia morava no código
-- da tela: só existia um guia, e ele ia junto no arquivo que qualquer visitante
-- baixa. Aqui o guia inteiro passa a ser um documento gravado por paciente,
-- que a nutricionista monta, copia de outra paciente e edita na ficha.
--
-- Três decisões:
--   * A paciente não lê a tabela: só `meu_guia_viagem()`, que confere o
--     interruptor. Desligou, o guia some — sem depender de política de leitura.
--   * A ficha de saúde (nome completo, nascimento, diagnóstico) continua em
--     `pacientes.viagem_ficha`, fora do guia: copiar o guia de uma paciente
--     para outra nunca leva a identidade junto.
--   * Não se libera guia que não existe: a porta abriria para uma tela vazia.
--
-- O conteúdo de cada paciente é gravado pelo app, nunca por migração.
-- =============================================================================

create table if not exists guias_viagem (
  paciente_id   uuid primary key references pacientes(id) on delete cascade,
  conteudo      jsonb not null check (jsonb_typeof(conteudo) = 'object'),
  atualizado_em timestamptz not null default now()
);

alter table guias_viagem enable row level security;

drop policy if exists guias_viagem_admin on guias_viagem;
create policy guias_viagem_admin on guias_viagem
  for all using (e_admin()) with check (e_admin());

-- -----------------------------------------------------------------------------
-- Paciente: o meu guia (e a minha ficha), só com o interruptor ligado
-- -----------------------------------------------------------------------------
create or replace function meu_guia_viagem()
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object('conteudo', g.conteudo, 'ficha', p.viagem_ficha)
    from pacientes p
    join guias_viagem g on g.paciente_id = p.id
   where p.perfil_id = auth.uid()
     and p.viagem_liberado;
$$;

revoke all on function meu_guia_viagem() from anon, public;
grant execute on function meu_guia_viagem() to authenticated;

-- -----------------------------------------------------------------------------
-- Nutricionista: ver, salvar, ligar e listar para copiar
-- -----------------------------------------------------------------------------
-- A visão da ficha (0087) passa a trazer também o guia.
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
      'conteudo', g.conteudo,
      'guiaAtualizadoEm', g.atualizado_em,
      'ficha', p.viagem_ficha,
      'diario', viagem_diario_json(p.id)
    )
      from pacientes p
      left join guias_viagem g on g.paciente_id = p.id
     where p.id = p_paciente
  );
end;
$$;

revoke all on function viagem_do_paciente(uuid) from anon, public;
grant execute on function viagem_do_paciente(uuid) to authenticated;

create or replace function salvar_guia_viagem(p_paciente uuid, p_conteudo jsonb, p_ficha jsonb)
returns timestamptz
language plpgsql security definer
set search_path = public
as $$
declare
  v_quando timestamptz := now();
begin
  if not e_admin() then
    raise exception 'Só a nutricionista salva o guia de viagem.' using errcode = '42501';
  end if;
  if not exists (select 1 from pacientes where id = p_paciente) then
    raise exception 'Paciente não encontrada.' using errcode = '22023';
  end if;
  if p_conteudo is null or jsonb_typeof(p_conteudo) <> 'object'
     or jsonb_typeof(p_conteudo -> 'secoes') is distinct from 'array' then
    raise exception 'O guia veio vazio ou em formato inválido.' using errcode = '22023';
  end if;

  insert into guias_viagem (paciente_id, conteudo, atualizado_em)
  values (p_paciente, p_conteudo, v_quando)
  on conflict (paciente_id)
  do update set conteudo = excluded.conteudo, atualizado_em = excluded.atualizado_em;

  -- Ficha vazia ou ausente grava nulo, e não um objeto de campos em branco.
  update pacientes
     set viagem_ficha = case
           when p_ficha is null or jsonb_typeof(p_ficha) <> 'object' then null
           when coalesce(p_ficha ->> 'nome', '') = ''
            and coalesce(p_ficha ->> 'nascimento', '') = ''
            and coalesce(p_ficha ->> 'diagnosticos', '') = '' then null
           else jsonb_build_object(
             'nome', p_ficha ->> 'nome',
             'nascimento', p_ficha ->> 'nascimento',
             'diagnosticos', p_ficha ->> 'diagnosticos')
         end
   where id = p_paciente;

  return v_quando;
end;
$$;

revoke all on function salvar_guia_viagem(uuid, jsonb, jsonb) from anon, public;
grant execute on function salvar_guia_viagem(uuid, jsonb, jsonb) to authenticated;

create or replace function definir_viagem_do_paciente(p_paciente uuid, p_ativo boolean)
returns boolean
language plpgsql security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista libera o Rota Viagem.' using errcode = '42501';
  end if;
  if not exists (select 1 from pacientes where id = p_paciente) then
    raise exception 'Paciente não encontrada.' using errcode = '22023';
  end if;
  if coalesce(p_ativo, false)
     and not exists (select 1 from guias_viagem where paciente_id = p_paciente) then
    raise exception 'Monte e salve o guia antes de liberar.' using errcode = '22023';
  end if;

  update pacientes set viagem_liberado = coalesce(p_ativo, false) where id = p_paciente;

  return (select viagem_liberado from pacientes where id = p_paciente);
end;
$$;

revoke all on function definir_viagem_do_paciente(uuid, boolean) from anon, public;
grant execute on function definir_viagem_do_paciente(uuid, boolean) to authenticated;

-- Quem já tem guia, para servir de ponto de partida. Só o cabeçalho: o
-- conteúdo é buscado depois, do guia escolhido.
create or replace function guias_viagem_para_copiar()
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê os guias de viagem.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'pacienteId', p.id,
             'nome', p.nome,
             'destinos', coalesce(g.conteudo ->> 'destinos', ''),
             'periodo', coalesce(g.conteudo ->> 'periodo', '')
           ) order by g.atualizado_em desc)
      from guias_viagem g
      join pacientes p on p.id = g.paciente_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function guias_viagem_para_copiar() from anon, public;
grant execute on function guias_viagem_para_copiar() to authenticated;
