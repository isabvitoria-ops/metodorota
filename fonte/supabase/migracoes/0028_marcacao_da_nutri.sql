-- =============================================================================
-- CENTRAL DO PACIENTE — 0028: a marcação que a nutricionista escreve
--
-- "Vamos supor que ela teste uma coisa muito nada a ver, tipo chocolate
-- quente cremoso das Três Corações. Não está na lista, mas é uma coisa que
-- ela pode ter testado. Eu quero depois conseguir editar e colocar lectina
-- alta, oxalato alto, por minha conta. E aí depois aparece para ela também,
-- que no final do tratamento a tabela fica pronta com a informação."
--
-- O BURACO. A marcação só existia para alimento do Mapa, vinda da Tabela
-- dela. Alimento digitado — e é exatamente o caso do produto de marca, que
-- nenhuma tabela traz — ficava sem oxalato, histamina e lectina para sempre,
-- e sumia do painel que ela usa para ler o padrão no fim do tratamento.
--
-- A SAÍDA NÃO É INVENTAR. Nada aqui adivinha marcador por nome: quem
-- escreve é ela, alimento por alimento, e o que ela escreve fica registrado
-- COMO DELA. A tela mostra a diferença; o painel e a tabela da paciente
-- contam as duas igual, porque para a leitura clínica o que importa é o
-- marcador, não quem o anotou.
-- =============================================================================

alter table reintroducao_itens
  add column if not exists marcacao_nutri jsonb;

comment on column reintroducao_itens.marcacao_nutri is
  'Marcação escrita pela nutricionista para este alimento desta paciente. '
  'NULL = ela não escreveu nada, e vale a do Mapa. Array vazio = ela disse '
  'que não há marcador, e isso não é o mesmo que não ter dito nada.';

/**
 * Confere e arruma o que vem da tela.
 *
 * Aceita só os três marcadores da Tabela dela e os cinco níveis. Um nome ou
 * nível de fora é erro, não é ignorado em silêncio: marcação clínica entrando
 * torta é pior que não entrar.
 *
 * Guarda apenas média e acima, a mesma régua de `marcacao_do_alimento` — o
 * material serve para responder "o que este alimento tem de alto", e listar
 * o que é baixo esconderia isso.
 */
create or replace function conferir_marcacao(p_marcacao jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  v_item jsonb;
  v_nome text;
  v_nivel text;
  v_saida jsonb := '[]'::jsonb;
begin
  if p_marcacao is null then return null; end if;
  if jsonb_typeof(p_marcacao) <> 'array' then
    raise exception 'A marcação precisa ser uma lista.' using errcode = '22023';
  end if;

  for v_item in select * from jsonb_array_elements(p_marcacao) loop
    v_nome := v_item ->> 'nome';
    v_nivel := v_item ->> 'nivel';

    if v_nome not in ('Oxalato', 'Histamina', 'Lectina') then
      raise exception 'Marcador desconhecido: %', coalesce(v_nome, 'nulo')
        using errcode = '22023';
    end if;
    if v_nivel not in ('muito_baixa', 'baixa', 'media', 'alta', 'muito_alta') then
      raise exception 'Nível desconhecido: %', coalesce(v_nivel, 'nulo')
        using errcode = '22023';
    end if;
    if v_saida @> jsonb_build_array(jsonb_build_object('nome', v_nome)) then
      raise exception 'O marcador % veio duas vezes.', v_nome using errcode = '22023';
    end if;

    if v_nivel in ('media', 'alta', 'muito_alta') then
      v_saida := v_saida || jsonb_build_array(
        jsonb_build_object('nome', v_nome, 'nivel', v_nivel));
    end if;
  end loop;

  return v_saida;
end;
$$;

revoke all on function conferir_marcacao(jsonb) from anon, public;
grant execute on function conferir_marcacao(jsonb) to authenticated;

/**
 * Ela escreve a marcação daquele alimento, naquela paciente.
 *
 * Passando nulo, apaga o que escreveu e a do Mapa volta a valer — é o
 * desfazer de quem marcou errado.
 */
create or replace function definir_marcacao_item(p_item uuid, p_marcacao jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista escreve a marcação.' using errcode = '42501';
  end if;

  update reintroducao_itens
     set marcacao_nutri = conferir_marcacao(p_marcacao)
   where id = p_item;

  if not found then
    raise exception 'Alimento não encontrado na lista.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function definir_marcacao_item(uuid, jsonb) from anon, public;
grant execute on function definir_marcacao_item(uuid, jsonb) to authenticated;

/**
 * A marcação que vale para um item: a dela quando existe, a do Mapa quando não.
 *
 * A dela ganha de propósito. Ela só escreve onde o Mapa é silencioso ou onde
 * discorda — e entre a Tabela e a nutricionista que está com a paciente na
 * frente, quem decide é a segunda.
 */
create or replace function marcacao_do_item(p_marcacao_nutri jsonb, p_marcador text)
returns jsonb
language sql
stable
set search_path = public
as $$
  select coalesce(p_marcacao_nutri, marcacao_do_alimento(p_marcador));
$$;

revoke all on function marcacao_do_item(jsonb, text) from anon, public;
grant execute on function marcacao_do_item(jsonb, text) to authenticated;

-- -----------------------------------------------------------------------------
-- A leitura passa a usar as duas
-- -----------------------------------------------------------------------------

create or replace function reintroducao_json(p_paciente uuid, p_previa boolean default false)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'ativo', p_previa or rastreio_ativo(p_paciente),
    'previa', p_previa,
    'inicio', inicio_da_reintroducao(p_paciente),
    'semanaAtual', semana_da_reintroducao(p_paciente, hoje_sp()),
    'semanasComRegistro', (
      select coalesce(jsonb_agg(distinct semana_da_reintroducao(p_paciente, r.data)), '[]'::jsonb)
      from reintroducao_registros r where r.paciente_id = p_paciente
    ),
    'itens', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', i.id,
        'alimentoId', i.alimento_id,
        'nome', coalesce(i.nome_livre, a.nome),
        'categoria', coalesce(a.categoria, 'outros'),
        'semanaSugerida', a.semana_sugerida,
        'porcaoReferencia', a.porcao_referencia,
        'observacaoMaterial', a.observacao,
        'doCatalogo', i.alimento_id is not null,
        'ligadoDepois', i.alimento_id is not null and i.nome_livre is not null,
        'status', i.status,
        'notaNutri', i.nota_nutri,
        'ordem', i.ordem,
        'marcacao', marcacao_do_item(i.marcacao_nutri, a.marcador_id),
        -- Quem anotou. A tela da NUTRICIONISTA usa para dizer "marcação
        -- sua"; a da paciente não mostra, porque para ela a origem não muda
        -- nada e só acrescentaria uma palavra a mais sobre o próprio corpo.
        'marcacaoDaNutri', i.marcacao_nutri is not null,
        'totalDeRegistros', (
          select count(*) from reintroducao_registros r where r.item_id = i.id
        ),
        'ultimoRegistro', (
          select max(r.data) from reintroducao_registros r where r.item_id = i.id
        )
      ) order by i.ordem, coalesce(i.nome_livre, a.nome)), '[]'::jsonb)
      from reintroducao_itens i
      left join reintroducao_alimentos a on a.id = i.alimento_id
      where i.paciente_id = p_paciente
    ),
    'registros', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', r.id,
        'itemId', r.item_id,
        'itemNome', coalesce(i.nome_livre, a.nome),
        'data', r.data,
        'horario', to_char(r.horario, 'HH24:MI'),
        'semana', semana_da_reintroducao(p_paciente, r.data),
        'quantidade', r.quantidade,
        'preparo', r.preparo,
        'sintomas', to_jsonb(r.sintomas),
        'intensidade', r.intensidade,
        'bristol', r.bristol,
        'observacao', r.observacao,
        'marcacao', marcacao_do_item(i.marcacao_nutri, a.marcador_id),
        'criadoEm', r.criado_em
      ) order by r.data desc, r.horario desc nulls last, r.criado_em desc), '[]'::jsonb)
      from reintroducao_registros r
      join reintroducao_itens i on i.id = r.item_id
      left join reintroducao_alimentos a on a.id = i.alimento_id
      where r.paciente_id = p_paciente
    )
  );
$$;
