-- =============================================================================
-- 0083 — Reintrodução automática: fases desbloqueiam por semana
--
-- Antes a nutricionista precisava liberar manualmente cada fase. Agora
-- `meu_acesso()` calcula as fases pela semana corrida do programa:
--
--   Dias 1–7  → Fase 1
--   Dias 8–14 → Fases 1–2
--   Dias 15–21 → Fases 1–3
--   Dia 22+   → Fases 1–4
--
-- A coluna `fases_liberadas` continua existindo como override manual:
-- se a nutricionista liberar uma fase antes do tempo, ela aparece junto.
-- =============================================================================

create or replace function meu_acesso()
returns jsonb
language sql
stable security definer
set search_path to 'public'
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
    'desafio', e_admin() or coalesce(desafio_liberado(meu_paciente_id()), true),
    'restricoes', e_admin() or coalesce(restricoes_liberado(meu_paciente_id()), false),
    'fodmap', e_admin() or coalesce(fodmap_liberado(meu_paciente_id()), false),
    -- Hot Slim
    'hotslim', e_admin() or e_hotslim(),
    'hotslimFases', coalesce(
      (select
        case
          when hoje_sp() < hp.data_inicio then hp.fases_liberadas
          else (
            select array(
              select distinct unnest(
                hp.fases_liberadas ||
                (select coalesce(array_agg(g)::int[], '{}'::int[])
                 from generate_series(1,
                   least(4, ceil((hoje_sp() - hp.data_inicio + 1)::numeric / 7))::int
                 ) g)
              ) order by 1
            )
          )
        end
       from hotslim_participantes hp
       where hp.id = auth.uid() and hp.ativo = true),
      '{}'::int[]
    ),
    'hotslimDiaAtual', (
      select least(21, greatest(1, hoje_sp() - data_inicio + 1))
      from hotslim_participantes
      where id = auth.uid() and ativo = true
    )
  );
$$;

grant execute on function meu_acesso() to authenticated;
