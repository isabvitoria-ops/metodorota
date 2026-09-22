-- =============================================================================
-- CENTRAL DO PACIENTE — 0042: marcar o check-in como revisado
--
-- Veio da referência que ela mandou: a coluna "REVISADO" no histórico
-- longitudinal. É o item mais simples da tela e o mais útil no dia a dia.
--
-- O PROBLEMA QUE RESOLVE: com oito pacientes respondendo toda semana, são
-- oito check-ins novos por semana e mais de trinta por mês. Sem marca de
-- lido, ela relê os mesmos e perde os novos — e o que ela quer saber ao
-- abrir a tela é "o que chegou desde a última vez que olhei".
--
-- A MARCA É DELA, NÃO DA PACIENTE. A paciente não vê, não é avisada e não
-- sabe se foi lido. Um "visto" visível criaria uma expectativa de resposta
-- que o aplicativo não promete — e ela não quer conversa dentro do app.
-- =============================================================================

alter table questionario_envios
  add column if not exists revisado_em timestamptz;

comment on column questionario_envios.revisado_em is
  'Quando a nutricionista marcou como lido. Nulo = ainda não revisado. A paciente não vê.';

/**
 * Marca ou desmarca um envio como revisado.
 *
 * Devolve o estado GRAVADO, e não o que o clique pediu — mesmo padrão dos
 * outros interruptores: a tela mostra a verdade do banco.
 */
create or replace function marcar_revisado(p_envio uuid, p_revisado boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_em timestamptz;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista marca como revisado.' using errcode = '42501';
  end if;
  if not exists (select 1 from questionario_envios where id = p_envio) then
    raise exception 'Envio não encontrado.' using errcode = '22023';
  end if;

  update questionario_envios
     set revisado_em = case when coalesce(p_revisado, false) then now() else null end
   where id = p_envio
  returning revisado_em into v_em;

  return v_em is not null;
end;
$$;

revoke all on function marcar_revisado(uuid, boolean) from anon, public;
grant execute on function marcar_revisado(uuid, boolean) to authenticated;

-- `questionarios_do_paciente` passa a devolver a marca. O corpo é o da 0041
-- com uma linha a mais: `create or replace` troca a função inteira.
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
          'revisado', e.revisado_em is not null,
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
