-- =============================================================================
-- Bateria da gravidade dos sintomas (0111):
--   * "forte" em algum sintoma dispara o alerta de gravidade_forte (A15);
--   * só leve e moderado não disparam;
--   * a regra por índice acha o sintoma marcado dentro de "marcados";
--   * o formato antigo (lista de índices) continua valendo.
-- =============================================================================

truncate resultados_teste;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000f8d01', 'grav-a@paciente.test');
insert into pacientes (email, nome, plano_id, data_inicio, data_fim) values
  ('grav-a@paciente.test', 'Gil Gravidade', 'mensal', hoje_sp() - 5, hoje_sp() + 25);
insert into questionarios (titulo, periodicidade) values ('GLP-1 teste', 'semanal');

insert into questionario_perguntas (questionario_id, ordem, texto, tipo, opcoes, alertas_opcoes)
select id, 1, 'Quais destes você sentiu?', 'multipla_escolha',
  '["Náuseas","Vômitos","Diarreia","Nada disso"]'::jsonb,
  '[{"indice":null,"alerta":"A15","condicao":"gravidade_forte"},{"indice":1,"alerta":"A02"}]'::jsonb
from questionarios where titulo = 'GLP-1 teste';

create or replace function grav_alertas(p_json jsonb) returns text language plpgsql as $$
declare v_envio uuid; v_q uuid; v_p uuid; v_pac uuid; v_saida text;
begin
  select id into v_q from questionarios where titulo = 'GLP-1 teste';
  select id into v_p from questionario_perguntas where questionario_id = v_q;
  select id into v_pac from pacientes where email = 'grav-a@paciente.test';
  delete from questionario_envios where questionario_id = v_q;
  insert into questionario_envios (questionario_id, paciente_id, periodo) values (v_q, v_pac, hoje_sp()) returning id into v_envio;
  insert into questionario_respostas (envio_id, pergunta_id, valor_texto, valor_json) values (v_envio, v_p, 'x', p_json);
  select coalesce(string_agg(a ->> 'codigo', ',' order by a ->> 'codigo'), '') into v_saida
    from jsonb_array_elements(disparar_alertas_envio(v_envio, v_q, v_pac)) a;
  return v_saida;
end $$;

select teste('sintoma forte dispara A15',
  grav_alertas('{"marcados":[0,2],"gravidade":{"0":"forte","2":"leve"}}') = 'A15');
select teste('só leve e moderado não disparam',
  grav_alertas('{"marcados":[0,2],"gravidade":{"0":"moderado","2":"leve"}}') = '');
select teste('vômito marcado (regra por índice) dispara A02, mesmo dentro de "marcados"',
  grav_alertas('{"marcados":[1],"gravidade":{"1":"leve"}}') = 'A02');
select teste('vômito forte dispara os dois',
  grav_alertas('{"marcados":[1],"gravidade":{"1":"forte"}}') = 'A02,A15');
select teste('o formato antigo (lista de índices) continua valendo',
  grav_alertas('[1]') = 'A02');
select teste('sem json, nada dispara', grav_alertas(null) = '');
select grav_alertas('{"marcados":[0],"gravidade":{"0":"forte"}}');
select teste('o alerta fica gravado para a nutricionista',
  (select count(*) from alertas_checkin a join pacientes p on p.id = a.paciente_id
    where p.email = 'grav-a@paciente.test' and a.codigo = 'A15' and a.pergunta_codigo is null) = 1);

select case when bool_and(passou) then count(*) || '/' || count(*) || ' verificacoes da gravidade dos sintomas passaram'
            else (count(*) filter (where not passou)) || ' verificacoes da gravidade dos sintomas falharam' end
    as resultado
from resultados_teste;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% verificacao(oes) da gravidade dos sintomas falharam', v_falhas;
  end if;
end;
$$;
