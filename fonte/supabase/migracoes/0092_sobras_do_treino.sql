-- =============================================================================
-- 0092 — Duas versões antigas de funções do treino, ainda no banco
--
-- Quando o treino ganhou duração da sessão (0074) e rótulo (0076), as funções
-- novas foram criadas com um parâmetro a mais — e as antigas, de seis
-- parâmetros, ficaram no banco ao lado delas:
--
--   registrar_sessao_treino(id, paciente, treino, data, observacao, series)
--   salvar_treino(id, paciente, nome, observacao, ativo, exercicios)
--
-- O aplicativo sempre chama as novas (manda os sete parâmetros). As antigas
-- são código velho que ninguém usa, mas que continua chamável por uma conta
-- logada, com as regras de antes. E com as duas no banco, uma chamada de seis
-- parâmetros fica AMBÍGUA — o banco não sabe qual escolher e recusa (é o que
-- derrubava as baterias 05 e 08).
--
-- Tirar as antigas não muda nenhuma tela: uma chamada de seis parâmetros passa
-- a cair na função nova, que tem valor padrão para o sétimo.
-- =============================================================================

drop function if exists registrar_sessao_treino(uuid, uuid, uuid, date, text, jsonb);
drop function if exists salvar_treino(uuid, uuid, text, text, boolean, jsonb);
