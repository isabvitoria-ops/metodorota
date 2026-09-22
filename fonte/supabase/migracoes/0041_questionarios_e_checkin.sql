-- =============================================================================
-- CENTRAL DO PACIENTE — 0041: questionários e check-in semanal
--
-- UM MOTOR SÓ PARA AS DUAS COISAS, e vale explicar por quê.
--
-- Ela pediu "questionários" e "check-in semanal" como dois módulos. Mas um
-- check-in semanal É um questionário — o que muda é só a periodicidade e o
-- fato de que ele volta toda semana. Construir os dois separados daria duas
-- telas de montar pergunta, duas de responder, duas de ler resposta, e um
-- dia elas discordariam sobre o que é uma escala de 0 a 10.
--
-- Então: um questionário tem `periodicidade`. 'unica' é o questionário de
-- anamnese que ela manda uma vez; 'semanal' é o check-in.
--
-- NÃO HÁ AGENDADOR, E ISSO É DE PROPÓSITO
--
-- O plano do Supabase dela não tem `pg_cron`. Em vez de inventar uma tarefa
-- agendada que não existe, o pendente é CALCULADO: "esta semana está em
-- aberto" é simplesmente "não há resposta gravada para a semana de hoje".
-- Nada precisa rodar de madrugada, nada pode falhar em silêncio, e se ela
-- atribuir um check-in hoje ele já aparece hoje.
--
-- O preço é que não existe histórico de "semana que ela não respondeu" como
-- linha gravada. Mas isso também não é perda: a ausência se vê contando as
-- semanas entre o início e hoje, e uma linha "não respondeu" gravada toda
-- segunda seria lixo acumulando para dizer a mesma coisa.
--
-- A RESPOSTA NÃO É EDITÁVEL DEPOIS DE ENVIADA — dentro da semana ela pode
-- reenviar (o `on conflict` atualiza), mas semana passada fecha. Check-in é
-- foto do momento; deixar reescrever o retrospecto transformaria a série
-- temporal em outra coisa.
-- =============================================================================

create table if not exists questionarios (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  -- 'unica': ela manda e a paciente responde uma vez (anamnese, hábitos).
  -- 'semanal': volta toda segunda-feira (o check-in).
  periodicidade text not null default 'unica'
    check (periodicidade in ('unica', 'semanal')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

comment on table questionarios is
  'Questionário ou check-in. A periodicidade é a única diferença entre os dois.';

create table if not exists questionario_perguntas (
  id uuid primary key default gen_random_uuid(),
  questionario_id uuid not null references questionarios(id) on delete cascade,
  ordem integer not null default 0,
  texto text not null,
  -- 'escala': 0 a 10, que é o que entra na pontuação.
  -- 'sim_nao', 'numero', 'texto', 'escolha' (com `opcoes`).
  tipo text not null default 'escala'
    check (tipo in ('escala', 'sim_nao', 'numero', 'texto', 'escolha')),
  obrigatoria boolean not null default true,
  opcoes jsonb not null default '[]'::jsonb,
  -- O peso da pergunta na pontuação da semana. Zero tira da conta sem tirar
  -- da tela: "como foi a semana, em uma frase" é importante e não é nota.
  peso numeric not null default 1 check (peso >= 0),
  -- Escala invertida: em "quanta dor você sentiu", 10 é RUIM. Sem isto, a
  -- pontuação somaria dor como se fosse bem-estar — e o número subiria
  -- justamente na semana pior.
  invertida boolean not null default false
);

create index if not exists perguntas_por_questionario
  on questionario_perguntas (questionario_id, ordem);

/** Quem responde o quê. */
create table if not exists questionario_pacientes (
  questionario_id uuid not null references questionarios(id) on delete cascade,
  paciente_id uuid not null references pacientes(id) on delete cascade,
  atribuido_em timestamptz not null default now(),
  primary key (questionario_id, paciente_id)
);

/**
 * Uma resposta enviada.
 *
 * `periodo` é a segunda-feira da semana, para o check-in; para o de
 * periodicidade única é a data do envio. A chave única em
 * (questionario, paciente, periodo) é o que impede duas respostas para a
 * mesma semana e o que faz o reenvio dentro da semana virar atualização.
 */
create table if not exists questionario_envios (
  id uuid primary key default gen_random_uuid(),
  questionario_id uuid not null references questionarios(id) on delete cascade,
  paciente_id uuid not null references pacientes(id) on delete cascade,
  periodo date not null,
  respondido_em timestamptz not null default now(),
  unique (questionario_id, paciente_id, periodo)
);

create index if not exists envios_por_paciente
  on questionario_envios (paciente_id, periodo desc);

create table if not exists questionario_respostas (
  id uuid primary key default gen_random_uuid(),
  envio_id uuid not null references questionario_envios(id) on delete cascade,
  pergunta_id uuid not null references questionario_perguntas(id) on delete cascade,
  -- Guardados separados em vez de um `text` para tudo: a escala precisa
  -- somar, e somar texto exigiria converter na leitura, toda vez, torcendo
  -- para ninguém ter digitado "oito".
  valor_numero numeric,
  valor_texto text,
  unique (envio_id, pergunta_id)
);

alter table questionarios enable row level security;
alter table questionario_perguntas enable row level security;
alter table questionario_pacientes enable row level security;
alter table questionario_envios enable row level security;
alter table questionario_respostas enable row level security;

-- As politicas decidem QUAIS linhas; o grant decide se a tabela e alcancavel.
-- Sem esta linha, a politica de admin existiria e a nutricionista ainda
-- levaria "permission denied" -- os dois sao necessarios.
grant select, insert, update, delete on
  questionarios, questionario_perguntas, questionario_pacientes,
  questionario_envios, questionario_respostas
  to authenticated;

-- A nutricionista manda em tudo.
drop policy if exists questionarios_admin on questionarios;
create policy questionarios_admin on questionarios
  for all using (e_admin()) with check (e_admin());

drop policy if exists perguntas_admin on questionario_perguntas;
create policy perguntas_admin on questionario_perguntas
  for all using (e_admin()) with check (e_admin());

drop policy if exists atribuicoes_admin on questionario_pacientes;
create policy atribuicoes_admin on questionario_pacientes
  for all using (e_admin()) with check (e_admin());

drop policy if exists envios_admin on questionario_envios;
create policy envios_admin on questionario_envios
  for all using (e_admin()) with check (e_admin());

drop policy if exists respostas_admin on questionario_respostas;
create policy respostas_admin on questionario_respostas
  for all using (e_admin()) with check (e_admin());

-- A paciente NÃO tem política nenhuma nestas tabelas, e é de propósito: ela
-- lê e escreve pelas funções abaixo. Dar `select` na tabela `questionarios`
-- mostraria os questionários que não são dela, e em `envios` mostraria os
-- das outras pacientes se alguém errasse uma cláusula.

/** A segunda-feira da semana de uma data. */
create or replace function semana_de(p_dia date)
returns date
language sql
immutable
as $$
  select (date_trunc('week', p_dia::timestamp))::date;
$$;

grant execute on function semana_de(date) to authenticated;

-- -----------------------------------------------------------------------------
-- O lado da nutricionista
-- -----------------------------------------------------------------------------

/**
 * Cria ou atualiza um questionário inteiro, com as perguntas.
 *
 * As perguntas vêm como lista e são regravadas por completo: é o mesmo
 * padrão do protocolo, e evita a tela ter que dizer "esta pergunta é nova,
 * esta mudou, esta some".
 *
 * QUEM JÁ RESPONDEU NÃO PERDE A RESPOSTA. As respostas apontam para a
 * pergunta; apagar a pergunta apagaria a resposta em cascata. Então a
 * regravação só apaga as perguntas que NINGUÉM respondeu — as demais são
 * atualizadas no lugar. Sem isso, corrigir uma vírgula no enunciado
 * destruiria o histórico de check-in de todas as pacientes, em silêncio.
 */
create or replace function salvar_questionario(
  p_id uuid,
  p_titulo text,
  p_descricao text,
  p_periodicidade text,
  p_ativo boolean,
  p_perguntas jsonb
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
    insert into questionarios (titulo, descricao, periodicidade, ativo)
    values (trim(p_titulo), nullif(trim(p_descricao), ''),
            coalesce(p_periodicidade, 'unica'), coalesce(p_ativo, true))
    returning id into v_id;
  else
    update questionarios
       set titulo = trim(p_titulo),
           descricao = nullif(trim(p_descricao), ''),
           periodicidade = coalesce(p_periodicidade, 'unica'),
           ativo = coalesce(p_ativo, true)
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
        (questionario_id, ordem, texto, tipo, obrigatoria, opcoes, peso, invertida)
      values (
        v_id, v_ordem,
        coalesce(nullif(trim(v_pergunta ->> 'texto'), ''), 'Pergunta sem texto'),
        coalesce(nullif(v_pergunta ->> 'tipo', ''), 'escala'),
        coalesce((v_pergunta ->> 'obrigatoria')::boolean, true),
        coalesce(v_pergunta -> 'opcoes', '[]'::jsonb),
        coalesce((v_pergunta ->> 'peso')::numeric, 1),
        coalesce((v_pergunta ->> 'invertida')::boolean, false))
      returning id into v_pid;
    else
      update questionario_perguntas
         set ordem = v_ordem,
             texto = coalesce(nullif(trim(v_pergunta ->> 'texto'), ''), texto),
             tipo = coalesce(nullif(v_pergunta ->> 'tipo', ''), tipo),
             obrigatoria = coalesce((v_pergunta ->> 'obrigatoria')::boolean, obrigatoria),
             opcoes = coalesce(v_pergunta -> 'opcoes', opcoes),
             peso = coalesce((v_pergunta ->> 'peso')::numeric, peso),
             invertida = coalesce((v_pergunta ->> 'invertida')::boolean, invertida)
       where id = v_pid and questionario_id = v_id;
    end if;

    v_ids := v_ids || v_pid;
  end loop;

  -- As que saíram da lista. Só apaga quem ninguém respondeu: apagar uma
  -- pergunta respondida levaria a resposta junto, em cascata e sem aviso.
  delete from questionario_perguntas q
   where q.questionario_id = v_id
     and not (q.id = any(v_ids))
     and not exists (select 1 from questionario_respostas r where r.pergunta_id = q.id);

  return v_id;
end;
$$;

revoke all on function salvar_questionario(uuid, text, text, text, boolean, jsonb) from anon, public;
grant execute on function salvar_questionario(uuid, text, text, text, boolean, jsonb) to authenticated;

/** A lista dela, com as perguntas e quantas pacientes respondem cada um. */
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
      'pacientes', (select count(*) from questionario_pacientes a where a.questionario_id = q.id),
      'respostas', (select count(*) from questionario_envios e where e.questionario_id = q.id),
      'perguntas', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', p.id, 'texto', p.texto, 'tipo', p.tipo,
          'obrigatoria', p.obrigatoria, 'opcoes', p.opcoes,
          'peso', p.peso, 'invertida', p.invertida,
          -- A tela precisa saber se apagar esta pergunta ainda é possível.
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

/** Liga ou desliga um questionário para uma paciente. */
create or replace function definir_questionario_do_paciente(
  p_questionario uuid, p_paciente uuid, p_ativo boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista atribui questionário.' using errcode = '42501';
  end if;
  if not exists (select 1 from pacientes where id = p_paciente) then
    raise exception 'Paciente não encontrada.' using errcode = '22023';
  end if;
  if not exists (select 1 from questionarios where id = p_questionario) then
    raise exception 'Questionário não encontrado.' using errcode = '22023';
  end if;

  if coalesce(p_ativo, false) then
    insert into questionario_pacientes (questionario_id, paciente_id)
    values (p_questionario, p_paciente)
    on conflict do nothing;
  else
    -- Tira da lista dela, mas NÃO apaga o que já respondeu: o histórico de
    -- check-in é dado clínico, e desatribuir é "pare de perguntar", não
    -- "esqueça o que ela disse".
    delete from questionario_pacientes
     where questionario_id = p_questionario and paciente_id = p_paciente;
  end if;

  return exists (
    select 1 from questionario_pacientes
     where questionario_id = p_questionario and paciente_id = p_paciente);
end;
$$;

revoke all on function definir_questionario_do_paciente(uuid, uuid, boolean) from anon, public;
grant execute on function definir_questionario_do_paciente(uuid, uuid, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- O lado da paciente
-- -----------------------------------------------------------------------------

/**
 * O que está em aberto para ela agora, e o que já respondeu.
 *
 * O PENDENTE É CALCULADO, não agendado (ver o cabeçalho). Para o semanal,
 * está em aberto quando não há envio para a segunda-feira desta semana; para
 * o de vez única, quando não há envio nenhum.
 */
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
      'periodo', case when q.periodicidade = 'semanal' then v_semana else hoje_sp() end,
      -- Em aberto AGORA.
      'pendente', not exists (
        select 1 from questionario_envios e
         where e.questionario_id = q.id and e.paciente_id = v_paciente
           and (q.periodicidade <> 'semanal' or e.periodo = v_semana)),
      'perguntas', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', p.id, 'texto', p.texto, 'tipo', p.tipo,
          'obrigatoria', p.obrigatoria, 'opcoes', p.opcoes)
        order by p.ordem)
        from questionario_perguntas p where p.questionario_id = q.id
      ), '[]'::jsonb),
      -- O que ela já enviou, para ela reler o que respondeu na semana.
      -- `peso` e `invertida` NÃO saem daqui: são a régua com que a
      -- nutricionista pontua, e mostrar isso viraria "esta pergunta vale
      -- mais", o que muda a resposta.
      'enviados', coalesce((
        select jsonb_agg(jsonb_build_object(
          'periodo', e.periodo, 'respondidoEm', e.respondido_em,
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

/**
 * A paciente responde.
 *
 * `p_respostas` é uma lista de {perguntaId, numero, texto}.
 *
 * O PERÍODO NÃO VEM DA TELA. Ele é calculado aqui a partir de hoje —
 * nenhum id ou data enviada pelo navegador é consultada para decidir a que
 * semana a resposta pertence. Aceitar o período da tela deixaria reescrever
 * semana passada mudando um campo escondido, e a série temporal do check-in
 * deixaria de valer.
 */
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

  insert into questionario_envios (questionario_id, paciente_id, periodo)
  values (p_questionario, v_paciente, v_periodo)
  on conflict (questionario_id, paciente_id, periodo)
    do update set respondido_em = now()
  returning id into v_envio;

  for v_resposta in select * from jsonb_array_elements(coalesce(p_respostas, '[]'::jsonb))
  loop
    select * into v_pergunta from questionario_perguntas
     where id = nullif(v_resposta ->> 'perguntaId', '')::uuid
       and questionario_id = p_questionario;

    -- Pergunta de outro questionário, ou que já não existe: ignorada em
    -- silêncio. Recusar o envio inteiro faria a paciente perder tudo que
    -- escreveu porque a nutricionista mexeu no formulário enquanto isso.
    continue when v_pergunta.id is null;

    v_numero := nullif(v_resposta ->> 'numero', '')::numeric;
    v_texto := nullif(trim(v_resposta ->> 'texto'), '');

    -- A escala é presa entre 0 e 10 AQUI, e não só no controle da tela:
    -- um 9999 entrando por fora estouraria a pontuação da semana.
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

/**
 * As respostas de uma paciente, para a nutricionista ler no prontuário.
 *
 * Devolve os valores CRUS, com peso e inversão de cada pergunta junto. A
 * pontuação da semana é contada na tela, pelo mesmo código em TypeScript
 * que já é testado — e não aqui, espalhada entre o banco e o navegador.
 */
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
      'ativo', q.ativo,
      'atribuido', exists (
        select 1 from questionario_pacientes a
         where a.questionario_id = q.id and a.paciente_id = p_paciente),
      'perguntas', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', p.id, 'texto', p.texto, 'tipo', p.tipo,
          'peso', p.peso, 'invertida', p.invertida, 'opcoes', p.opcoes)
        order by p.ordem)
        from questionario_perguntas p where p.questionario_id = q.id
      ), '[]'::jsonb),
      'envios', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', e.id, 'periodo', e.periodo, 'respondidoEm', e.respondido_em,
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
