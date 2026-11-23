-- 0106 — Relatório de evolução para o médico (lote 3; aprovado por ela em 23/11/2026).
--
-- Guarda uma CÓPIA de cada relatório gerado: exatamente o que entrou no PDF
-- (período, para quem, as seções e o parecer dela), para baixar de novo igual
-- depois. Só a nutricionista. Apagar a paciente leva os relatórios junto (e a
-- lixeira da 0102 guarda e devolve, porque segue as chaves estrangeiras).

create table if not exists public.relatorios_medico (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  de date not null,
  ate date not null check (ate >= de),
  medico text check (medico is null or length(medico) <= 120),
  dados jsonb not null check (jsonb_typeof(dados) = 'object'),
  criado_em timestamptz not null default now()
);
create index if not exists relatorios_medico_paciente on public.relatorios_medico (paciente_id, criado_em desc);

alter table public.relatorios_medico enable row level security;
revoke all on public.relatorios_medico from anon, authenticated;
grant select, insert, delete on public.relatorios_medico to authenticated;
drop policy if exists relatorios_medico_admin on public.relatorios_medico;
create policy relatorios_medico_admin on public.relatorios_medico
  for all to authenticated using (e_admin()) with check (e_admin());
