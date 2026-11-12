-- =============================================================================
-- Rastreabilidade: a nutricionista pode marcar "Não tolerado"
--
-- A conta automática da escada já mostrava "Não tolerado" para a paciente
-- (regra de 17/09), mas a lista de classificações da nutricionista não tinha
-- esse estado: a classificação dela só conseguia abrandar a conta, nunca
-- firmar. Com a regra nova da escada (sintoma antes + último teste tranquilo
-- vira "Rever na consulta"), ela precisa conseguir dizer "este não" quando
-- for o caso.
--
-- O que NÃO muda: nenhuma função atribui este status sozinha. Ele só entra
-- por `definir_status_reintroducao`, que só a nutricionista chama.
-- =============================================================================

alter table reintroducao_itens drop constraint if exists reintroducao_itens_status_check;

alter table reintroducao_itens
  add constraint reintroducao_itens_status_check
  check (status in (
    'nao_iniciado', 'em_teste', 'bem_tolerado', 'tolerancia_parcial',
    'sintomas_observados', 'nao_tolerado', 'necessita_reavaliacao',
    'pausado', 'nao_relevante'
  ));
