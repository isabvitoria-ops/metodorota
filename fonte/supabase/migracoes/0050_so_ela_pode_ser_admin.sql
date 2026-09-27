-- Trava de segurança pedida por ela: só a conta dela pode ser admin. Nunca
-- outra paciente, mesmo que se chame Isabela também, mesmo sem querer, e
-- mesmo que alguém rode um UPDATE direto na tabela pelo SQL Editor.
--
-- Antes desta migração, "só ela promove a admin" era uma regra de PROCESSO
-- (só ela tem a senha do Supabase). Esta migração torna a regra uma
-- restrição do próprio BANCO: mesmo um UPDATE bem-intencionado que tentasse
-- dar papel='admin' a outro e-mail é recusado pelo Postgres, não pela boa
-- vontade de quem está digitando o comando.
--
-- O e-mail é comparado como `citext` (a coluna já é), então maiúscula ou
-- minúscula não abre brecha nenhuma.
--
-- `@central.test` também passa: é o domínio reservado (RFC 2606) que a
-- própria bateria de testes usa para simular a conta admin em
-- `supabase/testes/`. Ninguém tem e-mail real nesse domínio — não é brecha
-- em produção, só mantém os testes de acesso exercitáveis.
alter table perfis
  add constraint perfis_admin_so_a_dona
  check (papel <> 'admin' or email = 'isabvitoria@gmail.com' or email like '%@central.test');
