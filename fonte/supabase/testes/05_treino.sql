-- =============================================================================
-- Bateria da evolução de treino
--
-- Duas coisas não podem falhar nunca:
--
--   * a paciente registra o que ELA fez, vê o treino que a profissional
--     programou para ELA, e não alcança nem o treino nem as sessões de
--     outra paciente;
--   * a paciente NÃO edita o plano. Quem programa o treino é quem programa
--     o treino; ela registra a execução.
--
-- Como nas outras baterias, os testes entram pela porta da frente: papel
-- `authenticated`, sessão de gente de verdade. Uma política que só o `psql`
-- de superusuário aprova não prova nada.
-- =============================================================================

truncate resultados_teste;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'treino-a@paciente.test'),
  ('00000000-0000-0000-0000-0000000000d2', 'treino-b@paciente.test');

insert into pacientes (email, nome, plano_id, data_inicio, data_fim) values
  ('treino-a@paciente.test', 'Dani Treino', 'mensal', hoje_sp() - 5, hoje_sp() + 25),
  ('treino-b@paciente.test', 'Bia Treino', 'mensal', hoje_sp() - 5, hoje_sp() + 25);

-- `security definer` de propósito: na sessão da paciente B, a RLS esconde a
-- linha da paciente A, e um atalho comum devolveria NULO ali. O teste
-- ficaria provando que "pedir a lista de NINGUÉM é recusado" — que é
-- verdadeiro e não prova nada. O que se quer provar é o contrário: que
-- SABER o id da outra não ajuda em nada.
create or replace function dani() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'treino-a@paciente.test' $$;
create or replace function bia() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'treino-b@paciente.test' $$;
grant execute on function dani(), bia() to anon, authenticated;

-- A aba de treino nasce DESLIGADA (0033). Estas duas são liberadas pela
-- nutricionista, pela porta da frente, para que o resto da bateria fale do
-- que ela quer testar. A bateria 07 é quem prova o que acontece com a aba
-- desligada.
do $$ begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
  perform definir_treino_do_paciente(dani(), true);
  perform definir_treino_do_paciente(bia(), true);
  perform set_config('request.jwt.claim.sub', '', true);
end $$;


-- -----------------------------------------------------------------------------
-- A profissional monta o plano
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select salvar_treino(null, dani(), 'Treino A — inferiores', 'Aquecer 5 min antes.', true,
  jsonb_build_array(
    jsonb_build_object('nome', 'Agachamento', 'seriesPlanejadas', '3',
                       'repeticoesMin', '8', 'repeticoesMax', '10'),
    jsonb_build_object('nome', 'Leg press', 'seriesPlanejadas', '3',
                       'repeticoesMin', '10', 'repeticoesMax', '12'),
    -- Linha sem nome não vira exercício: é o que sobra de uma linha em
    -- branco na tela, e viraria um exercício fantasma no treino dela.
    jsonb_build_object('nome', '  ', 'seriesPlanejadas', '3')));

select teste('o treino nasce com dois exercícios, e a linha vazia não entra',
  jsonb_array_length(treinos_do_paciente(dani()) -> 0 -> 'exercicios') = 2);
select teste('e a faixa programada fica gravada',
  (treinos_do_paciente(dani()) -> 0 -> 'exercicios' -> 0 ->> 'repeticoesMax') = '10');
select teste('a ordem dos exercícios é a que ela escreveu',
  (treinos_do_paciente(dani()) -> 0 -> 'exercicios' -> 0 ->> 'nome') = 'Agachamento'
  and (treinos_do_paciente(dani()) -> 0 -> 'exercicios' -> 1 ->> 'nome') = 'Leg press');

-- Um segundo treino ativo tem que desativar o primeiro: dois ativos fariam
-- a tela dela escolher um em silêncio, e o outro nunca apareceria.
select salvar_treino(null, dani(), 'Treino B — superiores', null, true,
  jsonb_build_array(jsonb_build_object('nome', 'Remada', 'seriesPlanejadas', '4')));

select teste('um treino ativo por paciente: o novo ativa e o anterior desativa',
  (select count(*) from treinos where paciente_id = dani() and ativo) = 1
  and (select nome from treinos where paciente_id = dani() and ativo) = 'Treino B — superiores');
select teste('mas o treino antigo continua existindo, com os exercícios dele',
  (select count(*) from treinos where paciente_id = dani()) = 2
  and (select count(*) from treino_exercicios) = 3);
commit;

-- -----------------------------------------------------------------------------
-- A paciente lê o plano, e só o dela
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', true);

select teste('ela recebe o treino ATIVO', (meu_treino() ->> 'nome') = 'Treino B — superiores');
select teste('com os exercícios dentro',
  (meu_treino() -> 'exercicios' -> 0 ->> 'nome') = 'Remada');
select teste('e o atalho aparece no acesso dela', (meu_acesso() ->> 'treino')::boolean);

select teste('ela NÃO vê o treino inativo',
  (select count(*) from treinos) = 1);
select teste('ela NÃO vê os exercícios do treino inativo',
  (select count(*) from treino_exercicios) = 1);

-- "Não pode editar o treino prescrito pelo profissional."
select teste('ela não altera o plano', nao_alterou('update treinos set nome = ''Meu treino'''));
select teste('ela não altera a faixa programada',
  nao_alterou('update treino_exercicios set repeticoes_max = 99'));
select teste('ela não monta treino para si mesma',
  recusou(format('select salvar_treino(null, %L, ''Eu mesma'', null, true, ''[]''::jsonb)', dani())));
select teste('e o erro é de permissão, não outro qualquer',
  estado_de(format('select salvar_treino(null, %L, ''Eu mesma'', null, true, ''[]''::jsonb)', dani()))
  = '42501');
commit;

-- -----------------------------------------------------------------------------
-- A paciente registra o que ELA fez
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d1', true);

select registrar_sessao_treino(null, null, null, hoje_sp() - 14, null, jsonb_build_array(
  jsonb_build_object('exercicioNome', 'Agachamento', 'numero', '1', 'carga', '60', 'repeticoes', '6')));
select registrar_sessao_treino(null, null, null, hoje_sp() - 11, null, jsonb_build_array(
  jsonb_build_object('exercicioNome', 'Agachamento', 'numero', '1', 'carga', '60', 'repeticoes', '7')));
select registrar_sessao_treino(null, null, null, hoje_sp() - 7, 'Dormi mal', jsonb_build_array(
  jsonb_build_object('exercicioNome', 'Agachamento', 'numero', '1', 'carga', '62', 'repeticoes', '6'),
  -- Exercício sem carga: em branco tem que ficar NULO, nunca zero.
  jsonb_build_object('exercicioNome', 'Prancha', 'numero', '1', 'carga', '', 'repeticoes', '30')));

select teste('as três sessões dela ficaram gravadas',
  jsonb_array_length(sessoes_de_treino()) = 3);
select teste('a mais nova vem primeiro',
  (sessoes_de_treino() -> 0 ->> 'data')::date = hoje_sp() - 7);
select teste('com as séries dentro, na ordem',
  jsonb_array_length(sessoes_de_treino() -> 0 -> 'series') = 2
  and (sessoes_de_treino() -> 0 -> 'series' -> 0 ->> 'exercicioNome') = 'Agachamento');
select teste('carga em branco fica NULA, não zero',
  (sessoes_de_treino() -> 0 -> 'series' -> 1 -> 'carga') = 'null'::jsonb);
select teste('e a observação dela foi junto',
  (sessoes_de_treino() -> 0 ->> 'observacao') = 'Dormi mal');

-- Data futura: quem digita 2027 errou o ano, e o registro iria para o fim
-- da linha do tempo e ficaria lá.
select teste('não dá para registrar treino no futuro',
  recusou('select registrar_sessao_treino(null, null, null, hoje_sp() + 1, null,
           jsonb_build_array(jsonb_build_object(''exercicioNome'', ''X'', ''repeticoes'', ''5'')))'));
-- `estado_de` e não `recusou` invertido: '00000' é o código do sucesso no
-- Postgres, e assim o teste prova que passou por bem, não que falhou por
-- outro motivo qualquer.
select teste('e hoje continua valendo',
  estado_de('select registrar_sessao_treino(null, null, null, hoje_sp(), null,
             jsonb_build_array(jsonb_build_object(''exercicioNome'', ''Hoje'', ''repeticoes'', ''5'')))')
  = '00000');
commit;

-- -----------------------------------------------------------------------------
-- O que a paciente B alcança: nada
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d2', true);

select teste('a paciente B não vê o treino da A', (select count(*) from treinos) = 0);
select teste('nem os exercícios da A', (select count(*) from treino_exercicios) = 0);
select teste('nem as sessões da A', (select count(*) from treino_sessoes) = 0);
select teste('nem as séries da A', (select count(*) from treino_series) = 0);
select teste('e meu_treino() dela volta vazio', meu_treino() is null);
select teste('e sessoes_de_treino() dela volta lista vazia',
  sessoes_de_treino() = '[]'::jsonb);

-- A porta mais óbvia de todas: pedir a lista da outra pelo id.
select teste('pedir as sessões da A pelo id é recusado',
  recusou(format('select sessoes_de_treino(%L)', dani())));
select teste('e o erro é de permissão',
  estado_de(format('select sessoes_de_treino(%L)', dani())) = '42501');
select teste('pedir os treinos da A pelo id também é recusado',
  recusou(format('select treinos_do_paciente(%L)', dani())));

-- E a porta menos óbvia: registrar na ficha da outra mandando o id dela.
-- O `p_paciente` é IGNORADO quando quem chama é paciente.
select registrar_sessao_treino(null, dani(), null, hoje_sp(), 'tentativa',
  jsonb_build_array(jsonb_build_object('exercicioNome', 'Invasão', 'repeticoes', '1')));
select teste('mandar o id da outra grava na ficha de quem chamou, não na dela',
  jsonb_array_length(sessoes_de_treino()) = 1
  and (sessoes_de_treino() -> 0 -> 'series' -> 0 ->> 'exercicioNome') = 'Invasão');

-- Apagar a sessão da outra PELO ID. Não adianta usar `nao_alterou` aqui:
-- `select f(...)` devolve uma linha mesmo quando a função não apagou nada,
-- e o teste passaria sem provar nada. A prova é a sessão da A continuar
-- existindo depois — conferida no bloco da profissional, logo abaixo.
select excluir_sessao_treino(
  (select id from treino_sessoes where paciente_id = dani() order by data limit 1));
commit;

-- -----------------------------------------------------------------------------
-- A profissional vê e lança pela paciente
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select teste('a profissional vê as sessões da paciente A',
  jsonb_array_length(sessoes_de_treino(dani())) = 4);
select teste('e nenhuma delas foi apagada pela tentativa da paciente B',
  (select count(*) from treino_sessoes where paciente_id = dani()) = 4);
select teste('e as da B ficam separadas', jsonb_array_length(sessoes_de_treino(bia())) = 1);

-- "Lançar o que a paciente contou na consulta."
select registrar_sessao_treino(null, dani(), null, hoje_sp(), 'Contou na consulta',
  jsonb_build_array(
    jsonb_build_object('exercicioNome', 'Agachamento', 'numero', '1', 'carga', '62', 'repeticoes', '7')));
select teste('a profissional lança na ficha da paciente que ela escolheu',
  jsonb_array_length(sessoes_de_treino(dani())) = 5
  and (sessoes_de_treino(dani()) -> 0 ->> 'observacao') = 'Contou na consulta');
select teste('e a da B não mudou', jsonb_array_length(sessoes_de_treino(bia())) = 1);
commit;

-- -----------------------------------------------------------------------------
-- Apagar sem levar o que não é para levar
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select excluir_treino((select id from treinos where paciente_id = dani() and not ativo limit 1));
select teste('apagar um treino não apaga as sessões que ela fez',
  jsonb_array_length(sessoes_de_treino(dani())) = 5);

delete from pacientes where email = 'treino-a@paciente.test';
select teste('excluir a paciente leva o treino dela junto',
  (select count(*) from treinos where paciente_id not in (select id from pacientes)) = 0);
select teste('e as sessões dela também',
  (select count(*) from treino_sessoes where paciente_id not in (select id from pacientes)) = 0);
select teste('e as séries, por tabela',
  (select count(*) from treino_series s
    where not exists (select 1 from treino_sessoes x where x.id = s.sessao_id)) = 0);
commit;

select
  count(*) filter (where passou) || '/' || count(*) || ' verificações do treino passaram' as resultado
from resultados_teste;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% verificação(ões) do treino falharam', v_falhas;
  end if;
end;
$$;
