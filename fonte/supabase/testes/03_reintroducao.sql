-- =============================================================================
-- Bateria da Rastreabilidade alimentar
--
-- Metade destes testes prova que o sistema FAZ alguma coisa. A outra metade
-- prova que ele NÃO faz — que não trava, não cobra e não conclui. Essa metade
-- é a que importa: um sistema que decide sozinho que um alimento "faz mal"
-- passa despercebido em revisão e aparece na cara da paciente.
-- =============================================================================

truncate resultados_teste;

-- -----------------------------------------------------------------------------
-- Cenário: elenco próprio, como nas outras baterias
-- -----------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'r-ana@paciente.test'),
  ('00000000-0000-0000-0000-0000000000e2', 'r-bia@paciente.test');

insert into pacientes (email, nome, plano_id, data_inicio, data_fim) values
  ('r-ana@paciente.test', 'Ana Rastreio', 'mensal', hoje_sp() - 20, hoje_sp() + 20),
  ('r-bia@paciente.test', 'Bia Rastreio', 'mensal', hoje_sp() - 20, hoje_sp() + 20);

-- -----------------------------------------------------------------------------
-- O catálogo veio do material dela
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select teste('o catálogo tem as quatro semanas do material',
  (select count(distinct semana_sugerida) from reintroducao_alimentos) = 4);
select teste('o abacate da semana 1 está com a porção do PDF',
  (select porcao_referencia from reintroducao_alimentos where id = 'abacate') = '60g');
select teste('a água de coco está em ml, não em gramas',
  (select porcao_referencia from reintroducao_alimentos where id = 'agua-de-coco') = '600ml');
select teste('vegetal entra como porção livre',
  (select porcao_referencia from reintroducao_alimentos where id = 'brocolis') = 'Livre');
select teste('o lácteo carrega o aviso de sem lactose',
  (select observacao from reintroducao_alimentos where id = 'kefir-integral')
    like '%sem lactose%');
select teste('os onze queijos de vaca das dicas extras estão lá',
  (select count(*) from reintroducao_alimentos where observacao like 'Queijo de vaca.%') = 11);
commit;

-- -----------------------------------------------------------------------------
-- A nutricionista monta a lista daquela paciente
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select set_config('teste.ana', (select id::text from pacientes where email = 'r-ana@paciente.test'), false);
select set_config('teste.bia', (select id::text from pacientes where email = 'r-bia@paciente.test'), false);

select teste('a nutricionista puxa quatro alimentos do catálogo para a Ana',
  adicionar_itens_reintroducao(current_setting('teste.ana')::uuid,
    array['abacate', 'pera', 'inhame', 'brocolis']) = 4);

select teste('puxar de novo não duplica',
  adicionar_itens_reintroducao(current_setting('teste.ana')::uuid,
    array['abacate', 'pera']) = 0);

select teste('e a lista da Ana tem só o que ela escolheu — não o catálogo inteiro',
  (select count(*) from reintroducao_itens
    where paciente_id = current_setting('teste.ana')::uuid) = 4);

select teste('a Bia continua sem lista nenhuma',
  (select count(*) from reintroducao_itens
    where paciente_id = current_setting('teste.bia')::uuid) = 0);

select teste('alimento fora do material entra pelo nome',
  adicionar_item_livre_reintroducao(current_setting('teste.ana')::uuid, 'Sucrilhos') is not null);

-- Cinco: os quatro do catálogo mais o "Sucrilhos". Nenhum deles nasce
-- cobrando nada — "não iniciado" é um estado de repouso, não uma pendência.
select teste('todo item nasce como não iniciado',
  (select count(*) from reintroducao_itens
    where paciente_id = current_setting('teste.ana')::uuid
      and status = 'nao_iniciado') = 5);
commit;

-- -----------------------------------------------------------------------------
-- A paciente registra — e o sistema NÃO atrapalha
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', true);
select set_config('teste.abacate',
  (select i.id::text from reintroducao_itens i
    where i.paciente_id = meu_paciente_id() and i.alimento_id = 'abacate'), false);
select set_config('teste.pera',
  (select i.id::text from reintroducao_itens i
    where i.paciente_id = meu_paciente_id() and i.alimento_id = 'pera'), false);
select set_config('teste.inhame',
  (select i.id::text from reintroducao_itens i
    where i.paciente_id = meu_paciente_id() and i.alimento_id = 'inhame'), false);

select teste('a paciente registra o primeiro alimento',
  registrar_reintroducao(
    p_item := current_setting('teste.abacate')::uuid,
    p_data := hoje_sp(), p_horario := '10:00',
    p_quantidade := '60g', p_preparo := 'Puro, no café da manhã',
    p_sintomas := array['nenhum']) is not null);

-- O ponto central do pedido dela: NADA de "espere 48 horas".
select teste('o segundo alimento entra no mesmo dia, três horas depois',
  registrar_reintroducao(
    p_item := current_setting('teste.pera')::uuid,
    p_data := hoje_sp(), p_horario := '13:00',
    p_quantidade := '175g', p_sintomas := array['nenhum']) is not null);

select teste('e o terceiro também, ainda no mesmo dia',
  registrar_reintroducao(
    p_item := current_setting('teste.inhame')::uuid,
    p_data := hoje_sp(), p_horario := '20:00',
    p_quantidade := '90g',
    p_sintomas := array['distensao', 'gases'], p_intensidade := 4,
    p_bristol := 5) is not null);

select teste('três alimentos no mesmo dia ficaram registrados',
  (select count(*) from reintroducao_registros where paciente_id = meu_paciente_id()) = 3);

-- O mesmo alimento acompanhado por vários dias, sem exigir um terceiro.
select teste('o mesmo alimento pode ser registrado de novo no dia seguinte',
  registrar_reintroducao(
    p_item := current_setting('teste.abacate')::uuid,
    p_data := hoje_sp() + 1, p_horario := '10:00',
    p_quantidade := '60g', p_sintomas := array['nenhum']) is not null);

select teste('o abacate tem dois registros, e nenhum terceiro é exigido',
  (select count(*) from reintroducao_registros
    where item_id = current_setting('teste.abacate')::uuid) = 2);

-- Alimento fora da lista: o "entra na semana 5" do material.
select teste('a paciente registra um alimento que não estava na lista dela',
  registrar_reintroducao(
    p_nome_novo := 'Pão da padaria', p_data := hoje_sp(),
    p_sintomas := array['dor_abdominal'], p_intensidade := 6) is not null);

select teste('e ele virou item da lista dela sozinho',
  (select count(*) from reintroducao_itens
    where paciente_id = meu_paciente_id() and nome_livre = 'Pão da padaria') = 1);
commit;

-- -----------------------------------------------------------------------------
-- O que o sistema NÃO conclui
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', true);

-- O inhame teve distensão e gases com intensidade 4. Se o sistema
-- "concluísse" alguma coisa, seria aqui.
select teste('sintoma registrado NÃO vira status de intolerância',
  (select status from reintroducao_itens
    where id = current_setting('teste.inhame')::uuid) = 'em_teste');

select teste('nenhum item ficou com status que a nutricionista não deu',
  (select count(*) from reintroducao_itens
    where paciente_id = meu_paciente_id()
      and status not in ('nao_iniciado', 'em_teste')) = 0);

select teste('registrar mudou o não iniciado para em teste, e só isso',
  (select status from reintroducao_itens
    where id = current_setting('teste.abacate')::uuid) = 'em_teste');

select teste('o alimento nunca registrado continua não iniciado, sem virar pendência',
  (select status from reintroducao_itens
    where paciente_id = meu_paciente_id() and alimento_id = 'brocolis') = 'nao_iniciado');
commit;

-- -----------------------------------------------------------------------------
-- A paciente tira da frente o que ela não come (§4)
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', true);
select set_config('teste.brocolis',
  (select i.id::text from reintroducao_itens i
    where i.paciente_id = meu_paciente_id() and i.alimento_id = 'brocolis'), false);

do $$
begin
  perform marcar_relevancia_reintroducao(current_setting('teste.brocolis')::uuid, false);
  perform teste('a paciente marca um alimento como não relevante para ela', true);
end;
$$;

select teste('e ele fica como não relevante',
  (select status from reintroducao_itens
    where id = current_setting('teste.brocolis')::uuid) = 'nao_relevante');

do $$
begin
  perform marcar_relevancia_reintroducao(current_setting('teste.brocolis')::uuid, true);
  perform teste('e ela pode voltar atrás', true);
end;
$$;
select teste('voltando para não iniciado',
  (select status from reintroducao_itens
    where id = current_setting('teste.brocolis')::uuid) = 'nao_iniciado');
commit;

-- Mas ela não desfaz uma classificação clínica da nutricionista.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
do $$
begin
  perform definir_status_reintroducao(current_setting('teste.pera')::uuid,
    'bem_tolerado', 'Comeu três vezes, sem sintoma.');
end;
$$;
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', true);
do $$
declare v_erro boolean := false;
begin
  begin perform marcar_relevancia_reintroducao(current_setting('teste.pera')::uuid, false);
  exception when others then v_erro := true; end;
  perform teste('a paciente NÃO apaga a classificação da nutricionista', v_erro);
end;
$$;
select teste('e a classificação ficou de pé',
  (select status from reintroducao_itens
    where id = current_setting('teste.pera')::uuid) = 'bem_tolerado');
commit;

-- -----------------------------------------------------------------------------
-- A semana agrupa, e nada mais
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
do $$
begin
  perform definir_acompanhamento_reintroducao(current_setting('teste.ana')::uuid,
    hoje_sp() - 10, 'Vamos com calma, sem pressa nenhuma.');
end;
$$;

select teste('com início dez dias atrás, hoje é a semana 2',
  semana_da_reintroducao(current_setting('teste.ana')::uuid, hoje_sp()) = 2);
select teste('e o primeiro dia era a semana 1',
  semana_da_reintroducao(current_setting('teste.ana')::uuid, hoje_sp() - 10) = 1);

-- O que não foi testado na semana 1 continua disponível: não existe fechamento.
select teste('alimento não testado continua na lista depois da semana virar',
  (select count(*) from reintroducao_itens
    where paciente_id = current_setting('teste.ana')::uuid
      and status = 'nao_iniciado') >= 1);

select teste('a orientação daquela paciente chega junto',
  (reintroducao_do_paciente(current_setting('teste.ana')::uuid) ->> 'orientacao')
    like '%sem pressa%');

select teste('a linha do tempo traz os registros com a semana de cada um',
  jsonb_array_length(reintroducao_do_paciente(current_setting('teste.ana')::uuid)
    -> 'registros') = 5);
commit;

-- -----------------------------------------------------------------------------
-- A tela da paciente
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', true);

select teste('a paciente lê a própria rastreabilidade',
  jsonb_array_length(minha_reintroducao() -> 'itens') = 6);
select teste('com os registros dela',
  jsonb_array_length(minha_reintroducao() -> 'registros') = 5);
select teste('e com o recado da nutricionista no topo',
  (minha_reintroducao() ->> 'orientacao') like '%sem pressa%');
select teste('o registro guarda mais de um sintoma ao mesmo tempo',
  (select jsonb_array_length(r -> 'sintomas')
     from jsonb_array_elements(minha_reintroducao() -> 'registros') r
    where r ->> 'itemNome' = 'Inhame') = 2);
select teste('e guarda a escala de Bristol do protocolo dela',
  (select (r ->> 'bristol')::int
     from jsonb_array_elements(minha_reintroducao() -> 'registros') r
    where r ->> 'itemNome' = 'Inhame') = 5);
select teste('a porção de referência do material acompanha o item',
  (select r ->> 'porcaoReferencia'
     from jsonb_array_elements(minha_reintroducao() -> 'itens') r
    where r ->> 'nome' = 'Inhame') = '90g');
commit;

-- -----------------------------------------------------------------------------
-- Corrigir e apagar o próprio registro
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', true);
select set_config('teste.registro',
  (select r.id::text from reintroducao_registros r
    where r.paciente_id = meu_paciente_id() order by r.criado_em limit 1), false);

do $$
begin
  perform editar_registro_reintroducao(current_setting('teste.registro')::uuid,
    p_horario := '11:30', p_quantidade := '30g',
    p_sintomas := array['nenhum'], p_observacao := 'Reduzi pela metade.');
  perform teste('a paciente corrige o próprio registro', true);
end;
$$;
select teste('a correção ficou gravada',
  (select quantidade from reintroducao_registros
    where id = current_setting('teste.registro')::uuid) = '30g');

do $$
begin
  perform excluir_registro_reintroducao(current_setting('teste.registro')::uuid);
  perform teste('e pode apagar o que registrou por engano', true);
end;
$$;
commit;

-- -----------------------------------------------------------------------------
-- Fechaduras
-- -----------------------------------------------------------------------------

-- Uma paciente não vê nem toca no diário da outra.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e2', true);

select teste('a Bia não enxerga um registro sequer da Ana',
  (select count(*) from reintroducao_registros) = 0);
select teste('nem a lista de alimentos da Ana',
  (select count(*) from reintroducao_itens) = 0);

do $$
declare v_estado text := '';
begin
  begin perform registrar_reintroducao(
    p_item := current_setting('teste.abacate')::uuid, p_data := hoje_sp());
  exception when others then v_estado := sqlstate; end;
  perform teste('e não registra nada no alimento da Ana', v_estado = '42501');
end;
$$;

do $$
declare v_erro boolean := false;
begin
  begin perform reintroducao_do_paciente(current_setting('teste.ana')::uuid);
  exception when others then v_erro := true; end;
  perform teste('paciente NÃO lê o acompanhamento de outra pelo painel', v_erro);
end;
$$;

do $$
declare v_erro boolean := false;
begin
  begin perform definir_status_reintroducao(current_setting('teste.pera')::uuid, 'bem_tolerado');
  exception when others then v_erro := true; end;
  perform teste('paciente NÃO classifica alimento', v_erro);
end;
$$;

do $$
declare v_erro boolean := false;
begin
  begin perform adicionar_itens_reintroducao(meu_paciente_id(), array['mel']);
  exception when others then v_erro := true; end;
  perform teste('paciente NÃO monta a própria lista pelo caminho da nutricionista', v_erro);
end;
$$;
commit;

-- Sintoma que a tela não conhece não entra.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', true);
do $$
declare v_erro boolean := false;
begin
  begin perform registrar_reintroducao(
    p_item := current_setting('teste.abacate')::uuid,
    p_sintomas := array['sintoma_inventado']);
  exception when others then v_erro := true; end;
  perform teste('sintoma fora do vocabulário é recusado', v_erro);
end;
$$;

select teste('"nenhum" junto com outro sintoma não sobrevive à contradição',
  conferir_sintomas(array['nenhum', 'gases']) = array['gases']);

do $$
declare v_erro boolean := false;
begin
  begin perform registrar_reintroducao(
    p_item := current_setting('teste.abacate')::uuid, p_intensidade := 50);
  exception when others then v_erro := true; end;
  perform teste('intensidade fora da escala de 0 a 10 é recusada', v_erro);
end;
$$;
commit;

-- Tirar da lista um alimento com histórico apagaria o que a paciente escreveu.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
do $$
declare v_erro boolean := false;
begin
  begin perform remover_item_reintroducao(current_setting('teste.inhame')::uuid);
  exception when others then v_erro := true; end;
  perform teste('remover alimento com registro é recusado, e a saída é marcar não relevante', v_erro);
end;
$$;
select teste('o histórico continua inteiro',
  (select count(*) from reintroducao_registros
    where item_id = current_setting('teste.inhame')::uuid) = 1);

do $$
begin
  perform remover_item_reintroducao(current_setting('teste.brocolis')::uuid);
  perform teste('alimento sem registro pode sair da lista', true);
end;
$$;
commit;

-- E o visitante sem login não alcança nada disso.
begin;
set local role anon;
do $$
declare v_erro boolean := false;
begin
  begin perform count(*) from reintroducao_registros;
  exception when others then v_erro := true; end;
  perform teste('visitante sem login NÃO lê o diário de ninguém', v_erro);

  v_erro := false;
  begin perform count(*) from reintroducao_alimentos;
  exception when others then v_erro := true; end;
  perform teste('visitante sem login NÃO lê nem o catálogo', v_erro);

  v_erro := false;
  begin perform minha_reintroducao();
  exception when others then v_erro := true; end;
  perform teste('visitante sem login NÃO chama a rastreabilidade', v_erro);
end;
$$;
commit;

-- -----------------------------------------------------------------------------
-- Oxalato, histamina e lectina (0018 a 0020)
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select teste('a tabela dela veio inteira, nas seis categorias',
  (select count(distinct categoria) from alimentos_marcadores) = 6);

select teste('o tomate está alto nos três, como no material',
  (select oxalato = 'muito_alta' and histamina = 'muito_alta' and lectina = 'muito_alta'
     from alimentos_marcadores where id = 'tomate'));

-- Traço no material vira nulo, não "baixa": não saber e saber que é baixo são
-- coisas diferentes, e misturar as duas inventaria informação.
select teste('onde o material traz um traço, o banco guarda nulo',
  (select histamina is null from alimentos_marcadores where id = 'atum'));

select teste('só entra na marcação o que está em média ou acima',
  jsonb_array_length(marcacao_do_alimento('m-pessego')) = 0);

select teste('e o abacate traz os dois marcadores altos dele',
  jsonb_array_length(marcacao_do_alimento('m-abacate')) = 2);

select teste('muito alta aparece antes de alta',
  (marcacao_do_alimento('m-goiaba') -> 0 ->> 'nivel') = 'muito_alta');

select teste('os alimentos do Mapa que existem na Tabela estão ligados',
  (select count(*) from reintroducao_alimentos where marcador_id is not null) = 46);
select teste('e o que não existe na Tabela fica sem marcação, em vez de chutar',
  (select marcador_id is null from reintroducao_alimentos where id = 'jabuticaba'));
commit;

-- Na leitura da paciente, a marcação acompanha o registro.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', true);

select teste('o registro do inhame carrega a marcação do alimento',
  (select jsonb_array_length(r -> 'marcacao')
     from jsonb_array_elements(minha_reintroducao() -> 'registros') r
    where r ->> 'itemNome' = 'Inhame') = 1);

select teste('e é o oxalato muito alto do material',
  (select r -> 'marcacao' -> 0 ->> 'nome'
     from jsonb_array_elements(minha_reintroducao() -> 'registros') r
    where r ->> 'itemNome' = 'Inhame') = 'Oxalato');

-- Alimento digitado não recebe marcação: ele não veio do Mapa.
select teste('o alimento digitado pela paciente fica sem marcação',
  (select jsonb_array_length(r -> 'marcacao')
     from jsonb_array_elements(minha_reintroducao() -> 'registros') r
    where r ->> 'itemNome' = 'Pão da padaria') = 0);

select teste('o item também traz a marcação, para a nutricionista comparar',
  (select jsonb_array_length(i -> 'marcacao')
     from jsonb_array_elements(minha_reintroducao() -> 'itens') i
    where i ->> 'nome' = 'Inhame') = 1);

-- O que a marcação NÃO faz. Esta é a parte que precisa continuar verdadeira.
select teste('a marcação não mexeu em status nenhum',
  (select status from reintroducao_itens
    where id = current_setting('teste.inhame')::uuid) = 'em_teste');
commit;

-- E nada disso chega ao visitante sem login.
begin;
set local role anon;
do $$
declare v_erro boolean := false;
begin
  begin perform count(*) from alimentos_marcadores;
  exception when others then v_erro := true; end;
  perform teste('visitante sem login NÃO lê a tabela de marcadores', v_erro);

  v_erro := false;
  begin perform marcacao_do_alimento('m-abacate');
  exception when others then v_erro := true; end;
  perform teste('visitante sem login NÃO consulta marcação de alimento', v_erro);
end;
$$;
commit;

-- -----------------------------------------------------------------------------
-- O rastreio é de quem precisa dele (0021)
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

-- Montar a lista de alguém já liga: sem isto, ela cadastraria dez alimentos e
-- a paciente continuaria sem ver nada.
select teste('montar a lista da paciente liga o rastreio sozinho',
  rastreio_ativo(current_setting('teste.ana')::uuid));

select teste('e quem nunca foi tocada continua desligada',
  rastreio_ativo(current_setting('teste.bia')::uuid) = false);

select teste('o quadro dela mostra quem está ligada',
  jsonb_array_length(rastreios_ativos()) = 1);
commit;

-- A Bia não vê o módulo.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e2', true);
select teste('paciente sem rastreio recebe a tela desligada',
  (minha_reintroducao() ->> 'ativo')::boolean = false);

do $$
declare v_estado text := '';
begin
  begin perform registrar_reintroducao(p_nome_novo := 'Qualquer coisa');
  exception when others then v_estado := sqlstate; end;
  perform teste('e NÃO registra nada, nem pelo caminho de fora da tela',
    v_estado = '42501');
end;
$$;
commit;

-- Desligar não apaga: o histórico fica e volta.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
do $$
begin
  perform definir_rastreio_do_paciente(current_setting('teste.ana')::uuid, false);
end;
$$;
select teste('a nutricionista desliga o rastreio de uma paciente',
  rastreio_ativo(current_setting('teste.ana')::uuid) = false);
select teste('e o histórico dela continua guardado',
  (select count(*) from reintroducao_registros
    where paciente_id = current_setting('teste.ana')::uuid) > 0);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', true);
select teste('com o rastreio desligado, a tela dela volta vazia',
  jsonb_array_length(minha_reintroducao() -> 'itens') = 0);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
do $$
begin
  perform definir_rastreio_do_paciente(current_setting('teste.ana')::uuid, true);
end;
$$;
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', true);
select teste('religando, tudo volta como estava',
  jsonb_array_length(minha_reintroducao() -> 'itens') > 0);
select teste('o acesso dela passa a dizer que o rastreio está ligado',
  (meu_acesso() ->> 'rastreio')::boolean);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e2', true);
select teste('e o de quem não faz rastreamento diz que não',
  (meu_acesso() ->> 'rastreio')::boolean = false);

do $$
declare v_erro boolean := false;
begin
  begin perform definir_rastreio_do_paciente(meu_paciente_id(), true);
  exception when others then v_erro := true; end;
  perform teste('paciente NÃO liga o rastreio para si mesma', v_erro);
end;
$$;
commit;

-- -----------------------------------------------------------------------------
-- A marcação só alcança os alimentos do Mapa (0021)
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', true);

-- O inhame veio do Mapa e tem ligação: continua marcado.
select teste('alimento do Mapa continua recebendo a marcação',
  (select jsonb_array_length(i -> 'marcacao')
     from jsonb_array_elements(minha_reintroducao() -> 'itens') i
    where i ->> 'nome' = 'Inhame') = 1);

-- "Champagne" existe na Tabela e não no Mapa. Antes do 0021, digitar o nome
-- trazia a marcação pela semelhança; agora não traz — e é esse o pedido dela.
select teste('a paciente registra um alimento que só existe na Tabela',
  registrar_reintroducao(p_nome_novo := 'Champagne',
    p_sintomas := array['dor_abdominal']) is not null);

select teste('e ele NÃO recebe marcação, porque não é alimento do Mapa',
  (select jsonb_array_length(r -> 'marcacao')
     from jsonb_array_elements(minha_reintroducao() -> 'registros') r
    where r ->> 'itemNome' = 'Champagne') = 0);
commit;

-- A busca por nome saiu de vez: não dá para chamar nem por fora.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select teste('a busca de marcador por nome não existe mais',
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'marcador_por_nome') = 0);

-- A Tabela inteira continua guardada: o que mudou é quem a alcança.
select teste('a Tabela dela continua com os 283 alimentos',
  (select count(*) from alimentos_marcadores) = 283);
commit;

-- -----------------------------------------------------------------------------
-- Resultado
-- -----------------------------------------------------------------------------
select
  count(*) filter (where passou) || '/' || count(*) || ' verificações da rastreabilidade passaram' as resultado
from resultados_teste;

select string_agg(nome, e'\n') as falhas from resultados_teste where not passou;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% verificação(ões) da rastreabilidade falharam', v_falhas;
  end if;
end;
$$;
