-- =============================================================================
-- 0082a — Desafio Hot Slim: tabelas, funções e políticas
--
-- ESTA MIGRAÇÃO JÁ ESTAVA EM PRODUÇÃO (aplicada em 27/10/2026 com o nome
-- `hotslim_tables_and_functions`) e nunca tinha sido salva aqui. Sem ela, a
-- 0083 — que usa `e_hotslim()` e `hotslim_participantes` — não aplica num banco
-- limpo, e a bateria de testes do banco parava ali.
--
-- O conteúdo é o que rodou em produção, só reescrito para poder rodar de novo
-- sem erro (`if not exists`, `drop ... if exists`). O `meu_acesso()` que vinha
-- junto não é repetido: a 0083 o redefine logo em seguida.
-- =============================================================================

-- 1. O papel 'hotslim' passa a ser aceito
alter table perfis drop constraint if exists perfis_papel_check;
alter table perfis add constraint perfis_papel_check
  check (papel = any (array['admin'::text, 'paciente'::text, 'hotslim'::text]));

-- 2. Participantes do desafio
create table if not exists hotslim_participantes (
  id              uuid primary key references perfis(id) on delete cascade,
  nome            text not null,
  email           text not null,
  telefone        text,
  data_inicio     date not null default hoje_sp(),
  data_fim        date not null default (hoje_sp() + 10),
  fases_liberadas int[] not null default '{}',
  ativo           boolean not null default true,
  criado_em       timestamptz not null default now()
);

alter table hotslim_participantes enable row level security;

drop policy if exists "hotslim_participante_ve_seu" on hotslim_participantes;
create policy "hotslim_participante_ve_seu" on hotslim_participantes
  for select using (id = auth.uid());

drop policy if exists "hotslim_admin_tudo" on hotslim_participantes;
create policy "hotslim_admin_tudo" on hotslim_participantes
  for all using (e_admin());

-- 3. Checklist diário
create table if not exists hotslim_checklist (
  id                 uuid primary key default gen_random_uuid(),
  participante_id    uuid not null references hotslim_participantes(id) on delete cascade,
  dia                date not null default hoje_sp(),
  intestino_regulou  boolean not null default false,
  sem_gases          boolean not null default false,
  dormiu_bem         boolean not null default false,
  barriga_desinchada boolean not null default false,
  sem_compulsao      boolean not null default false,
  energia_boa        boolean not null default false,
  humor_estavel      boolean not null default false,
  notas              text,
  criado_em          timestamptz not null default now(),
  unique (participante_id, dia)
);

alter table hotslim_checklist enable row level security;

drop policy if exists "checklist_participante_ve_seu" on hotslim_checklist;
create policy "checklist_participante_ve_seu" on hotslim_checklist
  for select using (participante_id = auth.uid());

drop policy if exists "checklist_participante_edita_seu" on hotslim_checklist;
create policy "checklist_participante_edita_seu" on hotslim_checklist
  for insert with check (participante_id = auth.uid());

drop policy if exists "checklist_participante_atualiza_seu" on hotslim_checklist;
create policy "checklist_participante_atualiza_seu" on hotslim_checklist
  for update using (participante_id = auth.uid());

drop policy if exists "checklist_admin_tudo" on hotslim_checklist;
create policy "checklist_admin_tudo" on hotslim_checklist
  for all using (e_admin());

-- 4. Metas semanais
create table if not exists hotslim_metas (
  id               uuid primary key default gen_random_uuid(),
  participante_id  uuid not null references hotslim_participantes(id) on delete cascade,
  semana           int not null check (semana >= 1),
  agua_litros      numeric,
  sono_horas       numeric,
  musculacao_vezes int,
  cardio_minutos   int,
  metas_extras     text[] not null default '{}',
  criado_em        timestamptz not null default now(),
  unique (participante_id, semana)
);

alter table hotslim_metas enable row level security;

drop policy if exists "metas_participante_ve_seu" on hotslim_metas;
create policy "metas_participante_ve_seu" on hotslim_metas
  for select using (participante_id = auth.uid());

drop policy if exists "metas_participante_insere_seu" on hotslim_metas;
create policy "metas_participante_insere_seu" on hotslim_metas
  for insert with check (participante_id = auth.uid());

drop policy if exists "metas_participante_atualiza_seu" on hotslim_metas;
create policy "metas_participante_atualiza_seu" on hotslim_metas
  for update using (participante_id = auth.uid());

drop policy if exists "metas_admin_tudo" on hotslim_metas;
create policy "metas_admin_tudo" on hotslim_metas
  for all using (e_admin());

-- 5. É participante ativo do Hot Slim?
create or replace function e_hotslim()
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from hotslim_participantes
     where id = auth.uid() and ativo = true
  );
$$;
