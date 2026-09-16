-- =============================================================================
-- CENTRAL DO PACIENTE — 0016: as regras da rastreabilidade
--
-- Vale a pena dizer de novo o que NÃO tem neste arquivo, porque é a parte
-- mais importante dele:
--
--   * nenhuma função recusa um registro por causa do intervalo desde o
--     anterior. Três alimentos às 10h, 15h e 20h do mesmo dia entram os três;
--   * nenhuma função olha um sintoma e muda o status para algo que signifique
--     "não pode". O único status que o sistema atribui sozinho é 'em_teste',
--     e só porque passou a existir registro — é fato, não julgamento;
--   * nenhuma função devolve pendência, atraso ou meta. Item não testado é
--     'nao_iniciado', e ficar assim para sempre é um resultado válido.
--
-- Quem conclui é a nutricionista, na tela dela, com o histórico na frente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Vocabulário dos sintomas
--
-- Em função e não espalhado pelo código: a tela, o registro e a edição
-- conferem contra a mesma lista. Os cinco primeiros vêm do protocolo de
-- rastreio do material dela; 'manchas_pele' também é dele.
-- -----------------------------------------------------------------------------

create or replace function sintomas_da_reintroducao()
returns text[]
language sql
immutable
-- `search_path` fixo mesmo sem ser `security definer`: sem ele, quem chama
-- escolhe qual `sintomas_da_reintroducao` a conferência enxerga, e a
-- conferência inteira passa a valer o que o chamador quiser.
set search_path = public
as $$
  select array[
    'nenhum', 'distensao', 'gases', 'dor_abdominal', 'colica',
    'alteracao_evacuacao', 'diarreia', 'constipacao', 'urgencia',
    'nausea', 'refluxo', 'manchas_pele', 'outros'
  ];
$$;

/** Recusa um sintoma que a tela não conhece, antes de ele virar linha. */
create or replace function conferir_sintomas(p_sintomas text[])
returns text[]
language plpgsql
immutable
set search_path = public
as $$
declare s text;
begin
  if p_sintomas is null then
    return '{}';
  end if;
  foreach s in array p_sintomas loop
    if not (s = any (sintomas_da_reintroducao())) then
      raise exception 'Sintoma desconhecido: %', s using errcode = '22023';
    end if;
  end loop;
  -- 'nenhum' junto de qualquer outro é contradição: o outro manda.
  if 'nenhum' = any (p_sintomas) and array_length(p_sintomas, 1) > 1 then
    return array_remove(p_sintomas, 'nenhum');
  end if;
  return p_sintomas;
end;
$$;

-- -----------------------------------------------------------------------------
-- A semana do histórico
--
-- Só agrupa o tempo. Quando a nutricionista não marcou um início, a âncora é
-- o primeiro registro da paciente — assim ninguém precisa "abrir" o processo
-- para começar a usar, e a semana 1 é a semana em que ela de fato começou.
-- -----------------------------------------------------------------------------

-- As duas conferem o dono antes de responder. Sem isso, o id de outra
-- paciente devolveria quando ela começou o processo — que é dado dela, e do
-- mesmo tipo que já vazou uma vez por `saldo_de_pontos` sem essa checagem.
-- O `coalesce` é o que impede o nulo de escapar: `if null` não entra no
-- bloco, e a conferência inteira viraria enfeite.
create or replace function inicio_da_reintroducao(p_paciente uuid)
returns date
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not coalesce(e_admin() or p_paciente = meu_paciente_id(), false) then
    raise exception 'Você só pode ver o seu acompanhamento.' using errcode = '42501';
  end if;
  return coalesce(
    (select a.inicio from reintroducao_acompanhamento a where a.paciente_id = p_paciente),
    (select min(r.data) from reintroducao_registros r where r.paciente_id = p_paciente)
  );
end;
$$;

create or replace function semana_da_reintroducao(p_paciente uuid, p_data date)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_inicio date;
begin
  if not coalesce(e_admin() or p_paciente = meu_paciente_id(), false) then
    raise exception 'Você só pode ver o seu acompanhamento.' using errcode = '42501';
  end if;
  v_inicio := inicio_da_reintroducao(p_paciente);
  return case
    when v_inicio is null then 1
    when p_data < v_inicio then 1
    else floor((p_data - v_inicio) / 7)::int + 1
  end;
end;
$$;

-- -----------------------------------------------------------------------------
-- O que as duas telas leem
--
-- Um construtor só para a tela da paciente e a da nutricionista: se as duas
-- lessem de lugares diferentes, um dia mostrariam coisas diferentes sobre a
-- mesma paciente.
-- -----------------------------------------------------------------------------

create or replace function reintroducao_json(p_paciente uuid, p_previa boolean default false)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'previa', p_previa,
    'inicio', inicio_da_reintroducao(p_paciente),
    'semanaAtual', semana_da_reintroducao(p_paciente, hoje_sp()),
    -- Quantas semanas já correram. Não é meta nem prazo: é só até onde a
    -- linha do tempo chega hoje.
    'semanasComRegistro', (
      select coalesce(jsonb_agg(distinct semana_da_reintroducao(p_paciente, r.data)), '[]'::jsonb)
      from reintroducao_registros r where r.paciente_id = p_paciente
    ),
    'itens', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', i.id,
        'alimentoId', i.alimento_id,
        'nome', coalesce(a.nome, i.nome_livre),
        'categoria', coalesce(a.categoria, 'outros'),
        'semanaSugerida', a.semana_sugerida,
        'porcaoReferencia', a.porcao_referencia,
        'observacaoMaterial', a.observacao,
        'doCatalogo', i.alimento_id is not null,
        'status', i.status,
        'notaNutri', i.nota_nutri,
        'ordem', i.ordem,
        'totalDeRegistros', (
          select count(*) from reintroducao_registros r where r.item_id = i.id
        ),
        'ultimoRegistro', (
          select max(r.data) from reintroducao_registros r where r.item_id = i.id
        )
      ) order by i.ordem, coalesce(a.nome, i.nome_livre)), '[]'::jsonb)
      from reintroducao_itens i
      left join reintroducao_alimentos a on a.id = i.alimento_id
      where i.paciente_id = p_paciente
    ),
    'registros', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', r.id,
        'itemId', r.item_id,
        'itemNome', coalesce(a.nome, i.nome_livre),
        'data', r.data,
        'horario', to_char(r.horario, 'HH24:MI'),
        'semana', semana_da_reintroducao(p_paciente, r.data),
        'quantidade', r.quantidade,
        'preparo', r.preparo,
        'sintomas', to_jsonb(r.sintomas),
        'intensidade', r.intensidade,
        'bristol', r.bristol,
        'observacao', r.observacao,
        'criadoEm', r.criado_em
      ) order by r.data desc, r.horario desc nulls last, r.criado_em desc), '[]'::jsonb)
      from reintroducao_registros r
      join reintroducao_itens i on i.id = r.item_id
      left join reintroducao_alimentos a on a.id = i.alimento_id
      where r.paciente_id = p_paciente
    )
  );
$$;

-- -----------------------------------------------------------------------------
-- A tela da paciente
--
-- Mesmo caminho do desafio: a nutricionista, que não tem cadastro de
-- paciente, entra em modo de prévia e vê como a tela fica.
-- -----------------------------------------------------------------------------

create or replace function minha_reintroducao()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
  v_previa boolean;
  v_orientacao text;
begin
  v_paciente := meu_paciente_id();
  v_previa := v_paciente is null and e_admin();

  if v_paciente is null and not v_previa then
    return jsonb_build_object('previa', false, 'orientacao', null,
                              'itens', '[]'::jsonb, 'registros', '[]'::jsonb);
  end if;

  select valor #>> '{}' into v_orientacao
  from configuracoes where chave = 'reintroducao_orientacao';

  -- A orientação da nutricionista para aquela paciente vem antes da geral.
  return jsonb_build_object('orientacao', coalesce(
    (select nullif(trim(a.orientacao), '') from reintroducao_acompanhamento a
      where a.paciente_id = v_paciente),
    v_orientacao
  )) || reintroducao_json(v_paciente, v_previa);
end;
$$;

-- -----------------------------------------------------------------------------
-- A paciente registra
--
-- Aceita item da lista dela OU um nome digitado: o material manda o que não
-- está na lista entrar na semana 5, e é por aqui que isso acontece.
--
-- Não há conferência de intervalo. De propósito.
-- -----------------------------------------------------------------------------

create or replace function registrar_reintroducao(
  p_item uuid default null,
  p_nome_novo text default null,
  p_data date default null,
  p_horario time default null,
  p_quantidade text default null,
  p_preparo text default null,
  p_sintomas text[] default '{}',
  p_intensidade integer default null,
  p_bristol integer default null,
  p_observacao text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
  v_item uuid;
  v_id uuid;
begin
  if not tem_acesso() then
    raise exception 'Seu acesso não está liberado.' using errcode = '42501';
  end if;
  v_paciente := meu_paciente_id();
  if v_paciente is null then
    raise exception 'Não encontrei seu cadastro de paciente.' using errcode = '42501';
  end if;

  if p_item is not null then
    select i.id into v_item from reintroducao_itens i
     where i.id = p_item and i.paciente_id = v_paciente;
    if v_item is null then
      raise exception 'Este alimento não está na sua lista.' using errcode = '42501';
    end if;
  elsif coalesce(trim(p_nome_novo), '') <> '' then
    -- Alimento fora da lista: entra como item da paciente, sem pedir licença.
    insert into reintroducao_itens (paciente_id, nome_livre, status, ordem)
    values (v_paciente, trim(p_nome_novo), 'em_teste',
            coalesce((select max(ordem) + 1 from reintroducao_itens
                       where paciente_id = v_paciente), 1))
    returning id into v_item;
  else
    raise exception 'Escolha um alimento ou escreva o nome.' using errcode = '22023';
  end if;

  insert into reintroducao_registros
    (item_id, paciente_id, data, horario, quantidade, preparo,
     sintomas, intensidade, bristol, observacao)
  values
    (v_item, v_paciente, coalesce(p_data, hoje_sp()), p_horario,
     nullif(trim(p_quantidade), ''), nullif(trim(p_preparo), ''),
     conferir_sintomas(p_sintomas), p_intensidade, p_bristol,
     nullif(trim(p_observacao), ''))
  returning id into v_id;

  -- 'em_teste' é o único status que o sistema mexe sozinho, e é constatação,
  -- não conclusão: passou a existir registro, então o teste começou. O que a
  -- nutricionista já tiver classificado fica como está — inclusive
  -- 'nao_relevante', que ela pode ter marcado por um motivo.
  update reintroducao_itens set status = 'em_teste'
   where id = v_item and status = 'nao_iniciado';

  return v_id;
end;
$$;

/** Corrigir o próprio registro — errar o horário não pode custar o registro. */
create or replace function editar_registro_reintroducao(
  p_registro uuid,
  p_data date default null,
  p_horario time default null,
  p_quantidade text default null,
  p_preparo text default null,
  p_sintomas text[] default '{}',
  p_intensidade integer default null,
  p_bristol integer default null,
  p_observacao text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_paciente uuid;
begin
  v_paciente := meu_paciente_id();
  update reintroducao_registros
     set data = coalesce(p_data, data),
         horario = p_horario,
         quantidade = nullif(trim(p_quantidade), ''),
         preparo = nullif(trim(p_preparo), ''),
         sintomas = conferir_sintomas(p_sintomas),
         intensidade = p_intensidade,
         bristol = p_bristol,
         observacao = nullif(trim(p_observacao), '')
   where id = p_registro
     and (paciente_id = v_paciente or e_admin());
  if not found then
    raise exception 'Registro não encontrado.' using errcode = '22023';
  end if;
end;
$$;

create or replace function excluir_registro_reintroducao(p_registro uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_paciente uuid;
begin
  v_paciente := meu_paciente_id();
  delete from reintroducao_registros
   where id = p_registro and (paciente_id = v_paciente or e_admin());
  if not found then
    raise exception 'Registro não encontrado.' using errcode = '22023';
  end if;
end;
$$;

/**
 * "Esse alimento não faz parte da minha alimentação."
 *
 * É o §4 do pedido dela virando código: a paciente tira da frente o que ela
 * não come, e o app para de mostrar — sem cobrar, sem marcar como falha.
 *
 * Só funciona a partir de 'nao_iniciado' ou do próprio 'nao_relevante'. Se a
 * nutricionista já classificou o alimento, a classificação dela fica: quem
 * desfaz um julgamento clínico é quem o fez.
 */
create or replace function marcar_relevancia_reintroducao(p_item uuid, p_relevante boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
  v_status text;
begin
  v_paciente := meu_paciente_id();
  select status into v_status from reintroducao_itens
   where id = p_item and paciente_id = v_paciente;
  if v_status is null then
    raise exception 'Este alimento não está na sua lista.' using errcode = '42501';
  end if;
  if v_status not in ('nao_iniciado', 'nao_relevante') then
    raise exception 'Este alimento já está em acompanhamento com a sua nutricionista.'
      using errcode = '22023';
  end if;

  update reintroducao_itens
     set status = case when p_relevante then 'nao_iniciado' else 'nao_relevante' end
   where id = p_item;
end;
$$;
