-- =============================================================================
-- 0068 — Perguntas ocultas por paciente
--
-- Cada paciente pode ter perguntas específicas desligadas, mesmo dentro da
-- mesma versão. Exemplo: B12 (ciclo menstrual) desligado para quem não
-- menstrua. A nutricionista escolhe isso no prontuário, pergunta por pergunta.
--
-- O que esta migração faz:
--
--   1. Coluna `perguntas_ocultas text[]` em `questionario_pacientes` — lista
--      de códigos de perguntas que NÃO aparecem para aquela paciente.
--
--   2. `meus_questionarios()` filtrada: além de ativa + versão, agora exclui
--      as perguntas cujo código está em `perguntas_ocultas`.
--
--   3. `questionarios_do_paciente()` devolve `perguntas_ocultas` para a
--      nutricionista montar os toggles no prontuário.
--
--   4. Função `ocultar_perguntas_checkin()` — grava a lista de códigos
--      ocultos para uma paciente num questionário.
-- =============================================================================

-- 1. Coluna nova
alter table questionario_pacientes
  add column if not exists perguntas_ocultas text[] not null default '{}';

-- 2. meus_questionarios() — agora filtra perguntas_ocultas

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
          and (a.perguntas_ocultas = '{}' or p.codigo is null
               or not (p.codigo = any(a.perguntas_ocultas)))
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

-- 3. questionarios_do_paciente() — devolve perguntas_ocultas

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
      'perguntasOcultas', coalesce((
        select a.perguntas_ocultas from questionario_pacientes a
         where a.questionario_id = q.id and a.paciente_id = p_paciente), '{}'),
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

-- 4. Função para gravar perguntas ocultas

create or replace function ocultar_perguntas_checkin(
  p_questionario uuid,
  p_paciente uuid,
  p_ocultas text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista personaliza as perguntas.' using errcode = '42501';
  end if;

  update questionario_pacientes
     set perguntas_ocultas = coalesce(p_ocultas, '{}')
   where questionario_id = p_questionario
     and paciente_id = p_paciente;

  if not found then
    raise exception 'Paciente não está atribuída a este questionário.' using errcode = '22023';
  end if;
end;
$$;
revoke all on function ocultar_perguntas_checkin(uuid, uuid, text[]) from anon, public;
grant execute on function ocultar_perguntas_checkin(uuid, uuid, text[]) to authenticated;

-- Conferência
select column_name from information_schema.columns
 where table_name = 'questionario_pacientes'
   and column_name = 'perguntas_ocultas';
