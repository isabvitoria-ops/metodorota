-- =============================================================================
-- CENTRAL DO PACIENTE — 0007: as regras do desafio
--
-- REGRA MAIS IMPORTANTE (dela, e o motivo deste arquivo existir):
-- o sistema NÃO confia no checkbox da paciente para dar pontos.
--
-- A paciente não tem permissão de escrever em `desafio_envios` nem em
-- `pontos_lancamentos` — ver 0008. O único caminho é `enviar_acao()`, que
-- grava status 'enviado' e zero pontos, sempre. Quem transforma isso em ponto
-- é `aprovar_envio()`, e essa só roda para admin.
--
-- Mesmo com o app aberto no console do navegador, a paciente não consegue
-- somar um ponto sequer para si.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Semanas do desafio (§12)
--
-- Calculadas a partir do período, nunca escritas à mão. Um desafio que começa
-- 01/09 e termina 30/09 tem 5 semanas; a última tem 2 dias, e tudo bem.
-- -----------------------------------------------------------------------------

create or replace function semana_do_desafio(p_desafio uuid, p_data date default null)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when d.id is null then null
    when coalesce(p_data, hoje_sp()) < d.data_inicio then null
    when coalesce(p_data, hoje_sp()) > d.data_fim then null
    else floor((coalesce(p_data, hoje_sp()) - d.data_inicio) / 7)::int + 1
  end
  from desafios d
  where d.id = p_desafio;
$$;

/** Quantas semanas o desafio tem no total. */
create or replace function total_de_semanas(p_desafio uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select floor((d.data_fim - d.data_inicio) / 7)::int + 1
  from desafios d where d.id = p_desafio;
$$;

/** Início e fim de uma semana do desafio, para a tela mostrar "08/09 — 14/09". */
create or replace function periodo_da_semana(p_desafio uuid, p_semana integer)
returns table (inicio date, fim date)
language sql
stable
security definer
set search_path = public
as $$
  select
    d.data_inicio + ((p_semana - 1) * 7),
    least(d.data_inicio + ((p_semana - 1) * 7) + 6, d.data_fim)
  from desafios d where d.id = p_desafio;
$$;

-- -----------------------------------------------------------------------------
-- Encerramento automático (§36)
--
-- Sem cron: a data decide. Qualquer leitura já vê o desafio como encerrado
-- depois do último dia, do mesmo jeito que o acesso da paciente expira sozinho.
-- -----------------------------------------------------------------------------

create or replace function situacao_desafio(p_status text, p_inicio date, p_fim date)
returns text
language sql
immutable
as $$
  select case
    when p_status = 'rascunho' then 'rascunho'
    when p_status = 'encerrado' then 'encerrado'
    when hoje_sp() > p_fim then 'encerrado'
    when hoje_sp() < p_inicio then 'agendado'
    else 'ativo'
  end;
$$;

/** O desafio que está valendo hoje. Nulo quando não há nenhum. */
create or replace function desafio_atual()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select d.id from desafios d
  where d.status = 'ativo'
    and hoje_sp() between d.data_inicio and d.data_fim
  order by d.data_inicio desc
  limit 1;
$$;

-- -----------------------------------------------------------------------------
-- O paciente de quem está logado
-- -----------------------------------------------------------------------------

create or replace function meu_paciente_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from pacientes where perfil_id = auth.uid() limit 1;
$$;

-- -----------------------------------------------------------------------------
-- Saldo e ranking — derivados do ledger, nunca de coluna guardada (§42)
-- -----------------------------------------------------------------------------

/** Saldo oficial do Ponto de Virada: soma tudo, de todos os desafios. Não expira. */
create or replace function saldo_de_pontos(p_paciente uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(pontos), 0)::int
  from pontos_lancamentos where paciente_id = p_paciente;
$$;

/** Pontos de um desafio só — é o que o ranking mensal usa (§15). */
create or replace function pontos_no_desafio(p_paciente uuid, p_desafio uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(pontos), 0)::int
  from pontos_lancamentos
  where paciente_id = p_paciente and desafio_id = p_desafio;
$$;

/**
 * Nome como o ranking mostra. A configuração `ranking_nome` decide entre
 * 'completo', 'primeiro' e 'primeiro_inicial' (o padrão).
 *
 * Existe porque o ranking é a única tela em que uma paciente vê outra: a
 * política de `pacientes` continua fechada, e o que sai daqui é só o nome
 * tratado — nunca e-mail, plano, data ou qualquer dado de saúde (§19).
 */
create or replace function nome_para_ranking(p_nome text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_modo text;
  v_partes text[];
begin
  select coalesce(valor #>> '{}', 'primeiro_inicial') into v_modo
  from configuracoes where chave = 'ranking_nome';

  if v_modo = 'completo' then
    return p_nome;
  end if;

  v_partes := regexp_split_to_array(trim(p_nome), '\s+');
  if array_length(v_partes, 1) is null then
    return p_nome;
  end if;

  if v_modo = 'primeiro' or array_length(v_partes, 1) = 1 then
    return v_partes[1];
  end if;

  return v_partes[1] || ' ' || upper(left(v_partes[array_length(v_partes, 1)], 1)) || '.';
end;
$$;

/**
 * Ranking de um desafio.
 *
 * Empate (§31): quem empata divide a posição — 1º, 1º, 3º. É a regra de
 * competição comum, e não obriga a inventar um critério de desempate que
 * puniria alguém por ter pontuado mais tarde.
 *
 * Só entra ponto já lançado, ou seja, já aprovado (§16).
 */
create or replace function ranking_do_desafio(p_desafio uuid)
returns table (posicao integer, paciente_id uuid, nome text, pontos integer, sou_eu boolean)
language sql
stable
security definer
set search_path = public
as $$
  -- Entra no ranking quem participou OU quem tem ponto no desafio.
  --
  -- A segunda metade não é redundância: uma paciente que só indicou uma amiga,
  -- ou que recebeu um ajuste manual, tem pontos do mês sem ter marcado ação
  -- nenhuma. Montar o ranking só pela lista de participantes a deixaria de
  -- fora com pontos e tudo — foi o que os testes pegaram.
  with envolvidas as (
    select paciente_id from desafio_participantes where desafio_id = p_desafio
    union
    select paciente_id from pontos_lancamentos where desafio_id = p_desafio
  ),
  somas as (
    select p.id, p.nome, coalesce(sum(l.pontos), 0)::int as pontos
    from envolvidas e
    join pacientes p on p.id = e.paciente_id
    left join pontos_lancamentos l
      on l.paciente_id = p.id and l.desafio_id = p_desafio
    group by p.id, p.nome
  )
  select
    rank() over (order by pontos desc)::int,
    s.id,
    nome_para_ranking(s.nome),
    s.pontos,
    s.id = meu_paciente_id()
  from somas s
  order by pontos desc, s.nome;
$$;

-- -----------------------------------------------------------------------------
-- O que a paciente envia
-- -----------------------------------------------------------------------------

/**
 * "Eu fiz isso."
 *
 * Confere tudo aqui dentro, porque a tela não é autoridade: acesso válido,
 * desafio em andamento, ação ativa, e o limite de repetição da ação. Grava
 * sempre com status 'enviado' e zero ponto.
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

  -- Semana só existe para ação semanal; nas demais fica nula de propósito, e é
  -- o índice único parcial que garante a unicidade certa para cada caso.
  if v_acao.periodicidade = 'semanal' then
    v_semana := semana_do_desafio(v_desafio.id);
    if v_semana is null then
      raise exception 'Hoje está fora do período do desafio.' using errcode = '22023';
    end if;
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

  -- Entra no desafio na primeira ação, sem tela de inscrição.
  insert into desafio_participantes (desafio_id, paciente_id)
  values (v_desafio.id, v_paciente)
  on conflict (desafio_id, paciente_id) do nothing;

  insert into desafio_envios (desafio_id, acao_id, paciente_id, semana, observacao)
  values (v_desafio.id, v_acao.id, v_paciente, v_semana, nullif(trim(p_observacao), ''))
  returning id into v_id;

  return v_id;
exception
  when unique_violation then
    raise exception 'Você já enviou esta ação.' using errcode = '23505';
end;
$$;

/** Desfazer o próprio envio, enquanto ainda não foi conferido. */
create or replace function cancelar_envio(p_envio uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_paciente uuid;
begin
  v_paciente := meu_paciente_id();
  delete from desafio_envios
  where id = p_envio and paciente_id = v_paciente and status = 'enviado';
  if not found then
    raise exception 'Este envio não pode mais ser desfeito.' using errcode = '22023';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- O que só a nutricionista faz
-- -----------------------------------------------------------------------------

/** Aprovar: é aqui, e só aqui, que um ponto de ação nasce. */
create or replace function aprovar_envio(p_envio uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_envio desafio_envios;
  v_acao desafio_acoes;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista aprova.' using errcode = '42501';
  end if;

  select * into v_envio from desafio_envios where id = p_envio for update;
  if not found then
    raise exception 'Envio não encontrado.' using errcode = '22023';
  end if;
  if v_envio.status = 'aprovado' then
    return; -- já aprovado: não gera ponto de novo
  end if;

  select * into v_acao from desafio_acoes where id = v_envio.acao_id;

  update desafio_envios
     set status = 'aprovado',
         revisado_em = now(),
         revisado_por = auth.uid(),
         motivo_recusa = null,
         pontos_concedidos = v_acao.pontos
   where id = p_envio;

  insert into pontos_lancamentos
    (paciente_id, desafio_id, acao_id, envio_id, pontos, tipo, descricao, criado_por)
  values
    (v_envio.paciente_id, v_envio.desafio_id, v_acao.id, v_envio.id, v_acao.pontos,
     'acao',
     v_acao.nome || coalesce(' · semana ' || v_envio.semana, ''),
     auth.uid());
end;
$$;

/** Recusar: não gera ponto, e a paciente vê o motivo. */
create or replace function recusar_envio(p_envio uuid, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista recusa.' using errcode = '42501';
  end if;

  -- Se já havia sido aprovado, o ponto sai por estorno — o lançamento
  -- original fica no histórico. Nada se apaga do ledger (§30).
  insert into pontos_lancamentos
    (paciente_id, desafio_id, acao_id, pontos, tipo, descricao, criado_por)
  select l.paciente_id, l.desafio_id, l.acao_id, -l.pontos, 'ajuste',
         'Estorno: ' || l.descricao, auth.uid()
  from pontos_lancamentos l
  where l.envio_id = p_envio;

  update desafio_envios
     set status = 'recusado',
         revisado_em = now(),
         revisado_por = auth.uid(),
         motivo_recusa = nullif(trim(p_motivo), ''),
         pontos_concedidos = 0
   where id = p_envio;
end;
$$;

/** Correção manual, sempre com motivo e sempre virando histórico (§30). */
create or replace function ajustar_pontos(
  p_paciente uuid,
  p_pontos integer,
  p_motivo text,
  p_desafio uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista ajusta pontos.' using errcode = '42501';
  end if;
  if p_pontos = 0 then
    raise exception 'Informe um valor diferente de zero.' using errcode = '22023';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Escreva o motivo do ajuste.' using errcode = '22023';
  end if;

  insert into pontos_lancamentos
    (paciente_id, desafio_id, pontos, tipo, descricao, criado_por)
  values (p_paciente, p_desafio, p_pontos, 'ajuste', trim(p_motivo), auth.uid());
end;
$$;

-- -----------------------------------------------------------------------------
-- Indicações
-- -----------------------------------------------------------------------------

/** A paciente registra que indicou alguém. Isso não vale ponto nenhum ainda. */
create or replace function registrar_indicacao(
  p_nome text,
  p_email text default null,
  p_telefone text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
  v_id uuid;
begin
  if not tem_acesso() then
    raise exception 'Seu acesso não está liberado.' using errcode = '42501';
  end if;
  v_paciente := meu_paciente_id();
  if coalesce(trim(p_nome), '') = '' then
    raise exception 'Escreva o nome de quem você indicou.' using errcode = '22023';
  end if;

  -- Indicar também é participar: sem isto ela só entraria no ranking depois
  -- de marcar alguma ação semanal.
  if desafio_atual() is not null then
    insert into desafio_participantes (desafio_id, paciente_id)
    values (desafio_atual(), v_paciente)
    on conflict (desafio_id, paciente_id) do nothing;
  end if;

  insert into indicacoes
    (desafio_id, paciente_indicadora_id, nome_indicada, email_indicada, telefone_indicada)
  values
    (desafio_atual(), v_paciente, trim(p_nome), nullif(trim(p_email), ''), nullif(trim(p_telefone), ''))
  returning id into v_id;

  return v_id;
end;
$$;

/**
 * Validar a indicação: os pontos saem aqui (50 na época deste arquivo, 100
 * desde o 0013), e só quando ela confirma que a
 * indicada começou o acompanhamento de verdade.
 */
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

  select coalesce(max(pontos), 50) into v_pontos
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

/** Recusar uma indicação: zero ponto, e o registro fica. */
create or replace function recusar_indicacao(p_indicacao uuid, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista recusa indicação.' using errcode = '42501';
  end if;
  update indicacoes
     set status = 'recusada',
         observacao = nullif(trim(p_motivo), ''),
         validado_em = now(),
         validado_por = auth.uid()
   where id = p_indicacao and status <> 'validada';
end;
$$;
