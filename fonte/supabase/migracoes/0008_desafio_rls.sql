-- =============================================================================
-- CENTRAL DO PACIENTE — 0008: quem pode o quê no desafio
--
-- O desenho é curto de explicar: a paciente LÊ. Ela não escreve em lugar
-- nenhum que vire ponto. Não há política de insert, update ou delete para ela
-- em `desafio_envios`, `pontos_lancamentos` ou `indicacoes` — o caminho é
-- sempre uma função `security definer` do 0007, que confere as regras antes.
--
-- Isso é o que responde ao §44 (anti-fraude): não é o app que impede, é o
-- banco. Tirar o app do caminho não abre porta nenhuma.
-- =============================================================================

alter table desafios enable row level security;
alter table desafio_acoes enable row level security;
alter table desafio_participantes enable row level security;
alter table desafio_envios enable row level security;
alter table pontos_lancamentos enable row level security;
alter table indicacoes enable row level security;
alter table recompensas enable row level security;

-- -----------------------------------------------------------------------------
-- Desafios e ações: conteúdo, lido por quem tem acesso válido
-- -----------------------------------------------------------------------------

drop policy if exists desafios_leitura on desafios;
create policy desafios_leitura on desafios for select
  using (e_admin() or (status <> 'rascunho' and tem_acesso()));

drop policy if exists desafios_admin on desafios;
create policy desafios_admin on desafios for all
  using (e_admin()) with check (e_admin());

drop policy if exists acoes_leitura on desafio_acoes;
create policy acoes_leitura on desafio_acoes for select
  using (
    e_admin() or (
      tem_acesso()
      and exists (select 1 from desafios d where d.id = desafio_id and d.status <> 'rascunho')
    )
  );

drop policy if exists acoes_admin on desafio_acoes;
create policy acoes_admin on desafio_acoes for all
  using (e_admin()) with check (e_admin());

-- -----------------------------------------------------------------------------
-- Participação
--
-- A paciente lê a lista de participantes do desafio porque o ranking depende
-- disso — mas a linha não carrega nada além do vínculo. Nome, e-mail, plano e
-- datas continuam atrás da política de `pacientes`, que não mudou.
-- -----------------------------------------------------------------------------

drop policy if exists participantes_leitura on desafio_participantes;
create policy participantes_leitura on desafio_participantes for select
  using (e_admin() or tem_acesso());

drop policy if exists participantes_admin on desafio_participantes;
create policy participantes_admin on desafio_participantes for all
  using (e_admin()) with check (e_admin());

-- -----------------------------------------------------------------------------
-- Envios: cada uma vê os seus
-- -----------------------------------------------------------------------------

drop policy if exists envios_leitura on desafio_envios;
create policy envios_leitura on desafio_envios for select
  using (e_admin() or paciente_id = meu_paciente_id());

drop policy if exists envios_admin on desafio_envios;
create policy envios_admin on desafio_envios for all
  using (e_admin()) with check (e_admin());

-- Repare no que NÃO existe: política de insert/update/delete para paciente.
-- Marcar uma ação passa por `enviar_acao()`; desfazer, por `cancelar_envio()`.

-- -----------------------------------------------------------------------------
-- Ledger: leitura do próprio histórico, e nada mais
-- -----------------------------------------------------------------------------

drop policy if exists lancamentos_leitura on pontos_lancamentos;
create policy lancamentos_leitura on pontos_lancamentos for select
  using (e_admin() or paciente_id = meu_paciente_id());

drop policy if exists lancamentos_admin on pontos_lancamentos;
create policy lancamentos_admin on pontos_lancamentos for all
  using (e_admin()) with check (e_admin());

-- -----------------------------------------------------------------------------
-- Indicações
-- -----------------------------------------------------------------------------

drop policy if exists indicacoes_leitura on indicacoes;
create policy indicacoes_leitura on indicacoes for select
  using (e_admin() or paciente_indicadora_id = meu_paciente_id());

drop policy if exists indicacoes_admin on indicacoes;
create policy indicacoes_admin on indicacoes for all
  using (e_admin()) with check (e_admin());

-- -----------------------------------------------------------------------------
-- Recompensas: tabela de leitura para todo mundo com acesso
-- -----------------------------------------------------------------------------

drop policy if exists recompensas_leitura on recompensas;
create policy recompensas_leitura on recompensas for select
  using (e_admin() or (ativo and tem_acesso()));

drop policy if exists recompensas_admin on recompensas;
create policy recompensas_admin on recompensas for all
  using (e_admin()) with check (e_admin());

-- -----------------------------------------------------------------------------
-- Permissões de execução
-- -----------------------------------------------------------------------------

grant execute on function enviar_acao(uuid, text) to authenticated;
grant execute on function cancelar_envio(uuid) to authenticated;
grant execute on function registrar_indicacao(text, text, text) to authenticated;
grant execute on function ranking_do_desafio(uuid) to authenticated;
grant execute on function saldo_de_pontos(uuid) to authenticated;
grant execute on function pontos_no_desafio(uuid, uuid) to authenticated;
grant execute on function semana_do_desafio(uuid, date) to authenticated;
grant execute on function total_de_semanas(uuid) to authenticated;
grant execute on function periodo_da_semana(uuid, integer) to authenticated;
grant execute on function desafio_atual() to authenticated;
grant execute on function meu_paciente_id() to authenticated;
grant execute on function nome_para_ranking(text) to authenticated;
grant execute on function situacao_desafio(text, date, date) to authenticated;

-- Estas são de administração. O `e_admin()` dentro delas já recusa qualquer
-- outra conta, mas não custa não oferecer.
grant execute on function aprovar_envio(uuid) to authenticated;
grant execute on function recusar_envio(uuid, text) to authenticated;
grant execute on function ajustar_pontos(uuid, integer, text, uuid) to authenticated;
grant execute on function validar_indicacao(uuid, uuid) to authenticated;
grant execute on function recusar_indicacao(uuid, text) to authenticated;

grant select on desafios, desafio_acoes, desafio_participantes,
  desafio_envios, pontos_lancamentos, indicacoes, recompensas to authenticated;
grant insert, update, delete on desafios, desafio_acoes, desafio_participantes,
  desafio_envios, pontos_lancamentos, indicacoes, recompensas to authenticated;
