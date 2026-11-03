-- =============================================================================
-- 0084 — carimbo do conteúdo que o paciente enxerga
--
-- O app pergunta isto de tempos em tempos. Se a resposta muda, aparece o aviso
-- "Atualização disponível". A função devolve só um texto (um resumo), nunca
-- dado: não há o que vazar por aqui.
--
-- Entram só as coisas que a nutricionista altera e que aparecem para o paciente.
-- Ficam de fora as que o próprio paciente grava (registros, fotos, treino
-- editável): senão ele veria o aviso por causa do que ele mesmo fez.
-- =============================================================================

create or replace function meu_carimbo_de_conteudo()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  pid uuid := meu_paciente_id();
  partes text[] := '{}';
begin
  -- Catálogo e textos de todos: tamanho + última alteração (barato mesmo com
  -- muitas linhas, e a contagem pega o que foi apagado).
  partes := partes || (select count(*)::text || coalesce(max(atualizado_em)::text, '') from alimentos);
  partes := partes || (select count(*)::text || coalesce(max(atualizado_em)::text, '') from equivalencias);
  partes := partes || (select count(*)::text || coalesce(max(atualizado_em)::text, '') from grupos_alimentares);
  partes := partes || (select count(*)::text || coalesce(max(atualizado_em)::text, '') from grupos_protocolo);
  partes := partes || (select count(*)::text || coalesce(max(atualizado_em)::text, '') from conteudos);
  partes := partes || (select count(*)::text || coalesce(max(atualizado_em)::text, '') from configuracoes);
  partes := partes || (select count(*)::text || coalesce(max(atualizado_em)::text, '') from desafios);
  partes := partes || (select count(*)::text || coalesce(max(atualizado_em)::text, '') from desafio_acoes);

  -- Só do próprio paciente: resumo da linha inteira, para pegar qualquer campo.
  partes := partes || coalesce((select md5(string_agg(t::text, '|' order by t::text)) from protocolos t where t.paciente_id = pid), '');
  partes := partes || coalesce((select md5(string_agg(t::text, '|' order by t::text)) from metas t where t.paciente_id = pid), '');
  partes := partes || coalesce((select md5(string_agg(t::text, '|' order by t::text)) from metas_semanais t where t.paciente_id = pid), '');
  partes := partes || coalesce((select md5(string_agg(t::text, '|' order by t::text)) from avaliacoes_fisicas t where t.paciente_id = pid), '');
  partes := partes || coalesce((select md5(string_agg(t::text, '|' order by t::text)) from paciente_fases t where t.paciente_id = pid), '');
  partes := partes || coalesce((select md5(t::text) from pacientes t where t.id = pid), '');
  partes := partes || coalesce((select md5(t::text) from hotslim_participantes t where t.id = auth.uid()), '');

  return md5(array_to_string(partes, '#'));
end;
$$;

revoke all on function meu_carimbo_de_conteudo() from public, anon;
grant execute on function meu_carimbo_de_conteudo() to authenticated;
