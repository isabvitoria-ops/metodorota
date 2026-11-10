-- =============================================================================
-- Bateria do Rota Viagem (0086, 0087 e 0088)
--
-- O guia de viagem traz a ficha de saude da paciente e um diario de sintomas.
-- O que nao pode falhar:
--
--   * desligado, a paciente nao le nem escreve nada -- nem chamando a funcao;
--   * uma paciente nunca ve a ficha nem o diario da OUTRA, nem sabendo o id;
--   * a tabela do diario nao e lida direto por ninguem alem da nutricionista;
--   * numero fora da faixa e recusado, nao guardado;
--   * so a nutricionista le o diario de uma paciente pela ficha.
-- =============================================================================

truncate resultados_teste;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000071a1', 'viagem-a@paciente.test'),
  ('00000000-0000-0000-0000-0000000071a2', 'viagem-b@paciente.test');

insert into pacientes (email, nome, plano_id, data_inicio, data_fim) values
  ('viagem-a@paciente.test', 'Lia Viagem', 'mensal', hoje_sp() - 5, hoje_sp() + 25),
  ('viagem-b@paciente.test', 'Bia Viagem', 'mensal', hoje_sp() - 5, hoje_sp() + 25);

create or replace function lia() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'viagem-a@paciente.test' $$;
create or replace function bia() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'viagem-b@paciente.test' $$;
grant execute on function lia(), bia() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Nasce desligado, e desligado nao existe
-- -----------------------------------------------------------------------------
begin;
select teste('o Rota Viagem nasce desligado para todo mundo',
  not (select bool_or(viagem_liberado) from pacientes));
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000071a1', true);
select teste('desligado: a chave do acesso vem falsa', (meu_acesso() ->> 'viagem') = 'false');
select teste('desligado: o diario volta vazio', meu_diario_de_viagem() = '[]'::jsonb);
select teste('desligado: anotar e recusado',
  estado_de($$select anotar_diario_de_viagem(hoje_sp(), '{"onde":"Lisboa"}')$$) = '42501');
select teste('desligado: a ficha nao sai', minha_ficha_viagem() is null);
commit;

-- A nutricionista liga para a Lia e grava a ficha dela (e uma para a Bia, desligada).
update pacientes set viagem_liberado = true,
       viagem_ficha = '{"nome":"Lia Completa","nascimento":"01/02/1980","diagnosticos":"teste A"}'
 where id = lia();
update pacientes set viagem_ficha = '{"nome":"Bia Completa","nascimento":"03/04/1990","diagnosticos":"teste B"}'
 where id = bia();

-- -----------------------------------------------------------------------------
-- Ligado: ela le a propria ficha e escreve o proprio diario
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000071a1', true);
select teste('ligado: a chave do acesso vem verdadeira', (meu_acesso() ->> 'viagem') = 'true');
select teste('ligado: ela le a PROPRIA ficha', (minha_ficha_viagem() ->> 'nome') = 'Lia Completa');
select teste('ela anota um dia',
  anotar_diario_de_viagem(hoje_sp(), '{"onde":"Lisboa","inchaco":"3","dor":"0","azia":"","evacuacoes":"2","bristol":"4","observacoes":"pastel de nata"}') is not null);
select teste('e le de volta, com os numeros como numeros',
  meu_diario_de_viagem() -> 0 ->> 'onde' = 'Lisboa'
  and (meu_diario_de_viagem() -> 0 ->> 'inchaco')::int = 3
  and (meu_diario_de_viagem() -> 0 ->> 'bristol')::int = 4
  and meu_diario_de_viagem() -> 0 -> 'azia' = 'null'::jsonb);
-- A leitura vai em comando separado: funcao `stable` enxerga o banco como
-- estava no comeco do comando, e nao veria a escrita feita na mesma linha.
select teste('ela anota de novo o mesmo dia',
  anotar_diario_de_viagem(hoje_sp(), '{"onde":"Porto","inchaco":"5"}') is not null);
select teste('e isso substitui, nao duplica',
  jsonb_array_length(meu_diario_de_viagem()) = 1
  and meu_diario_de_viagem() -> 0 ->> 'onde' = 'Porto'
  and meu_diario_de_viagem() -> 0 -> 'bristol' = 'null'::jsonb);
select teste('inchaco 11 e recusado',
  recusou($$select anotar_diario_de_viagem(hoje_sp(), '{"inchaco":"11"}')$$));
select teste('Bristol 8 e recusado',
  recusou($$select anotar_diario_de_viagem(hoje_sp(), '{"bristol":"8"}')$$));
select teste('texto no lugar de numero e recusado',
  recusou($$select anotar_diario_de_viagem(hoje_sp(), '{"dor":"muita"}')$$));
select teste('data absurda e recusada',
  estado_de($$select anotar_diario_de_viagem(date '2001-01-01', '{"onde":"x"}')$$) = '22023');
select teste('o que foi recusado nao estragou o dia gravado',
  meu_diario_de_viagem() -> 0 ->> 'onde' = 'Porto');
select teste('ela nao le a tabela direto', (select count(*) from viagem_diario) = 0);
select teste('nem escreve nela direto',
  recusou(format('insert into viagem_diario (paciente_id, dia) values (%L, hoje_sp() + 1)', lia())));
select teste('ela nao chama a visao da nutricionista',
  estado_de(format('select viagem_do_paciente(%L)', lia())) = '42501');
select teste('nem a auxiliar que recebe id de qualquer paciente',
  recusou(format('select viagem_diario_json(%L)', bia())));
commit;

-- -----------------------------------------------------------------------------
-- A outra paciente nao ve nada da primeira
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000071a2', true);
select teste('a outra (desligada) nao recebe ficha nenhuma', minha_ficha_viagem() is null);
select teste('nem diario', meu_diario_de_viagem() = '[]'::jsonb);
select teste('nem pela visao da nutricionista',
  estado_de(format('select viagem_do_paciente(%L)', lia())) = '42501');
commit;

update pacientes set viagem_liberado = true where id = bia();

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000071a2', true);
select teste('ligada, a outra le a ficha DELA, nao a da primeira',
  (minha_ficha_viagem() ->> 'nome') = 'Bia Completa');
select teste('e o diario dela comeca vazio: o da primeira nao aparece',
  meu_diario_de_viagem() = '[]'::jsonb);
select teste('ela anota o dela',
  anotar_diario_de_viagem(hoje_sp(), '{"onde":"Roma"}') is not null);
commit;

-- -----------------------------------------------------------------------------
-- A nutricionista le o de cada uma, separado
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select teste('a nutricionista ve o diario da primeira',
  viagem_do_paciente(lia()) -> 'diario' -> 0 ->> 'onde' = 'Porto'
  and jsonb_array_length(viagem_do_paciente(lia()) -> 'diario') = 1);
select teste('com a ficha e o interruptor',
  (viagem_do_paciente(lia()) ->> 'liberado') = 'true'
  and viagem_do_paciente(lia()) -> 'ficha' ->> 'nome' = 'Lia Completa');
select teste('e o da outra, sem misturar',
  viagem_do_paciente(bia()) -> 'diario' -> 0 ->> 'onde' = 'Roma');
select teste('paciente que nao existe da erro claro',
  estado_de($$select viagem_do_paciente('00000000-0000-0000-0000-00000000dead')$$) = '22023');
commit;

-- -----------------------------------------------------------------------------
-- Esvaziar o dia apaga a linha; desligar fecha a porta sem apagar o que ha
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000071a2', true);
select teste('ela esvazia todos os campos do dia',
  anotar_diario_de_viagem(hoje_sp(), '{"onde":"  ","inchaco":""}') is not null);
select teste('e o dia some, em vez de ficar uma linha em branco',
  meu_diario_de_viagem() = '[]'::jsonb);
commit;

update pacientes set viagem_liberado = false where id = lia();

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000071a1', true);
select teste('desligada de novo, ela nao le mais o diario', meu_diario_de_viagem() = '[]'::jsonb);
select teste('nem a ficha', minha_ficha_viagem() is null);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select teste('mas a nutricionista continua lendo o que ja foi escrito',
  jsonb_array_length(viagem_do_paciente(lia()) -> 'diario') = 1);
commit;

-- -----------------------------------------------------------------------------
-- 0088: o guia e um documento por paciente, escrito pela nutricionista
-- (neste ponto a Lia esta desligada e a Bia ligada; nenhuma tem guia)
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000071a2', true);
select teste('ligada mas sem guia, a paciente nao recebe guia nenhum', meu_guia_viagem() is null);
select teste('a paciente nao salva guia, nem o proprio',
  estado_de(format($$select salvar_guia_viagem(%L, '{"secoes":[]}', null)$$, bia())) = '42501');
select teste('nem se liga sozinha',
  estado_de(format('select definir_viagem_do_paciente(%L, true)', bia())) = '42501');
select teste('nem lista os guias das outras',
  estado_de('select guias_viagem_para_copiar()') = '42501');
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select teste('nao se liga guia que nao existe',
  estado_de(format('select definir_viagem_do_paciente(%L, true)', lia())) = '22023');
select teste('guia sem secoes em lista e recusado',
  estado_de(format($$select salvar_guia_viagem(%L, '{"destinos":"x"}', null)$$, lia())) = '22023');
select teste('guia que nao e objeto e recusado',
  estado_de(format($$select salvar_guia_viagem(%L, '[1,2]', null)$$, lia())) = '22023');
select teste('a nutricionista salva o guia da Lia, com a ficha',
  salvar_guia_viagem(lia(), '{"destinos":"Portugal","periodo":"3 dias","secoes":[{"id":"a","titulo":"A","blocos":[]}]}',
                     '{"nome":"Lia Nova","nascimento":"","diagnosticos":"dx A"}') is not null);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select teste('e le de volta, na ficha',
  viagem_do_paciente(lia()) -> 'conteudo' ->> 'destinos' = 'Portugal'
  and viagem_do_paciente(lia()) -> 'ficha' ->> 'nome' = 'Lia Nova'
  and viagem_do_paciente(lia()) ->> 'guiaAtualizadoEm' is not null);
select teste('salvar nao liga: o guia fica guardado e desligado',
  (viagem_do_paciente(lia()) ->> 'liberado') = 'false');
select teste('paciente sem guia vem com o guia nulo',
  viagem_do_paciente(bia()) -> 'conteudo' = 'null'::jsonb);
select teste('a lista para copiar traz so quem tem guia, sem o conteudo',
  jsonb_array_length(guias_viagem_para_copiar()) = 1
  and guias_viagem_para_copiar() -> 0 ->> 'nome' = 'Lia Viagem'
  and guias_viagem_para_copiar() -> 0 ->> 'destinos' = 'Portugal'
  and not (guias_viagem_para_copiar() -> 0 ? 'conteudo'));
select teste('agora liga, e a funcao devolve o estado gravado',
  definir_viagem_do_paciente(lia(), true) = true);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000071a1', true);
select teste('ligada, a Lia recebe o guia DELA e a ficha DELA',
  meu_guia_viagem() -> 'conteudo' ->> 'destinos' = 'Portugal'
  and meu_guia_viagem() -> 'ficha' ->> 'nome' = 'Lia Nova');
select teste('ela nao le a tabela dos guias direto', (select count(*) from guias_viagem) = 0);
select teste('nem escreve nela',
  nao_alterou($$update guias_viagem set conteudo = '{"secoes":[]}'$$));
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000071a2', true);
select teste('a outra paciente, ligada e sem guia, continua sem ver o da Lia', meu_guia_viagem() is null);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select teste('salvar de novo substitui o guia, e ficha vazia vira nula',
  salvar_guia_viagem(lia(), '{"destinos":"Italia","secoes":[]}', '{"nome":"","nascimento":"","diagnosticos":""}') is not null);
select teste('a nutricionista desliga', definir_viagem_do_paciente(lia(), false) = false);
commit;

begin;
select teste('ficou um guia so por paciente, com o texto novo',
  (select count(*) from guias_viagem where paciente_id = lia()) = 1
  and (select conteudo ->> 'destinos' from guias_viagem where paciente_id = lia()) = 'Italia');
select teste('e a ficha vazia foi gravada como nula',
  (select viagem_ficha from pacientes where id = lia()) is null);
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000071a1', true);
select teste('desligada, a Lia nao recebe mais o guia', meu_guia_viagem() is null);
commit;

-- -----------------------------------------------------------------------------
-- Quem nao entrou nao chama nada
-- -----------------------------------------------------------------------------
select teste('visitante nao executa ' || f,
  not has_function_privilege('anon', f::regprocedure, 'execute'))
from unnest(array['meu_diario_de_viagem()', 'anotar_diario_de_viagem(date, jsonb)',
                  'viagem_do_paciente(uuid)', 'viagem_diario_json(uuid)',
                  'minha_ficha_viagem()', 'viagem_liberado(uuid)',
                  'meu_guia_viagem()', 'salvar_guia_viagem(uuid, jsonb, jsonb)',
                  'definir_viagem_do_paciente(uuid, boolean)', 'guias_viagem_para_copiar()']) as f;

select
  count(*) filter (where passou) || '/' || count(*) || ' verificacoes do Rota Viagem passaram'
    as resultado
from resultados_teste;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% verificacao(oes) do Rota Viagem falharam', v_falhas;
  end if;
end;
$$;
