-- 0095 — Cozinha: receitas da nutricionista.
--
-- receitas            : a receita inteira. Os números (`numeros`) são calculados
--                       pelo app a partir dos gramas e da tabela escolhida (TACO,
--                       IBGE, USDA ou "Meus alimentos") no momento de salvar —
--                       nunca digitados à mão. Cada ingrediente guarda de onde
--                       veio (`fonte`, `alimento_id`, `alimento_nome`).
-- receitas_enviadas   : quais receitas ela mandou para qual paciente
--                       ("Enviadas para você" na Cozinha da paciente).
--
-- Quem vê o quê:
--   * nutricionista (e_admin): tudo;
--   * paciente com acesso ativo: as receitas PUBLICADAS e as enviadas para ela.
-- Favoritas usam a tabela `favoritos`, que já existe (tipo = 'receita').

create table if not exists public.receitas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(trim(titulo)) > 0),
  categoria text not null check (categoria in ('cafe', 'lanche', 'almoco_jantar', 'doce', 'outros')),
  minutos integer check (minutos is null or minutos between 0 and 1440),
  porcoes numeric not null default 1 check (porcoes > 0),
  tags text[] not null default '{}',
  ingredientes jsonb not null default '[]'::jsonb,
  preparo text[] not null default '{}',
  dica text,
  numeros jsonb,
  publicada boolean not null default false,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.receitas_enviadas (
  receita_id uuid not null references public.receitas(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  enviada_em timestamptz not null default now(),
  primary key (receita_id, paciente_id)
);

drop trigger if exists tocar_atualizado on public.receitas;
create trigger tocar_atualizado before update on public.receitas
  for each row execute function tocar_atualizado_em();

create index if not exists receitas_enviadas_paciente on public.receitas_enviadas (paciente_id);

alter table public.receitas enable row level security;
alter table public.receitas_enviadas enable row level security;

drop policy if exists receitas_admin on public.receitas;
create policy receitas_admin on public.receitas
  for all using (e_admin()) with check (e_admin());

drop policy if exists receitas_paciente on public.receitas;
create policy receitas_paciente on public.receitas
  for select using (
    ativo and tem_acesso() and (
      publicada
      or exists (
        select 1 from public.receitas_enviadas e
        where e.receita_id = receitas.id and e.paciente_id = meu_paciente_id()
      )
    )
  );

drop policy if exists receitas_enviadas_admin on public.receitas_enviadas;
create policy receitas_enviadas_admin on public.receitas_enviadas
  for all using (e_admin()) with check (e_admin());

drop policy if exists receitas_enviadas_paciente on public.receitas_enviadas;
create policy receitas_enviadas_paciente on public.receitas_enviadas
  for select using (paciente_id = meu_paciente_id() and tem_acesso());

revoke all on public.receitas, public.receitas_enviadas from anon;
grant select, insert, update, delete on public.receitas, public.receitas_enviadas to authenticated;

-- Conferência: as duas tabelas, com RLS ligado.
select relname, relrowsecurity from pg_class
where relname in ('receitas', 'receitas_enviadas') and relnamespace = 'public'::regnamespace;
