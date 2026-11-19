-- 0097 — Agenda da nutricionista.
--
-- Um calendário só dela, dentro do app: consultas, visitas, compromissos
-- pessoais. Ela pediu "um só meu", sem Google Agenda.
--
-- agenda_eventos : cada compromisso. `paciente_id` é opcional (uma visita ou
--                  um compromisso pessoal não tem paciente).
--
-- Quem vê o quê: SÓ a nutricionista (e_admin). Paciente não lê nem a própria
-- linha — a agenda tem compromisso pessoal dela, que não é da conta de
-- ninguém. As consultas que ela já marca no prontuário continuam na tabela
-- `consultas` (0035); a tela da agenda mostra as duas juntas, sem copiar.

create table if not exists public.agenda_eventos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(trim(titulo)) between 1 and 200),
  tipo text not null default 'pessoal' check (tipo in ('consulta', 'visita', 'pessoal', 'outro')),
  data date not null,
  -- Nulas = o dia inteiro. Nula não é meia-noite.
  hora_inicio time,
  hora_fim time,
  local text,
  observacao text,
  paciente_id uuid references public.pacientes(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint agenda_fim_depois_do_inicio check (hora_fim is null or hora_inicio is null or hora_fim >= hora_inicio),
  constraint agenda_fim_precisa_inicio check (hora_fim is null or hora_inicio is not null)
);

create index if not exists agenda_eventos_data on public.agenda_eventos (data);

drop trigger if exists tocar_atualizado on public.agenda_eventos;
create trigger tocar_atualizado before update on public.agenda_eventos
  for each row execute function tocar_atualizado_em();

alter table public.agenda_eventos enable row level security;

drop policy if exists agenda_eventos_admin on public.agenda_eventos;
create policy agenda_eventos_admin on public.agenda_eventos
  for all using (e_admin()) with check (e_admin());

revoke all on public.agenda_eventos from anon;
grant select, insert, update, delete on public.agenda_eventos to authenticated;
