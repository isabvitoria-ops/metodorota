-- 0111 — "Para cada um, indique se foi leve, moderado ou forte" (pedido dela
-- em 25/11/2026, aprovado no mesmo dia).
--
-- A pergunta de sintomas do GLP-1 (G03) pede a intensidade de cada sintoma,
-- e a regra de alerta A15 dela é "gravidade_forte" — que o motor de alertas
-- nunca soube ler: o alerta não disparava nunca. Agora a resposta de
-- múltipla escolha chega com
--     {"marcados": [0, 4], "gravidade": {"0": "forte", "4": "leve"}}
-- e o motor:
--   * dispara "gravidade_forte" quando algum sintoma marcado foi "forte";
--   * acha o índice marcado também dentro de "marcados" (as regras por
--     índice das outras perguntas de marcar continuam valendo).
--
-- A função é a de PRODUÇÃO (conferida em 25/11/2026: ela apaga os alertas
-- do envio antes de recalcular, o que a 0066 do repositório não fazia),
-- com só esses dois acréscimos.

create or replace function public.disparar_alertas_envio(p_envio uuid, p_questionario uuid, p_paciente uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pergunta record; v_resposta record; v_alerta jsonb; v_alerta_elem jsonb;
  v_indice integer; v_valor_num numeric; v_valor_texto text; v_valor_json jsonb;
  v_dispara boolean; v_codigo_alerta text; v_config record;
  v_resultado jsonb := '[]'::jsonb;
begin
  delete from alertas_checkin where envio_id = p_envio;
  for v_pergunta in
    select p.id, p.codigo, p.tipo, p.alertas_opcoes
      from questionario_perguntas p
     where p.questionario_id = p_questionario and p.ativa
       and jsonb_array_length(coalesce(p.alertas_opcoes, '[]'::jsonb)) > 0
  loop
    select r.valor_numero, r.valor_texto, r.valor_json
      into v_valor_num, v_valor_texto, v_valor_json
      from questionario_respostas r
     where r.envio_id = p_envio and r.pergunta_id = v_pergunta.id;
    continue when not found;
    for v_alerta_elem in select * from jsonb_array_elements(v_pergunta.alertas_opcoes) loop
      v_dispara := false;
      v_codigo_alerta := v_alerta_elem ->> 'alerta';
      if v_alerta_elem ->> 'condicao' = 'faixa_min' then
        if v_valor_num is not null and v_valor_num >= (v_alerta_elem ->> 'valor')::numeric then
          v_dispara := true;
        end if;
      elsif v_alerta_elem ->> 'condicao' = 'gravidade_forte' then
        -- Algum sintoma marcado como "forte".
        if v_valor_json is not null and jsonb_typeof(v_valor_json -> 'gravidade') = 'object' then
          select exists(select 1 from jsonb_each_text(v_valor_json -> 'gravidade') g where g.value = 'forte')
            into v_dispara;
        end if;
      elsif v_alerta_elem ? 'indice' and (v_alerta_elem ->> 'indice') is not null then
        v_indice := (v_alerta_elem ->> 'indice')::integer;
        if v_pergunta.tipo in ('escolha', 'emoji', 'sim_nao') then
          if v_valor_num is not null and v_valor_num::integer = v_indice then v_dispara := true; end if;
        elsif v_pergunta.tipo = 'multipla_escolha' then
          if v_valor_json is not null and v_valor_json ? v_indice::text then v_dispara := true; end if;
          if not v_dispara and v_valor_json is not null and jsonb_typeof(v_valor_json) = 'array' then
            select exists(select 1 from jsonb_array_elements_text(v_valor_json) t where t.value = v_indice::text) into v_dispara;
          end if;
          if not v_dispara and v_valor_json is not null and jsonb_typeof(v_valor_json -> 'marcados') = 'array' then
            select exists(select 1 from jsonb_array_elements_text(v_valor_json -> 'marcados') t where t.value = v_indice::text) into v_dispara;
          end if;
        end if;
      end if;
      if v_dispara then
        select * into v_config from alertas_checkin_config where codigo = v_codigo_alerta and ativo;
        if v_config.codigo is not null then
          insert into alertas_checkin (codigo, nivel, paciente_id, envio_id, pergunta_codigo)
          values (v_config.codigo, v_config.nivel, p_paciente, p_envio, v_pergunta.codigo);
          v_resultado := v_resultado || jsonb_build_object('codigo', v_config.codigo, 'nivel', v_config.nivel, 'mensagem', v_config.mensagem_paciente);
        end if;
      end if;
    end loop;
  end loop;
  return v_resultado;
end;
$$;

revoke all on function public.disparar_alertas_envio(uuid, uuid, uuid) from public, anon, authenticated;
