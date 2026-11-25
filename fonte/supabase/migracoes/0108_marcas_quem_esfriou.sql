-- 0108 — "Feito" e "Ignorar" do Precisa de um oi (pedido dela em 25/11/2026,
-- aprovada a tabela nova no mesmo dia).
--
-- Uma marca por paciente: o que ela decidiu (feito ou ignorado), em que dia,
-- e a ASSINATURA dos motivos daquele dia. O app compara a assinatura com os
-- motivos de hoje: mudou o motivo, a paciente volta para a lista. Só a
-- nutricionista lê e escreve. Apagar a paciente leva a marca junto (e a
-- lixeira da 0102 guarda e devolve, porque segue as chaves estrangeiras).

create table if not exists public.marcas_quem_esfriou (
  paciente_id uuid primary key references public.pacientes(id) on delete cascade,
  como text not null check (como in ('feito', 'ignorado')),
  assinatura text not null check (length(assinatura) <= 4000),
  em date not null default hoje_sp(),
  atualizado_em timestamptz not null default now()
);

alter table public.marcas_quem_esfriou enable row level security;
revoke all on public.marcas_quem_esfriou from anon, authenticated;
grant select, insert, update, delete on public.marcas_quem_esfriou to authenticated;
drop policy if exists marcas_quem_esfriou_admin on public.marcas_quem_esfriou;
create policy marcas_quem_esfriou_admin on public.marcas_quem_esfriou
  for all to authenticated using (e_admin()) with check (e_admin());
