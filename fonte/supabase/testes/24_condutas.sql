-- =============================================================================
-- Bateria das condutas em Kanban (0055)
--
-- O que nao pode falhar:
--   * modelo com etapas e prazos relativos volta inteiro e na ordem.
--   * aplicar um modelo cria as tarefas com as DATAS confirmadas na tela.
--   * as tarefas aparecem na ficha da paciente E na visao geral de pendentes.
--   * mover para Concluida tira da visao geral e marca quando; voltar desmarca.
--   * mudar ou apagar o modelo depois NAO mexe no que ja foi aplicado.
--   * a PACIENTE nao ve nem mexe em nada disso; anon muito menos.
-- Usa as pacientes da bateria 14 (alda, bela).
-- =============================================================================

truncate resultados_teste;

create or replace function conta_condutas(p_paciente uuid) returns integer
  language sql stable security definer as $$
  select count(*)::integer from condutas where paciente_id = p_paciente $$;
create or replace function modelo_por_nome(p_nome text) returns uuid
  language sql stable security definer as $$
  select id from modelos_conduta where nome = p_nome limit 1 $$;
create or replace function conduta_por_titulo(p_titulo text) returns uuid
  language sql stable security definer as $$
  select id from condutas where titulo = p_titulo limit 1 $$;
grant execute on function conta_condutas(uuid), modelo_por_nome(text), conduta_por_titulo(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- A nutricionista monta um modelo e aplica
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select salvar_modelo_conduta(null, 'Protocolo SIBO', 'Fases do tratamento', jsonb_build_array(
  jsonb_build_object('titulo', 'Pedir teste respiratorio', 'dias', 0),
  jsonb_build_object('titulo', 'Iniciar dieta de baixa fermentacao', 'dias', 7),
  jsonb_build_object('titulo', '', 'dias', 10),
  jsonb_build_object('titulo', 'Reavaliar sintomas', 'dias', 14, 'descricao', 'Escala de inchaco')));

select teste('o modelo volta com 3 etapas (a vazia foi ignorada)',
  jsonb_array_length((select m -> 'etapas' from jsonb_array_elements(listar_modelos_conduta()) m
                       where m ->> 'nome' = 'Protocolo SIBO')) = 3);
select teste('as etapas vem na ordem, com os dias',
  (select string_agg(e ->> 'dias', ',') from jsonb_array_elements(listar_modelos_conduta()) m,
          jsonb_array_elements(m -> 'etapas') e where m ->> 'nome' = 'Protocolo SIBO') = '0,7,14');

-- Aplica com as datas que a tela calculou a partir de 01/10/2026 — e uma
-- editada à mão (a segunda passou de 08/10 para 09/10).
select teste('aplicar cria 3 tarefas', aplicar_modelo_conduta(alda(), modelo_por_nome('Protocolo SIBO'),
  jsonb_build_array(
    jsonb_build_object('titulo', 'Pedir teste respiratorio', 'prazo', '2026-10-01'),
    jsonb_build_object('titulo', 'Iniciar dieta de baixa fermentacao', 'prazo', '2026-10-09'),
    jsonb_build_object('titulo', 'Reavaliar sintomas', 'prazo', '2026-10-15', 'descricao', 'Escala de inchaco'))) = 3);

select teste('as datas confirmadas foram gravadas',
  (select string_agg(c ->> 'prazo', ',') from jsonb_array_elements(condutas_de(alda())) c)
    = '2026-10-01,2026-10-09,2026-10-15');
select teste('a tarefa lembra de que modelo veio',
  (select bool_and(c ->> 'modeloNome' = 'Protocolo SIBO') from jsonb_array_elements(condutas_de(alda())) c));
select teste('tudo nasce em A fazer',
  (select bool_and(c ->> 'status' = 'a_fazer') from jsonb_array_elements(condutas_de(alda())) c));
select teste('a visao geral mostra as 3, com o nome da paciente',
  (select count(*) from jsonb_array_elements(condutas_pendentes()) c
    where c ->> 'pacienteId' = alda()::text and c ->> 'pacienteNome' is not null) = 3);

-- Tarefa solta, sem modelo, em outra paciente.
select salvar_conduta(null, bela(), 'Mandar lista de compras', null, '2026-10-03', 'andamento');
select teste('a tarefa solta entrou para a outra paciente', conta_condutas(bela()) = 1);
select teste('e aparece na visao geral', jsonb_array_length(condutas_pendentes()) = 4);
select teste('a primeira da visao geral e a de prazo mais cedo',
  (condutas_pendentes() -> 0 ->> 'titulo') = 'Pedir teste respiratorio');

-- Kanban.
select teste('mover para Concluida devolve o status gravado',
  mover_conduta(conduta_por_titulo('Pedir teste respiratorio'), 'concluida') = 'concluida');
select teste('concluida marca quando',
  (select concluida_em is not null from condutas where id = conduta_por_titulo('Pedir teste respiratorio')));
select teste('concluida sai da visao geral', jsonb_array_length(condutas_pendentes()) = 3);
select mover_conduta(conduta_por_titulo('Pedir teste respiratorio'), 'andamento');
select teste('voltar do Concluida desmarca o quando',
  (select concluida_em is null from condutas where id = conduta_por_titulo('Pedir teste respiratorio')));
select teste('status inventado e recusado',
  estado_de(format('select mover_conduta(%L::uuid, %L)', conduta_por_titulo('Reavaliar sintomas'), 'jogar_fora')) = '22023');

-- Mexer no modelo depois nao mexe no aplicado.
select salvar_modelo_conduta(modelo_por_nome('Protocolo SIBO'), 'SIBO v2', null,
  jsonb_build_array(jsonb_build_object('titulo', 'So uma etapa', 'dias', 3)));
select teste('renomear o modelo nao muda o nome gravado nas tarefas',
  (select bool_and(c ->> 'modeloNome' = 'Protocolo SIBO') from jsonb_array_elements(condutas_de(alda())) c));
select excluir_modelo_conduta(modelo_por_nome('SIBO v2'));
select teste('apagar o modelo nao apaga as tarefas', conta_condutas(alda()) = 3);

select excluir_conduta(conduta_por_titulo('Mandar lista de compras'));
select teste('apagar uma tarefa', conta_condutas(bela()) = 0);
select teste('titulo vazio e recusado',
  estado_de(format('select salvar_conduta(null, %L::uuid, %L, null, null, %L)', alda(), '  ', 'a_fazer')) = '22023');
commit;

-- -----------------------------------------------------------------------------
-- A paciente nao alcanca nada
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000fa01', true);

select teste('a paciente NAO lista modelos', estado_de('select listar_modelos_conduta()') = '42501');
select teste('a paciente NAO ve as proprias condutas', estado_de(format('select condutas_de(%L::uuid)', alda())) = '42501');
select teste('a paciente NAO ve a visao geral', estado_de('select condutas_pendentes()') = '42501');
select teste('a paciente NAO cria conduta',
  estado_de(format('select salvar_conduta(null, %L::uuid, %L, null, null, null)', alda(), 'x')) = '42501');
select teste('a paciente NAO move conduta',
  estado_de(format('select mover_conduta(%L::uuid, %L)', conduta_por_titulo('Reavaliar sintomas'), 'concluida')) = '42501');
select teste('a paciente NAO le a tabela', (select count(*) from condutas) = 0);
select teste('a paciente NAO le os modelos pela tabela', (select count(*) from modelos_conduta) = 0);
commit;

begin;
set local role anon;
set local search_path = public;
do $$
declare v_erro boolean := false;
begin
  begin perform condutas_pendentes();
  exception when others then v_erro := true; end;
  perform teste('anon NAO chama a visao geral', v_erro);
  v_erro := false;
  begin perform count(*) from condutas;
  exception when others then v_erro := true; end;
  perform teste('anon NAO le a tabela', v_erro);
end;
$$;
commit;

select case when bool_and(passou) then count(*) || '/' || count(*) || ' verificacoes das condutas passaram'
            else (count(*) filter (where not passou)) || ' verificacoes das condutas falharam' end
    as resultado
from resultados_teste;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% verificacao(oes) das condutas falharam', v_falhas;
  end if;
end;
$$;
