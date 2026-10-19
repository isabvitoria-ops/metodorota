-- =============================================================================
-- 0077 — Dois painéis novos para a nutricionista:
--
--   1. checkin_respondidos_nao_revisados()
--      Todos os envios de check-in que a paciente mandou e a nutricionista
--      ainda não marcou "revisado". Mostra nome, questionário, data, nota.
--
--   2. pacientes_para_lembrete_retorno(p_dias integer)
--      Pacientes cuja última consulta concluída foi há >= p_dias dias e que
--      ainda não receberam lembrete neste ciclo. Para o botão de WhatsApp.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Check-ins respondidos mas não revisados
-- ---------------------------------------------------------------------------

create or replace function checkin_respondidos_nao_revisados()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'envioId',            e.id,
      'pacienteId',         p.id,
      'nome',               p.nome,
      'questionarioId',     q.id,
      'questionarioTitulo', q.titulo,
      'periodo',            e.periodo,
      'respondidoEm',       e.respondido_em
    ) order by e.respondido_em desc)
    from questionario_envios e
    join pacientes p on p.id = e.paciente_id
    join questionarios q on q.id = e.questionario_id
    where e.revisado_em is null
      and q.periodicidade = 'semanal'
      and p.status = 'ativo'
  ), '[]'::jsonb);
end;
$$;

revoke all on function checkin_respondidos_nao_revisados() from anon, public;
grant execute on function checkin_respondidos_nao_revisados() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Lembrete de retorno — pacientes sem consulta há N dias
-- ---------------------------------------------------------------------------

create or replace function pacientes_para_lembrete_retorno(p_dias integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'pacienteId', p.id,
      'nome',       p.nome,
      'telefone',   p.telefone,
      'email',      p.email,
      'ultimaConsulta', uc.data,
      'diasDesde',  (hoje_sp() - uc.data)
    ) order by uc.data asc)
    from pacientes p
    join lateral (
      select c.data
        from consultas c
       where c.paciente_id = p.id
         and c.status = 'concluida'
       order by c.data desc
       limit 1
    ) uc on true
    where p.status = 'ativo'
      and (hoje_sp() - uc.data) >= p_dias
  ), '[]'::jsonb);
end;
$$;

revoke all on function pacientes_para_lembrete_retorno(integer) from anon, public;
grant execute on function pacientes_para_lembrete_retorno(integer) to authenticated;

commit;
