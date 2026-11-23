-- 0105 — Restrições cruzadas com as trocas (lote 3; aprovado por ela em 23/11/2026).
--
-- A Troca inteligente passa a respeitar as restrições da paciente:
--   * alergia: o alimento some da lista de trocas;
--   * intolerância e sensibilidade (decisão dela: tratar igual): aparece com
--     aviso;
--   * preferência ("não gosta"): vai para o fim.
--
-- A restrição é um texto livre ("Leite de vaca"), e casar texto com o nome
-- do alimento ("leite" esconderia "leite de coco"?) seria adivinhar. Por
-- isso a nutricionista LIGA cada restrição aos alimentos da lista de trocas
-- (alimento_ids). Sem ligação, nada muda nas trocas.
--
-- `origem`: 'rastreio' quando a restrição nasceu do botão "Virar restrição"
-- da Rastreabilidade (o aviso para a paciente diz "Você não se sentiu bem no
-- teste"); 'consulta' nas demais.

alter table public.restricoes_alimentares
  add column if not exists alimento_ids text[] not null default '{}',
  add column if not exists origem text not null default 'consulta';
alter table public.restricoes_alimentares drop constraint if exists restricoes_origem_valida;
alter table public.restricoes_alimentares add constraint restricoes_origem_valida
  check (origem in ('consulta', 'rastreio'));

-- Salvar ganha os alimentos ligados e a origem. A assinatura antiga sai para
-- não haver duas funções com o mesmo nome.
drop function if exists public.salvar_restricao(uuid, uuid, text, text, text, text);
create or replace function public.salvar_restricao(
  p_paciente_id  uuid,
  p_id           uuid,
  p_tipo         text,
  p_alimento     text,
  p_gravidade    text,
  p_notas        text,
  p_alimento_ids text[] default '{}',
  p_origem       text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not e_admin() then
    raise exception 'Acesso restrito.' using errcode = '42501';
  end if;

  if p_id is null then
    insert into restricoes_alimentares (paciente_id, tipo, alimento, gravidade, notas, alimento_ids, origem)
    values (p_paciente_id, p_tipo, p_alimento, p_gravidade, p_notas,
            coalesce(p_alimento_ids, '{}'), coalesce(p_origem, 'consulta'))
    returning id into v_id;
  else
    update restricoes_alimentares
    set tipo = p_tipo,
        alimento = p_alimento,
        gravidade = p_gravidade,
        notas = p_notas,
        alimento_ids = coalesce(p_alimento_ids, alimento_ids),
        origem = coalesce(p_origem, origem),
        atualizado_em = now()
    where id = p_id and paciente_id = p_paciente_id;
    v_id := p_id;
  end if;

  return jsonb_build_object('id', v_id);
end;
$$;
revoke all on function public.salvar_restricao(uuid, uuid, text, text, text, text, text[], text) from anon, public;
grant execute on function public.salvar_restricao(uuid, uuid, text, text, text, text, text[], text) to authenticated;

create or replace function public.restricoes_do_paciente(p_paciente_id uuid)
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
      'id',           r.id,
      'tipo',         r.tipo,
      'alimento',     r.alimento,
      'gravidade',    r.gravidade,
      'notas',        r.notas,
      'alimentoIds',  to_jsonb(r.alimento_ids),
      'origem',       r.origem,
      'criadoEm',     r.criado_em,
      'atualizadoEm', r.atualizado_em
    ) order by
      case r.gravidade when 'grave' then 1 when 'moderada' then 2 else 3 end,
      r.alimento
    )
    from restricoes_alimentares r
    where r.paciente_id = p_paciente_id
  ), '[]'::jsonb);
end;
$$;

-- A Troca da paciente. Vale MESMO com a área "Minhas restrições" desligada:
-- esconder um alérgeno da troca é segurança, não uma tela a mais. Devolve só
-- o necessário (alimento ligado, tipo, origem), nada das notas.
create or replace function public.meus_alimentos_restritos()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_paciente uuid := meu_paciente_id();
begin
  if v_paciente is null then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('alimentoId', a.id, 'tipo', r.tipo, 'origem', r.origem))
      from restricoes_alimentares r, unnest(r.alimento_ids) as a(id)
     where r.paciente_id = v_paciente
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.meus_alimentos_restritos() from public, anon;
grant execute on function public.meus_alimentos_restritos() to authenticated;
