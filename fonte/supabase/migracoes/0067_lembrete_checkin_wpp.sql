-- =============================================================================
-- 0067 — Lista de pacientes que ainda não responderam o check-in da semana
--
-- Função usada pelo painel da nutricionista para mostrar quem não respondeu
-- e oferecer o botão de lembrete por WhatsApp.
-- =============================================================================

begin;

create or replace function checkin_pendentes_da_semana()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_semana date;
begin
  if not e_admin() then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;

  v_semana := semana_de(hoje_sp());

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'pacienteId', p.id,
      'nome', p.nome,
      'telefone', p.telefone,
      'email', p.email,
      'questionarioId', q.id,
      'questionarioTitulo', q.titulo
    ) order by p.nome)
    from questionario_pacientes qp
    join pacientes p on p.id = qp.paciente_id
    join questionarios q on q.id = qp.questionario_id
    where q.ativo
      and q.periodicidade = 'semanal'
      and p.status = 'ativo'
      and not exists (
        select 1 from questionario_envios e
         where e.questionario_id = q.id
           and e.paciente_id = p.id
           and e.periodo = v_semana
      )
  ), '[]'::jsonb);
end;
$$;

revoke all on function checkin_pendentes_da_semana() from anon, public;
grant execute on function checkin_pendentes_da_semana() to authenticated;

commit;
