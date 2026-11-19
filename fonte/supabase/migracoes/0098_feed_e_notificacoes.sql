-- 0098 — Feed de fotos e notificações da nutricionista.
--
-- Ela pediu para não ter que abrir a ficha de cada paciente para saber quem
-- mandou foto, quem registrou rastreio, quem respondeu check-in, quem treinou.
--
-- diario_de_todas(dias, limite) : as fotos do diário de TODAS as pacientes,
--                                 da mais nova para a mais velha, com o nome.
-- notificacoes_da_nutri(dias)   : o que as pacientes fizeram, numa lista só.
--                                 Não é uma tabela nova: é lida das tabelas
--                                 que já guardam cada coisa, então não dá
--                                 para "esquecer" de avisar nada.
-- notificacoes_vistas           : até quando ela já viu (por perfil), para
--                                 marcar o que é novo.
--
-- Tudo só para e_admin(). Nenhuma paciente vê o que a outra faz.

create table if not exists public.notificacoes_vistas (
  perfil_id uuid primary key references public.perfis(id) on delete cascade,
  visto_em timestamptz not null default now()
);
alter table public.notificacoes_vistas enable row level security;
drop policy if exists notificacoes_vistas_dono on public.notificacoes_vistas;
create policy notificacoes_vistas_dono on public.notificacoes_vistas
  for all using (perfil_id = auth.uid() and e_admin()) with check (perfil_id = auth.uid() and e_admin());
revoke all on public.notificacoes_vistas from anon;
grant select, insert, update on public.notificacoes_vistas to authenticated;

create or replace function public.diario_de_todas(p_dias integer default 30, p_limite integer default 300)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê o diário de todas.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(f order by f->>'criadoEm' desc)
    from (
      select jsonb_build_object(
        'id', d.id, 'caminho', d.caminho, 'refeicao', d.refeicao, 'legenda', d.legenda,
        'data', d.data, 'curtida', d.curtida, 'criadoEm', d.criado_em,
        'pacienteId', p.id, 'pacienteNome', p.nome) as f
      from diario_fotos d
      join pacientes p on p.id = d.paciente_id
      where d.data >= hoje_sp() - least(greatest(coalesce(p_dias, 30), 1), 365)
      order by d.criado_em desc
      limit least(greatest(coalesce(p_limite, 300), 1), 1000)
    ) x
  ), '[]'::jsonb);
end;
$$;

create or replace function public.notificacoes_da_nutri(p_dias integer default 14)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  desde timestamptz := now() - make_interval(days => least(greatest(coalesce(p_dias, 14), 1), 90));
  visto timestamptz;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê as notificações.' using errcode = '42501';
  end if;
  select visto_em into visto from notificacoes_vistas where perfil_id = auth.uid();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'tipo', n.tipo, 'pacienteId', n.paciente_id, 'pacienteNome', n.nome,
      'quando', n.quando, 'detalhe', n.detalhe, 'nova', visto is null or n.quando > visto)
      order by n.quando desc)
    from (
      select * from (
        -- Rastreabilidade: um registro novo (com ou sem sintoma).
        select 'rastreio'::text tipo, r.paciente_id, p.nome, r.criado_em quando,
               coalesce(a.nome, i.nome_livre, 'um alimento') ||
               case when coalesce(array_length(array_remove(r.sintomas, 'nenhum'), 1), 0) > 0 then ' · com sintoma' else '' end detalhe
          from reintroducao_registros r
          join pacientes p on p.id = r.paciente_id
          left join reintroducao_itens i on i.id = r.item_id
          left join reintroducao_alimentos a on a.id = i.alimento_id
         where r.criado_em >= desde
        union all
        -- Diário de fotos.
        select 'foto', d.paciente_id, p.nome, d.criado_em, d.refeicao
          from diario_fotos d join pacientes p on p.id = d.paciente_id
         where d.criado_em >= desde
        union all
        -- Check-in respondido.
        select 'checkin', e.paciente_id, p.nome, e.respondido_em, q.titulo
          from questionario_envios e
          join pacientes p on p.id = e.paciente_id
          join questionarios q on q.id = e.questionario_id
         where e.respondido_em >= desde
        union all
        -- Treino de força registrado.
        select 'treino', s.paciente_id, p.nome, s.criado_em, coalesce(t.nome, 'treino')
          from treino_sessoes s
          join pacientes p on p.id = s.paciente_id
          left join treinos t on t.id = s.treino_id
         where s.criado_em >= desde
        union all
        -- Cardio registrado.
        select 'cardio', c.paciente_id, p.nome, c.criado_em,
               c.tipo || coalesce(' · ' || c.duracao_min || ' min', '')
          from cardio_sessoes c join pacientes p on p.id = c.paciente_id
         where c.criado_em >= desde
        union all
        -- Meta marcada.
        select 'meta', m.paciente_id, p.nome, mr.criado_em, m.titulo
          from meta_registros mr
          join metas m on m.id = mr.meta_id
          join pacientes p on p.id = m.paciente_id
         where mr.criado_em >= desde
        union all
        -- Mensagem dela numa refeição do plano.
        select 'mensagem', mr.paciente_id, p.nome, mr.criado_em, mr.refeicao
          from mensagens_refeicao mr join pacientes p on p.id = mr.paciente_id
         where mr.autor = 'paciente' and mr.criado_em >= desde
        union all
        -- Ação do desafio enviada.
        select 'desafio', de.paciente_id, p.nome, de.enviado_em, coalesce(da.nome, 'uma ação')
          from desafio_envios de
          join pacientes p on p.id = de.paciente_id
          left join desafio_acoes da on da.id = de.acao_id
         where de.enviado_em >= desde
        union all
        -- Exame que ela mesma guardou.
        select 'exame', x.paciente_id, p.nome, x.criado_em, coalesce(x.descricao, x.nome)
          from exames x join pacientes p on p.id = x.paciente_id
         where x.origem = 'paciente' and x.criado_em >= desde
        union all
        -- Diário da viagem.
        select 'viagem', v.paciente_id, p.nome, v.atualizado_em, to_char(v.dia, 'DD/MM')
          from viagem_diario v join pacientes p on p.id = v.paciente_id
         where v.atualizado_em >= desde
      ) tudo
      order by quando desc
      limit 300
    ) n
  ), '[]'::jsonb);
end;
$$;

create or replace function public.marcar_notificacoes_vistas()
returns timestamptz
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  agora timestamptz := now();
begin
  if not e_admin() then
    raise exception 'Só a nutricionista.' using errcode = '42501';
  end if;
  insert into notificacoes_vistas (perfil_id, visto_em) values (auth.uid(), agora)
  on conflict (perfil_id) do update set visto_em = excluded.visto_em;
  return agora;
end;
$$;

revoke all on function public.diario_de_todas(integer, integer) from public, anon;
revoke all on function public.notificacoes_da_nutri(integer) from public, anon;
revoke all on function public.marcar_notificacoes_vistas() from public, anon;
grant execute on function public.diario_de_todas(integer, integer) to authenticated;
grant execute on function public.notificacoes_da_nutri(integer) to authenticated;
grant execute on function public.marcar_notificacoes_vistas() to authenticated;

-- Conserto do teto de 12 fotos por dia: contava pelo dia em UTC, e entre 21h e
-- meia-noite (horário de Brasília) o teto olhava o dia errado. Mesma função de
-- 0057, só essa linha mudou.
create or replace function registrar_diario_foto(
  p_caminho text, p_refeicao text, p_legenda text, p_data date)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
  v_data date := coalesce(p_data, hoje_sp());
  v_id uuid;
begin
  if not tem_acesso() then
    raise exception 'Seu acesso não está liberado.' using errcode = '42501';
  end if;
  v_paciente := meu_paciente_id();
  if v_paciente is null then
    raise exception 'Não encontrei o seu cadastro.' using errcode = '42501';
  end if;
  if coalesce(trim(p_caminho), '') = '' then
    raise exception 'Faltou a foto.' using errcode = '22023';
  end if;
  if split_part(p_caminho, '/', 1) <> v_paciente::text then
    raise exception 'A foto não está na sua pasta.' using errcode = '42501';
  end if;
  if v_data > hoje_sp() then
    raise exception 'Não dá para registrar uma refeição de amanhã.' using errcode = '22023';
  end if;
  if v_data < hoje_sp() - 7 then
    raise exception 'Só dá para registrar refeições dos últimos 7 dias.' using errcode = '22023';
  end if;
  if (select count(*) from diario_fotos where paciente_id = v_paciente and (criado_em at time zone 'America/Sao_Paulo')::date = hoje_sp()) >= 12 then
    raise exception 'Você já registrou 12 fotos hoje. Amanhã dá para continuar.' using errcode = '22023';
  end if;

  insert into diario_fotos (paciente_id, caminho, refeicao, legenda, data)
  values (v_paciente, trim(p_caminho), p_refeicao,
          nullif(left(trim(coalesce(p_legenda, '')), 300), ''), v_data)
  returning id into v_id;

  return v_id;
end;
$$;
