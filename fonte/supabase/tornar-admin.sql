-- =============================================================================
-- TORNAR UMA CONTA ADMINISTRADORA
--
-- Rode isto UMA VEZ, depois de você mesma ter criado sua conta no app
-- (tela "Entrar" → "Entrar por link no e-mail" → clique no link do e-mail).
--
-- Antes de rodar, troque o e-mail abaixo pelo SEU.
--
-- Onde rodar: Supabase → SQL Editor → New query → colar → Run.
--
-- Por que isso não é automático: se qualquer conta pudesse virar
-- administradora sozinha, bastaria alguém se cadastrar para ter acesso a
-- todos os pacientes. A promoção acontece fora do app, por quem tem a senha
-- do banco — ou seja, só você.
-- =============================================================================

update perfis
   set papel = 'admin'
 where email = 'troque-pelo-seu@email.com';

-- Confira o resultado: deve aparecer uma linha com papel = admin.
select email, papel, criado_em from perfis where papel = 'admin';
