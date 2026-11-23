-- 0101 — Medicamentos × nutrientes (N31, aprovado por ela em 23/11/2026).
--
-- Decisão dela: "medicamento é uma coisa séria e é só eu que vou fazer as
-- anotações". Por isso:
--   * NADA aqui é escrito por IA e NADA aparece para a paciente: as duas
--     tabelas são só da nutricionista (RLS com e_admin(), sem leitura da
--     paciente, sem acesso de visitante);
--   * a base de partida traz só o que tem fonte publicada, e entra como
--     "para conferir" (conferido_em nulo). Só depois que ela marca que
--     conferiu é que a entrada vale para o lembrete do pedido de exames e
--     para o PDF.
--
-- 1. base_medicamentos: a base dela. Uma linha por medicamento ou classe,
--    com os nomes que casam (termos) e os nutrientes a acompanhar, cada um
--    com a sua fonte.
-- 2. paciente_medicamentos: o que cada paciente usa (remédio, suplemento ou
--    fitoterápico), com dose, horário, desde quando, quem prescreveu e a
--    anotação dela.

create table if not exists public.base_medicamentos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 1 and 80),
  termos text[] not null default '{}',
  -- [{ "nutriente": "Vitamina B12", "fonte": "Lam JR et al. JAMA 2013…" }]
  nutrientes jsonb not null default '[]'::jsonb check (jsonb_typeof(nutrientes) = 'array'),
  -- Nulo = ainda não conferido por ela: não vale para lembrete nem PDF.
  conferido_em date,
  anotacao text check (anotacao is null or length(anotacao) <= 2000),
  atualizado_em timestamptz not null default now()
);

drop trigger if exists tocar_atualizado on public.base_medicamentos;
create trigger tocar_atualizado before update on public.base_medicamentos
  for each row execute function tocar_atualizado_em();

alter table public.base_medicamentos enable row level security;
revoke all on public.base_medicamentos from anon, authenticated;
grant select, insert, update, delete on public.base_medicamentos to authenticated;
drop policy if exists base_medicamentos_admin on public.base_medicamentos;
create policy base_medicamentos_admin on public.base_medicamentos
  for all to authenticated using (e_admin()) with check (e_admin());

create table if not exists public.paciente_medicamentos (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  nome text not null check (length(trim(nome)) between 1 and 120),
  tipo text not null default 'medicamento' check (tipo in ('medicamento', 'suplemento', 'fitoterapico')),
  dose text check (dose is null or length(dose) <= 120),
  horario text check (horario is null or length(horario) <= 120),
  desde text check (desde is null or length(desde) <= 40),
  prescrito_por text check (prescrito_por is null or length(prescrito_por) <= 120),
  anotacao text check (anotacao is null or length(anotacao) <= 2000),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists paciente_medicamentos_paciente on public.paciente_medicamentos (paciente_id);

drop trigger if exists tocar_atualizado on public.paciente_medicamentos;
create trigger tocar_atualizado before update on public.paciente_medicamentos
  for each row execute function tocar_atualizado_em();

alter table public.paciente_medicamentos enable row level security;
revoke all on public.paciente_medicamentos from anon, authenticated;
grant select, insert, update, delete on public.paciente_medicamentos to authenticated;
drop policy if exists paciente_medicamentos_admin on public.paciente_medicamentos;
create policy paciente_medicamentos_admin on public.paciente_medicamentos
  for all to authenticated using (e_admin()) with check (e_admin());

-- Base de partida: só o que tem fonte publicada (PubMed), e PARA CONFERIR.
-- Entra só se a base estiver vazia, para nunca sobrescrever o que ela editou.
insert into public.base_medicamentos (nome, termos, nutrientes)
select * from (values
  ('Inibidores da bomba de prótons (IBP)',
   array['omeprazol', 'esomeprazol', 'pantoprazol', 'lansoprazol', 'dexlansoprazol', 'rabeprazol'],
   jsonb_build_array(
     jsonb_build_object('nutriente', 'Vitamina B12',
       'fonte', 'Lam JR et al. Proton pump inhibitor and histamine 2 receptor antagonist use and vitamin B12 deficiency. JAMA 2013;310(22):2435-42. doi:10.1001/jama.2013.280490. PMID 24327038'),
     jsonb_build_object('nutriente', 'Ferro',
       'fonte', 'Lam JR et al. Proton pump inhibitor and histamine-2 receptor antagonist use and iron deficiency. Gastroenterology 2017;152(4):821-829.e1. doi:10.1053/j.gastro.2016.11.023. PMID 27890768'),
     jsonb_build_object('nutriente', 'Magnésio',
       'fonte', 'Cheungpasitporn W et al. Proton pump inhibitors linked to hypomagnesemia: a systematic review and meta-analysis of observational studies. Ren Fail 2015;37(7):1237-41. doi:10.3109/0886022X.2015.1057800. PMID 26108134'))),
  ('Metformina',
   array['metformina'],
   jsonb_build_array(
     jsonb_build_object('nutriente', 'Vitamina B12',
       'fonte', 'Aroda VR et al. Long-term metformin use and vitamin B12 deficiency in the Diabetes Prevention Program Outcomes Study. J Clin Endocrinol Metab 2016;101(4):1754-61. doi:10.1210/jc.2015-3754. PMID 26900641')))
) as v(nome, termos, nutrientes)
where not exists (select 1 from public.base_medicamentos);
