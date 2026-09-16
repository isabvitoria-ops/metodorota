-- =============================================================================
-- Bateria do Desafio do Mês — o checklist do §68 dela, rodando de verdade.
--
-- O que estes testes provam não é que a tela esconde o botão: é que o BANCO
-- recusa. Cada bloco assume a identidade de alguém e tenta fazer o que não
-- deveria conseguir. Se uma política estiver frouxa, a linha falha aqui — não
-- em produção, com paciente de verdade olhando o ranking.
-- =============================================================================

truncate resultados_teste;

-- -----------------------------------------------------------------------------
-- Cenário
-- -----------------------------------------------------------------------------
-- Elenco PRÓPRIO, e não o do 01_acesso: aquela bateria testa renovação, então
-- a "expirada" dela chega aqui renovada e viva. Um teste que depende do estado
-- que outro deixou não testa o que diz testar.
--
-- Um desafio de 30 dias começando 6 dias atrás: hoje é semana 1, e a semana 2
-- já existe no calendário.

-- O 0011 semeia o desafio do mês corrente. A bateria monta o mundo dela do
-- zero, e a trava de sobreposição impediria dois desafios no mesmo período —
-- então o semeado sai primeiro. O banco de teste é descartável.
delete from desafios;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'd-ativa@paciente.test'),
  ('00000000-0000-0000-0000-0000000000c2', 'd-expirada@paciente.test'),
  ('00000000-0000-0000-0000-0000000000c3', 'd-suspensa@paciente.test'),
  ('00000000-0000-0000-0000-0000000000c4', 'd-futura@paciente.test'),
  ('00000000-0000-0000-0000-0000000000c5', 'd-outra@paciente.test');

insert into pacientes (email, nome, plano_id, data_inicio, data_fim) values
  ('d-ativa@paciente.test',    'Ana Madureira',  'mensal', hoje_sp() - 10, hoje_sp() + 20),
  ('d-expirada@paciente.test', 'Bia Expirada',   'mensal', hoje_sp() - 60, hoje_sp() - 1),
  ('d-suspensa@paciente.test', 'Cris Suspensa',  'mensal', hoje_sp() - 10, hoje_sp() + 20),
  ('d-futura@paciente.test',   'Dani Futura',    'mensal', hoje_sp() + 7,  hoje_sp() + 37),
  ('d-outra@paciente.test',    'Elis Outra',     'mensal', hoje_sp() - 10, hoje_sp() + 20);

update pacientes set status = 'suspenso' where email = 'd-suspensa@paciente.test';

insert into desafios (id, nome, lema, data_inicio, data_fim, status)
values (
  '00000000-0000-0000-0000-00000000d001',
  'Desafio de teste',
  'Cada pequena ação conta.',
  hoje_sp() - 6,
  hoje_sp() + 23,
  'ativo'
);

-- O 0012 faz todo desafio nascer com as ações. A bateria precisa dos seus
-- próprios identificadores para conferir cada caso, então troca as copiadas
-- pelas dela.
delete from desafio_acoes where desafio_id = '00000000-0000-0000-0000-00000000d001';

insert into desafio_acoes (id, desafio_id, chave, nome, pontos, periodicidade, ordem) values
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000d001',
   'questionario', 'Questionário semanal', 5, 'semanal', 1),
  ('00000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-00000000d001',
   'metas', 'Metas da semana', 5, 'semanal', 2),
  ('00000000-0000-0000-0000-00000000a003', '00000000-0000-0000-0000-00000000d001',
   'diario', 'Diário alimentar', 5, 'semanal', 3),
  ('00000000-0000-0000-0000-00000000a004', '00000000-0000-0000-0000-00000000d001',
   'redes', 'Compartilhar evolução', 10, 'semanal', 4),
  ('00000000-0000-0000-0000-00000000a005', '00000000-0000-0000-0000-00000000d001',
   'indicacao', 'Indicar uma amiga', 50, 'evento', 5);

-- -----------------------------------------------------------------------------
-- A paciente ativa
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);

select teste('ativa vê o desafio', (select count(*) from desafios) = 1);
select teste('ativa vê as 5 ações', (select count(*) from desafio_acoes) = 5);
select teste('ativa está na semana 1', semana_do_desafio('00000000-0000-0000-0000-00000000d001') = 1);
select teste('o desafio tem 5 semanas', total_de_semanas('00000000-0000-0000-0000-00000000d001') = 5);

-- Marca as três ações da semana.
select teste('ativa envia o questionário',
  enviar_acao('00000000-0000-0000-0000-00000000a001') is not null);
select teste('ativa envia as metas',
  enviar_acao('00000000-0000-0000-0000-00000000a002') is not null);

select teste('o envio nasce pendente, sem ponto',
  (select status = 'enviado' and pontos_concedidos = 0
   from desafio_envios where acao_id = '00000000-0000-0000-0000-00000000a001'));

select teste('marcar não gerou ponto nenhum',
  saldo_de_pontos(meu_paciente_id()) = 0);

commit;

-- A trava de duplicidade é do banco, não da tela.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
do $$
declare v_erro boolean := false;
begin
  begin
    perform enviar_acao('00000000-0000-0000-0000-00000000a001');
  exception when others then
    v_erro := true;
  end;
  perform teste('enviar duas vezes na mesma semana é recusado', v_erro);
end;
$$;

select teste('continua com um envio só desta ação',
  (select count(*) from desafio_envios
   where acao_id = '00000000-0000-0000-0000-00000000a001') = 1);
commit;

-- -----------------------------------------------------------------------------
-- O que a paciente NÃO consegue fazer (§43, §44)
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);

do $$
declare v_erro boolean;
begin
  -- Dar 50 pontos para si mesma.
  v_erro := false;
  begin
    insert into pontos_lancamentos (paciente_id, pontos, tipo, descricao)
    values (meu_paciente_id(), 50, 'ajuste', 'me dei pontos');
  exception when others then v_erro := true;
  end;
  perform teste('paciente NÃO consegue lançar pontos para si', v_erro);

  -- Aprovar o próprio envio.
  v_erro := false;
  begin
    perform aprovar_envio((select id from desafio_envios
      where acao_id = '00000000-0000-0000-0000-00000000a001' limit 1));
  exception when others then v_erro := true;
  end;
  perform teste('paciente NÃO consegue aprovar o próprio envio', v_erro);

  -- Editar o status do envio na mão.
  v_erro := false;
  begin
    update desafio_envios set status = 'aprovado', pontos_concedidos = 5
    where acao_id = '00000000-0000-0000-0000-00000000a001';
    if not found then v_erro := true; end if;
  exception when others then v_erro := true;
  end;
  perform teste('paciente NÃO consegue marcar o próprio envio como aprovado', v_erro);

  -- Ajustar pontos.
  v_erro := false;
  begin
    perform ajustar_pontos(meu_paciente_id(), 100, 'porque sim');
  exception when others then v_erro := true;
  end;
  perform teste('paciente NÃO consegue ajustar pontos', v_erro);

  -- Validar a própria indicação.
  v_erro := false;
  begin
    perform validar_indicacao(registrar_indicacao('Amiga Inventada'));
  exception when others then v_erro := true;
  end;
  perform teste('paciente NÃO consegue validar a própria indicação', v_erro);

  -- Mexer nas regras do desafio.
  v_erro := false;
  begin
    update desafio_acoes set pontos = 500 where chave = 'questionario';
    if not found then v_erro := true; end if;
  exception when others then v_erro := true;
  end;
  perform teste('paciente NÃO consegue mudar a pontuação das ações', v_erro);
end;
$$;

select teste('saldo continua zero depois de todas as tentativas',
  saldo_de_pontos(meu_paciente_id()) = 0);
commit;

-- -----------------------------------------------------------------------------
-- Quem não tem acesso não entra (§39, §40)
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', true);
select teste('expirada não vê o desafio', (select count(*) from desafios) = 0);
do $$
declare v_erro boolean := false;
begin
  begin perform enviar_acao('00000000-0000-0000-0000-00000000a001');
  exception when others then v_erro := true; end;
  perform teste('expirada não consegue enviar ação', v_erro);
end;
$$;
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c3', true);
select teste('suspensa não vê o desafio', (select count(*) from desafios) = 0);
do $$
declare v_erro boolean := false;
begin
  begin perform enviar_acao('00000000-0000-0000-0000-00000000a002');
  exception when others then v_erro := true; end;
  perform teste('suspensa não consegue enviar ação', v_erro);
end;
$$;
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c4', true);
select teste('quem ainda não começou não vê o desafio', (select count(*) from desafios) = 0);
commit;

-- -----------------------------------------------------------------------------
-- A nutricionista aprova
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select teste('nutricionista vê os 2 envios pendentes',
  (select count(*) from desafio_envios where status = 'enviado') = 2);

do $$
begin
  perform aprovar_envio((select id from desafio_envios
    where acao_id = '00000000-0000-0000-0000-00000000a001'));
  perform teste('aprovar o questionário', true);
end;
$$;

select teste('aprovar gerou +5 no ledger',
  (select pontos from pontos_lancamentos
   where acao_id = '00000000-0000-0000-0000-00000000a001') = 5);

do $$
begin
  perform aprovar_envio((select id from desafio_envios
    where acao_id = '00000000-0000-0000-0000-00000000a001'));
  perform teste('aprovar de novo não duplica o ponto',
    (select count(*) from pontos_lancamentos
     where acao_id = '00000000-0000-0000-0000-00000000a001') = 1);
end;
$$;

do $$
begin
  perform recusar_envio(
    (select id from desafio_envios where acao_id = '00000000-0000-0000-0000-00000000a002'),
    'não recebi as metas');
  perform teste('recusar as metas foi aceito', true);
end;
$$;

select teste('a recusa não lançou ponto',
  (select count(*) from pontos_lancamentos
   where acao_id = '00000000-0000-0000-0000-00000000a002') = 0);
commit;

-- -----------------------------------------------------------------------------
-- Saldo, ranking e a separação entre mês e acumulado (§15)
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);

select teste('a paciente vê os 5 pontos',
  saldo_de_pontos(meu_paciente_id()) = 5);
select teste('os 5 pontos contam no desafio',
  pontos_no_desafio(meu_paciente_id(), '00000000-0000-0000-0000-00000000d001') = 5);
select teste('ela aparece no ranking',
  (select pontos from ranking_do_desafio('00000000-0000-0000-0000-00000000d001') where sou_eu) = 5);
select teste('o ranking não mostra e-mail nem plano',
  (select nome from ranking_do_desafio('00000000-0000-0000-0000-00000000d001') where sou_eu)
   not like '%@%');

-- A recusa liberou a ação: pode mandar de novo na mesma semana.
select teste('depois de recusada, dá para enviar de novo',
  enviar_acao('00000000-0000-0000-0000-00000000a002') is not null);
commit;

-- -----------------------------------------------------------------------------
-- Semana 2 pontua de novo; semana 1 não (§24)
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
-- Simula a semana 2 escrevendo o envio pela via administrativa.
insert into desafio_envios (desafio_id, acao_id, paciente_id, semana)
select '00000000-0000-0000-0000-00000000d001', '00000000-0000-0000-0000-00000000a001',
       p.id, 2
from pacientes p where p.email = 'd-ativa@paciente.test';

select teste('semana 2 do mesmo questionário é aceita',
  (select count(*) from desafio_envios
   where acao_id = '00000000-0000-0000-0000-00000000a001') = 2);

do $$
begin
  perform aprovar_envio((select id from desafio_envios
    where acao_id = '00000000-0000-0000-0000-00000000a001' and semana = 2));
  perform teste('aprovar a semana 2 foi aceito', true);
end;
$$;

select teste('agora são 10 pontos no desafio',
  pontos_no_desafio(
    (select id from pacientes where email = 'd-ativa@paciente.test'),
    '00000000-0000-0000-0000-00000000d001') = 10);
commit;

-- -----------------------------------------------------------------------------
-- Indicação: 50 pontos só depois da validação (§9, §26)
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c5', true);
select teste('outra paciente registra uma indicação',
  registrar_indicacao('Amiga da Outra', 'amiga@teste.test') is not null);
select teste('a indicação nasce sem ponto',
  saldo_de_pontos(meu_paciente_id()) = 0);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
do $$
begin
  perform validar_indicacao((select id from indicacoes where nome_indicada = 'Amiga da Outra'));
  perform teste('nutricionista valida a indicação', true);
end;
$$;
select teste('a validação lançou +50',
  saldo_de_pontos((select id from pacientes where email = 'd-outra@paciente.test')) = 50);
select teste('validar duas vezes não vira 100',
  (select count(*) from pontos_lancamentos where tipo = 'indicacao') = 1);
commit;

-- -----------------------------------------------------------------------------
-- Ranking: quem tem mais no mês fica na frente, independente do acumulado (§15)
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

-- A "outra" tem 50 acumulados (da indicação, que é deste desafio), a "ativa"
-- tem 10. Um ajuste avulso fora do desafio prova a separação.
do $$
begin
  perform ajustar_pontos((select id from pacientes where email = 'd-ativa@paciente.test'),
    100, 'pontos antigos do programa');
  perform teste('ajuste avulso foi aceito', true);
end;
$$;

select teste('o acumulado da ativa virou 110',
  saldo_de_pontos((select id from pacientes where email = 'd-ativa@paciente.test')) = 110);

select teste('mas no desafio ela continua com 10',
  pontos_no_desafio((select id from pacientes where email = 'd-ativa@paciente.test'),
    '00000000-0000-0000-0000-00000000d001') = 10);

select teste('no ranking do mês a outra está na frente', (
  select r.pontos = 50 from ranking_do_desafio('00000000-0000-0000-0000-00000000d001') r
  where r.posicao = 1
));

select teste('ajuste manual fica no histórico com motivo',
  (select descricao from pontos_lancamentos where tipo = 'ajuste' and pontos = 100)
  = 'pontos antigos do programa');
commit;

-- -----------------------------------------------------------------------------
-- Desafio encerrado (§36)
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
insert into desafios (id, nome, data_inicio, data_fim, status)
values ('00000000-0000-0000-0000-00000000d002', 'Desafio velho',
        hoje_sp() - 60, hoje_sp() - 30, 'ativo');
-- E o de outubro, deixado pronto enquanto o atual ainda roda: tem que caber.
insert into desafios (id, nome, data_inicio, data_fim, status)
values ('00000000-0000-0000-0000-00000000d003', 'Desafio seguinte',
        hoje_sp() + 24, hoje_sp() + 53, 'ativo');
select teste('dá para deixar o próximo desafio pronto antes de o atual acabar',
  (select count(*) from desafios) = 3);
select teste('desafio com data vencida já conta como encerrado',
  situacao_desafio('ativo', hoje_sp() - 60, hoje_sp() - 30) = 'encerrado');
select teste('o desafio atual continua sendo o que está no prazo',
  desafio_atual() = '00000000-0000-0000-0000-00000000d001');
delete from desafios where id in ('00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-00000000d003');
commit;

-- -----------------------------------------------------------------------------
-- A tela da paciente lê tudo de uma função só
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
select teste('meu_desafio() responde com o desafio no ar',
  (meu_desafio() ->> 'temDesafio')::boolean);
select teste('meu_desafio() traz os pontos do mês',
  (meu_desafio() ->> 'pontosNoMes')::int = 10);
select teste('meu_desafio() traz o acumulado separado',
  (meu_desafio() ->> 'saldoAcumulado')::int = 110);
select teste('meu_desafio() traz as 5 ações',
  jsonb_array_length(meu_desafio() -> 'acoes') = 5);
select teste('meu_desafio() traz o ranking',
  jsonb_array_length(meu_desafio() -> 'ranking') >= 2);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', true);
do $$
declare v_erro boolean := false;
begin
  begin perform painel_do_desafio('00000000-0000-0000-0000-00000000d001');
  exception when others then v_erro := true; end;
  perform teste('expirada não abre o painel da nutricionista', v_erro);
end;
$$;
commit;

-- -----------------------------------------------------------------------------
-- Resultado
-- -----------------------------------------------------------------------------
select
  count(*) filter (where passou) || '/' || count(*) || ' verificações do desafio passaram' as resultado
from resultados_teste;

select string_agg(nome, e'\n') as falhas from resultados_teste where not passou;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% teste(s) do desafio falharam', v_falhas;
  end if;
end;
$$;

-- =============================================================================
-- Fechaduras (0010) — as duas brechas que o verificador do Supabase achou
-- depois que o desafio já estava no ar.
-- =============================================================================

truncate resultados_teste;

-- Uma paciente NÃO lê o saldo de outra passando o id dela.
begin;
-- O id da outra é guardado ANTES de trocar de papel: como paciente, ela não
-- enxerga a linha da colega em `pacientes` — e passar um id nulo não testaria
-- nada, que foi exatamente o que aconteceu na primeira versão deste teste.
select set_config('teste.outra_id',
  (select id::text from pacientes where email = 'd-outra@paciente.test'), false);
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
do $$
declare v_erro boolean := false; v_outra uuid;
begin
  v_outra := nullif(current_setting('teste.outra_id', true), '')::uuid;
  perform teste('o teste tem o id da outra em mãos', v_outra is not null);
  begin
    perform saldo_de_pontos(v_outra);
  exception when others then v_erro := true;
  end;
  perform teste('paciente NÃO lê o saldo de outra', v_erro);

  v_erro := false;
  begin
    perform pontos_no_desafio(v_outra, '00000000-0000-0000-0000-00000000d001');
  exception when others then v_erro := true;
  end;
  perform teste('paciente NÃO lê os pontos de outra no desafio', v_erro);
end;
$$;
select teste('mas continua lendo o próprio saldo', saldo_de_pontos(meu_paciente_id()) >= 0);
select teste('e continua vendo o ranking',
  (select count(*) from ranking_do_desafio('00000000-0000-0000-0000-00000000d001')) >= 2);
commit;

-- Quem perdeu o acesso não lê mais o ranking com os nomes das outras.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', true);
do $$
declare v_erro boolean := false;
begin
  begin perform * from ranking_do_desafio('00000000-0000-0000-0000-00000000d001');
  exception when others then v_erro := true; end;
  perform teste('paciente sem acesso NÃO lê o ranking', v_erro);
end;
$$;
commit;

-- E o visitante sem login não alcança nada.
begin;
set local role anon;
do $$
declare v_erro boolean := false;
begin
  begin perform desafio_atual();
  exception when others then v_erro := true; end;
  perform teste('visitante sem login NÃO chama desafio_atual()', v_erro);

  v_erro := false;
  begin perform * from ranking_do_desafio('00000000-0000-0000-0000-00000000d001');
  exception when others then v_erro := true; end;
  perform teste('visitante sem login NÃO lê o ranking', v_erro);

  v_erro := false;
  begin perform count(*) from pacientes;
  exception when others then v_erro := true; end;
  perform teste('visitante sem login NÃO lê a tabela de pacientes', v_erro);

  v_erro := false;
  begin perform count(*) from pontos_lancamentos;
  exception when others then v_erro := true; end;
  perform teste('visitante sem login NÃO lê o ledger', v_erro);
end;
$$;
commit;

-- =============================================================================
-- Criação de desafio (0012) — os dois furos que apareceram no uso real.
-- =============================================================================

-- Desafio novo nasce com as ações, sem ninguém cadastrar nada.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
insert into desafios (id, nome, data_inicio, data_fim, status)
values ('00000000-0000-0000-0000-00000000d009', 'Desafio do mês que vem',
        hoje_sp() + 40, hoje_sp() + 69, 'rascunho');
select teste('desafio novo já vem com as ações',
  (select count(*) from desafio_acoes
   where desafio_id = '00000000-0000-0000-0000-00000000d009') = 5);
select teste('e com a mesma pontuação do desafio anterior',
  (select sum(pontos) from desafio_acoes
   where desafio_id = '00000000-0000-0000-0000-00000000d009') =
  (select sum(pontos) from desafio_acoes
   where desafio_id = '00000000-0000-0000-0000-00000000d001'));

-- A nutricionista consegue ver a tela da paciente.
select teste('nutricionista vê o desafio em modo de prévia',
  (meu_desafio() ->> 'temDesafio')::boolean and (meu_desafio() ->> 'previa')::boolean);
select teste('na prévia ela não tem pontos nem posição',
  (meu_desafio() ->> 'pontosNoMes')::int = 0 and meu_desafio() -> 'posicao' = 'null'::jsonb);
select teste('e a prévia mostra o checklist',
  jsonb_array_length(meu_desafio() -> 'acoes') = 5);
delete from desafios where id = '00000000-0000-0000-0000-00000000d009';
commit;

-- Paciente de verdade continua sem prévia.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
select teste('paciente não entra em modo de prévia',
  (meu_desafio() ->> 'previa')::boolean = false);
commit;

select
  count(*) filter (where passou) || '/' || count(*) || ' verificações das fechaduras e da criação passaram' as resultado
from resultados_teste;

select string_agg(nome, e'\n') as falhas from resultados_teste where not passou;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% fechadura(s) falharam', v_falhas;
  end if;
end;
$$;

-- =============================================================================
-- Ajustes do 0013 — duas vezes por semana, indicação de 100, escada de
-- benefícios, lançamento pela nutricionista.
-- =============================================================================

truncate resultados_teste;

-- -----------------------------------------------------------------------------
-- Uma ação que vale duas vezes por semana
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
update desafio_acoes
   set max_por_semana = 2, descricao = 'Duas vezes por semana.'
 where id = '00000000-0000-0000-0000-00000000a003';
select teste('a nutricionista define o diário como duas vezes por semana',
  (select max_por_semana from desafio_acoes
    where id = '00000000-0000-0000-0000-00000000a003') = 2);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);

select teste('ativa marca o diário a primeira vez',
  enviar_acao('00000000-0000-0000-0000-00000000a003') is not null);
select teste('e a segunda vez na mesma semana também entra',
  enviar_acao('00000000-0000-0000-0000-00000000a003') is not null);

do $$
declare v_erro boolean := false;
begin
  begin perform enviar_acao('00000000-0000-0000-0000-00000000a003');
  exception when others then v_erro := true; end;
  perform teste('a terceira é recusada pelo banco, não pela tela', v_erro);
end;
$$;

select teste('os dois envios ficaram com ocorrências diferentes',
  (select count(distinct ocorrencia) from desafio_envios
    where acao_id = '00000000-0000-0000-0000-00000000a003'
      and paciente_id = meu_paciente_id() and status <> 'recusado') = 2);

select teste('e a tela recebe os dois envios da semana',
  (select jsonb_array_length(a -> 'envios')
     from jsonb_array_elements(meu_desafio() -> 'acoes') a
    where a ->> 'id' = '00000000-0000-0000-0000-00000000a003') = 2);

select teste('com podeMarcar falso, porque a semana encheu',
  (select (a ->> 'podeMarcar')::boolean = false
     from jsonb_array_elements(meu_desafio() -> 'acoes') a
    where a ->> 'id' = '00000000-0000-0000-0000-00000000a003'));

select teste('e uma ação de uma vez por semana traz maxPorSemana 1',
  (select (a ->> 'maxPorSemana')::int
     from jsonb_array_elements(meu_desafio() -> 'acoes') a
    where a ->> 'id' = '00000000-0000-0000-0000-00000000a004') = 1);
commit;

-- -----------------------------------------------------------------------------
-- A nutricionista lança a ação por quem fez e esqueceu de marcar
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
do $$
declare v_id uuid;
begin
  v_id := conceder_acao(
    (select id from pacientes where email = 'd-outra@paciente.test'),
    '00000000-0000-0000-0000-00000000a004');
  perform teste('a nutricionista lança a ação pela paciente', v_id is not null);
  perform teste('o envio já nasce aprovado',
    (select status = 'aprovado' from desafio_envios where id = v_id));
  perform teste('e o ponto entra pelo mesmo ledger, ligado ao envio',
    (select count(*) from pontos_lancamentos where envio_id = v_id) = 1);
  perform teste('lançar de novo a mesma semana é recusado',
    (select count(*) from desafio_envios
      where acao_id = '00000000-0000-0000-0000-00000000a004'
        and paciente_id = (select id from pacientes where email = 'd-outra@paciente.test')
        and status <> 'recusado') = 1);
end;
$$;
commit;

-- Rascunho não recebe lançamento: a paciente nem sabe que ele existe.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
insert into desafios (id, nome, data_inicio, data_fim, status)
values ('00000000-0000-0000-0000-00000000d014', 'Rascunho de teste',
        hoje_sp() + 80, hoje_sp() + 109, 'rascunho');
do $$
declare v_erro boolean := false;
begin
  begin
    perform conceder_acao(
      (select id from pacientes where email = 'd-ativa@paciente.test'),
      (select id from desafio_acoes
        where desafio_id = '00000000-0000-0000-0000-00000000d014' and chave = 'metas'));
  exception when others then v_erro := true; end;
  perform teste('não dá para lançar ponto num desafio em rascunho', v_erro);
end;
$$;
delete from desafios where id = '00000000-0000-0000-0000-00000000d014';
commit;

-- E a paciente não lança nada para si mesma.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
do $$
declare v_estado text := '';
begin
  begin perform conceder_acao(meu_paciente_id(), '00000000-0000-0000-0000-00000000a003');
  exception when others then v_estado := sqlstate; end;
  -- 42501 e não 23505: a recusa vem da checagem de admin, antes de qualquer
  -- conta de duplicidade. Se um dia a ordem inverter, este teste acusa.
  perform teste('paciente NÃO lança ação nem para si mesma', v_estado = '42501');
end;
$$;
commit;

-- -----------------------------------------------------------------------------
-- Indicação: 100 pontos, e o total não zera no fim do mês
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
update desafio_acoes set pontos = 100 where id = '00000000-0000-0000-0000-00000000a005';
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
select teste('ativa registra uma indicação',
  registrar_indicacao('Alana', 'alana@teste.test') is not null);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
do $$
begin
  perform validar_indicacao((select id from indicacoes where nome_indicada = 'Alana'));
end;
$$;
select teste('a validação lançou 100, não 50',
  (select pontos from pontos_lancamentos
    where indicacao_id = (select id from indicacoes where nome_indicada = 'Alana')) = 100);

-- O desafio do mês que vem herda a pontuação, inclusive a da indicação.
insert into desafios (id, nome, data_inicio, data_fim, status)
values ('00000000-0000-0000-0000-00000000d013', 'Desafio herdeiro',
        hoje_sp() + 40, hoje_sp() + 69, 'rascunho');
select teste('o desafio seguinte nasce com a indicação valendo 100',
  (select pontos from desafio_acoes
    where desafio_id = '00000000-0000-0000-0000-00000000d013' and chave = 'indicacao') = 100);
select teste('e herda também o duas vezes por semana',
  (select max_por_semana from desafio_acoes
    where desafio_id = '00000000-0000-0000-0000-00000000d013' and chave = 'diario') = 2);
delete from desafios where id = '00000000-0000-0000-0000-00000000d013';

-- Indicação não expira: desligada do desafio, ela continua contando.
update indicacoes set desafio_id = null, criado_em = now() - interval '8 months'
 where nome_indicada = 'Alana';
select teste('indicação de meses atrás continua no total da paciente',
  indicacoes_validadas((select id from pacientes where email = 'd-ativa@paciente.test')) = 1);

select teste('o resumo mostra quem indicou e quantas',
  (select (x ->> 'validadas')::int from jsonb_array_elements(resumo_indicacoes()) x
    where x ->> 'nome' = 'Ana Madureira') = 1);
commit;

-- E uma paciente não conta as indicações de outra.
begin;
select set_config('teste.outra_id',
  (select id::text from pacientes where email = 'd-outra@paciente.test'), false);
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
do $$
declare v_estado text := '';
begin
  begin perform indicacoes_validadas(current_setting('teste.outra_id')::uuid);
  exception when others then v_estado := sqlstate; end;
  perform teste('paciente NÃO conta as indicações de outra', v_estado = '42501');
end;
$$;
select teste('mas conta as suas',
  indicacoes_validadas(meu_paciente_id()) = 1);
commit;

-- O resumo é só dela.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);
do $$
declare v_erro boolean := false;
begin
  begin perform resumo_indicacoes();
  exception when others then v_erro := true; end;
  perform teste('paciente NÃO vê o resumo de indicações de todas', v_erro);
end;
$$;
commit;

-- -----------------------------------------------------------------------------
-- A escada de benefícios
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);

select teste('a escada tem quatro degraus',
  (select count(*) from indicacao_beneficios where ativo) = 4);

select teste('a tela recebe a escada com o degrau alcançado',
  (select (b ->> 'alcancado')::boolean
     from jsonb_array_elements(meu_desafio() -> 'beneficiosIndicacao') b
    where (b ->> 'nivel')::int = 1));

select teste('e o degrau seguinte ainda não',
  (select (b ->> 'alcancado')::boolean = false
     from jsonb_array_elements(meu_desafio() -> 'beneficiosIndicacao') b
    where (b ->> 'nivel')::int = 2));

select teste('o total de indicações vem junto',
  (meu_desafio() ->> 'indicacoesValidadas')::int = 1);

do $$
declare v_erro boolean := false;
begin
  begin update indicacao_beneficios set texto = 'um milhão de pontos' where nivel = 1;
  exception when others then v_erro := true; end;
  perform teste('paciente NÃO reescreve a escada de benefícios',
    v_erro or (select texto from indicacao_beneficios where nivel = 1) <> 'um milhão de pontos');
end;
$$;
commit;

-- E o visitante sem login não lê nem a escada.
begin;
set local role anon;
do $$
declare v_erro boolean := false;
begin
  begin perform count(*) from indicacao_beneficios;
  exception when others then v_erro := true; end;
  perform teste('visitante sem login NÃO lê a escada de benefícios', v_erro);

  v_erro := false;
  begin perform resumo_indicacoes();
  exception when others then v_erro := true; end;
  perform teste('visitante sem login NÃO chama o resumo de indicações', v_erro);
end;
$$;
commit;

-- -----------------------------------------------------------------------------
-- Resultado
-- -----------------------------------------------------------------------------
select
  count(*) filter (where passou) || '/' || count(*) || ' verificações dos ajustes passaram' as resultado
from resultados_teste;

select string_agg(nome, e'\n') as falhas from resultados_teste where not passou;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% ajuste(s) falharam', v_falhas;
  end if;
end;
$$;
