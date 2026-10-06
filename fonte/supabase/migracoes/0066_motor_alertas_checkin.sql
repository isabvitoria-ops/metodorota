-- =============================================================================
-- 0066 — Motor de alertas no responder_questionario
--
-- Ao gravar as respostas, avalia alertas_opcoes de cada pergunta e insere
-- linhas em alertas_checkin. Também devolve os alertas disparados para que
-- o frontend mostre a mensagem à paciente.
--
-- Cria uma nova função disparar_alertas_envio(envio, questionario, paciente)
-- e atualiza responder_questionario para chamá-la e retornar os alertas.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Função auxiliar: avalia alertas de um envio
-- -----------------------------------------------------------------------------

create or replace function disparar_alertas_envio(
  p_envio uuid,
  p_questionario uuid,
  p_paciente uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pergunta record;
  v_resposta record;
  v_alerta jsonb;
  v_alerta_elem jsonb;
  v_indice integer;
  v_valor_num numeric;
  v_valor_texto text;
  v_valor_json jsonb;
  v_dispara boolean;
  v_codigo_alerta text;
  v_config record;
  v_resultado jsonb := '[]'::jsonb;
begin
  -- Limpa alertas anteriores deste envio (reenvio idempotente)
  delete from alertas_checkin where envio_id = p_envio;

  -- Para cada pergunta que tem alertas configurados
  for v_pergunta in
    select p.id, p.codigo, p.tipo, p.alertas_opcoes
      from questionario_perguntas p
     where p.questionario_id = p_questionario
       and p.ativa
       and jsonb_array_length(coalesce(p.alertas_opcoes, '[]'::jsonb)) > 0
  loop
    -- Busca a resposta dessa pergunta nesse envio
    select r.valor_numero, r.valor_texto, r.valor_json
      into v_valor_num, v_valor_texto, v_valor_json
      from questionario_respostas r
     where r.envio_id = p_envio
       and r.pergunta_id = v_pergunta.id;

    continue when not found;

    -- Avalia cada regra de alerta
    for v_alerta_elem in
      select * from jsonb_array_elements(v_pergunta.alertas_opcoes)
    loop
      v_dispara := false;
      v_codigo_alerta := v_alerta_elem ->> 'alerta';

      if v_alerta_elem ->> 'condicao' = 'faixa_min' then
        -- Alerta por faixa numérica: dispara se valor >= limiar
        if v_valor_num is not null and
           v_valor_num >= (v_alerta_elem ->> 'valor')::numeric then
          v_dispara := true;
        end if;

      elsif v_alerta_elem ? 'indice' and (v_alerta_elem ->> 'indice') is not null then
        v_indice := (v_alerta_elem ->> 'indice')::integer;

        if v_pergunta.tipo in ('escolha', 'emoji', 'sim_nao') then
          -- Dispara se a opção selecionada (por número) é o índice
          if v_valor_num is not null and v_valor_num::integer = v_indice then
            v_dispara := true;
          end if;

        elsif v_pergunta.tipo = 'multipla_escolha' then
          -- Dispara se o índice está entre os marcados no json
          if v_valor_json is not null and v_valor_json ? v_indice::text then
            v_dispara := true;
          end if;
          -- Fallback: checa se o valor_json é um array que contém o índice
          if not v_dispara and v_valor_json is not null
             and jsonb_typeof(v_valor_json) = 'array' then
            select exists(
              select 1 from jsonb_array_elements_text(v_valor_json) t
               where t.value = v_indice::text
            ) into v_dispara;
          end if;
        end if;
      end if;

      if v_dispara then
        -- Busca config do alerta
        select * into v_config from alertas_checkin_config
         where codigo = v_codigo_alerta and ativo;

        if v_config.codigo is not null then
          insert into alertas_checkin (
            codigo, nivel, paciente_id, envio_id, pergunta_codigo
          ) values (
            v_config.codigo, v_config.nivel, p_paciente, p_envio,
            v_pergunta.codigo
          );

          v_resultado := v_resultado || jsonb_build_object(
            'codigo', v_config.codigo,
            'nivel', v_config.nivel,
            'mensagem', v_config.mensagem_paciente
          );
        end if;
      end if;
    end loop;
  end loop;

  return v_resultado;
end;
$$;

-- Só admin e a própria paciente (via responder_questionario) usam
revoke all on function disparar_alertas_envio(uuid, uuid, uuid)
  from anon, public;
grant execute on function disparar_alertas_envio(uuid, uuid, uuid)
  to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Atualiza responder_questionario para disparar alertas e retornar resultado
-- -----------------------------------------------------------------------------

-- A função passa a retornar JSONB com {envioId, alertas} em vez de só uuid
create or replace function responder_questionario(p_questionario uuid, p_respostas jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
  v_periodicidade text;
  v_periodo date;
  v_envio uuid;
  v_resposta jsonb;
  v_pergunta questionario_perguntas;
  v_numero numeric;
  v_texto text;
  v_json jsonb;
  v_snapshot jsonb;
  v_alertas jsonb;
begin
  if not tem_acesso() then
    raise exception 'Seu acesso não está liberado.' using errcode = '42501';
  end if;

  v_paciente := meu_paciente_id();
  if v_paciente is null then
    raise exception 'Não encontrei seu cadastro de paciente.' using errcode = '42501';
  end if;

  select q.periodicidade into v_periodicidade
    from questionarios q
    join questionario_pacientes a
      on a.questionario_id = q.id and a.paciente_id = v_paciente
   where q.id = p_questionario and q.ativo;

  if v_periodicidade is null then
    raise exception 'Este questionário não está disponível para você.' using errcode = '42501';
  end if;

  v_periodo := case when v_periodicidade = 'semanal' then semana_de(hoje_sp()) else hoje_sp() end;

  select jsonb_agg(jsonb_build_object(
           'perguntaId', p.id, 'tipo', p.tipo, 'peso', p.peso,
           'invertida', p.invertida, 'opcoes', p.opcoes,
           'pontosOpcoes', p.pontos_opcoes,
           'eixoId', p.eixo_id, 'eixoNome', e.nome,
           'codigo', p.codigo, 'notas_por_faixa', p.notas_por_faixa))
    into v_snapshot
    from questionario_perguntas p
    left join checkin_eixos e on e.id = p.eixo_id
   where p.questionario_id = p_questionario
     and p.ativa;

  insert into questionario_envios (questionario_id, paciente_id, periodo, regua_snapshot)
  values (p_questionario, v_paciente, v_periodo, coalesce(v_snapshot, '[]'::jsonb))
  on conflict (questionario_id, paciente_id, periodo)
    do update set respondido_em = now(),
                  regua_snapshot = coalesce(v_snapshot, '[]'::jsonb)
  returning id into v_envio;

  for v_resposta in select * from jsonb_array_elements(coalesce(p_respostas, '[]'::jsonb))
  loop
    select * into v_pergunta from questionario_perguntas
     where id = nullif(v_resposta ->> 'perguntaId', '')::uuid
       and questionario_id = p_questionario;

    continue when v_pergunta.id is null;

    v_numero := nullif(v_resposta ->> 'numero', '')::numeric;
    v_texto := nullif(trim(v_resposta ->> 'texto'), '');
    v_json := v_resposta -> 'json';

    if v_pergunta.tipo = 'escala' and v_numero is not null then
      v_numero := least(greatest(v_numero, 0), 10);
    end if;
    if v_pergunta.tipo = 'sim_nao' and v_numero is not null then
      v_numero := case when v_numero > 0 then 1 else 0 end;
    end if;
    if v_pergunta.tipo = 'estrelas' and v_numero is not null then
      v_numero := least(greatest(v_numero, 1), 5);
    end if;
    if v_pergunta.tipo = 'emoji' and v_numero is not null then
      v_numero := least(greatest(v_numero, 0), 4);
    end if;

    insert into questionario_respostas (envio_id, pergunta_id, valor_numero, valor_texto, valor_json)
    values (v_envio, v_pergunta.id, v_numero, v_texto, v_json)
    on conflict (envio_id, pergunta_id)
      do update set valor_numero = excluded.valor_numero,
                    valor_texto = excluded.valor_texto,
                    valor_json = excluded.valor_json;
  end loop;

  -- Dispara alertas clínicos
  v_alertas := disparar_alertas_envio(v_envio, p_questionario, v_paciente);

  return jsonb_build_object('envioId', v_envio, 'alertas', v_alertas);
end;
$$;
grant execute on function responder_questionario(uuid, jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. meus_questionarios — inclui alertas do último envio
-- -----------------------------------------------------------------------------

-- Adiciona mensagem_paciente e configs no retorno para o frontend
create or replace function alertas_do_envio(p_envio uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'codigo', a.codigo,
      'nivel', a.nivel,
      'mensagem', c.mensagem_paciente
    ) order by
      case a.nivel when 'vermelho' then 0 else 1 end,
      a.criado_em)
    from alertas_checkin a
    join alertas_checkin_config c on c.codigo = a.codigo
    where a.envio_id = p_envio
  ), '[]'::jsonb);
end;
$$;
revoke all on function alertas_do_envio(uuid) from anon, public;
grant execute on function alertas_do_envio(uuid) to authenticated;

commit;
