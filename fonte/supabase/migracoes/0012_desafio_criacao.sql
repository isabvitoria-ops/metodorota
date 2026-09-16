-- =============================================================================
-- CENTRAL DO PACIENTE — 0012: dois buracos que só apareceram no uso real
--
-- 1. DESAFIO NOVO NASCIA VAZIO
--
--    Criar um desafio pelo painel gravava só a linha do desafio. As cinco
--    ações não vinham junto — e desafio sem ação é um checklist em branco: a
--    paciente abre, não tem o que marcar, e não há como pontuar.
--
--    O §22 dela pede para criar desafio sem tocar em código. Um formulário
--    que produz algo inútil não cumpre isso.
--
-- 2. A NUTRICIONISTA NÃO CONSEGUIA VER A TELA DA PACIENTE
--
--    `meu_desafio()` devolve vazio quando não há cadastro de paciente ligado
--    à conta — e a conta dela é exatamente esse caso. Resultado: ela abria o
--    Desafio e lia "Nenhum desafio no ar", enquanto as pacientes viam o
--    desafio normalmente. A Central inteira é feita para ela conferir o que a
--    paciente vê; essa tela tinha ficado de fora.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Todo desafio nasce com as ações
--
-- Copia do desafio mais recente que tenha ações. Assim a pontuação que ela
-- ajustar uma vez vale para os meses seguintes, sem precisar recadastrar —
-- e sem nenhum valor escrito em código.
-- -----------------------------------------------------------------------------

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
    -- Primeiro desafio do sistema: as cinco ações do programa dela.
    insert into desafio_acoes
      (desafio_id, chave, nome, descricao, pontos, periodicidade, ordem)
    values
      (new.id, 'questionario', 'Respondi meu questionário semanal', null, 5, 'semanal', 1),
      (new.id, 'metas', 'Cumpri minhas metas da semana', null, 5, 'semanal', 2),
      (new.id, 'diario', 'Enviei meu diário alimentar', null, 5, 'semanal', 3),
      (new.id, 'redes', 'Compartilhei minha evolução e te marquei', 'Uma vez por semana.', 10, 'semanal', 4),
      (new.id, 'indicacao', 'Indiquei uma amiga',
       'Os pontos entram quando ela começa o acompanhamento.', 50, 'evento', 5);
  else
    insert into desafio_acoes
      (desafio_id, chave, nome, descricao, pontos, periodicidade, max_ocorrencias, ativo, ordem)
    select new.id, a.chave, a.nome, a.descricao, a.pontos, a.periodicidade,
           a.max_ocorrencias, a.ativo, a.ordem
    from desafio_acoes a
    where a.desafio_id = v_modelo;
  end if;

  return new;
end;
$$;

drop trigger if exists copiar_acoes on desafios;
create trigger copiar_acoes
after insert on desafios
for each row execute function copiar_acoes_do_ultimo();

-- Os desafios que já nasceram vazios ganham as ações agora.
do $$
declare d record;
begin
  -- `des.id` qualificado de propósito: `desafio_acoes` também tem uma coluna
  -- `id`, e um `id` solto aqui dentro se liga à tabela de DENTRO do subselect.
  -- A condição vira `a.desafio_id = a.id`, que nunca é verdadeira — e o
  -- `not exists` passaria a valer para todo desafio, inclusive os que já têm
  -- ações. Foi o que aconteceu na primeira versão, e o teste acusou.
  for d in
    select des.id from desafios des
    where des.status <> 'encerrado'
      and not exists (select 1 from desafio_acoes a where a.desafio_id = des.id)
  loop
    insert into desafio_acoes
      (desafio_id, chave, nome, descricao, pontos, periodicidade, max_ocorrencias, ativo, ordem)
    select d.id, a.chave, a.nome, a.descricao, a.pontos, a.periodicidade,
           a.max_ocorrencias, a.ativo, a.ordem
    from desafio_acoes a
    where a.desafio_id = (
      select a2.desafio_id from desafio_acoes a2
      join desafios d2 on d2.id = a2.desafio_id
      group by a2.desafio_id, d2.data_inicio
      order by d2.data_inicio desc limit 1
    );
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. A nutricionista vê a tela da paciente
--
-- Sem cadastro de paciente ela entra em modo de prévia: vê o desafio, o
-- checklist e o ranking, com `previa: true` — a tela usa isso para explicar
-- que ali ela não pontua. Quem não é admin nem paciente continua sem nada.
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
begin
  v_paciente := meu_paciente_id();
  v_previa := v_paciente is null and e_admin();

  if v_paciente is null and not v_previa then
    return jsonb_build_object('temDesafio', false, 'previa', false,
                              'saldoAcumulado', 0, 'recompensas', '[]'::jsonb);
  end if;

  select * into v_desafio from desafios where id = desafio_atual();
  v_saldo := case when v_previa then 0 else coalesce(saldo_de_pontos(v_paciente), 0) end;

  if v_desafio.id is null then
    return jsonb_build_object(
      'temDesafio', false, 'previa', v_previa, 'saldoAcumulado', v_saldo,
      'recompensas', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', r.id, 'pontos', r.pontos, 'nome', r.nome, 'descricao', r.descricao,
          'alcancada', v_saldo >= r.pontos) order by r.ordem), '[]'::jsonb)
        from recompensas r where r.ativo));
  end if;

  v_semana := semana_do_desafio(v_desafio.id);
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
    'acoes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id, 'chave', a.chave, 'nome', a.nome, 'descricao', a.descricao,
        'pontos', a.pontos, 'periodicidade', a.periodicidade,
        'envio', (
          select jsonb_build_object('id', e.id, 'status', e.status, 'semana', e.semana,
            'observacao', e.observacao, 'motivoRecusa', e.motivo_recusa,
            'enviadoEm', e.enviado_em, 'pontosConcedidos', e.pontos_concedidos)
          from desafio_envios e
          where e.acao_id = a.id and e.paciente_id = v_paciente
            and (a.periodicidade <> 'semanal' or e.semana = v_semana)
            and e.status <> 'recusado'
          order by e.enviado_em desc limit 1),
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
revoke all on function copiar_acoes_do_ultimo() from anon, public, authenticated;
