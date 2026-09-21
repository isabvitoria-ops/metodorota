-- =============================================================================
-- Bateria do treino escrito pela PACIENTE (0032)
--
-- A 0030 provou que a paciente não edita o plano da profissional. A 0032
-- abre uma segunda porta — ela escrever o treino DELA — e esta bateria existe
-- para provar que a porta nova não abriu a antiga.
--
-- O que não pode falhar nunca:
--
--   * ela escreve o treino dela, e só o dela;
--   * mandar o id de outra paciente na chamada não escreve na ficha de
--     ninguém — nem na da outra, nem cria treino solto;
--   * com plano ATIVO da nutricionista no ar, ela não cria, não altera e
--     não apaga nada;
--   * ela não converte um treino da profissional em treino próprio;
--   * a nutricionista continua podendo tudo, e vê de quem é cada plano.
-- =============================================================================

truncate resultados_teste;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000007a01', 'propria-a@paciente.test'),
  ('00000000-0000-0000-0000-000000007a02', 'propria-b@paciente.test');

insert into pacientes (email, nome, plano_id, data_inicio, data_fim) values
  ('propria-a@paciente.test', 'Carla Propria', 'mensal', hoje_sp() - 5, hoje_sp() + 25),
  ('propria-b@paciente.test', 'Duda Propria', 'mensal', hoje_sp() - 5, hoje_sp() + 25);

create or replace function carla() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'propria-a@paciente.test' $$;
create or replace function duda() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'propria-b@paciente.test' $$;
/**
 * O id de um treino, visto por cima da RLS.
 *
 * Sem `security definer` aqui, o `select id from treinos ...` rodando na
 * sessão da Duda devolveria NULO — a RLS esconde a linha da Carla — e o
 * `salvar_treino(NULL, ...)` que sairia disso seria uma CRIAÇÃO, que é
 * permitida. O teste passaria verde provando o contrário do que diz.
 */
create or replace function treino_de(p_paciente uuid, p_origem text default null)
returns uuid language sql stable security definer as $$
  select id from treinos
  where paciente_id = p_paciente and (p_origem is null or origem = p_origem)
  order by ativo desc, atualizado_em desc limit 1 $$;

grant execute on function carla(), duda(), treino_de(uuid, text) to anon, authenticated;

-- A aba de treino nasce DESLIGADA (0033). Estas duas são liberadas pela
-- nutricionista, pela porta da frente, para que o resto da bateria fale do
-- que ela quer testar. A bateria 07 é quem prova o que acontece com a aba
-- desligada.
do $$ begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
  perform definir_treino_do_paciente(carla(), true);
  perform definir_treino_do_paciente(duda(), true);
  perform set_config('request.jwt.claim.sub', '', true);
end $$;


-- -----------------------------------------------------------------------------
-- Sem plano da nutricionista, a paciente escreve o dela
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000007a01', true);

select teste('a porta do treino aparece mesmo sem plano nenhum',
  (meu_acesso() ->> 'treino')::boolean);
select teste('e o banco diz que ela pode escrever',
  (posso_escrever_treino() ->> 'pode')::boolean);
select teste('sem treino nenhum, meu_treino() é nulo', meu_treino() is null);

select salvar_treino(null, null, 'Meu treino da academia', 'Segunda, quarta e sexta.', true,
  jsonb_build_array(
    jsonb_build_object('nome', 'Supino', 'seriesPlanejadas', '3',
                       'repeticoesMin', '8', 'repeticoesMax', '12'),
    jsonb_build_object('nome', 'Prancha', 'seriesPlanejadas', '3'),
    jsonb_build_object('nome', '   ', 'seriesPlanejadas', '3')));

select teste('o treino dela nasce e aparece', (meu_treino() ->> 'nome') = 'Meu treino da academia');
select teste('com os exercícios, e a linha em branco fora',
  jsonb_array_length(meu_treino() -> 'exercicios') = 2);
select teste('marcado como escrito por ela', (meu_treino() ->> 'origem') = 'paciente');
select teste('e ela pode editar o próprio', (meu_treino() ->> 'podeEditar')::boolean);
select teste('nasce ativo, senão a tela de registro não acha exercício',
  (select ativo from treinos where id = (meu_treino() ->> 'id')::uuid));

-- Editar o próprio: é dela, ela muda quando quiser.
select salvar_treino((meu_treino() ->> 'id')::uuid, null, 'Academia — novo', null, true,
  jsonb_build_array(jsonb_build_object('nome', 'Remada', 'seriesPlanejadas', '4')));

select teste('ela edita o treino que escreveu', (meu_treino() ->> 'nome') = 'Academia — novo');
select teste('e a edição substitui os exercícios, não soma',
  jsonb_array_length(meu_treino() -> 'exercicios') = 1);
select teste('editar não cria um segundo treino',
  (select count(*) from treinos where paciente_id = carla()) = 1);
commit;

-- -----------------------------------------------------------------------------
-- O id da outra paciente não vale nada
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000007a01', true);

-- Mandando o id da Duda: a função ignora `p_paciente` para quem não é admin.
select salvar_treino(null, duda(), 'Treino que eu escrevi pra outra', null, true,
  jsonb_build_array(jsonb_build_object('nome', 'Agachamento')));

select teste('mandar o id de outra paciente NÃO escreve na ficha dela',
  (select count(*) from treinos where paciente_id = duda()) = 0);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000007a01', true);
select teste('o treino foi parar na ficha de quem chamou, e em nenhuma outra',
  (select count(*) from treinos where paciente_id = carla()) = 2);
commit;

-- A Duda, do lado dela, não vê nada disso.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000007a02', true);

select teste('a outra paciente não vê treino nenhum', (select count(*) from treinos) = 0);
select teste('nem exercício nenhum', (select count(*) from treino_exercicios) = 0);
select teste('e meu_treino() dela é nulo', meu_treino() is null);
commit;

-- Sabendo o id do treino da Carla, ainda não dá.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000007a02', true);

select teste('ela não altera o treino que a OUTRA paciente escreveu',
  estado_de(format('select salvar_treino(%L, null, ''Roubado'', null, true, ''[]''::jsonb)',
    treino_de(carla()))) = '42501');
select teste('e não apaga o treino da outra',
  estado_de(format('select excluir_treino(%L)', treino_de(carla()))) = '42501');
select teste('e a recusa não deixou um treino solto na ficha dela',
  (select count(*) from treinos) = 0);
commit;

begin;
select teste('o treino da Carla continua inteiro depois das tentativas',
  (select count(*) from treinos where paciente_id = carla()) = 2);
commit;

-- -----------------------------------------------------------------------------
-- Chegou plano da nutricionista: a paciente para de escrever
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select salvar_treino(null, carla(), 'Programa da nutri', 'Prescrito.', true,
  jsonb_build_array(jsonb_build_object('nome', 'Leg press', 'seriesPlanejadas', '3',
                                       'repeticoesMin', '10', 'repeticoesMax', '12')));

select teste('o plano da profissional nasce com origem nutricionista',
  (select origem from treinos where paciente_id = carla() and ativo) = 'nutricionista');
select teste('e ele desativa o que a paciente tinha escrito',
  (select count(*) from treinos where paciente_id = carla() and ativo) = 1);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000007a01', true);

select teste('agora meu_treino() é o da nutricionista',
  (meu_treino() ->> 'nome') = 'Programa da nutri');
select teste('e ela NÃO pode editar esse', not (meu_treino() ->> 'podeEditar')::boolean);
select teste('o banco explica por que ela não pode escrever',
  (posso_escrever_treino() ->> 'pode')::boolean is false
  and (posso_escrever_treino() ->> 'motivo') = 'treino_da_nutricionista');

select teste('ela não cria um treino próprio por cima do plano',
  estado_de('select salvar_treino(null, null, ''O meu'', null, true, ''[]''::jsonb)') = '42501');
select teste('ela não edita o plano da profissional',
  estado_de(format('select salvar_treino(%L, null, ''Editado'', null, true, ''[]''::jsonb)',
    (meu_treino() ->> 'id'))) = '42501');
select teste('ela não apaga o plano da profissional',
  estado_de(format('select excluir_treino(%L)', (meu_treino() ->> 'id'))) = '42501');
select teste('e nem o treino próprio dela, enquanto o plano está no ar',
  estado_de(format('select salvar_treino(%L, null, ''Meu de novo'', null, true, ''[]''::jsonb)',
    (select id from treinos where paciente_id = carla() and origem = 'paciente'
     order by atualizado_em desc limit 1))) = '42501');

-- A RLS continua sendo a segunda tranca, independente das funções.
select teste('ela não altera a tabela direto', nao_alterou('update treinos set nome = ''Na marra'''));
select teste('nem marca um treino como próprio na marra',
  nao_alterou('update treinos set origem = ''paciente'''));
select teste('nem altera a faixa programada',
  nao_alterou('update treino_exercicios set repeticoes_max = 99'));
select teste('nem insere treino direto na tabela',
  recusou(format('insert into treinos (paciente_id, nome, origem) values (%L, ''X'', ''paciente'')',
    carla())));
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000007a01', true);
select teste('o plano da profissional segue com o nome que ela deu',
  (select nome from treinos where paciente_id = carla() and ativo) = 'Programa da nutri');
select teste('o treino que a paciente escreveu não foi apagado: continua visível para ela',
  (select count(*) from treinos where origem = 'paciente') = 2);
commit;

-- -----------------------------------------------------------------------------
-- A nutricionista tira o plano; a paciente volta a escrever
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select teste('ela vê de quem é cada plano',
  (select count(*) from jsonb_array_elements(treinos_do_paciente(carla())) e
   where e ->> 'origem' = 'paciente') = 2);

select excluir_treino((select id from treinos where paciente_id = carla()
                       and origem = 'nutricionista'));
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000007a01', true);

select teste('sem plano ativo, ela volta a poder escrever',
  (posso_escrever_treino() ->> 'pode')::boolean);
select teste('e o treino que ela tinha escrito volta a aparecer',
  meu_treino() is not null and (meu_treino() ->> 'origem') = 'paciente');

select salvar_treino((meu_treino() ->> 'id')::uuid, null, 'De volta ao meu', null, true,
  jsonb_build_array(jsonb_build_object('nome', 'Afundo', 'seriesPlanejadas', '3')));
select teste('e ela edita de novo', (meu_treino() ->> 'nome') = 'De volta ao meu');

-- Apagar o próprio: pode.
select excluir_treino((meu_treino() ->> 'id')::uuid);
select teste('ela apaga o treino que escreveu',
  (select count(*) from treinos where nome = 'De volta ao meu') = 0);
commit;

-- -----------------------------------------------------------------------------
-- O treino próprio serve de base para o registro de sessão
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000007a01', true);

select salvar_treino(null, null, 'Rotina', null, true,
  jsonb_build_array(jsonb_build_object('nome', 'Supino', 'seriesPlanejadas', '3',
                                       'repeticoesMin', '8', 'repeticoesMax', '10')));

select registrar_sessao_treino(null, null, (meu_treino() ->> 'id')::uuid, hoje_sp(), null,
  jsonb_build_array(jsonb_build_object(
    'exercicioId', (meu_treino() -> 'exercicios' -> 0 ->> 'id'),
    'exercicioNome', 'Supino', 'numero', '1', 'carga', '30', 'repeticoes', '10')));

select teste('ela registra a sessão contra o treino que ela mesma escreveu',
  jsonb_array_length(sessoes_de_treino()) = 1);
select teste('e a série ficou ligada ao exercício do treino dela',
  (sessoes_de_treino() -> 0 -> 'series' -> 0 ->> 'exercicioNome') = 'Supino');
commit;

-- -----------------------------------------------------------------------------
-- Apagar a paciente leva o treino que ela escreveu
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
delete from pacientes where id = carla();
select teste('excluir a paciente leva os treinos próprios dela',
  (select count(*) from treinos where paciente_id not in (select id from pacientes)) = 0);
commit;

select
  count(*) filter (where passou) || '/' || count(*) || ' verificações do treino próprio passaram'
    as resultado
from resultados_teste;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% verificação(ões) do treino próprio falharam', v_falhas;
  end if;
end;
$$;
