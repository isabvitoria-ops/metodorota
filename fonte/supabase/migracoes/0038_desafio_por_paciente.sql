-- =============================================================================
-- CENTRAL DO PACIENTE — 0038: o desafio, liberado paciente a paciente
--
-- Item 6 da lista aprovada. Ao levantar quais módulos precisavam de
-- interruptor, a conta deu um só — e foi uma surpresa útil.
--
-- POR QUE OS OUTROS NÃO PRECISAM
--
-- Protocolo, avaliação, metas, documentos e treino JÁ SE ESCONDEM SOZINHOS:
-- `tenho_protocolo()`, `tenho_avaliacao()`, `tenho_metas()` e
-- `tenho_treino()` decidem pela existência do conteúdo. Sem protocolo
-- publicado, a porta não existe. Botar um interruptor em cima disso daria
-- dois lugares para desligar a mesma coisa, e um dia eles discordariam.
--
-- O DESAFIO É O ÚNICO QUE NÃO TEM PORTA NATURAL: existindo desafio no mês,
-- ele aparece para TODA paciente. E é justamente o módulo em que estar
-- dentro pode fazer mal — pontuação, ranking e comparação com outras
-- pessoas não são para toda paciente, e quem atende transtorno alimentar
-- sabe exatamente por quê.
--
-- POR QUE ESTE NASCE LIGADO, AO CONTRÁRIO DO TREINO
--
-- O treino nasceu desligado porque era módulo novo: ligado, apareceria para
-- as oito de uma vez. O desafio já está rodando com participantes e pontos
-- acumulados. Nascendo desligado, esta migração tiraria todo mundo de um
-- desafio em andamento, em silêncio, no minuto em que rodasse.
--
-- Em migração, o padrão certo é o que NÃO muda nada para quem já está lá.
-- =============================================================================

alter table pacientes
  add column if not exists desafio_liberado boolean not null default true;

/**
 * Se o desafio está ligado para aquela paciente.
 *
 * Mesma guarda de privacidade do `treino_liberado`: a pergunta só é
 * respondida para a nutricionista e para a própria pessoa. Sem isso,
 * qualquer paciente logada poderia varrer os ids e descobrir quem está
 * dentro e quem está fora — que, neste módulo, é informação delicada.
 */
create or replace function desafio_liberado(p_paciente uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_paciente is null then false
    when e_admin() or p_paciente = meu_paciente_id() then
      coalesce((select p.desafio_liberado from pacientes p where p.id = p_paciente), true)
    else false
  end;
$$;

revoke all on function desafio_liberado(uuid) from anon, public;
grant execute on function desafio_liberado(uuid) to authenticated;

/** A nutricionista liga e desliga. Só ela. */
create or replace function definir_desafio_do_paciente(p_paciente uuid, p_ativo boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista libera o desafio.' using errcode = '42501';
  end if;
  if not exists (select 1 from pacientes where id = p_paciente) then
    raise exception 'Paciente não encontrada.' using errcode = '22023';
  end if;

  update pacientes set desafio_liberado = coalesce(p_ativo, true) where id = p_paciente;

  -- O estado GRAVADO, não o que o clique pediu.
  return (select desafio_liberado from pacientes where id = p_paciente);
end;
$$;

revoke all on function definir_desafio_do_paciente(uuid, boolean) from anon, public;
grant execute on function definir_desafio_do_paciente(uuid, boolean) to authenticated;
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

  -- O desafio desligado para ESTA paciente responde igual a "não há
  -- desafio": a tela some inteira, sem uma frase explicando que ela ficou
  -- de fora. Explicar seria informar que existe algo do qual ela foi
  -- tirada — e o motivo de desligar costuma ser exatamente não fazer isso.
  if v_paciente is not null and not desafio_liberado(v_paciente) then
    return jsonb_build_object('temDesafio', false, 'previa', false,
                              'saldoAcumulado', 0, 'indicacoesValidadas', 0,
                              'beneficiosIndicacao', '[]'::jsonb,
                              'recompensas', '[]'::jsonb);
  end if;

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

  -- A tranca de verdade fica aqui, e não só no `meu_desafio()`. Esconder o
  -- cartão da tela não impede ninguém de chamar a função; com o desafio
  -- desligado, marcar ação é recusado por quem grava.
  if not desafio_liberado(v_paciente) then
    raise exception 'O desafio não está ativo para você.' using errcode = '42501';
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
-- `meu_acesso()` ganha a chave `desafio`
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
    'avaliacao', e_admin() or tenho_avaliacao(),
    'treino', e_admin() or tenho_treino(),
    'metas', e_admin() or tenho_metas(),
    'desafio', e_admin() or coalesce(desafio_liberado(meu_paciente_id()), true)
  );
$$;

grant execute on function meu_acesso() to authenticated;

-- -----------------------------------------------------------------------------
-- Os interruptores num lugar só
-- -----------------------------------------------------------------------------

/**
 * O que cada paciente alcança, numa resposta só — para o painel da
 * nutricionista.
 *
 * O PEDIDO ERA "controle de acesso uniforme, módulo a módulo". Ao levantar
 * quais módulos precisavam de interruptor, a conta deu um só (o desafio);
 * os outros já se escondem pela existência do conteúdo. O que faltava de
 * verdade, então, não era mais interruptor: era ver os que existem JUNTOS,
 * em vez de um na tela de rastreabilidade e outro na de treino.
 *
 * Os dois primeiros são interruptores; os outros são estado, e a tela diz
 * qual é qual. Mostrar "Protocolo: desligado" com um botão ao lado seria
 * prometer um controle que não existe — o protocolo aparece quando ela
 * publica um, e some quando não há.
 */
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
