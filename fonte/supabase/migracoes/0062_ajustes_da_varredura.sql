-- =============================================================================
-- 0062 — Ajustes da varredura de 01/10/2026
--
-- * `semana_de` e `situacao_cobranca` ficavam sem `search_path` fixo (aviso do
--   verificador de segurança do Supabase). Fixar não muda o resultado: as duas
--   só usam funções do próprio `public`.
-- * `pontos_arquivo` (0061) nasceu sem chave primária: `like ... including
--   defaults` não a copia. Cada linha do livro de pontos só é arquivada uma vez
--   (sai do livro na mesma operação), então o id basta como chave.
-- =============================================================================

alter function semana_de(date) set search_path = public;
alter function situacao_cobranca(text, date) set search_path = public;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conrelid = 'pontos_arquivo'::regclass and contype = 'p'
  ) then
    alter table pontos_arquivo add primary key (id);
  end if;
end;
$$;
