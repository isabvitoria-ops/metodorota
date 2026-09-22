-- =============================================================================
-- CENTRAL DO PACIENTE — 0035: consultas e o panorama das pacientes
--
-- "Criar uma tela profissional com todos os pacientes: nome, status, última
-- consulta, próximo retorno, adesão, metas em andamento." E, no prontuário,
-- "histórico de consultas" numa linha do tempo.
--
-- É a base de três telas da lista dela — a lista de pacientes (item 2), o
-- prontuário (item 3) e o dashboard (item 1) — e por isso vem antes deles.
--
-- O QUE FALTAVA NO BANCO ERA A CONSULTA
--
-- O resto já existe e só precisava ser reunido: `pacientes` tem a situação,
-- `avaliacoes_fisicas` tem o peso, `metas` tem o que foi combinado,
-- `meta_registros`, `treino_sessoes`, `cardio_sessoes` e
-- `reintroducao_registros` têm o que ela anda fazendo. O que não existia em
-- lugar nenhum era "quando foi a última consulta e quando é o próximo
-- retorno" — sem isso, "retorno amanhã" e "retorno hoje" não têm de onde sair.
--
-- AS ANOTAÇÕES DA CONSULTA NÃO SÃO DA PACIENTE
--
-- `observacoes` é anotação clínica: é onde ela escreve o que pensou, não o
-- que combinou. A paciente NÃO tem política de leitura nesta tabela — nem
-- para as próprias linhas. O que ela vê é o que `minhas_consultas()`
-- devolve, e essa função não devolve nem `observacoes` nem `resumo`.
--
-- Restringir por COLUNA não é coisa que a RLS faça bem; restringir por
-- FUNÇÃO é. Uma política de leitura "só as suas" entregaria a anotação
-- clínica inteira para quem abrisse o console do navegador.
--
-- A ADESÃO NÃO É CALCULADA AQUI
--
-- O panorama devolve as metas com os registros crus, e quem conta é
-- `utils/progressoMetas.ts` — o mesmo código, com teste, que a paciente vê
-- na tela dela. Somar aqui também criaria duas contas para o mesmo número,
-- e o dia em que discordassem a lista dela diria uma coisa e a tela da
-- paciente outra.
-- =============================================================================

create table if not exists consultas (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes (id) on delete cascade,

  data date not null,
  /** Nulo quando ela só marcou o dia. Nulo não é meia-noite. */
  hora time,

  tipo text not null default 'retorno',
  status text not null default 'agendada',

  /** Uma linha do que aconteceu. É o que aparece na linha do tempo. */
  resumo text,
  /** Anotação clínica. NUNCA sai para a paciente. */
  observacoes text,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  constraint consulta_tipo_conhecido check (tipo in ('primeira', 'retorno')),
  constraint consulta_status_conhecido
    check (status in ('agendada', 'concluida', 'faltou', 'cancelada'))
);

create index if not exists consultas_por_paciente on consultas (paciente_id, data desc);
create index if not exists consultas_por_data on consultas (data, status);

alter table consultas enable row level security;

drop policy if exists consultas_nutri on consultas;
create policy consultas_nutri on consultas for all using (e_admin()) with check (e_admin());

-- Nenhuma política para a paciente, e é de propósito: ver a própria consulta
-- pela tabela traria `observacoes` junto. Ela lê por `minhas_consultas()`.

grant select, insert, update, delete on consultas to authenticated;
revoke all on table consultas from anon;

-- -----------------------------------------------------------------------------
-- Escrita — a profissional
-- -----------------------------------------------------------------------------

create or replace function salvar_consulta(
  p_id uuid,
  p_paciente uuid,
  p_data date,
  p_hora time,
  p_tipo text,
  p_status text,
  p_resumo text,
  p_observacoes text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_tipo text;
  v_status text;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista marca consulta.' using errcode = '42501';
  end if;
  if p_data is null then
    raise exception 'A consulta precisa de uma data.' using errcode = '22023';
  end if;

  -- Valor desconhecido vira o padrão em vez de derrubar a gravação: ela não
  -- pode perder a anotação inteira por causa do que a tela mandou errado.
  v_tipo := case when p_tipo in ('primeira', 'retorno') then p_tipo else 'retorno' end;
  v_status := case when p_status in ('agendada', 'concluida', 'faltou', 'cancelada')
                   then p_status else 'agendada' end;

  if p_id is null then
    if not exists (select 1 from pacientes where id = p_paciente) then
      raise exception 'Paciente não encontrada.' using errcode = 'P0002';
    end if;
    insert into consultas (paciente_id, data, hora, tipo, status, resumo, observacoes)
    values (p_paciente, p_data, p_hora, v_tipo, v_status,
            nullif(btrim(coalesce(p_resumo, '')), ''),
            nullif(btrim(coalesce(p_observacoes, '')), ''))
    returning id into v_id;
  else
    update consultas
    set data = p_data,
        hora = p_hora,
        tipo = v_tipo,
        status = v_status,
        resumo = nullif(btrim(coalesce(p_resumo, '')), ''),
        observacoes = nullif(btrim(coalesce(p_observacoes, '')), ''),
        atualizado_em = now()
    where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'Consulta não encontrada.' using errcode = 'P0002';
    end if;
  end if;

  return jsonb_build_object('id', v_id);
end;
$$;

revoke all on function salvar_consulta(uuid, uuid, date, time, text, text, text, text)
  from anon, public;
grant execute on function salvar_consulta(uuid, uuid, date, time, text, text, text, text)
  to authenticated;

create or replace function excluir_consulta(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista apaga consulta.' using errcode = '42501';
  end if;
  delete from consultas where id = p_id;
end;
$$;

revoke all on function excluir_consulta(uuid) from anon, public;
grant execute on function excluir_consulta(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Leitura
-- -----------------------------------------------------------------------------

/** As consultas de uma paciente, com as anotações. Só a profissional. */
create or replace function consultas_de(p_paciente uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê o histórico de consultas.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', c.id, 'data', c.data, 'hora', c.hora, 'tipo', c.tipo,
             'status', c.status, 'resumo', c.resumo, 'observacoes', c.observacoes)
           order by c.data desc, c.hora desc nulls last)
    from consultas c where c.paciente_id = p_paciente
  ), '[]'::jsonb);
end;
$$;

revoke all on function consultas_de(uuid) from anon, public;
grant execute on function consultas_de(uuid) to authenticated;

/**
 * As consultas da própria paciente — SEM as anotações clínicas.
 *
 * Ela vê quando foi e quando é a próxima. O que a profissional escreveu
 * pensando em voz alta continua sendo da profissional.
 */
create or replace function minhas_consultas()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
begin
  v_paciente := meu_paciente_id();
  if v_paciente is null then return '[]'::jsonb; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', c.id, 'data', c.data, 'hora', c.hora,
             'tipo', c.tipo, 'status', c.status)
           order by c.data desc, c.hora desc nulls last)
    from consultas c
    where c.paciente_id = v_paciente and c.status <> 'cancelada'
  ), '[]'::jsonb);
end;
$$;

revoke all on function minhas_consultas() from anon, public;
grant execute on function minhas_consultas() to authenticated;

-- -----------------------------------------------------------------------------
-- O panorama: uma linha por paciente, com o que a lista precisa mostrar
-- -----------------------------------------------------------------------------

/**
 * Tudo que a tela "Minhas pacientes" mostra, numa ida só ao banco.
 *
 * Uma função e não oito consultas: a tela tem doze pacientes e oito fontes
 * de dado por paciente, e noventa e seis idas ao banco deixariam a lista
 * montando aos pedaços no celular dela.
 *
 * NADA AQUI É INTERPRETADO. A função devolve datas e números; quem decide o
 * que é "sem registro recente" e o que é "retorno próximo" é a tela, em
 * `utils/panoramaPacientes.ts`, onde a regra tem teste e pode mudar sem
 * migração. Escrever "sem_registro" aqui dentro congelaria a régua no banco.
 */
create or replace function panorama_dos_pacientes(p_dias integer default 28)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_desde date;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê o panorama.' using errcode = '42501';
  end if;

  v_desde := hoje_sp() - greatest(coalesce(p_dias, 28), 1);

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id,
      'nome', p.nome,
      'email', p.email,
      'situacao', situacao_paciente(p.status, p.perfil_id, p.data_inicio, p.data_fim),
      'dataInicio', p.data_inicio,
      'dataFim', p.data_fim,
      'diasRestantes', p.data_fim - hoje_sp(),

      -- A próxima consulta AGENDADA, de hoje em diante. Consulta de ontem
      -- que ninguém marcou como concluída não vira "próximo retorno".
      'proximaConsulta', (
        select jsonb_build_object('data', c.data, 'hora', c.hora, 'tipo', c.tipo)
        from consultas c
        where c.paciente_id = p.id and c.status = 'agendada' and c.data >= hoje_sp()
        order by c.data, c.hora nulls last limit 1
      ),

      'ultimaConsulta', (
        select jsonb_build_object('data', c.data, 'tipo', c.tipo, 'resumo', c.resumo)
        from consultas c
        where c.paciente_id = p.id and c.status = 'concluida'
        order by c.data desc limit 1
      ),

      -- O dia mais recente em que ela registrou QUALQUER coisa. É o que
      -- responde "sem registro recente" sem precisar de quatro consultas.
      'ultimoRegistro', greatest(
        (select max(r.data) from meta_registros r
           join metas m on m.id = r.meta_id where m.paciente_id = p.id),
        (select max(s.data) from treino_sessoes s where s.paciente_id = p.id),
        (select max(c2.data) from cardio_sessoes c2 where c2.paciente_id = p.id),
        (select max(rr.data) from reintroducao_registros rr where rr.paciente_id = p.id)
      ),

      -- Peso: o primeiro e o último de que há registro publicado. A avaliação
      -- guarda tudo em `dados`, e o peso mora lá dentro.
      'pesoInicial', (
        select (a.dados ->> 'peso')::numeric from avaliacoes_fisicas a
        where a.paciente_id = p.id and a.publicada and (a.dados ->> 'peso') is not null
        order by a.data limit 1
      ),
      'pesoAtual', (
        select (a.dados ->> 'peso')::numeric from avaliacoes_fisicas a
        where a.paciente_id = p.id and a.publicada and (a.dados ->> 'peso') is not null
        order by a.data desc limit 1
      ),

      -- As metas com os registros do período, CRUAS. A adesão é contada na
      -- tela, pelo mesmo código que a paciente vê.
      'metas', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', m.id, 'titulo', m.titulo, 'descricao', m.descricao,
                 'categoria', m.categoria, 'frequencia', m.frequencia,
                 'alvo', m.alvo, 'unidade', m.unidade, 'inicio', m.inicio,
                 'prazo', m.prazo, 'status', m.status,
                 'registros', coalesce((
                   select jsonb_agg(jsonb_build_object(
                            'id', r.id, 'data', r.data,
                            'quantidade', r.quantidade, 'observacao', r.observacao)
                          order by r.data desc)
                   from meta_registros r
                   where r.meta_id = m.id and r.data >= v_desde
                 ), '[]'::jsonb)))
        from metas m where m.paciente_id = p.id and m.status = 'ativa'
      ), '[]'::jsonb)
    ) order by p.nome)
    from pacientes p
  ), '[]'::jsonb);
end;
$$;

revoke all on function panorama_dos_pacientes(integer) from anon, public;
grant execute on function panorama_dos_pacientes(integer) to authenticated;
