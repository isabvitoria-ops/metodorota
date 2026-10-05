-- =============================================================================
-- 0064 — Check-in semanal V2: estrutura para 3 versões, cadência por pergunta,
--        regras de exibição, códigos estáveis e alertas clínicos.
--
-- O check-in agora tem três versões (V1 Estética, V2 Intestinal, V3 GLP-1)
-- montadas sobre um banco ÚNICO de perguntas. Cada pergunta carrega um
-- CÓDIGO ESTÁVEL (B01, I05, G07) que não depende do UUID e sobrevive a
-- qualquer recriação. É por esse código que se compara semana contra semana,
-- mesmo quando a paciente troca de versão.
--
-- O que esta migração faz:
--
--   1. TIPOS NOVOS de pergunta: emoji (5 emojis), estrelas (1–5),
--      multipla_escolha (checklist com gravidade) e metrica (kg, cm, sem nota).
--
--   2. COLUNAS NOVAS em `questionario_perguntas`: codigo, cadencia,
--      regra_exibicao, modulo, versoes, explicacao_opcoes, texto_ajuda,
--      notas_por_faixa, alertas_opcoes, ativa.
--
--   3. VERSÃO DA PACIENTE em `questionario_pacientes`: cada atribuição leva
--      a versão que a paciente usa (V1, V2 ou V3).
--
--   4. RESPOSTA COMPLEXA em `questionario_respostas`: valor_json para
--      múltipla escolha com gravidade, explicações embutidas.
--
--   5. ALERTAS CLÍNICOS: tabela de configuração (limiares editáveis) e
--      tabela de alertas disparados (status, nota da nutricionista).
--
--   6. FUNÇÕES ATUALIZADAS para gravar e devolver os campos novos.
--
-- REVERSÍVEL: cada alter table usa `add column if not exists`; a constraint
-- de tipo é recriada; as tabelas novas têm `if not exists`. Para desfazer,
-- basta rodar o bloco de rollback no fim do arquivo.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Novos tipos de pergunta
-- -----------------------------------------------------------------------------

alter table questionario_perguntas
  drop constraint if exists questionario_perguntas_tipo_check;

alter table questionario_perguntas
  add constraint questionario_perguntas_tipo_check
    check (tipo in (
      'escala', 'sim_nao', 'numero', 'texto', 'escolha',
      'emoji', 'estrelas', 'multipla_escolha', 'metrica'
    ));

-- -----------------------------------------------------------------------------
-- 2. Colunas novas em questionario_perguntas
-- -----------------------------------------------------------------------------

alter table questionario_perguntas
  add column if not exists codigo text,
  add column if not exists cadencia text not null default 'semanal',
  add column if not exists regra_exibicao jsonb,
  add column if not exists modulo text,
  add column if not exists versoes jsonb,
  add column if not exists explicacao_opcoes jsonb not null default '[]'::jsonb,
  add column if not exists texto_ajuda text,
  add column if not exists notas_por_faixa jsonb,
  add column if not exists alertas_opcoes jsonb not null default '[]'::jsonb,
  add column if not exists ativa boolean not null default true;

-- Cadência: semanal aparece toda semana; quinzenal semanas pares; mensal a cada 4.
alter table questionario_perguntas
  drop constraint if exists questionario_perguntas_cadencia_check;
alter table questionario_perguntas
  add constraint questionario_perguntas_cadencia_check
    check (cadencia in ('semanal', 'quinzenal', 'mensal'));

-- Código estável único dentro do mesmo questionário (B01, I05…).
-- Null é permitido para perguntas antigas que não usam o sistema de códigos.
create unique index if not exists perguntas_codigo_por_questionario
  on questionario_perguntas (questionario_id, codigo)
  where codigo is not null;

-- -----------------------------------------------------------------------------
-- 3. Versão da paciente na atribuição
-- -----------------------------------------------------------------------------

alter table questionario_pacientes
  add column if not exists versao text;

-- -----------------------------------------------------------------------------
-- 4. Resposta complexa (múltipla escolha com gravidade, explicações)
-- -----------------------------------------------------------------------------

alter table questionario_respostas
  add column if not exists valor_json jsonb;

-- -----------------------------------------------------------------------------
-- 5. Alertas clínicos — configuração
-- -----------------------------------------------------------------------------

create table if not exists alertas_checkin_config (
  codigo text primary key,
  nivel text not null check (nivel in ('vermelho', 'amarelo')),
  descricao text not null,
  mensagem_paciente text not null default '',
  ativo boolean not null default true,
  limiar jsonb,
  criado_em timestamptz not null default now()
);

comment on table alertas_checkin_config is
  'Limiares editáveis dos 19 alertas do check-in (A01–A19). Cada linha define quando o alerta dispara e o que a paciente vê.';

alter table alertas_checkin_config enable row level security;
grant select, insert, update, delete on alertas_checkin_config to authenticated;

drop policy if exists alerta_config_admin on alertas_checkin_config;
create policy alerta_config_admin on alertas_checkin_config
  for all using (e_admin()) with check (e_admin());

-- Seed com os 19 alertas definidos na especificação. A nutricionista pode
-- editar os textos depois; aqui entram os rascunhos do documento.

insert into alertas_checkin_config (codigo, nivel, descricao, mensagem_paciente, ativo, limiar)
values
  ('A01', 'vermelho',
   'Dor forte persistente na parte superior do abdome — possível pancreatite ou vesícula.',
   'Pelo que você respondeu, isso merece atenção hoje. Fale com o seu médico agora. Se os sintomas estiverem fortes, piorando ou você se sentir mal, procure um pronto atendimento ou ligue 192 (SAMU). Sua nutricionista também foi avisada.',
   true, null),

  ('A02', 'vermelho',
   'Vômitos por mais de um dia ou sem conseguir manter líquidos — risco de desidratação e lesão renal.',
   'Pelo que você respondeu, isso merece atenção hoje. Fale com o seu médico agora. Se os sintomas estiverem fortes, piorando ou você se sentir mal, procure um pronto atendimento ou ligue 192 (SAMU). Sua nutricionista também foi avisada.',
   true, null),

  ('A03', 'vermelho',
   'Desmaio — desidratação importante ou outra causa grave.',
   'Pelo que você respondeu, isso merece atenção hoje. Fale com o seu médico agora. Se os sintomas estiverem fortes, piorando ou você se sentir mal, procure um pronto atendimento ou ligue 192 (SAMU). Sua nutricionista também foi avisada.',
   true, null),

  ('A04', 'vermelho',
   'Inchaço de rosto/lábios/língua, falta de ar ou mudança súbita na visão — reação alérgica ou perda de visão.',
   'Pelo que você respondeu, isso merece atenção hoje. Fale com o seu médico agora. Se os sintomas estiverem fortes, piorando ou você se sentir mal, procure um pronto atendimento ou ligue 192 (SAMU). Sua nutricionista também foi avisada.',
   true, null),

  ('A05', 'vermelho',
   'Tristeza profunda ou pensamentos de se machucar.',
   'Sinto muito que você esteja passando por isso. Você não precisa enfrentar sozinha. Fale agora com alguém de confiança e com o seu médico. O CVV atende 24 horas, de graça, pelo telefone 188. Em risco imediato, ligue 192. Sua nutricionista foi avisada.',
   true, null),

  ('A06', 'vermelho',
   'Fezes pretas ou muito sangue — possível sangramento digestivo.',
   'Pelo que você respondeu, isso merece atenção hoje. Fale com o seu médico agora. Se os sintomas estiverem fortes, piorando ou você se sentir mal, procure um pronto atendimento ou ligue 192 (SAMU). Sua nutricionista também foi avisada.',
   true, null),

  ('A07', 'amarelo',
   'Sangue vivo nas fezes — orientar contato com gastroenterologista.',
   'Anotei isso e avisei sua nutricionista. Vale conversar com o seu médico sobre esse sintoma nos próximos dias. Se piorar, não espere a próxima consulta.',
   true, null),

  ('A08', 'amarelo',
   'Caroço no pescoço, rouquidão persistente ou dificuldade para engolir.',
   'Anotei isso e avisei sua nutricionista. Vale conversar com o seu médico sobre esse sintoma nos próximos dias. Se piorar, não espere a próxima consulta.',
   true, null),

  ('A09', 'amarelo',
   'Coração acelerado em repouso, tremor, suor frio, fraqueza súbita ou confusão.',
   'Anotei isso e avisei sua nutricionista. Vale conversar com o seu médico sobre esse sintoma nos próximos dias. Se piorar, não espere a próxima consulta.',
   true, null),

  ('A10', 'amarelo',
   'Mais de 14 dias sem aplicar o medicamento — falar com prescritor antes de retomar.',
   'Anotei isso e avisei sua nutricionista. Vale conversar com o seu médico sobre esse sintoma nos próximos dias. Se piorar, não espere a próxima consulta.',
   true, null),

  ('A11', 'amarelo',
   'Constipação: 4 a 6 dias sem evacuar.',
   'Anotei isso e avisei sua nutricionista. Vale conversar com o seu médico sobre esse sintoma nos próximos dias. Se piorar, não espere a próxima consulta.',
   true, null),

  ('A12', 'vermelho',
   'Constipação grave: 7+ dias sem evacuar, ou 4+ dias com dor forte e vômitos — risco de obstrução.',
   'Pelo que você respondeu, isso merece atenção hoje. Fale com o seu médico agora. Se os sintomas estiverem fortes, piorando ou você se sentir mal, procure um pronto atendimento ou ligue 192 (SAMU). Sua nutricionista também foi avisada.',
   true, null),

  ('A13', 'amarelo',
   'Procedimento com sedação marcado — avisar prescritor sobre o uso do medicamento.',
   'Anotei isso e avisei sua nutricionista. Vale conversar com o seu médico sobre esse sintoma nos próximos dias. Se piorar, não espere a próxima consulta.',
   true, null),

  ('A14', 'amarelo',
   'Atraso menstrual ou possibilidade de gravidez (V3) — contato com prescritor.',
   'Anotei isso e avisei sua nutricionista. Vale conversar com o seu médico sobre esse sintoma nos próximos dias. Se piorar, não espere a próxima consulta.',
   true, null),

  ('A15', 'amarelo',
   'Sintomas fortes (G03) ou vômitos 4+ (G05) ou 2+ sinais de desidratação com vômito/diarreia — risco de desidratação.',
   'Anotei isso e avisei sua nutricionista. Vale conversar com o seu médico sobre esse sintoma nos próximos dias. Se piorar, não espere a próxima consulta.',
   true, null),

  ('A16', 'amarelo',
   'Dor abdominal forte (I05 = 8–10) nas versões 2 e 3 — contato com gastroenterologista.',
   'Anotei isso e avisei sua nutricionista. Vale conversar com o seu médico sobre esse sintoma nos próximos dias. Se piorar, não espere a próxima consulta.',
   true, null),

  ('A17', 'amarelo',
   'Comida "parada", empachamento por horas — possível esvaziamento gástrico lento.',
   'Anotei isso e avisei sua nutricionista. Vale conversar com o seu médico sobre esse sintoma nos próximos dias. Se piorar, não espere a próxima consulta.',
   true, null),

  ('A18', 'amarelo',
   'Não sente fome e tem dificuldade para comer (V3) — ingestão possivelmente insuficiente.',
   'Anotei isso e avisei sua nutricionista. Vale conversar com o seu médico sobre esse sintoma nos próximos dias. Se piorar, não espere a próxima consulta.',
   true, null),

  ('A19', 'amarelo',
   'Queda de peso entre dois check-ins acima do limite configurado — perda rápida.',
   'Anotei isso e avisei sua nutricionista. Vale conversar com o seu médico sobre esse sintoma nos próximos dias. Se piorar, não espere a próxima consulta.',
   true, '{"kg_por_semana": null}'::jsonb)

on conflict (codigo) do nothing;

-- -----------------------------------------------------------------------------
-- 5b. Alertas disparados
-- -----------------------------------------------------------------------------

create table if not exists alertas_checkin (
  id uuid primary key default gen_random_uuid(),
  codigo text not null references alertas_checkin_config(codigo),
  nivel text not null check (nivel in ('vermelho', 'amarelo')),
  paciente_id uuid not null references pacientes(id) on delete cascade,
  envio_id uuid not null references questionario_envios(id) on delete cascade,
  pergunta_codigo text,
  status text not null default 'novo'
    check (status in ('novo', 'visto', 'contatado', 'resolvido')),
  nota_nutri text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table alertas_checkin is
  'Alertas clínicos disparados ao enviar um check-in. Status acompanhado pela nutricionista.';

create index if not exists alertas_paciente on alertas_checkin (paciente_id, criado_em desc);
create index if not exists alertas_envio on alertas_checkin (envio_id);
create index if not exists alertas_status on alertas_checkin (status) where status <> 'resolvido';

alter table alertas_checkin enable row level security;
grant select, insert, update, delete on alertas_checkin to authenticated;

drop policy if exists alertas_admin on alertas_checkin;
create policy alertas_admin on alertas_checkin
  for all using (e_admin()) with check (e_admin());

-- A paciente vê os alertas do próprio check-in (para a mensagem pós-envio).
drop policy if exists alertas_paciente_le on alertas_checkin;
create policy alertas_paciente_le on alertas_checkin
  for select using (paciente_id = meu_paciente_id());

-- -----------------------------------------------------------------------------
-- 6. Funções atualizadas
-- -----------------------------------------------------------------------------

-- 6a. salvar_questionario — aceita campos novos

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
         eixo_id, pontos_opcoes,
         codigo, cadencia, regra_exibicao, modulo, versoes,
         explicacao_opcoes, texto_ajuda, notas_por_faixa, alertas_opcoes, ativa)
      values (
        v_id, v_ordem,
        coalesce(nullif(trim(v_pergunta ->> 'texto'), ''), 'Pergunta sem texto'),
        coalesce(nullif(v_pergunta ->> 'tipo', ''), 'escala'),
        coalesce((v_pergunta ->> 'obrigatoria')::boolean, true),
        coalesce(v_pergunta -> 'opcoes', '[]'::jsonb),
        coalesce((v_pergunta ->> 'peso')::numeric, 1),
        coalesce((v_pergunta ->> 'invertida')::boolean, false),
        nullif(v_pergunta ->> 'eixoId', '')::uuid,
        coalesce(v_pergunta -> 'pontosOpcoes', '[]'::jsonb),
        nullif(trim(v_pergunta ->> 'codigo'), ''),
        coalesce(nullif(v_pergunta ->> 'cadencia', ''), 'semanal'),
        v_pergunta -> 'regraExibicao',
        nullif(trim(v_pergunta ->> 'modulo'), ''),
        v_pergunta -> 'versoes',
        coalesce(v_pergunta -> 'explicacaoOpcoes', '[]'::jsonb),
        nullif(trim(v_pergunta ->> 'textoAjuda'), ''),
        v_pergunta -> 'notasPorFaixa',
        coalesce(v_pergunta -> 'alertasOpcoes', '[]'::jsonb),
        coalesce((v_pergunta ->> 'ativa')::boolean, true))
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
             pontos_opcoes = coalesce(v_pergunta -> 'pontosOpcoes', pontos_opcoes),
             codigo = coalesce(nullif(trim(v_pergunta ->> 'codigo'), ''), codigo),
             cadencia = coalesce(nullif(v_pergunta ->> 'cadencia', ''), cadencia),
             regra_exibicao = coalesce(v_pergunta -> 'regraExibicao', regra_exibicao),
             modulo = coalesce(nullif(trim(v_pergunta ->> 'modulo'), ''), modulo),
             versoes = coalesce(v_pergunta -> 'versoes', versoes),
             explicacao_opcoes = coalesce(v_pergunta -> 'explicacaoOpcoes', explicacao_opcoes),
             texto_ajuda = coalesce(nullif(trim(v_pergunta ->> 'textoAjuda'), ''), texto_ajuda),
             notas_por_faixa = coalesce(v_pergunta -> 'notasPorFaixa', notas_por_faixa),
             alertas_opcoes = coalesce(v_pergunta -> 'alertasOpcoes', alertas_opcoes),
             ativa = coalesce((v_pergunta ->> 'ativa')::boolean, ativa)
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

-- 6b. listar_questionarios — devolve campos novos

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
          'codigo', p.codigo, 'cadencia', p.cadencia,
          'regraExibicao', p.regra_exibicao,
          'modulo', p.modulo, 'versoes', p.versoes,
          'explicacaoOpcoes', p.explicacao_opcoes,
          'textoAjuda', p.texto_ajuda,
          'notasPorFaixa', p.notas_por_faixa,
          'alertasOpcoes', p.alertas_opcoes,
          'ativa', p.ativa,
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

-- 6c. meus_questionarios — filtra por versão da paciente e devolve campos novos

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
      'versao', a.versao,
      'perguntas', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', p.id, 'texto', p.texto, 'tipo', p.tipo,
          'obrigatoria', p.obrigatoria, 'opcoes', p.opcoes,
          'codigo', p.codigo, 'cadencia', p.cadencia,
          'regraExibicao', p.regra_exibicao,
          'modulo', p.modulo, 'versoes', p.versoes,
          'explicacaoOpcoes', p.explicacao_opcoes,
          'textoAjuda', p.texto_ajuda,
          'notasPorFaixa', p.notas_por_faixa,
          'alertasOpcoes', p.alertas_opcoes,
          'ativa', p.ativa,
          'peso', case when q.mostra_pontuacao then p.peso else null end,
          'invertida', case when q.mostra_pontuacao then p.invertida else null end,
          'pontosOpcoes', case when q.mostra_pontuacao then p.pontos_opcoes else '[]'::jsonb end,
          'eixoId', case when q.mostra_pontuacao then p.eixo_id else null end)
        order by p.ordem)
        from questionario_perguntas p
        where p.questionario_id = q.id
          and p.ativa
          and (a.versao is null or p.versoes is null
               or p.versoes @> jsonb_build_array(a.versao))
      ), '[]'::jsonb),
      'enviados', coalesce((
        select jsonb_agg(jsonb_build_object(
          'periodo', e.periodo, 'respondidoEm', e.respondido_em,
          'reguaSnapshot', case when q.mostra_pontuacao then e.regua_snapshot else null end,
          'respostas', coalesce((
            select jsonb_agg(jsonb_build_object(
              'perguntaId', r.pergunta_id,
              'numero', r.valor_numero, 'texto', r.valor_texto,
              'json', r.valor_json))
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

-- 6d. responder_questionario — aceita valor_json, grava snapshot com campos novos

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
  v_json jsonb;
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

  select jsonb_agg(jsonb_build_object(
           'perguntaId', p.id, 'tipo', p.tipo, 'peso', p.peso,
           'invertida', p.invertida, 'opcoes', p.opcoes,
           'pontosOpcoes', p.pontos_opcoes,
           'eixoId', p.eixo_id, 'eixoNome', e.nome,
           'codigo', p.codigo, 'notas_por_faixa', p.notas_por_faixa))
    into v_snapshot
    from questionario_perguntas p
    left join checkin_eixos e on e.id = p.eixo_id
   where p.questionario_id = p_questionario
     and p.ativa;

  insert into questionario_envios (questionario_id, paciente_id, periodo, regua_snapshot)
  values (p_questionario, v_paciente, v_periodo, coalesce(v_snapshot, '[]'::jsonb))
  on conflict (questionario_id, paciente_id, periodo)
    do update set respondido_em = now(),
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
    v_json := v_resposta -> 'json';

    if v_pergunta.tipo = 'escala' and v_numero is not null then
      v_numero := least(greatest(v_numero, 0), 10);
    end if;
    if v_pergunta.tipo = 'sim_nao' and v_numero is not null then
      v_numero := case when v_numero > 0 then 1 else 0 end;
    end if;
    if v_pergunta.tipo = 'estrelas' and v_numero is not null then
      v_numero := least(greatest(v_numero, 1), 5);
    end if;
    if v_pergunta.tipo = 'emoji' and v_numero is not null then
      v_numero := least(greatest(v_numero, 0), 4);
    end if;

    insert into questionario_respostas (envio_id, pergunta_id, valor_numero, valor_texto, valor_json)
    values (v_envio, v_pergunta.id, v_numero, v_texto, v_json)
    on conflict (envio_id, pergunta_id)
      do update set valor_numero = excluded.valor_numero,
                    valor_texto = excluded.valor_texto,
                    valor_json = excluded.valor_json;
  end loop;

  return v_envio;
end;
$$;
grant execute on function responder_questionario(uuid, jsonb) to authenticated;

-- 6e. questionarios_do_paciente — devolve campos novos e alertas

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
      'versao', (
        select a.versao from questionario_pacientes a
         where a.questionario_id = q.id and a.paciente_id = p_paciente),
      'perguntas', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', p.id, 'texto', p.texto, 'tipo', p.tipo,
          'peso', p.peso, 'invertida', p.invertida, 'opcoes', p.opcoes,
          'eixoId', p.eixo_id, 'pontosOpcoes', p.pontos_opcoes,
          'codigo', p.codigo, 'cadencia', p.cadencia,
          'modulo', p.modulo, 'versoes', p.versoes,
          'regraExibicao', p.regra_exibicao,
          'explicacaoOpcoes', p.explicacao_opcoes,
          'notasPorFaixa', p.notas_por_faixa,
          'alertasOpcoes', p.alertas_opcoes,
          'ativa', p.ativa)
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
              'numero', r.valor_numero, 'texto', r.valor_texto,
              'json', r.valor_json))
            from questionario_respostas r where r.envio_id = e.id
          ), '[]'::jsonb),
          'alertas', coalesce((
            select jsonb_agg(jsonb_build_object(
              'id', al.id, 'codigo', al.codigo, 'nivel', al.nivel,
              'perguntaCodigo', al.pergunta_codigo,
              'status', al.status, 'notaNutri', al.nota_nutri,
              'criadoEm', al.criado_em))
            from alertas_checkin al where al.envio_id = e.id
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

-- 6f. Funções de alerta — CRUD pela nutricionista

create or replace function listar_alertas_pendentes()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê os alertas.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'codigo', a.codigo, 'nivel', a.nivel,
      'pacienteId', a.paciente_id,
      'pacienteNome', pac.nome,
      'envioId', a.envio_id,
      'perguntaCodigo', a.pergunta_codigo,
      'status', a.status, 'notaNutri', a.nota_nutri,
      'criadoEm', a.criado_em,
      'descricao', c.descricao)
    order by
      case a.nivel when 'vermelho' then 0 else 1 end,
      a.criado_em desc)
    from alertas_checkin a
    join alertas_checkin_config c on c.codigo = a.codigo
    join pacientes pac on pac.id = a.paciente_id
    where a.status <> 'resolvido'
  ), '[]'::jsonb);
end;
$$;
revoke all on function listar_alertas_pendentes() from anon, public;
grant execute on function listar_alertas_pendentes() to authenticated;

create or replace function atualizar_alerta(
  p_alerta uuid,
  p_status text,
  p_nota text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista mexe nos alertas.' using errcode = '42501';
  end if;
  if p_status not in ('novo', 'visto', 'contatado', 'resolvido') then
    raise exception 'Status inválido.' using errcode = '22023';
  end if;

  update alertas_checkin
     set status = p_status,
         nota_nutri = coalesce(p_nota, nota_nutri),
         atualizado_em = now()
   where id = p_alerta;
end;
$$;
revoke all on function atualizar_alerta(uuid, text, text) from anon, public;
grant execute on function atualizar_alerta(uuid, text, text) to authenticated;

-- 6g. Configuração de alertas — leitura e edição

create or replace function listar_alertas_config()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê a configuração dos alertas.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'codigo', c.codigo, 'nivel', c.nivel,
      'descricao', c.descricao,
      'mensagemPaciente', c.mensagem_paciente,
      'ativo', c.ativo, 'limiar', c.limiar)
    order by c.codigo)
    from alertas_checkin_config c
  ), '[]'::jsonb);
end;
$$;
revoke all on function listar_alertas_config() from anon, public;
grant execute on function listar_alertas_config() to authenticated;

create or replace function salvar_alerta_config(
  p_codigo text,
  p_mensagem text default null,
  p_ativo boolean default null,
  p_limiar jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista edita os alertas.' using errcode = '42501';
  end if;

  update alertas_checkin_config
     set mensagem_paciente = coalesce(p_mensagem, mensagem_paciente),
         ativo = coalesce(p_ativo, ativo),
         limiar = coalesce(p_limiar, limiar)
   where codigo = p_codigo;
end;
$$;
revoke all on function salvar_alerta_config(text, text, boolean, jsonb) from anon, public;
grant execute on function salvar_alerta_config(text, text, boolean, jsonb) to authenticated;

-- 6h. Atribuir versão ao paciente

create or replace function atribuir_versao_checkin(
  p_questionario uuid,
  p_paciente uuid,
  p_versao text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista muda a versão.' using errcode = '42501';
  end if;

  update questionario_pacientes
     set versao = p_versao
   where questionario_id = p_questionario
     and paciente_id = p_paciente;

  if not found then
    raise exception 'Paciente não está atribuída a este questionário.' using errcode = '22023';
  end if;
end;
$$;
revoke all on function atribuir_versao_checkin(uuid, uuid, text) from anon, public;
grant execute on function atribuir_versao_checkin(uuid, uuid, text) to authenticated;

-- 6i. Alertas da paciente no envio (para a tela pós-envio)

create or replace function meus_alertas_do_envio(p_envio uuid)
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
  if v_paciente is null or not tem_acesso() then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'codigo', a.codigo, 'nivel', a.nivel,
      'mensagem', c.mensagem_paciente)
    order by
      case a.nivel when 'vermelho' then 0 else 1 end,
      a.codigo)
    from alertas_checkin a
    join alertas_checkin_config c on c.codigo = a.codigo and c.ativo
    where a.envio_id = p_envio and a.paciente_id = v_paciente
  ), '[]'::jsonb);
end;
$$;
grant execute on function meus_alertas_do_envio(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Conferência: deve retornar as novas colunas e tabelas sem erro.
-- -----------------------------------------------------------------------------

select column_name from information_schema.columns
 where table_name = 'questionario_perguntas'
   and column_name in ('codigo', 'cadencia', 'regra_exibicao', 'modulo',
                        'versoes', 'explicacao_opcoes', 'notas_por_faixa',
                        'alertas_opcoes', 'ativa')
 order by column_name;

select column_name from information_schema.columns
 where table_name = 'questionario_pacientes' and column_name = 'versao';

select column_name from information_schema.columns
 where table_name = 'questionario_respostas' and column_name = 'valor_json';

select count(*) as alertas_config from alertas_checkin_config;
