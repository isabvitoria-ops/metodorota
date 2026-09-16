-- =============================================================================
-- Bateria de segurança — o checklist do §35 do briefing, rodando de verdade.
--
-- Cada bloco assume a identidade de uma pessoa (papel `authenticated` + o id
-- dela em `auth.uid()`) e pergunta ao banco o que ela consegue ver e fazer.
-- É o teste que importa: se a política estiver frouxa, esconder o botão no
-- frontend não adianta nada.
--
-- Os blocos terminam em `commit` e não em `rollback` porque o resultado de
-- cada verificação é uma linha gravada — desfazer a transação apagaria junto
-- a resposta do teste. O banco é recriado do zero a cada execução
-- (scripts/testar-banco.sh), então não há resíduo entre rodadas.
-- =============================================================================

truncate resultados_teste;

-- -----------------------------------------------------------------------------
-- Elenco
-- -----------------------------------------------------------------------------
-- A nutricionista e seis pacientes, um por situação que o sistema precisa
-- distinguir. Todos criados como superusuário (é o equivalente ao que o
-- Supabase faz quando alguém se cadastra).

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'nutri@central.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'ativa@paciente.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'expirada@paciente.test'),
  ('00000000-0000-0000-0000-0000000000b3', 'suspensa@paciente.test'),
  ('00000000-0000-0000-0000-0000000000b4', 'futura@paciente.test'),
  ('00000000-0000-0000-0000-0000000000b5', 'outra@paciente.test'),
  ('00000000-0000-0000-0000-0000000000b9', 'intrusa@qualquer.test');

update perfis set papel = 'admin' where email = 'nutri@central.test';

-- Cadastrada mas sem conta: é o convite pendente.
insert into pacientes (email, nome, plano_id, data_inicio, data_fim)
values ('convidada@paciente.test', 'Convidada', 'mensal', hoje_sp(), hoje_sp() + 30);

insert into pacientes (email, nome, plano_id, data_inicio, data_fim) values
  ('ativa@paciente.test',    'Ativa',    'mensal', hoje_sp() - 5,  hoje_sp() + 25),
  ('expirada@paciente.test', 'Expirada', 'mensal', hoje_sp() - 60, hoje_sp() - 1),
  ('suspensa@paciente.test', 'Suspensa', 'mensal', hoje_sp() - 5,  hoje_sp() + 25),
  ('futura@paciente.test',   'Futura',   'mensal', hoje_sp() + 7,  hoje_sp() + 37),
  ('outra@paciente.test',    'Outra',    'mensal', hoje_sp() - 5,  hoje_sp() + 25);

update pacientes set status = 'suspenso' where email = 'suspensa@paciente.test';

-- A conta avulsa: existe em auth.users, nunca foi cadastrada pela
-- nutricionista. É o caso que prova "convite não é acesso" pelo avesso.
select teste(
  'quem se cadastra sozinho não vira paciente',
  not exists (select 1 from pacientes where email = 'intrusa@qualquer.test')
);

select teste(
  'cadastro da paciente com conta já criada vincula sozinho',
  (select perfil_id from pacientes where email = 'ativa@paciente.test') is not null
);

select teste(
  'convite pendente fica sem perfil vinculado',
  (select perfil_id from pacientes where email = 'convidada@paciente.test') is null
);

-- -----------------------------------------------------------------------------
-- Situação derivada das datas
-- -----------------------------------------------------------------------------

select teste('situação: ativa',   (select situacao from pacientes_visao where email = 'ativa@paciente.test') = 'ativo');
select teste('situação: expirada', (select situacao from pacientes_visao where email = 'expirada@paciente.test') = 'expirado');
select teste('situação: suspensa', (select situacao from pacientes_visao where email = 'suspensa@paciente.test') = 'suspenso');
select teste('situação: ainda não começou', (select situacao from pacientes_visao where email = 'futura@paciente.test') = 'nao_iniciado');
select teste('situação: convite pendente', (select situacao from pacientes_visao where email = 'convidada@paciente.test') = 'convite_pendente');

-- Vence em 10 dias, com alerta configurado em 15: tem que acusar.
update pacientes set data_fim = hoje_sp() + 10 where email = 'outra@paciente.test';
select teste(
  'situação: próximo do vencimento',
  (select situacao from pacientes_visao where email = 'outra@paciente.test') = 'proximo_do_vencimento'
);
select teste(
  'próximo do vencimento ainda tem acesso',
  (select status from pacientes where email = 'outra@paciente.test') = 'ativo'
);

-- =============================================================================
-- 1. Paciente ativa
-- =============================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);

select teste('ativa: tem acesso', tem_acesso());
select teste('ativa: lê alimentos', (select count(*) from alimentos) > 0);
select teste('ativa: lê equivalências', (select count(*) from equivalencias) > 0);
select teste('ativa: lê conteúdo publicado', (select count(*) from conteudos) > 0);
select teste('ativa: não é admin', not e_admin());
select teste('ativa: vê só a própria linha', (select count(*) from pacientes) = 1);
select teste('ativa: meu_acesso confirma', (meu_acesso() ->> 'temAcesso')::boolean);

-- Não pode mexer no próprio prazo nem no próprio status.
select teste(
  'ativa: não estica a própria data de fim',
  nao_alterou($$update pacientes set data_fim = hoje_sp() + 3650 where perfil_id = auth.uid()$$)
);
select teste(
  'ativa: não mexe no cadastro de outra paciente',
  nao_alterou($$update pacientes set status = 'ativo' where email = 'suspensa@paciente.test'$$)
);
select teste(
  'ativa: não se promove a admin',
  nao_alterou($$update perfis set papel = 'admin' where id = auth.uid()$$)
);
select teste(
  'ativa: não apaga o próprio cadastro',
  nao_alterou($$delete from pacientes where perfil_id = auth.uid()$$)
);
select teste('ativa: não lê histórico administrativo', (select count(*) from historico_admin) = 0);
select teste('ativa: não lê convites', (select count(*) from convites) = 0);

insert into favoritos (perfil_id, tipo, ref_id, titulo, rota)
values (auth.uid(), 'alimento', 'arroz-cozido', 'Arroz', '/trocas');
select teste('ativa: salva favorito', (select count(*) from favoritos) = 1);
commit;

-- =============================================================================
-- 2. Paciente expirada
-- =============================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', true);

select teste('expirada: não tem acesso', not tem_acesso());
select teste('expirada: não lê alimentos', (select count(*) from alimentos) = 0);
select teste('expirada: não lê equivalências', (select count(*) from equivalencias) = 0);
select teste('expirada: não lê conteúdo', (select count(*) from conteudos) = 0);

-- O caso do briefing: a URL salva no favorito do navegador.
select teste(
  'expirada: URL protegida direta não devolve nada',
  (select count(*) from conteudos where id = 'constipacao') = 0
);
select teste(
  'expirada: continua cadastrada (não foi excluída)',
  (select count(*) from pacientes where perfil_id = auth.uid()) = 1
);
select teste(
  'expirada: não consegue salvar favorito',
  recusou($$insert into favoritos (perfil_id, tipo, ref_id, titulo, rota) values (auth.uid(), 'alimento', 'x', 'X', '/x')$$)
);
commit;

-- =============================================================================
-- 3. Paciente suspensa
-- =============================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b3', true);

select teste('suspensa: não tem acesso', not tem_acesso());
select teste('suspensa: não lê conteúdo', (select count(*) from conteudos) = 0);
select teste('suspensa: dentro do período e ainda assim bloqueada',
  (select hoje_sp() between data_inicio and data_fim from pacientes_visao where perfil_id = auth.uid()));
commit;

-- =============================================================================
-- 4. Antes da data de início
-- =============================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b4', true);

select teste('futura: não tem acesso antes de começar', not tem_acesso());
select teste('futura: não lê conteúdo', (select count(*) from conteudos) = 0);
commit;

-- =============================================================================
-- 5. Conta avulsa — o teste central do briefing
-- =============================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b9', true);

select teste('avulsa: autenticada e sem acesso', not tem_acesso());
select teste('avulsa: não lê alimentos', (select count(*) from alimentos) = 0);
select teste('avulsa: não lê conteúdo', (select count(*) from conteudos) = 0);
select teste('avulsa: não enxerga paciente nenhum', (select count(*) from pacientes) = 0);
select teste('avulsa: não é admin', not e_admin());
select teste(
  'avulsa: não se cadastra como paciente',
  recusou($$insert into pacientes (email, nome, data_inicio, data_fim) values ('avulsa2@x.test','X',hoje_sp(),hoje_sp()+30)$$)
);
commit;

-- =============================================================================
-- 6. Isolamento entre pacientes
-- =============================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
insert into favoritos (perfil_id, tipo, ref_id, titulo, rota)
values (auth.uid(), 'guia', 'gases', 'Gases', '/guias/gases');
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b5', true);

select teste('paciente B não lê a linha do paciente A',
  not exists (select 1 from pacientes where email = 'ativa@paciente.test'));
select teste('paciente B não lê o perfil do paciente A',
  not exists (select 1 from perfis where email = 'ativa@paciente.test'));
select teste('paciente B não lê os favoritos do paciente A', (select count(*) from favoritos) = 0);
select teste('paciente B não apaga favorito alheio',
  nao_alterou($$delete from favoritos where perfil_id = '00000000-0000-0000-0000-0000000000b1'$$));
commit;

-- =============================================================================
-- 7. Nutricionista
-- =============================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select teste('admin: é reconhecida', e_admin());
select teste('admin: vê todos os pacientes', (select count(*) from pacientes) = 6);
select teste('admin: vê o histórico', (select count(*) from historico_admin) > 0);
select teste('admin: lê conteúdo mesmo em rascunho', (select count(*) from conteudos) > 0);

-- Renovação: o briefing pede que restaure o acesso sem criar paciente novo.
update pacientes
   set data_inicio = hoje_sp(), data_fim = hoje_sp() + 90, plano_id = 'trimestral'
 where email = 'expirada@paciente.test';
select teste('admin: renova sem duplicar paciente', (select count(*) from pacientes) = 6);
select teste('admin: renovação fica no histórico',
  exists (select 1 from historico_admin h join pacientes p on p.id = h.paciente_id
           where p.email = 'expirada@paciente.test' and h.evento = 'renovado'));

update pacientes set status = 'suspenso' where email = 'ativa@paciente.test';
select teste('admin: suspensão fica no histórico',
  exists (select 1 from historico_admin h join pacientes p on p.id = h.paciente_id
           where p.email = 'ativa@paciente.test' and h.evento = 'suspenso'));
update pacientes set status = 'ativo' where email = 'ativa@paciente.test';
select teste('admin: reativação fica no histórico',
  exists (select 1 from historico_admin h join pacientes p on p.id = h.paciente_id
           where p.email = 'ativa@paciente.test' and h.evento = 'reativado'));
commit;

-- =============================================================================
-- 7b. Corrigir o e-mail solta a conta antiga
-- =============================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

update pacientes set email = 'outra-ativa@paciente.test' where email = 'ativa@paciente.test';
select teste(
  'trocar o e-mail desvincula a conta que estava ligada',
  (select perfil_id from pacientes where email = 'outra-ativa@paciente.test') is null
);
select teste(
  'e o cadastro volta a ficar como convite pendente',
  (select status from pacientes where email = 'outra-ativa@paciente.test') = 'convite_pendente'
);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
select teste('a conta antiga perde o acesso na hora', not tem_acesso());
commit;

-- Voltar o e-mail religa a mesma conta, sem precisar de novo convite.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
update pacientes set email = 'ativa@paciente.test' where email = 'outra-ativa@paciente.test';
select teste(
  'voltar o e-mail religa a conta',
  (select perfil_id from pacientes where email = 'ativa@paciente.test') = '00000000-0000-0000-0000-0000000000b1'
);
commit;

-- =============================================================================
-- 8. Depois da renovação, a paciente volta a entrar
-- =============================================================================
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', true);

select teste('renovada: acesso restaurado', tem_acesso());
select teste('renovada: volta a ler conteúdo', (select count(*) from conteudos) > 0);
select teste('renovada: situação voltou a ativo',
  (select situacao from pacientes_visao where perfil_id = auth.uid()) = 'ativo');
commit;

-- =============================================================================
-- 9. Visitante sem login
-- =============================================================================
-- Sem login o bloqueio é ainda mais cedo: a conta anônima não recebe nem
-- permissão de leitura na tabela, então nem chega a passar pela política.
begin;
set local role anon;
select teste('anônimo: barrado em alimentos', recusou($$select 1 from alimentos$$));
select teste('anônimo: barrado em conteúdos', recusou($$select 1 from conteudos$$));
select teste('anônimo: barrado em pacientes', recusou($$select 1 from pacientes$$));
select teste('anônimo: barrado em perfis', recusou($$select 1 from perfis$$));
commit;

-- -----------------------------------------------------------------------------
-- Resultado
-- -----------------------------------------------------------------------------
select
  count(*) filter (where passou) || '/' || count(*) || ' verificações de acesso passaram' as resultado
from resultados_teste;

select string_agg(nome, e'\n') as falhas from resultados_teste where not passou;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% teste(s) de acesso falharam', v_falhas;
  end if;
end;
$$;
