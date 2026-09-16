-- =============================================================================
-- CENTRAL DO PACIENTE — 0010: fechando o que o verificador do Supabase achou
--
-- Duas falhas reais, encontradas depois que o 0006–0009 subiu. Vale registrar
-- o que eram, porque a lição serve para qualquer função nova daqui em diante.
--
-- 1. FUNÇÃO SEM DONO DA PERGUNTA
--
--    `saldo_de_pontos(paciente)` recebia um id e devolvia o saldo — sem
--    perguntar de quem era o id. Uma paciente autenticada poderia ler o saldo
--    de outra passando o id dela. A política de `pontos_lancamentos` está
--    certa, mas a função é `security definer`: ela passa por cima da política,
--    e por isso precisa fazer a checagem no corpo. O mesmo valia para
--    `pontos_no_desafio` e `ranking_do_desafio`.
--
-- 2. FUNÇÃO ABERTA PARA QUEM NEM ENTROU
--
--    O Supabase publica toda função de `public` como endereço REST, e o papel
--    `anon` — visitante sem login — vinha com permissão de executar. A chave
--    pública do app está dentro do HTML publicado, de propósito, então
--    qualquer pessoa poderia chamar `desafio_atual()`, pegar o id, chamar
--    `ranking_do_desafio(id)` e receber os nomes e pontos das pacientes dela.
--
--    Sem login. Sem ser paciente. Só com o endereço do site.
--
--    A correção é tirar `anon` e `public` de tudo que toca dado, e deixar o
--    `grant` só para `authenticated` — que ainda passa pelas checagens acima.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. As funções que devolvem dado passam a perguntar de quem é
-- -----------------------------------------------------------------------------

create or replace function saldo_de_pontos(p_paciente uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- Cada uma vê o seu; a nutricionista vê o de todas.
  --
  -- O `coalesce` não é enfeite: `null = qualquer coisa` dá null, e `if null`
  -- não entra — um id nulo passaria direto pela checagem. Devolveria zero, o
  -- que é inofensivo, mas uma guarda que depende de sorte não é guarda.
  if not coalesce(e_admin() or p_paciente = meu_paciente_id(), false) then
    raise exception 'Você só pode ver os seus pontos.' using errcode = '42501';
  end if;
  return (
    select coalesce(sum(pontos), 0)::int
    from pontos_lancamentos where paciente_id = p_paciente
  );
end;
$$;

create or replace function pontos_no_desafio(p_paciente uuid, p_desafio uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not coalesce(e_admin() or p_paciente = meu_paciente_id(), false) then
    raise exception 'Você só pode ver os seus pontos.' using errcode = '42501';
  end if;
  return (
    select coalesce(sum(pontos), 0)::int
    from pontos_lancamentos
    where paciente_id = p_paciente and desafio_id = p_desafio
  );
end;
$$;

/**
 * O ranking é a única tela em que uma paciente vê outra, e continua sendo —
 * mas agora só para quem está autenticado E com acesso válido. Uma paciente
 * vencida ou suspensa não lê mais os nomes das outras.
 */
create or replace function ranking_do_desafio(p_desafio uuid)
returns table (posicao integer, paciente_id uuid, nome text, pontos integer, sou_eu boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not coalesce(e_admin() or tem_acesso(), false) then
    raise exception 'Seu acesso não está liberado.' using errcode = '42501';
  end if;

  return query
  with envolvidas as (
    select dp.paciente_id from desafio_participantes dp where dp.desafio_id = p_desafio
    union
    select l.paciente_id from pontos_lancamentos l where l.desafio_id = p_desafio
  ),
  somas as (
    select p.id, p.nome, coalesce(sum(l.pontos), 0)::int as pontos
    from envolvidas e
    join pacientes p on p.id = e.paciente_id
    left join pontos_lancamentos l on l.paciente_id = p.id and l.desafio_id = p_desafio
    group by p.id, p.nome
  )
  select
    rank() over (order by s.pontos desc)::int,
    s.id,
    nome_para_ranking(s.nome),
    s.pontos,
    s.id = meu_paciente_id()
  from somas s
  order by s.pontos desc, s.nome;
end;
$$;

-- `meu_desafio()` chama `saldo_de_pontos` para o próprio id, então continua
-- funcionando — mas sem paciente vinculado ele agora explodiria. Trata antes.
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
  v_semana integer;
  v_pontos_mes integer;
  v_saldo integer;
  v_posicao integer;
  v_proxima integer;
begin
  v_paciente := meu_paciente_id();

  -- Sem cadastro de paciente vinculado não há desafio nenhum a mostrar. É o
  -- caso de quem tem conta mas ainda não é paciente — e da nutricionista.
  if v_paciente is null then
    return jsonb_build_object('temDesafio', false, 'saldoAcumulado', 0, 'recompensas', '[]'::jsonb);
  end if;

  select * into v_desafio from desafios where id = desafio_atual();
  v_saldo := coalesce(saldo_de_pontos(v_paciente), 0);

  if v_desafio.id is null then
    return jsonb_build_object(
      'temDesafio', false,
      'saldoAcumulado', v_saldo,
      'recompensas', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', r.id, 'pontos', r.pontos, 'nome', r.nome, 'descricao', r.descricao,
          'alcancada', v_saldo >= r.pontos
        ) order by r.ordem), '[]'::jsonb)
        from recompensas r where r.ativo
      )
    );
  end if;

  v_semana := semana_do_desafio(v_desafio.id);
  v_pontos_mes := coalesce(pontos_no_desafio(v_paciente, v_desafio.id), 0);
  select r.posicao into v_posicao from ranking_do_desafio(v_desafio.id) r where r.sou_eu;
  select min(r.pontos) - v_pontos_mes into v_proxima
  from ranking_do_desafio(v_desafio.id) r where r.pontos > v_pontos_mes;

  return jsonb_build_object(
    'temDesafio', true,
    'desafio', jsonb_build_object(
      'id', v_desafio.id, 'nome', v_desafio.nome, 'descricao', v_desafio.descricao,
      'lema', v_desafio.lema, 'regras', v_desafio.regras,
      'dataInicio', v_desafio.data_inicio, 'dataFim', v_desafio.data_fim,
      'situacao', situacao_desafio(v_desafio.status, v_desafio.data_inicio, v_desafio.data_fim),
      'semanaAtual', v_semana, 'totalDeSemanas', total_de_semanas(v_desafio.id)
    ),
    'pontosNoMes', v_pontos_mes,
    'saldoAcumulado', v_saldo,
    'posicao', v_posicao,
    'pontosParaProxima', v_proxima,
    'acoes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id, 'chave', a.chave, 'nome', a.nome, 'descricao', a.descricao,
        'pontos', a.pontos, 'periodicidade', a.periodicidade,
        'envio', (
          select jsonb_build_object(
            'id', e.id, 'status', e.status, 'semana', e.semana,
            'observacao', e.observacao, 'motivoRecusa', e.motivo_recusa,
            'enviadoEm', e.enviado_em, 'pontosConcedidos', e.pontos_concedidos
          )
          from desafio_envios e
          where e.acao_id = a.id and e.paciente_id = v_paciente
            and (a.periodicidade <> 'semanal' or e.semana = v_semana)
            and e.status <> 'recusado'
          order by e.enviado_em desc limit 1
        ),
        'aprovadas', (
          select count(*) from desafio_envios e
          where e.acao_id = a.id and e.paciente_id = v_paciente and e.status = 'aprovado'
        )
      ) order by a.ordem), '[]'::jsonb)
      from desafio_acoes a where a.desafio_id = v_desafio.id and a.ativo
    ),
    'ranking', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'posicao', r.posicao, 'nome', r.nome, 'pontos', r.pontos, 'souEu', r.sou_eu
      ) order by r.posicao, r.nome), '[]'::jsonb)
      from ranking_do_desafio(v_desafio.id) r
    ),
    'historico', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', l.id, 'pontos', l.pontos, 'descricao', l.descricao,
        'tipo', l.tipo, 'criadoEm', l.criado_em
      ) order by l.criado_em desc), '[]'::jsonb)
      from pontos_lancamentos l
      where l.paciente_id = v_paciente and l.desafio_id = v_desafio.id
    ),
    'indicacoes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', i.id, 'nome', i.nome_indicada, 'status', i.status,
        'pontos', i.pontos_concedidos, 'criadoEm', i.criado_em
      ) order by i.criado_em desc), '[]'::jsonb)
      from indicacoes i where i.paciente_indicadora_id = v_paciente
    ),
    'recompensas', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', r.id, 'pontos', r.pontos, 'nome', r.nome, 'descricao', r.descricao,
        'alcancada', v_saldo >= r.pontos
      ) order by r.ordem), '[]'::jsonb)
      from recompensas r where r.ativo
    )
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. `search_path` fixo em tudo
--
-- Sem isto, quem conseguisse criar um schema antes de `public` no caminho de
-- busca poderia trocar o significado de uma função chamada lá dentro.
-- -----------------------------------------------------------------------------

alter function hoje_sp() set search_path = public;
alter function situacao_paciente(text, uuid, date, date) set search_path = public;
alter function tocar_atualizado_em() set search_path = public;
alter function desafio_sem_sobreposicao() set search_path = public;
alter function situacao_desafio(text, date, date) set search_path = public;

-- -----------------------------------------------------------------------------
-- 3. `anon` sai de tudo
--
-- O visitante sem login não precisa de nenhuma destas funções: a tela de
-- entrar usa só o serviço de autenticação do próprio Supabase.
-- -----------------------------------------------------------------------------

-- Só as funções DESTE projeto. As que vieram junto com uma extensão ficam
-- como estão: `citext_eq`, por exemplo, é o que compara dois e-mails, e
-- revogar isso quebraria o login e toda busca por e-mail no app inteiro.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (
        select 1 from pg_depend d
        where d.objid = p.oid
          and d.classid = 'pg_proc'::regclass
          and d.deptype = 'e'
      )
  loop
    execute format('revoke all on function %s from anon, public', f.assinatura);
  end loop;
end;
$$;

-- E os gatilhos não são para ninguém chamar pela mão.
revoke all on function ao_criar_usuario() from authenticated;
revoke all on function vincular_paciente_ao_perfil() from authenticated;
revoke all on function registrar_evento_paciente() from authenticated;
revoke all on function tocar_atualizado_em() from authenticated;
revoke all on function desafio_sem_sobreposicao() from authenticated;

-- O que a pessoa logada continua podendo chamar.
grant execute on function tem_acesso() to authenticated;
grant execute on function e_admin() to authenticated;
grant execute on function meu_acesso() to authenticated;
grant execute on function registrar_acesso() to authenticated;
grant execute on function hoje_sp() to authenticated;
grant execute on function situacao_paciente(text, uuid, date, date) to authenticated;
grant execute on function situacao_desafio(text, date, date) to authenticated;
grant execute on function config_inteiro(text, integer) to authenticated;
grant execute on function enviar_acao(uuid, text) to authenticated;
grant execute on function cancelar_envio(uuid) to authenticated;
grant execute on function registrar_indicacao(text, text, text) to authenticated;
grant execute on function ranking_do_desafio(uuid) to authenticated;
grant execute on function saldo_de_pontos(uuid) to authenticated;
grant execute on function pontos_no_desafio(uuid, uuid) to authenticated;
grant execute on function semana_do_desafio(uuid, date) to authenticated;
grant execute on function total_de_semanas(uuid) to authenticated;
grant execute on function periodo_da_semana(uuid, integer) to authenticated;
grant execute on function desafio_atual() to authenticated;
grant execute on function meu_paciente_id() to authenticated;
grant execute on function nome_para_ranking(text) to authenticated;
grant execute on function meu_desafio() to authenticated;
grant execute on function painel_do_desafio(uuid) to authenticated;
grant execute on function aprovar_envio(uuid) to authenticated;
grant execute on function recusar_envio(uuid, text) to authenticated;
grant execute on function ajustar_pontos(uuid, integer, text, uuid) to authenticated;
grant execute on function validar_indicacao(uuid, uuid) to authenticated;
grant execute on function recusar_indicacao(uuid, text) to authenticated;

-- E as tabelas também: `anon` não lê nada.
do $$
declare t text;
begin
  foreach t in array array[
    'perfis', 'planos', 'pacientes', 'convites', 'historico_admin', 'unidades',
    'grupos_alimentares', 'alimentos', 'equivalencias', 'conteudos', 'favoritos',
    'configuracoes', 'desafios', 'desafio_acoes', 'desafio_participantes',
    'desafio_envios', 'pontos_lancamentos', 'indicacoes', 'recompensas'
  ] loop
    execute format('revoke all on table %I from anon', t);
  end loop;
end;
$$;
