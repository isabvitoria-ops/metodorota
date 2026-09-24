-- Corrige: uma nutricionista que também é paciente de si mesma (mesma
-- conta, papel admin, com um cadastro próprio em `pacientes`) caía sempre em
-- "Sem cadastro de paciente." ao registrar cardio, sessão de treino ou
-- escrever o próprio treino pela Central — porque essas telas são pensadas
-- para quem NÃO é admin e por isso sempre mandam o paciente como nulo
-- (`registrarCardio(null, null, ...)`, `salvarTreino(id, null, ...)`), e as
-- funções tratavam "é admin" como "então use o paciente que a tela mandou",
-- que era nulo. Fora do caso raro de ela também ser paciente, nada muda: o
-- admin de verdade sempre manda o paciente explícito.

create or replace function registrar_cardio(
  p_id uuid,
  p_paciente uuid,
  p_data date,
  p_tipo text,
  p_duracao integer,
  p_distancia numeric,
  p_intensidade text,
  p_observacao text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin boolean;
  v_paciente uuid;
  v_id uuid;
begin
  -- "Administrando outra pessoa" só vale quando um paciente foi de fato
  -- informado. Sem paciente informado, mesmo quem é admin está falando de
  -- si mesma.
  v_admin := e_admin() and p_paciente is not null;

  if v_admin then
    v_paciente := p_paciente;
  else
    v_paciente := meu_paciente_id();
  end if;

  if v_paciente is not null and not v_admin then
    perform exigir_treino_liberado(v_paciente);
  end if;

  if v_paciente is null then
    raise exception 'Sem cadastro de paciente.' using errcode = '42501';
  end if;
  if coalesce(p_data, hoje_sp()) > hoje_sp() then
    raise exception 'Não dá para registrar cardio de uma data futura.' using errcode = '22007';
  end if;

  if p_id is null then
    insert into cardio_sessoes
      (paciente_id, data, tipo, duracao_min, distancia_km, intensidade, observacao)
    values (
      v_paciente, coalesce(p_data, hoje_sp()),
      coalesce(nullif(btrim(coalesce(p_tipo, '')), ''), 'Cardio'),
      p_duracao, p_distancia,
      nullif(btrim(coalesce(p_intensidade, '')), ''),
      nullif(btrim(coalesce(p_observacao, '')), '')
    )
    returning id into v_id;
  else
    update cardio_sessoes
    set data = coalesce(p_data, data),
        tipo = coalesce(nullif(btrim(coalesce(p_tipo, '')), ''), tipo),
        duracao_min = p_duracao,
        distancia_km = p_distancia,
        intensidade = nullif(btrim(coalesce(p_intensidade, '')), ''),
        observacao = nullif(btrim(coalesce(p_observacao, '')), '')
    where id = p_id and paciente_id = v_paciente
    returning id into v_id;
    if v_id is null then
      raise exception 'Registro não encontrado.' using errcode = 'P0002';
    end if;
  end if;

  return jsonb_build_object('id', v_id);
end;
$$;

revoke all on function registrar_cardio(uuid, uuid, date, text, integer, numeric, text, text)
  from anon, public;
grant execute on function registrar_cardio(uuid, uuid, date, text, integer, numeric, text, text)
  to authenticated;

create or replace function registrar_sessao_treino(
  p_id uuid,
  p_paciente uuid,
  p_treino uuid,
  p_data date,
  p_observacao text,
  p_series jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin boolean;
  v_paciente uuid;
  v_id uuid;
  v_item jsonb;
  v_nome text;
begin
  v_admin := e_admin() and p_paciente is not null;

  if v_admin then
    v_paciente := p_paciente;
  else
    v_paciente := meu_paciente_id();
  end if;

  if v_paciente is null then
    raise exception 'Sem cadastro de paciente.' using errcode = '42501';
  end if;
  if not v_admin then perform exigir_treino_liberado(v_paciente); end if;
  if p_series is null or jsonb_typeof(p_series) <> 'array' then
    raise exception 'As séries precisam ser uma lista.' using errcode = '22023';
  end if;
  if coalesce(p_data, hoje_sp()) > hoje_sp() then
    raise exception 'Não dá para registrar treino de uma data futura.' using errcode = '22007';
  end if;

  if p_id is null then
    insert into treino_sessoes (paciente_id, treino_id, data, observacao)
    values (v_paciente, p_treino, coalesce(p_data, hoje_sp()),
            nullif(btrim(coalesce(p_observacao, '')), ''))
    returning id into v_id;
  else
    update treino_sessoes
    set treino_id = coalesce(p_treino, treino_id),
        data = coalesce(p_data, data),
        observacao = nullif(btrim(coalesce(p_observacao, '')), '')
    where id = p_id and paciente_id = v_paciente
    returning id into v_id;
    if v_id is null then
      raise exception 'Sessão não encontrada.' using errcode = 'P0002';
    end if;
  end if;

  delete from treino_series where sessao_id = v_id;
  for v_item in select * from jsonb_array_elements(p_series) loop
    v_nome := btrim(coalesce(v_item ->> 'exercicioNome', ''));
    if v_nome = '' then continue; end if;
    insert into treino_series
      (sessao_id, exercicio_id, exercicio_nome, numero, carga, repeticoes, observacao)
    values (
      v_id,
      nullif(v_item ->> 'exercicioId', '')::uuid,
      v_nome,
      coalesce(nullif(v_item ->> 'numero', '')::integer, 1),
      nullif(v_item ->> 'carga', '')::numeric,
      nullif(v_item ->> 'repeticoes', '')::integer
      , nullif(btrim(coalesce(v_item ->> 'observacao', '')), '')
    );
  end loop;

  return jsonb_build_object('id', v_id);
end;
$$;

revoke all on function registrar_sessao_treino(uuid, uuid, uuid, date, text, jsonb)
  from anon, public;
grant execute on function registrar_sessao_treino(uuid, uuid, uuid, date, text, jsonb)
  to authenticated;

create or replace function salvar_treino(
  p_id uuid,
  p_paciente uuid,
  p_nome text,
  p_observacao text,
  p_ativo boolean,
  p_exercicios jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin boolean;
  v_paciente uuid;
  v_origem text;
  v_ativo boolean;
  v_id uuid;
  v_item jsonb;
  v_ordem integer := 0;
  v_alvo treinos;
begin
  v_admin := e_admin() and p_paciente is not null;

  if v_admin then
    v_paciente := p_paciente;
    v_origem := 'nutricionista';
    v_ativo := coalesce(p_ativo, false);
  else
    v_paciente := meu_paciente_id();
    v_origem := 'paciente';
    v_ativo := true;

    if v_paciente is null then
      raise exception 'Sem cadastro de paciente.' using errcode = '42501';
    end if;

    perform exigir_treino_liberado(v_paciente);

    if exists (select 1 from treinos
               where paciente_id = v_paciente and ativo and origem = 'nutricionista') then
      raise exception 'Sua nutricionista enviou um treino; ele não pode ser alterado aqui.'
        using errcode = '42501';
    end if;

    if p_id is not null then
      select * into v_alvo from treinos where id = p_id;
      if v_alvo.id is null
         or v_alvo.paciente_id <> v_paciente
         or v_alvo.origem <> 'paciente' then
        raise exception 'Este treino não pode ser alterado aqui.' using errcode = '42501';
      end if;
    end if;
  end if;

  if v_paciente is null then
    raise exception 'Paciente não informado.' using errcode = 'P0002';
  end if;
  if not exists (select 1 from pacientes where id = v_paciente) then
    raise exception 'Paciente não encontrado.' using errcode = 'P0002';
  end if;
  if p_exercicios is null or jsonb_typeof(p_exercicios) <> 'array' then
    raise exception 'Os exercícios precisam ser uma lista.' using errcode = '22023';
  end if;

  if p_id is null then
    insert into treinos (paciente_id, nome, observacao, ativo, origem)
    values (v_paciente, coalesce(nullif(btrim(p_nome), ''), 'Treino'),
            nullif(btrim(coalesce(p_observacao, '')), ''), v_ativo, v_origem)
    returning id into v_id;
  else
    update treinos
    set nome = coalesce(nullif(btrim(p_nome), ''), nome),
        observacao = nullif(btrim(coalesce(p_observacao, '')), ''),
        ativo = case when v_admin then coalesce(p_ativo, ativo) else true end,
        atualizado_em = now()
    where id = p_id and paciente_id = v_paciente
    returning id into v_id;
    if v_id is null then
      raise exception 'Treino não encontrado.' using errcode = 'P0002';
    end if;
  end if;

  if v_ativo then
    update treinos set ativo = false
    where paciente_id = v_paciente
      and id <> v_id
      and (v_admin or origem = 'paciente');
  end if;

  delete from treino_exercicios where treino_id = v_id;
  for v_item in select * from jsonb_array_elements(p_exercicios) loop
    if btrim(coalesce(v_item ->> 'nome', '')) = '' then continue; end if;
    insert into treino_exercicios
      (treino_id, nome, ordem, series_planejadas, repeticoes_min, repeticoes_max, observacao)
    values (
      v_id, btrim(v_item ->> 'nome'), v_ordem,
      nullif(v_item ->> 'seriesPlanejadas', '')::integer,
      nullif(v_item ->> 'repeticoesMin', '')::integer,
      nullif(v_item ->> 'repeticoesMax', '')::integer,
      nullif(btrim(coalesce(v_item ->> 'observacao', '')), '')
    );
    v_ordem := v_ordem + 1;
  end loop;

  return jsonb_build_object('id', v_id, 'origem', v_origem);
end;
$$;

revoke all on function salvar_treino(uuid, uuid, text, text, boolean, jsonb) from anon, public;
grant execute on function salvar_treino(uuid, uuid, text, text, boolean, jsonb) to authenticated;
