-- 0104 — o carimbo do conteúdo deixa de mudar sozinho (pedido dela, 23/11/2026:
-- "toda hora fica aparecendo atualização disponível até quando não tem").
--
-- A causa: o carimbo resumia a linha INTEIRA da paciente, e `ultimo_acesso`
-- muda toda vez que ela abre o app (registrar_acesso). Um minuto depois de
-- abrir, o carimbo era outro e a faixa "Atualização disponível" aparecia sem
-- nada novo. Agora ficam de fora os campos que mudam sem a nutricionista
-- mexer: ultimo_acesso, atualizado_em e perfil_id (o vínculo da conta).

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
  partes := partes || (select count(*)::text || coalesce(max(atualizado_em)::text, '') from alimentos);
  partes := partes || (select count(*)::text || coalesce(max(atualizado_em)::text, '') from equivalencias);
  partes := partes || (select count(*)::text || coalesce(max(atualizado_em)::text, '') from grupos_alimentares);
  partes := partes || (select count(*)::text || coalesce(max(atualizado_em)::text, '') from grupos_protocolo);
  partes := partes || (select count(*)::text || coalesce(max(atualizado_em)::text, '') from conteudos);
  partes := partes || (select count(*)::text || coalesce(max(atualizado_em)::text, '') from configuracoes);
  partes := partes || (select count(*)::text || coalesce(max(atualizado_em)::text, '') from desafios);
  partes := partes || (select count(*)::text || coalesce(max(atualizado_em)::text, '') from desafio_acoes);

  partes := partes || coalesce((select md5(string_agg(t::text, '|' order by t::text)) from protocolos t where t.paciente_id = pid), '');
  partes := partes || coalesce((select md5(string_agg(t::text, '|' order by t::text)) from metas t where t.paciente_id = pid), '');
  partes := partes || coalesce((select md5(string_agg(t::text, '|' order by t::text)) from metas_semanais t where t.paciente_id = pid), '');
  partes := partes || coalesce((select md5(string_agg(t::text, '|' order by t::text)) from avaliacoes_fisicas t where t.paciente_id = pid), '');
  partes := partes || coalesce((select md5(string_agg(t::text, '|' order by t::text)) from paciente_fases t where t.paciente_id = pid), '');
  partes := partes || coalesce((select md5((to_jsonb(t) - 'ultimo_acesso' - 'atualizado_em' - 'perfil_id')::text)
                                  from pacientes t where t.id = pid), '');
  partes := partes || coalesce((select md5(t::text) from hotslim_participantes t where t.id = auth.uid()), '');

  return md5(array_to_string(partes, '#'));
end;
$$;

revoke all on function meu_carimbo_de_conteudo() from public, anon;
grant execute on function meu_carimbo_de_conteudo() to authenticated;
