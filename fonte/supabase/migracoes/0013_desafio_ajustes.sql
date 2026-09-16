-- =============================================================================
-- CENTRAL DO PACIENTE — 0013: o que ela pediu depois de usar o desafio
--
-- Cinco mudanças, todas autorizadas por ela:
--
-- 1. Lembrete de frequência em toda ação, não só na das redes. E o diário
--    alimentar passa a valer DUAS vezes por semana — o que o banco não sabia
--    fazer: 'semanal' significava "uma vez", ponto final.
-- 2. Indicação passa de 50 para 100 pontos.
-- 3. A escada de benefícios da indicação vira tabela, do mesmo jeito que as
--    recompensas: é regra do programa dela, não texto de tela.
-- 4. Indicação não zera no fim do mês — o total de cada paciente é de sempre.
-- 5. Ela pode lançar a ação por uma paciente que fez e esqueceu de marcar,
--    sem inventar ponto solto: entra pelo mesmo caminho de um envio aprovado.
--
-- O que NÃO muda: a paciente continua sem conseguir escrever um ponto. Lançar
-- por ela é função de admin, e cai no mesmo ledger, com o mesmo histórico.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Uma ação pode valer mais de uma vez por semana
--
-- `max_por_semana` é dado, não código: o dia em que ela quiser o diário 3x,
-- é uma linha de update. O envio ganha `ocorrencia` (1, 2, ...) porque a
-- trava de duplicidade é um índice único, e sem esse número a segunda marca
-- da semana bateria de frente com a primeira.
-- -----------------------------------------------------------------------------

alter table desafio_acoes
  add column if not exists max_por_semana integer not null default 1;

alter table desafio_acoes
  drop constraint if exists desafio_acoes_max_por_semana_check;
alter table desafio_acoes
  add constraint desafio_acoes_max_por_semana_check check (max_por_semana > 0);

alter table desafio_envios
  add column if not exists ocorrencia integer not null default 1;

alter table desafio_envios
  drop constraint if exists desafio_envios_ocorrencia_check;
alter table desafio_envios
  add constraint desafio_envios_ocorrencia_check check (ocorrencia > 0);

drop index if exists envios_sem_duplicata_semanal_idx;
create unique index if not exists envios_sem_duplicata_semanal_idx
  on desafio_envios (desafio_id, acao_id, paciente_id, semana, ocorrencia)
  where status <> 'recusado' and semana is not null;

/**
 * "Eu fiz isso."
 *
 * Mesma função de sempre, com uma conta a mais: quantas vezes esta ação já
 * foi marcada nesta semana. Enquanto couber, a próxima marca ganha o número
 * seguinte; quando não couber, a recusa vem daqui e não da tela.
 */
create or replace function enviar_acao(p_acao uuid, p_observacao text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
  v_acao desafio_acoes;
  v_desafio desafios;
  v_semana integer;
  v_id uuid;
  v_ocorrencias integer;
  v_ocorrencia integer := 1;
begin
  if not tem_acesso() then
    raise exception 'Seu acesso não está liberado.' using errcode = '42501';
  end if;

  v_paciente := meu_paciente_id();
  if v_paciente is null then
    raise exception 'Não encontrei seu cadastro de paciente.' using errcode = '42501';
  end if;

  select * into v_acao from desafio_acoes where id = p_acao and ativo;
  if not found then
    raise exception 'Esta ação não está disponível.' using errcode = '22023';
  end if;

  select * into v_desafio from desafios where id = v_acao.desafio_id;
  if situacao_desafio(v_desafio.status, v_desafio.data_inicio, v_desafio.data_fim) <> 'ativo' then
    raise exception 'Este desafio não está em andamento.' using errcode = '22023';
  end if;

  if v_acao.periodicidade = 'semanal' then
    v_semana := semana_do_desafio(v_desafio.id);
    if v_semana is null then
      raise exception 'Hoje está fora do período do desafio.' using errcode = '22023';
    end if;

    -- Quantas vezes já marcou nesta semana. Recusado não conta: se ela
    -- recusou, a vaga volta a existir.
    select coalesce(max(e.ocorrencia), 0) into v_ocorrencias
    from desafio_envios e
    where e.acao_id = v_acao.id and e.paciente_id = v_paciente
      and e.semana = v_semana and e.status <> 'recusado';

    if v_ocorrencias >= v_acao.max_por_semana then
      raise exception 'Você já marcou esta ação o número de vezes desta semana.'
        using errcode = '23505';
    end if;
    v_ocorrencia := v_ocorrencias + 1;
  else
    v_semana := null;
  end if;

  if v_acao.periodicidade = 'evento' and v_acao.max_ocorrencias is not null then
    select count(*) into v_ocorrencias
    from desafio_envios
    where acao_id = v_acao.id and paciente_id = v_paciente and status <> 'recusado';
    if v_ocorrencias >= v_acao.max_ocorrencias then
      raise exception 'Você já usou todas as vezes desta ação.' using errcode = '22023';
    end if;
  end if;

  insert into desafio_participantes (desafio_id, paciente_id)
  values (v_desafio.id, v_paciente)
  on conflict (desafio_id, paciente_id) do nothing;

  insert into desafio_envios
    (desafio_id, acao_id, paciente_id, semana, ocorrencia, observacao)
  values
    (v_desafio.id, v_acao.id, v_paciente, v_semana, v_ocorrencia,
     nullif(trim(p_observacao), ''))
  returning id into v_id;

  return v_id;
exception
  when unique_violation then
    raise exception 'Você já enviou esta ação.' using errcode = '23505';
end;
$$;

grant execute on function enviar_acao(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Ela lança a ação pela paciente
--
-- O caso é o dela: "a paciente que faz tudo mas esquece de registrar". Não
-- vira ponto solto de ajuste — vira um envio como qualquer outro, já
-- aprovado por ela, com o nome dela no histórico. Assim o número bate com o
-- resto: a ação aparece marcada para a paciente, conta no `aprovadas`, e o
-- índice de duplicidade impede lançar duas vezes a mesma semana.
-- -----------------------------------------------------------------------------

create or replace function conceder_acao(
  p_paciente uuid,
  p_acao uuid,
  p_semana integer default null,
  p_observacao text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acao desafio_acoes;
  v_desafio desafios;
  v_semana integer;
  v_ocorrencias integer;
  v_id uuid;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista lança ação por alguém.' using errcode = '42501';
  end if;

  select * into v_acao from desafio_acoes where id = p_acao;
  if not found then
    raise exception 'Ação não encontrada.' using errcode = '22023';
  end if;
  select * into v_desafio from desafios where id = v_acao.desafio_id;

  -- Lançar num desafio encerrado é legítimo — é o caso de corrigir o mês
  -- passado. Lançar num rascunho não: a paciente nem sabe que ele existe, e
  -- o ponto apareceria no saldo dela vindo de lugar nenhum.
  if v_desafio.status = 'rascunho' then
    raise exception 'Este desafio ainda é um rascunho. Publique antes de lançar pontos.'
      using errcode = '22023';
  end if;

  if not exists (select 1 from pacientes where id = p_paciente) then
    raise exception 'Paciente não encontrada.' using errcode = '22023';
  end if;

  if v_acao.periodicidade = 'semanal' then
    v_semana := coalesce(p_semana, semana_do_desafio(v_desafio.id));
    if v_semana is null then
      raise exception 'Escolha a semana: hoje está fora do período do desafio.'
        using errcode = '22023';
    end if;
    select coalesce(max(e.ocorrencia), 0) into v_ocorrencias
    from desafio_envios e
    where e.acao_id = v_acao.id and e.paciente_id = p_paciente
      and e.semana = v_semana and e.status <> 'recusado';
    if v_ocorrencias >= v_acao.max_por_semana then
      raise exception 'Esta ação já está lançada para esta semana.' using errcode = '23505';
    end if;
  else
    v_semana := null;
    v_ocorrencias := 0;
  end if;

  insert into desafio_participantes (desafio_id, paciente_id)
  values (v_desafio.id, p_paciente)
  on conflict (desafio_id, paciente_id) do nothing;

  insert into desafio_envios
    (desafio_id, acao_id, paciente_id, semana, ocorrencia, observacao)
  values
    (v_desafio.id, v_acao.id, p_paciente, v_semana, v_ocorrencias + 1,
     coalesce(nullif(trim(p_observacao), ''), 'Lançado pela nutricionista.'))
  returning id into v_id;

  perform aprovar_envio(v_id);
  return v_id;
end;
$$;

revoke all on function conceder_acao(uuid, uuid, integer, text) from anon, public;
grant execute on function conceder_acao(uuid, uuid, integer, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. A escada de benefícios da indicação
--
-- Em tabela, como as recompensas, pelo mesmo motivo: é regra do programa
-- dela. Os valores vieram do pedido dela e só mudam com autorização dela.
-- -----------------------------------------------------------------------------

create table if not exists indicacao_beneficios (
  nivel integer primary key check (nivel > 0),
  texto text not null,
  ativo boolean not null default true
);

alter table indicacao_beneficios enable row level security;

drop policy if exists indicacao_beneficios_leitura on indicacao_beneficios;
create policy indicacao_beneficios_leitura on indicacao_beneficios for select
  using (e_admin() or (ativo and tem_acesso()));

drop policy if exists indicacao_beneficios_admin on indicacao_beneficios;
create policy indicacao_beneficios_admin on indicacao_beneficios for all
  using (e_admin()) with check (e_admin());

grant select, insert, update, delete on indicacao_beneficios to authenticated;
revoke all on table indicacao_beneficios from anon;

insert into indicacao_beneficios (nivel, texto) values
  (1, '100 pontos'),
  (2, '100 pontos + 20% de desconto na renovação do plano'),
  (3, '100 pontos + 1 consulta bônus'),
  (4, '100 pontos + 1 consulta bônus + 1 kit completo das marcas parceiras')
on conflict (nivel) do update set texto = excluded.texto, ativo = true;

-- -----------------------------------------------------------------------------
-- 4. Quantas indicações cada paciente já fez, de sempre
--
-- O ranking é do mês; isto não é. A conta ignora desafio de propósito: a
-- indicação de março continua contando em setembro, igual ao saldo de
-- pontos, que também não expira.
-- -----------------------------------------------------------------------------

create or replace function indicacoes_validadas(p_paciente uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- A mesma fechadura do `saldo_de_pontos` (0010): sem isto, uma paciente
  -- passaria o id de outra e descobriria quantas amigas a colega indicou.
  -- O `coalesce` é o que impede o nulo de escapar: `if null` não entra no
  -- bloco, e a checagem inteira viraria enfeite.
  if not coalesce(e_admin() or p_paciente = meu_paciente_id(), false) then
    raise exception 'Você só pode ver as suas indicações.' using errcode = '42501';
  end if;

  return (
    select count(*)::int from indicacoes
    where paciente_indicadora_id = p_paciente and status = 'validada'
  );
end;
$$;

revoke all on function indicacoes_validadas(uuid) from anon, public;
grant execute on function indicacoes_validadas(uuid) to authenticated;

/** O quadro de quem já indicou — "Alana · 1 indicação". Só para admin. */
create or replace function resumo_indicacoes()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê o resumo.' using errcode = '42501';
  end if;

  return (
    select coalesce(jsonb_agg(x order by (x->>'validadas')::int desc, x->>'nome'), '[]'::jsonb)
    from (
      select jsonb_build_object(
        'pacienteId', p.id,
        'nome', p.nome,
        'validadas', count(*) filter (where i.status = 'validada'),
        'emAndamento', count(*) filter (where i.status in ('registrada', 'iniciou'))
      ) as x
      from indicacoes i
      join pacientes p on p.id = i.paciente_indicadora_id
      group by p.id, p.nome
    ) t
  );
end;
$$;

revoke all on function resumo_indicacoes() from anon, public;
grant execute on function resumo_indicacoes() to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Indicação vale 100
--
-- Vale para os desafios que já existem e para os que vierem. O fallback da
-- validação também sobe: ele é a rede de segurança para uma indicação sem
-- desafio nenhum ligado, e deixá-lo em 50 daria dois valores diferentes para
-- a mesma coisa.
-- -----------------------------------------------------------------------------

update desafio_acoes set pontos = 100 where chave = 'indicacao' and pontos = 50;

create or replace function validar_indicacao(p_indicacao uuid, p_paciente_indicada uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ind indicacoes;
  v_pontos integer;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista valida indicação.' using errcode = '42501';
  end if;

  select * into v_ind from indicacoes where id = p_indicacao for update;
  if not found then
    raise exception 'Indicação não encontrada.' using errcode = '22023';
  end if;
  if v_ind.status = 'validada' then
    return;
  end if;

  select coalesce(max(pontos), 100) into v_pontos
  from desafio_acoes
  where chave = 'indicacao' and desafio_id = coalesce(v_ind.desafio_id, desafio_atual());

  update indicacoes
     set status = 'validada',
         paciente_indicada_id = coalesce(p_paciente_indicada, paciente_indicada_id),
         pontos_concedidos = v_pontos,
         validado_em = now(),
         validado_por = auth.uid()
   where id = p_indicacao;

  insert into pontos_lancamentos
    (paciente_id, desafio_id, indicacao_id, pontos, tipo, descricao, criado_por)
  values
    (v_ind.paciente_indicadora_id, coalesce(v_ind.desafio_id, desafio_atual()), p_indicacao,
     v_pontos, 'indicacao', 'Indicação de ' || v_ind.nome_indicada, auth.uid());
end;
$$;

grant execute on function validar_indicacao(uuid, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 1 (continuação). O lembrete de frequência em toda ação
--
-- Só onde o texto ainda é o de fábrica: se ela já reescreveu a descrição de
-- alguma ação pelo banco, a dela fica.
-- -----------------------------------------------------------------------------

update desafio_acoes set descricao = 'Uma vez por semana.'
 where chave in ('questionario', 'metas', 'redes')
   and (descricao is null or descricao = 'Uma vez por semana.');

update desafio_acoes set descricao = 'Duas vezes por semana.', max_por_semana = 2
 where chave = 'diario'
   and (descricao is null or descricao in ('Uma vez por semana.', 'Duas vezes por semana.'));

-- E o molde dos próximos desafios nasce já assim.
create or replace function copiar_acoes_do_ultimo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_modelo uuid;
begin
  select a.desafio_id into v_modelo
  from desafio_acoes a
  join desafios d on d.id = a.desafio_id
  where d.id <> new.id
  group by a.desafio_id, d.data_inicio
  order by d.data_inicio desc
  limit 1;

  if v_modelo is null then
    insert into desafio_acoes
      (desafio_id, chave, nome, descricao, pontos, periodicidade, max_por_semana, ordem)
    values
      (new.id, 'questionario', 'Respondi meu questionário semanal',
       'Uma vez por semana.', 5, 'semanal', 1, 1),
      (new.id, 'metas', 'Cumpri minhas metas da semana',
       'Uma vez por semana.', 5, 'semanal', 1, 2),
      (new.id, 'diario', 'Enviei meu diário alimentar',
       'Duas vezes por semana.', 5, 'semanal', 2, 3),
      (new.id, 'redes', 'Compartilhei minha evolução e te marquei',
       'Uma vez por semana.', 10, 'semanal', 1, 4),
      (new.id, 'indicacao', 'Indiquei uma amiga',
       'Os pontos entram quando ela começa o acompanhamento.', 100, 'evento', 1, 5);
  else
    insert into desafio_acoes
      (desafio_id, chave, nome, descricao, pontos, periodicidade,
       max_por_semana, max_ocorrencias, ativo, ordem)
    select new.id, a.chave, a.nome, a.descricao, a.pontos, a.periodicidade,
           a.max_por_semana, a.max_ocorrencias, a.ativo, a.ordem
    from desafio_acoes a
    where a.desafio_id = v_modelo;
  end if;

  return new;
end;
$$;

revoke all on function copiar_acoes_do_ultimo() from anon, public, authenticated;

-- -----------------------------------------------------------------------------
-- O que a tela da paciente passa a receber
--
-- Três campos novos, e nenhum deles é conta feita no navegador:
--   `maxPorSemana` e `podeMarcar` — quem decide se ainda cabe marcar é o
--        banco, que é quem também recusa o envio a mais.
--   `envios` no lugar de `envio` — uma ação de duas vezes por semana tem
--        dois estados ao mesmo tempo, e um campo só não conseguia mostrar.
--   `indicacoesValidadas` e `beneficiosIndicacao` — a escada dela, com o
--        degrau em que a paciente está.
-- -----------------------------------------------------------------------------

create or replace function meu_desafio()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_desafio desafios;
  v_paciente uuid;
  v_previa boolean;
  v_semana integer;
  v_pontos_mes integer;
  v_saldo integer;
  v_posicao integer;
  v_proxima integer;
  v_indicacoes integer;
  v_beneficios jsonb;
  v_ativo boolean;
begin
  v_paciente := meu_paciente_id();
  v_previa := v_paciente is null and e_admin();

  if v_paciente is null and not v_previa then
    return jsonb_build_object('temDesafio', false, 'previa', false,
                              'saldoAcumulado', 0, 'indicacoesValidadas', 0,
                              'beneficiosIndicacao', '[]'::jsonb,
                              'recompensas', '[]'::jsonb);
  end if;

  select * into v_desafio from desafios where id = desafio_atual();
  v_saldo := case when v_previa then 0 else coalesce(saldo_de_pontos(v_paciente), 0) end;
  v_indicacoes := case when v_previa then 0
                  else coalesce(indicacoes_validadas(v_paciente), 0) end;
  v_beneficios := (
    select coalesce(jsonb_agg(jsonb_build_object(
      'nivel', b.nivel, 'texto', b.texto, 'alcancado', v_indicacoes >= b.nivel
    ) order by b.nivel), '[]'::jsonb)
    from indicacao_beneficios b where b.ativo);

  if v_desafio.id is null then
    return jsonb_build_object(
      'temDesafio', false, 'previa', v_previa, 'saldoAcumulado', v_saldo,
      'indicacoesValidadas', v_indicacoes,
      'beneficiosIndicacao', v_beneficios,
      'recompensas', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', r.id, 'pontos', r.pontos, 'nome', r.nome, 'descricao', r.descricao,
          'alcancada', v_saldo >= r.pontos) order by r.ordem), '[]'::jsonb)
        from recompensas r where r.ativo));
  end if;

  v_semana := semana_do_desafio(v_desafio.id);
  v_ativo := situacao_desafio(v_desafio.status, v_desafio.data_inicio, v_desafio.data_fim) = 'ativo';
  v_pontos_mes := case when v_previa then 0
                  else coalesce(pontos_no_desafio(v_paciente, v_desafio.id), 0) end;

  if not v_previa then
    select r.posicao into v_posicao from ranking_do_desafio(v_desafio.id) r where r.sou_eu;
    select min(r.pontos) - v_pontos_mes into v_proxima
    from ranking_do_desafio(v_desafio.id) r where r.pontos > v_pontos_mes;
  end if;

  return jsonb_build_object(
    'temDesafio', true,
    'previa', v_previa,
    'desafio', jsonb_build_object(
      'id', v_desafio.id, 'nome', v_desafio.nome, 'descricao', v_desafio.descricao,
      'lema', v_desafio.lema, 'regras', v_desafio.regras,
      'dataInicio', v_desafio.data_inicio, 'dataFim', v_desafio.data_fim,
      'situacao', situacao_desafio(v_desafio.status, v_desafio.data_inicio, v_desafio.data_fim),
      'semanaAtual', v_semana, 'totalDeSemanas', total_de_semanas(v_desafio.id)),
    'pontosNoMes', v_pontos_mes,
    'saldoAcumulado', v_saldo,
    'posicao', v_posicao,
    'pontosParaProxima', v_proxima,
    'indicacoesValidadas', v_indicacoes,
    'beneficiosIndicacao', v_beneficios,
    'acoes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id, 'chave', a.chave, 'nome', a.nome, 'descricao', a.descricao,
        'pontos', a.pontos, 'periodicidade', a.periodicidade,
        'maxPorSemana', a.max_por_semana,
        -- Os envios da semana, o recusado inclusive: a paciente precisa ler o
        -- motivo, e o lugar de ler é o cartão da ação.
        'envios', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', e.id, 'status', e.status, 'semana', e.semana,
            'observacao', e.observacao, 'motivoRecusa', e.motivo_recusa,
            'enviadoEm', e.enviado_em, 'pontosConcedidos', e.pontos_concedidos
          ) order by e.enviado_em), '[]'::jsonb)
          from desafio_envios e
          where e.acao_id = a.id and e.paciente_id = v_paciente
            and (a.periodicidade <> 'semanal' or e.semana = v_semana)),
        -- Se ainda cabe marcar. Quem decide é aqui, não o botão.
        'podeMarcar', (
          v_ativo and not v_previa and v_paciente is not null
          and case
            when a.periodicidade = 'semanal' then
              v_semana is not null and (
                select count(*) from desafio_envios e
                where e.acao_id = a.id and e.paciente_id = v_paciente
                  and e.semana = v_semana and e.status <> 'recusado'
              ) < a.max_por_semana
            when a.periodicidade = 'evento' then
              a.max_ocorrencias is null or (
                select count(*) from desafio_envios e
                where e.acao_id = a.id and e.paciente_id = v_paciente
                  and e.status <> 'recusado'
              ) < a.max_ocorrencias
            else not exists (
              select 1 from desafio_envios e
              where e.acao_id = a.id and e.paciente_id = v_paciente
                and e.status <> 'recusado')
          end),
        'aprovadas', (
          select count(*) from desafio_envios e
          where e.acao_id = a.id and e.paciente_id = v_paciente and e.status = 'aprovado')
      ) order by a.ordem), '[]'::jsonb)
      from desafio_acoes a where a.desafio_id = v_desafio.id and a.ativo),
    'ranking', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'posicao', r.posicao, 'nome', r.nome, 'pontos', r.pontos, 'souEu', r.sou_eu
      ) order by r.posicao, r.nome), '[]'::jsonb)
      from ranking_do_desafio(v_desafio.id) r),
    'historico', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', l.id, 'pontos', l.pontos, 'descricao', l.descricao,
        'tipo', l.tipo, 'criadoEm', l.criado_em) order by l.criado_em desc), '[]'::jsonb)
      from pontos_lancamentos l
      where l.paciente_id = v_paciente and l.desafio_id = v_desafio.id),
    'indicacoes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', i.id, 'nome', i.nome_indicada, 'status', i.status,
        'pontos', i.pontos_concedidos, 'criadoEm', i.criado_em) order by i.criado_em desc), '[]'::jsonb)
      from indicacoes i where i.paciente_indicadora_id = v_paciente),
    'recompensas', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', r.id, 'pontos', r.pontos, 'nome', r.nome, 'descricao', r.descricao,
        'alcancada', v_saldo >= r.pontos) order by r.ordem), '[]'::jsonb)
      from recompensas r where r.ativo));
end;
$$;

grant execute on function meu_desafio() to authenticated;

-- E o `anon` continua sem nada do que nasceu aqui.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('conceder_acao', 'indicacoes_validadas', 'resumo_indicacoes',
                        'enviar_acao', 'meu_desafio', 'validar_indicacao',
                        'copiar_acoes_do_ultimo')
  loop
    execute format('revoke all on function %s from anon, public', f.assinatura);
  end loop;
end;
$$;
