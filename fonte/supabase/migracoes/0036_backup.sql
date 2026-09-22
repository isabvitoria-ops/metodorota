-- =============================================================================
-- CENTRAL DO PACIENTE — 0036: baixar um backup de tudo
--
-- "Não substitui o backup automático, mas tira você do zero absoluto."
--
-- No plano gratuito o Supabase NÃO guarda cópia do banco. Se algo corromper
-- os dados, não existe volta — e o que está lá dentro é prontuário: peso,
-- dobras, tolerância alimentar, protocolo. Esta função é a rede provisória
-- até ela assinar o plano com backup diário.
--
-- É UMA FUNÇÃO E NÃO TRINTA CONSULTAS porque um backup montado de trinta
-- idas ao banco pode pegar a tabela A antes de uma escrita e a tabela B
-- depois, e gravar um arquivo internamente inconsistente. Uma função só roda
-- numa transação só: o arquivo é uma fotografia de um instante.
--
-- O QUE NÃO ENTRA: `auth.users`, senhas e tokens. Não são do esquema dela,
-- não há como recriá-los a partir daqui, e um arquivo no Drive com hash de
-- senha é um risco sem nenhum ganho. Quem restaura convida de novo.
--
-- SÓ A NUTRICIONISTA. Esta função devolve a clínica inteira numa resposta:
-- é o alvo mais valioso do banco, e a bateria prova a recusa para a paciente.
-- =============================================================================

create or replace function exportar_tudo()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista baixa o backup.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'versao', 1,
    'gerado_em', now(),
    'aviso', 'Backup da Central do Paciente. Contém dado clínico: guarde em lugar seguro.',

    'planos', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from planos t),
    'pacientes', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from pacientes t),
    'perfis', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from perfis t),
    'convites', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from convites t),

    'unidades', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from unidades t),
    'grupos_alimentares', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from grupos_alimentares t),
    'alimentos', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from alimentos t),
    'alimentos_marcadores', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from alimentos_marcadores t),
    'equivalencias', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from equivalencias t),
    'conteudos', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from conteudos t),
    'configuracoes', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from configuracoes t),

    'protocolos', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from protocolos t),
    'grupos_protocolo', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from grupos_protocolo t),
    'avaliacoes_fisicas', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from avaliacoes_fisicas t),
    'consultas', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from consultas t),

    'metas', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from metas t),
    'meta_registros', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from meta_registros t),

    'treinos', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from treinos t),
    'treino_exercicios', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from treino_exercicios t),
    'treino_sessoes', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from treino_sessoes t),
    'treino_series', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from treino_series t),
    'cardio_sessoes', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from cardio_sessoes t),
    'metas_semanais', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from metas_semanais t),

    'reintroducao_alimentos', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from reintroducao_alimentos t),
    'reintroducao_acompanhamento', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from reintroducao_acompanhamento t),
    'reintroducao_itens', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from reintroducao_itens t),
    'reintroducao_registros', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from reintroducao_registros t),

    'desafios', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from desafios t),
    'desafio_acoes', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from desafio_acoes t),
    'desafio_participantes', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from desafio_participantes t),
    'desafio_envios', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from desafio_envios t),
    'pontos_lancamentos', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from pontos_lancamentos t),
    'indicacoes', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from indicacoes t),
    'recompensas', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from recompensas t),
    'indicacao_beneficios', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from indicacao_beneficios t),

    'historico_admin', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from historico_admin t)
  );
end;
$$;

revoke all on function exportar_tudo() from anon, public;
grant execute on function exportar_tudo() to authenticated;
