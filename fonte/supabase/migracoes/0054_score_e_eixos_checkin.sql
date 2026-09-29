-- =============================================================================
-- 0054 — Score ponderado por eixo no Check-in
--
-- O motor de pontuação já existia (peso, escala invertida, nota 0–100 em
-- `utils/pontuacaoQuestionario.ts`). Esta migração acrescenta o que faltava:
--
--   1. EIXOS: cada pergunta pertence a um eixo (intestino, sono, hidratação…).
--      Eixo é uma LISTA que a nutricionista cria uma vez e reusa — não texto
--      livre por pergunta, para "intestino" e "Intestino" não virarem dois.
--   2. PONTOS POR OPÇÃO: perguntas de múltipla escolha passam a pontuar, com
--      um valor de 0 a 10 por opção. Escala e sim/não continuam como estavam.
--   3. NOTA ESCONDIDA DA PACIENTE por padrão: `mostra_pontuacao` no
--      questionário, que a nutricionista liga quando quiser mostrar.
--   4. HISTÓRICO CONGELADO: ao responder, a régua vigente (peso, inversão,
--      eixo, pontos por opção) é fotografada no envio (`regua_snapshot`).
--      Mudar o peso de uma pergunta hoje NÃO reescreve a nota das semanas já
--      respondidas — a foto de cada envio manda. Envios antigos, de antes
--      desta migração, não têm foto: a tela cai na régua atual, como antes.
--
-- A CONTA CONTINUA EM TYPESCRIPT, num lugar só e testada. O banco guarda a
-- foto da régua e as respostas cruas; quem soma é `pontuacaoQuestionario.ts`.
-- Reimplementar a soma aqui em SQL seria uma segunda fonte da verdade, e a
-- semana em que as duas discordassem seria impossível de explicar.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Os eixos: a lista gerenciável
-- -----------------------------------------------------------------------------

create table if not exists checkin_eixos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ordem integer not null default 0,
  criado_em timestamptz not null default now()
);

comment on table checkin_eixos is
  'Os eixos do check-in (intestino, sono, hidratação…). Lista da nutricionista, reusada nas perguntas.';

alter table checkin_eixos enable row level security;
grant select, insert, update, delete on checkin_eixos to authenticated;

drop policy if exists eixos_admin on checkin_eixos;
create policy eixos_admin on checkin_eixos
  for all using (e_admin()) with check (e_admin());

-- -----------------------------------------------------------------------------
-- Colunas novas
-- -----------------------------------------------------------------------------

alter table questionario_perguntas
  add column if not exists eixo_id uuid references checkin_eixos(id) on delete set null,
  -- Pontos por opção, alinhado com `opcoes`: cada opção vale de 0 a 10.
  -- Só a pergunta 'escolha' usa. Vazio = a pergunta não pontua (como peso 0).
  add column if not exists pontos_opcoes jsonb not null default '[]'::jsonb;

alter table questionarios
  -- Nasce FALSE: a nota é da nutricionista até ela decidir mostrar.
  add column if not exists mostra_pontuacao boolean not null default false;

alter table questionario_envios
  -- A foto da régua no momento do envio. Null nos envios anteriores a esta
  -- migração — a tela usa a régua atual nesses, e a foto nos novos.
  add column if not exists regua_snapshot jsonb;

-- -----------------------------------------------------------------------------
-- Eixos: CRUD (a nutricionista gerencia a lista)
-- -----------------------------------------------------------------------------

create or replace function listar_eixos_checkin()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê os eixos.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', e.id, 'nome', e.nome, 'ordem', e.ordem)
                     order by e.ordem, e.nome)
    from checkin_eixos e
  ), '[]'::jsonb);
end;
$$;
revoke all on function listar_eixos_checkin() from anon, public;
grant execute on function listar_eixos_checkin() to authenticated;

/**
 * Salva a lista inteira de eixos de uma vez (a tela manda o conjunto).
 * Um eixo em uso por alguma pergunta não é apagado — apagá-lo desligaria o
 * eixo das perguntas (on delete set null) e a quebra por eixo do histórico
 * perderia o rótulo. Some da lista quem não tem pergunta atrás.
 */
create or replace function salvar_eixos_checkin(p_eixos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_eixo jsonb;
  v_ordem integer := 0;
  v_id uuid;
  v_ids uuid[] := array[]::uuid[];
begin
  if not e_admin() then
    raise exception 'Só a nutricionista mexe nos eixos.' using errcode = '42501';
  end if;

  for v_eixo in select * from jsonb_array_elements(coalesce(p_eixos, '[]'::jsonb))
  loop
    if coalesce(trim(v_eixo ->> 'nome'), '') = '' then
      continue;
    end if;
    v_ordem := v_ordem + 1;
    v_id := nullif(v_eixo ->> 'id', '')::uuid;
    if v_id is null then
      insert into checkin_eixos (nome, ordem)
      values (trim(v_eixo ->> 'nome'), v_ordem)
      returning id into v_id;
    else
      update checkin_eixos
         set nome = trim(v_eixo ->> 'nome'), ordem = v_ordem
       where id = v_id;
    end if;
    v_ids := v_ids || v_id;
  end loop;

  -- Apaga os que saíram da lista E não estão presos a nenhuma pergunta.
  delete from checkin_eixos e
   where not (e.id = any(v_ids))
     and not exists (select 1 from questionario_perguntas p where p.eixo_id = e.id);

  return listar_eixos_checkin();
end;
$$;
revoke all on function salvar_eixos_checkin(jsonb) from anon, public;
grant execute on function salvar_eixos_checkin(jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- salvar_questionario: agora aceita eixo, pontos por opção e mostra_pontuacao
-- -----------------------------------------------------------------------------

create or replace function salvar_questionario(
  p_id uuid,
  p_titulo text,
  p_descricao text,
  p_periodicidade text,
  p_ativo boolean,
  p_perguntas jsonb,
  p_mostra_pontuacao boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_pergunta jsonb;
  v_ordem integer := 0;
  v_ids uuid[] := array[]::uuid[];
  v_pid uuid;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista monta questionário.' using errcode = '42501';
  end if;
  if coalesce(trim(p_titulo), '') = '' then
    raise exception 'O questionário precisa de um título.' using errcode = '22023';
  end if;
  if coalesce(p_periodicidade, 'unica') not in ('unica', 'semanal') then
    raise exception 'Periodicidade inválida.' using errcode = '22023';
  end if;

  if p_id is null then
    insert into questionarios (titulo, descricao, periodicidade, ativo, mostra_pontuacao)
    values (trim(p_titulo), nullif(trim(p_descricao), ''),
            coalesce(p_periodicidade, 'unica'), coalesce(p_ativo, true),
            coalesce(p_mostra_pontuacao, false))
    returning id into v_id;
  else
    update questionarios
       set titulo = trim(p_titulo),
           descricao = nullif(trim(p_descricao), ''),
           periodicidade = coalesce(p_periodicidade, 'unica'),
           ativo = coalesce(p_ativo, true),
           mostra_pontuacao = coalesce(p_mostra_pontuacao, false)
     where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'Questionário não encontrado.' using errcode = '22023';
    end if;
  end if;

  for v_pergunta in select * from jsonb_array_elements(coalesce(p_perguntas, '[]'::jsonb))
  loop
    v_ordem := v_ordem + 1;
    v_pid := nullif(v_pergunta ->> 'id', '')::uuid;

    if v_pid is null then
      insert into questionario_perguntas
        (questionario_id, ordem, texto, tipo, obrigatoria, opcoes, peso, invertida,
         eixo_id, pontos_opcoes)
      values (
        v_id, v_ordem,
        coalesce(nullif(trim(v_pergunta ->> 'texto'), ''), 'Pergunta sem texto'),
        coalesce(nullif(v_pergunta ->> 'tipo', ''), 'escala'),
        coalesce((v_pergunta ->> 'obrigatoria')::boolean, true),
        coalesce(v_pergunta -> 'opcoes', '[]'::jsonb),
        coalesce((v_pergunta ->> 'peso')::numeric, 1),
        coalesce((v_pergunta ->> 'invertida')::boolean, false),
        nullif(v_pergunta ->> 'eixoId', '')::uuid,
        coalesce(v_pergunta -> 'pontosOpcoes', '[]'::jsonb))
      returning id into v_pid;
    else
      update questionario_perguntas
         set ordem = v_ordem,
             texto = coalesce(nullif(trim(v_pergunta ->> 'texto'), ''), texto),
             tipo = coalesce(nullif(v_pergunta ->> 'tipo', ''), tipo),
             obrigatoria = coalesce((v_pergunta ->> 'obrigatoria')::boolean, obrigatoria),
             opcoes = coalesce(v_pergunta -> 'opcoes', opcoes),
             peso = coalesce((v_pergunta ->> 'peso')::numeric, peso),
             invertida = coalesce((v_pergunta ->> 'invertida')::boolean, invertida),
             eixo_id = nullif(v_pergunta ->> 'eixoId', '')::uuid,
             pontos_opcoes = coalesce(v_pergunta -> 'pontosOpcoes', pontos_opcoes)
       where id = v_pid and questionario_id = v_id;
    end if;

    v_ids := v_ids || v_pid;
  end loop;

  delete from questionario_perguntas q
   where q.questionario_id = v_id
     and not (q.id = any(v_ids))
     and not exists (select 1 from questionario_respostas r where r.pergunta_id = q.id);

  return v_id;
end;
$$;

revoke all on function salvar_questionario(uuid, text, text, text, boolean, jsonb, boolean) from anon, public;
grant execute on function salvar_questionario(uuid, text, text, text, boolean, jsonb, boolean) to authenticated;
-- A assinatura antiga (sem mostra_pontuacao) sai de cena para não haver duas.
drop function if exists salvar_questionario(uuid, text, text, text, boolean, jsonb);

-- -----------------------------------------------------------------------------
-- listar_questionarios: devolve eixo, pontos por opção e mostra_pontuacao
-- -----------------------------------------------------------------------------

create or replace function listar_questionarios()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê os questionários.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', q.id, 'titulo', q.titulo, 'descricao', q.descricao,
      'periodicidade', q.periodicidade, 'ativo', q.ativo, 'criadoEm', q.criado_em,
      'mostraPontuacao', q.mostra_pontuacao,
      'pacientes', (select count(*) from questionario_pacientes a where a.questionario_id = q.id),
      'respostas', (select count(*) from questionario_envios e where e.questionario_id = q.id),
      'perguntas', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', p.id, 'texto', p.texto, 'tipo', p.tipo,
          'obrigatoria', p.obrigatoria, 'opcoes', p.opcoes,
          'peso', p.peso, 'invertida', p.invertida,
          'eixoId', p.eixo_id, 'pontosOpcoes', p.pontos_opcoes,
          'respondida', exists (
            select 1 from questionario_respostas r where r.pergunta_id = p.id))
        order by p.ordem)
        from questionario_perguntas p where p.questionario_id = q.id
      ), '[]'::jsonb))
    order by q.criado_em desc)
    from questionarios q
  ), '[]'::jsonb);
end;
$$;
revoke all on function listar_questionarios() from anon, public;
grant execute on function listar_questionarios() to authenticated;

-- -----------------------------------------------------------------------------
-- responder_questionario: fotografa a régua no envio
-- -----------------------------------------------------------------------------

create or replace function responder_questionario(p_questionario uuid, p_respostas jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
  v_periodicidade text;
  v_periodo date;
  v_envio uuid;
  v_resposta jsonb;
  v_pergunta questionario_perguntas;
  v_numero numeric;
  v_texto text;
  v_snapshot jsonb;
begin
  if not tem_acesso() then
    raise exception 'Seu acesso não está liberado.' using errcode = '42501';
  end if;

  v_paciente := meu_paciente_id();
  if v_paciente is null then
    raise exception 'Não encontrei seu cadastro de paciente.' using errcode = '42501';
  end if;

  select q.periodicidade into v_periodicidade
    from questionarios q
    join questionario_pacientes a
      on a.questionario_id = q.id and a.paciente_id = v_paciente
   where q.id = p_questionario and q.ativo;

  if v_periodicidade is null then
    raise exception 'Este questionário não está disponível para você.' using errcode = '42501';
  end if;

  v_periodo := case when v_periodicidade = 'semanal' then semana_de(hoje_sp()) else hoje_sp() end;

  -- A foto da régua AGORA. Guarda o rótulo do eixo junto, para a quebra do
  -- histórico continuar legível mesmo se o eixo for renomeado ou apagado.
  select jsonb_agg(jsonb_build_object(
           'perguntaId', p.id, 'tipo', p.tipo, 'peso', p.peso,
           'invertida', p.invertida, 'opcoes', p.opcoes,
           'pontosOpcoes', p.pontos_opcoes,
           'eixoId', p.eixo_id, 'eixoNome', e.nome))
    into v_snapshot
    from questionario_perguntas p
    left join checkin_eixos e on e.id = p.eixo_id
   where p.questionario_id = p_questionario;

  insert into questionario_envios (questionario_id, paciente_id, periodo, regua_snapshot)
  values (p_questionario, v_paciente, v_periodo, coalesce(v_snapshot, '[]'::jsonb))
  on conflict (questionario_id, paciente_id, periodo)
    do update set respondido_em = now(),
                  -- Reenvio dentro da semana refotografa: a régua da resposta
                  -- é a de quando ela mandou pela última vez.
                  regua_snapshot = coalesce(v_snapshot, '[]'::jsonb)
  returning id into v_envio;

  for v_resposta in select * from jsonb_array_elements(coalesce(p_respostas, '[]'::jsonb))
  loop
    select * into v_pergunta from questionario_perguntas
     where id = nullif(v_resposta ->> 'perguntaId', '')::uuid
       and questionario_id = p_questionario;

    continue when v_pergunta.id is null;

    v_numero := nullif(v_resposta ->> 'numero', '')::numeric;
    v_texto := nullif(trim(v_resposta ->> 'texto'), '');

    if v_pergunta.tipo = 'escala' and v_numero is not null then
      v_numero := least(greatest(v_numero, 0), 10);
    end if;
    if v_pergunta.tipo = 'sim_nao' and v_numero is not null then
      v_numero := case when v_numero > 0 then 1 else 0 end;
    end if;

    insert into questionario_respostas (envio_id, pergunta_id, valor_numero, valor_texto)
    values (v_envio, v_pergunta.id, v_numero, v_texto)
    on conflict (envio_id, pergunta_id)
      do update set valor_numero = excluded.valor_numero,
                    valor_texto = excluded.valor_texto;
  end loop;

  return v_envio;
end;
$$;
grant execute on function responder_questionario(uuid, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- Reaplicar a régua atual aos envios de uma paciente (a saída de emergência)
-- -----------------------------------------------------------------------------
--
-- O padrão é congelar. Mas às vezes ela ajusta a régua NO MEIO de um
-- acompanhamento e quer que valha para trás também, só para aquela paciente.
-- Isto refotografa os envios dela daquele questionário com a régua de hoje.

create or replace function reaplicar_regua(p_questionario uuid, p_paciente uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_snapshot jsonb;
  v_n integer;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista reaplica a régua.' using errcode = '42501';
  end if;

  select jsonb_agg(jsonb_build_object(
           'perguntaId', p.id, 'tipo', p.tipo, 'peso', p.peso,
           'invertida', p.invertida, 'opcoes', p.opcoes,
           'pontosOpcoes', p.pontos_opcoes,
           'eixoId', p.eixo_id, 'eixoNome', e.nome))
    into v_snapshot
    from questionario_perguntas p
    left join checkin_eixos e on e.id = p.eixo_id
   where p.questionario_id = p_questionario;

  update questionario_envios
     set regua_snapshot = coalesce(v_snapshot, '[]'::jsonb)
   where questionario_id = p_questionario and paciente_id = p_paciente;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke all on function reaplicar_regua(uuid, uuid) from anon, public;
grant execute on function reaplicar_regua(uuid, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- questionarios_do_paciente: devolve a foto da régua e o mostra_pontuacao
-- -----------------------------------------------------------------------------

create or replace function questionarios_do_paciente(p_paciente uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê as respostas.' using errcode = '42501';
  end if;
  if not exists (select 1 from pacientes where id = p_paciente) then
    raise exception 'Paciente não encontrada.' using errcode = '22023';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', q.id, 'titulo', q.titulo, 'periodicidade', q.periodicidade,
      'ativo', q.ativo, 'mostraPontuacao', q.mostra_pontuacao,
      'atribuido', exists (
        select 1 from questionario_pacientes a
         where a.questionario_id = q.id and a.paciente_id = p_paciente),
      'perguntas', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', p.id, 'texto', p.texto, 'tipo', p.tipo,
          'peso', p.peso, 'invertida', p.invertida, 'opcoes', p.opcoes,
          'eixoId', p.eixo_id, 'pontosOpcoes', p.pontos_opcoes)
        order by p.ordem)
        from questionario_perguntas p where p.questionario_id = q.id
      ), '[]'::jsonb),
      'envios', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', e.id, 'periodo', e.periodo, 'respondidoEm', e.respondido_em,
          'revisado', e.revisado_em is not null,
          'reguaSnapshot', e.regua_snapshot,
          'respostas', coalesce((
            select jsonb_agg(jsonb_build_object(
              'perguntaId', r.pergunta_id,
              'numero', r.valor_numero, 'texto', r.valor_texto))
            from questionario_respostas r where r.envio_id = e.id
          ), '[]'::jsonb))
        order by e.periodo desc)
        from questionario_envios e
        where e.questionario_id = q.id and e.paciente_id = p_paciente
      ), '[]'::jsonb))
    order by q.periodicidade, q.titulo)
    from questionarios q
    where exists (
        select 1 from questionario_pacientes a
         where a.questionario_id = q.id and a.paciente_id = p_paciente)
       or exists (
        select 1 from questionario_envios e
         where e.questionario_id = q.id and e.paciente_id = p_paciente)
  ), '[]'::jsonb);
end;
$$;
revoke all on function questionarios_do_paciente(uuid) from anon, public;
grant execute on function questionarios_do_paciente(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- meus_questionarios: a paciente vê a nota SÓ quando mostra_pontuacao é true
-- -----------------------------------------------------------------------------

create or replace function meus_questionarios()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
  v_semana date;
begin
  v_paciente := meu_paciente_id();
  if v_paciente is null or not tem_acesso() then
    return '[]'::jsonb;
  end if;

  v_semana := semana_de(hoje_sp());

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', q.id, 'titulo', q.titulo, 'descricao', q.descricao,
      'periodicidade', q.periodicidade,
      'mostraPontuacao', q.mostra_pontuacao,
      'periodo', case when q.periodicidade = 'semanal' then v_semana else hoje_sp() end,
      'pendente', not exists (
        select 1 from questionario_envios e
         where e.questionario_id = q.id and e.paciente_id = v_paciente
           and (q.periodicidade <> 'semanal' or e.periodo = v_semana)),
      'perguntas', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', p.id, 'texto', p.texto, 'tipo', p.tipo,
          'obrigatoria', p.obrigatoria, 'opcoes', p.opcoes,
          -- Régua (peso/inversão/pontos/eixo) só sai quando a nota é
          -- mostrada para ela; senão continua invisível, como antes.
          'peso', case when q.mostra_pontuacao then p.peso else null end,
          'invertida', case when q.mostra_pontuacao then p.invertida else null end,
          'pontosOpcoes', case when q.mostra_pontuacao then p.pontos_opcoes else '[]'::jsonb end,
          'eixoId', case when q.mostra_pontuacao then p.eixo_id else null end)
        order by p.ordem)
        from questionario_perguntas p where p.questionario_id = q.id
      ), '[]'::jsonb),
      'enviados', coalesce((
        select jsonb_agg(jsonb_build_object(
          'periodo', e.periodo, 'respondidoEm', e.respondido_em,
          'reguaSnapshot', case when q.mostra_pontuacao then e.regua_snapshot else null end,
          'respostas', coalesce((
            select jsonb_agg(jsonb_build_object(
              'perguntaId', r.pergunta_id,
              'numero', r.valor_numero, 'texto', r.valor_texto))
            from questionario_respostas r where r.envio_id = e.id
          ), '[]'::jsonb))
        order by e.periodo desc)
        from questionario_envios e
        where e.questionario_id = q.id and e.paciente_id = v_paciente
      ), '[]'::jsonb))
    order by q.periodicidade, q.titulo)
    from questionarios q
    join questionario_pacientes a
      on a.questionario_id = q.id and a.paciente_id = v_paciente
    where q.ativo
  ), '[]'::jsonb);
end;
$$;
grant execute on function meus_questionarios() to authenticated;
