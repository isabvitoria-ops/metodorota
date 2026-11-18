-- 0096 — Áreas do app ligadas ou desligadas por paciente.
--
-- A nutricionista escolhe o que cada paciente vê (pacientes mais velhos com o
-- mínimo, por exemplo). Guardado como a lista do que está DESLIGADO: tudo
-- nasce ligado, então ninguém perde nada no dia em que isto entra.
--
-- O Protocolo não entra (é de todos). Treino, desafio, restrições, FODMAP,
-- rastreio e o guia de viagem continuam com os interruptores próprios.
-- As chaves são as de src/central/utils/areas.ts — as duas listas andam juntas.

alter table public.pacientes
  add column if not exists areas_desligadas text[] not null default '{}';

alter table public.pacientes drop constraint if exists pacientes_areas_desligadas_validas;
alter table public.pacientes add constraint pacientes_areas_desligadas_validas check (
  areas_desligadas <@ array[
    'trocas', 'comer_fora', 'cozinha', 'documentos', 'avaliacao', 'metas', 'checkin',
    'hidratacao', 'habitos', 'diario', 'fotos_evolucao', 'busca', 'aviso_viagem'
  ]::text[]
);

create or replace function public.definir_area_do_paciente(p_paciente uuid, p_area text, p_ligada boolean)
returns text[]
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  resultado text[];
begin
  if not e_admin() then
    raise exception 'Só a nutricionista muda o que a paciente vê.' using errcode = '42501';
  end if;
  if p_area is null or not (p_area = any (array[
    'trocas', 'comer_fora', 'cozinha', 'documentos', 'avaliacao', 'metas', 'checkin',
    'hidratacao', 'habitos', 'diario', 'fotos_evolucao', 'busca', 'aviso_viagem'
  ])) then
    raise exception 'Área desconhecida: %', p_area using errcode = '22023';
  end if;
  update pacientes
     set areas_desligadas = case
           when p_ligada then array_remove(areas_desligadas, p_area)
           else array(select distinct x from unnest(areas_desligadas || p_area) as x order by x)
         end
   where id = p_paciente
  returning areas_desligadas into resultado;
  if resultado is null then
    raise exception 'Paciente não encontrada.' using errcode = 'P0002';
  end if;
  return resultado;
end;
$$;

revoke all on function public.definir_area_do_paciente(uuid, text, boolean) from public, anon;
grant execute on function public.definir_area_do_paciente(uuid, text, boolean) to authenticated;

-- meu_acesso(): o mesmo de antes, mais 'areasDesligadas'.
create or replace function public.meu_acesso()
 returns jsonb
 language sql
 stable security definer
 set search_path to 'public'
as $function$
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
    'viagem', e_admin() or coalesce(viagem_liberado(meu_paciente_id()), false),
    'areasDesligadas', case when e_admin() then '{}'::text[]
      else coalesce((select areas_desligadas from pacientes where perfil_id = auth.uid()), '{}'::text[]) end,
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
$function$;
