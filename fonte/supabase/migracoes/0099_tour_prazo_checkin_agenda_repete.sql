-- 0099 — Lote 1 da auditoria DietSystem (aprovado por ela em 23/11/2026).
--
-- 1. Agenda: compromisso que se repete (toda semana, a cada 15 dias, todo mês).
-- 2. Check-in: prazo para responder, e a resposta fora do prazo marcada como
--    atrasada (fica guardada, sai da conta da semana).
-- 3. Tour do app na primeira vez: os passos que ela escreve, e quem já viu.
--
-- O grupo Intestino do pedido de exames não precisa de banco (é uma lista na
-- tela e sai no PDF; nada do pedido é gravado).

-- ---------------------------------------------------------------------------
-- 1. Agenda que se repete
-- ---------------------------------------------------------------------------
-- A repetição é uma REGRA guardada no compromisso, e não uma linha por dia:
-- "Treino toda segunda" não vira 52 linhas que ela teria de apagar uma a uma.
-- A tela desenha os dias. `excecoes` são os dias em que ela apagou só aquele.
alter table public.agenda_eventos
  add column if not exists repete text not null default 'nao',
  add column if not exists dias_semana smallint[] not null default '{}',
  add column if not exists repete_ate date,
  add column if not exists excecoes date[] not null default '{}';

alter table public.agenda_eventos drop constraint if exists agenda_repete_valido;
alter table public.agenda_eventos add constraint agenda_repete_valido
  check (repete in ('nao', 'semanal', 'quinzenal', 'mensal'));
alter table public.agenda_eventos drop constraint if exists agenda_dias_semana_validos;
alter table public.agenda_eventos add constraint agenda_dias_semana_validos
  check (dias_semana <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]);
alter table public.agenda_eventos drop constraint if exists agenda_repete_ate_depois;
alter table public.agenda_eventos add constraint agenda_repete_ate_depois
  check (repete_ate is null or repete_ate >= data);

-- ---------------------------------------------------------------------------
-- 2. Prazo do check-in
-- ---------------------------------------------------------------------------
-- O check-in semanal abre na segunda-feira (é o `periodo`). Com prazo de N
-- dias, fecha às 23:59 do N-ésimo dia, no horário de Brasília. Sem prazo
-- (nulo, o padrão), tudo continua como antes: nenhuma paciente passa a ter
-- resposta atrasada no dia em que isto entra no ar.
alter table public.questionarios
  add column if not exists prazo_dias smallint;
alter table public.questionarios drop constraint if exists questionarios_prazo_valido;
alter table public.questionarios add constraint questionarios_prazo_valido
  check (prazo_dias is null or prazo_dias between 1 and 7);

alter table public.questionario_envios
  add column if not exists atrasado boolean not null default false;

-- Marca na hora de gravar, e fica marcado: se ela mudar o prazo depois, as
-- semanas que já passaram não mudam de classificação.
create or replace function public.marcar_envio_atrasado()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_periodicidade text;
  v_prazo smallint;
begin
  select periodicidade, prazo_dias into v_periodicidade, v_prazo
    from questionarios where id = new.questionario_id;
  new.atrasado := v_periodicidade = 'semanal'
    and v_prazo is not null
    and (new.respondido_em at time zone 'America/Sao_Paulo')::date > new.periodo + (v_prazo - 1);
  return new;
end;
$$;

drop trigger if exists marcar_envio_atrasado on public.questionario_envios;
create trigger marcar_envio_atrasado before insert or update of respondido_em, periodo
  on public.questionario_envios
  for each row execute function public.marcar_envio_atrasado();

create or replace function public.definir_prazo_questionario(p_questionario uuid, p_dias integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista.' using errcode = '42501';
  end if;
  if p_dias is not null and (p_dias < 1 or p_dias > 7) then
    raise exception 'O prazo vai de 1 a 7 dias.' using errcode = '22023';
  end if;
  update questionarios set prazo_dias = p_dias where id = p_questionario;
  if not found then
    raise exception 'Não achei este questionário.' using errcode = 'P0002';
  end if;
end;
$$;

-- Nutricionista: o prazo de cada questionário.
create or replace function public.prazos_dos_questionarios()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('questionarioId', id, 'prazoDias', prazo_dias))
      from questionarios
  ), '[]'::jsonb);
end;
$$;

-- Nutricionista: as respostas atrasadas de uma paciente (saem da conta da semana).
create or replace function public.atrasos_do_paciente(p_paciente uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('questionarioId', questionario_id, 'periodo', periodo))
      from questionario_envios
     where paciente_id = p_paciente and atrasado
  ), '[]'::jsonb);
end;
$$;

-- Paciente: até quando responder cada check-in desta semana, e quais semanas
-- dela ficaram atrasadas.
create or replace function public.meus_prazos()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_paciente uuid := meu_paciente_id();
  v_semana date := semana_de(hoje_sp());
begin
  if v_paciente is null or not tem_acesso() then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'questionarioId', q.id,
      'prazoDias', q.prazo_dias,
      'venceEm', case when q.prazo_dias is null then null else v_semana + (q.prazo_dias - 1) end,
      'atrasados', coalesce((
        select jsonb_agg(e.periodo order by e.periodo)
          from questionario_envios e
         where e.questionario_id = q.id and e.paciente_id = v_paciente and e.atrasado
      ), '[]'::jsonb)))
      from questionarios q
      join questionario_pacientes a on a.questionario_id = q.id and a.paciente_id = v_paciente
     where q.ativo and q.periodicidade = 'semanal'
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Tour do app
-- ---------------------------------------------------------------------------
-- `area`: nula vale para todas; senão é a chave da área do app (a mesma de
-- `pacientes.areas_desligadas`) ou 'rastreio'. A tela pula o passo de área
-- que a paciente não tem ligada.
create table if not exists public.tour_passos (
  id uuid primary key default gen_random_uuid(),
  ordem integer not null default 0,
  area text,
  titulo text not null check (length(trim(titulo)) between 1 and 80),
  texto text not null check (length(trim(texto)) between 1 and 400),
  video_url text check (video_url is null or video_url ~ '^https://'),
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now()
);

drop trigger if exists tocar_atualizado on public.tour_passos;
create trigger tocar_atualizado before update on public.tour_passos
  for each row execute function tocar_atualizado_em();

alter table public.tour_passos enable row level security;
drop policy if exists tour_passos_leitura on public.tour_passos;
create policy tour_passos_leitura on public.tour_passos
  for select to authenticated using (ativo or e_admin());
drop policy if exists tour_passos_admin on public.tour_passos;
create policy tour_passos_admin on public.tour_passos
  for all to authenticated using (e_admin()) with check (e_admin());
revoke all on public.tour_passos from anon;
grant select, insert, update, delete on public.tour_passos to authenticated;

create table if not exists public.tour_vistos (
  perfil_id uuid primary key references public.perfis(id) on delete cascade,
  visto_em timestamptz not null default now()
);
alter table public.tour_vistos enable row level security;
revoke all on public.tour_vistos from anon, authenticated;
grant select on public.tour_vistos to authenticated;
drop policy if exists tour_vistos_leitura on public.tour_vistos;
create policy tour_vistos_leitura on public.tour_vistos
  for select to authenticated using (perfil_id = auth.uid() or e_admin());

create or replace function public.concluir_tour()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Entre na sua conta.' using errcode = '42501';
  end if;
  insert into tour_vistos (perfil_id) values (auth.uid())
  on conflict (perfil_id) do update set visto_em = now();
end;
$$;

-- Os passos de partida. São textos de tela, não conteúdo clínico, e ela
-- edita todos em Configurações. Só entram se a tabela estiver vazia.
insert into public.tour_passos (ordem, area, titulo, texto)
select * from (values
  (1, null, 'Boas-vindas', 'Este é o app do seu acompanhamento. Em um minuto eu te mostro onde fica cada coisa.'),
  (2, null, 'Seu plano', 'Em Protocolo Alimentar está o seu plano, refeição por refeição, com as trocas de cada alimento.'),
  (3, 'trocas', 'Trocas', 'Quer trocar um alimento? Na Troca inteligente você escolhe o alimento e vê pelo que dá para trocar, na quantidade certa.'),
  (4, 'rastreio', 'Rastreabilidade', 'Aqui você registra o alimento que testou e como se sentiu depois. Um toque já vale como registro.'),
  (5, 'checkin', 'Check-in', 'Toda semana chega um check-in curto. Ele me ajuda a ver como foi a sua semana.'),
  (6, 'diario', 'Diário de fotos', 'Fotografe o prato e eu acompanho por aqui.')
) as v(ordem, area, titulo, texto)
where not exists (select 1 from public.tour_passos);

-- ---------------------------------------------------------------------------
revoke all on function public.definir_prazo_questionario(uuid, integer) from public, anon;
revoke all on function public.prazos_dos_questionarios() from public, anon;
revoke all on function public.atrasos_do_paciente(uuid) from public, anon;
revoke all on function public.meus_prazos() from public, anon;
revoke all on function public.concluir_tour() from public, anon;
grant execute on function public.definir_prazo_questionario(uuid, integer) to authenticated;
grant execute on function public.prazos_dos_questionarios() to authenticated;
grant execute on function public.atrasos_do_paciente(uuid) to authenticated;
grant execute on function public.meus_prazos() to authenticated;
grant execute on function public.concluir_tour() to authenticated;
