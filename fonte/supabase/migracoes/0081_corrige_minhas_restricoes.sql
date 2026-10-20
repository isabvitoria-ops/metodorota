-- =============================================================================
-- 0081 — Corrige minhas_restricoes(): recoloca atualizadoEm no retorno.
--
-- A migração 0080 substituiu minhas_restricoes() para adicionar o
-- interruptor de restrições, mas esqueceu de incluir atualizadoEm no
-- jsonb_build_object. O tipo TypeScript espera esse campo.
-- =============================================================================

create or replace function minhas_restricoes()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_paciente_id uuid;
begin
  select id into v_paciente_id
  from pacientes where perfil_id = auth.uid();

  if v_paciente_id is null then return '[]'::jsonb; end if;
  if not restricoes_liberado(v_paciente_id) then return '[]'::jsonb; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id,
      'tipo', r.tipo,
      'alimento', r.alimento,
      'gravidade', r.gravidade,
      'notas', r.notas,
      'criadoEm', r.criado_em,
      'atualizadoEm', r.atualizado_em
    ) order by
      case r.gravidade when 'grave' then 1 when 'moderada' then 2 else 3 end,
      r.alimento
    )
    from restricoes_alimentares r
    where r.paciente_id = v_paciente_id
  ), '[]'::jsonb);
end;
$$;
