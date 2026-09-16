-- =============================================================================
-- CENTRAL DO PACIENTE — 0020: ligar os dois materiais e mostrar a marcação
--
-- O Mapa de Reintrodução e a Tabela de Oxalato são documentos diferentes, e
-- os nomes nem sempre batem. A ligação é feita um a um, à mão, e só onde os
-- dois falam do mesmo alimento.
--
-- O que NÃO foi ligado, e por quê: cará, jabuticaba, vagem, ervilha torta,
-- cottage, manteiga de búfala, queijo brie, queijos de búfala, coalhada e
-- "todas as folhas e brotos" não existem na tabela de marcadores. Ficam sem
-- marcação — que é honesto. Inventar um valor "parecido" seria pior do que
-- não mostrar nada, porque a paciente leria como informação.
-- =============================================================================

update reintroducao_alimentos a set marcador_id = v.marcador
from (values
  ('abacate','m-abacate'),
  ('pera','m-pera'),
  ('pessego','m-pessego'),
  ('manga','m-manga'),
  ('inhame','m-inhame'),
  ('avela','m-avela'),
  ('azeitona','m-azeitona'),
  -- "Chocolate 60% ou mais" do Mapa cobre o "Chocolate 70%" da Tabela.
  ('chocolate-60','m-chocolate'),
  ('nozes','m-nozes'),
  ('acerola','m-acerola'),
  ('goiaba','m-goiaba'),
  ('lichia','m-lichia'),
  ('aspargos','m-aspargos'),
  ('cogumelos','m-cogumelos'),
  ('nabo','m-nabo'),
  ('mel','m-mel'),
  ('batata-doce','m-batata-doce'),
  ('manteiga','m-manteiga'),
  ('pistache','m-pistache'),
  ('carne-vermelha','m-carne-vermelha'),
  ('carne-porco','m-carne-porco'),
  -- Whey é o soro do leite; é a mesma linha da Tabela.
  ('whey','m-whey'),
  -- Água de coco entra por "Coco e derivados".
  ('agua-de-coco','coco'),
  ('banana-da-terra','m-banana'),
  ('melancia','m-melancia'),
  ('alho-poro','m-alho-poro'),
  ('brocolis','m-brocolis'),
  ('couve-flor','m-couve-flor'),
  ('couve-bruxelas','m-couve-bruxelas'),
  ('repolho','m-repolho'),
  ('lentilha','m-lentilha'),
  ('quinoa','m-quinoa'),
  ('ervilha','m-ervilha'),
  ('feijao','m-feijao'),
  ('grao-de-bico','m-grao-de-bico'),
  ('alho','m-alho'),
  ('cebola','m-cebola'),
  ('amendoim','m-amendoim'),
  -- A Tabela separa por tipo de laticínio, não por teor de gordura: o que
  -- pesa na histamina é a fermentação, e ela vale para os dois iogurtes.
  ('iogurte-2-3','m-iogurte'),
  ('iogurte-desnatado','m-iogurte'),
  ('kefir-integral','m-kefir'),
  ('kefir-desnatado','m-kefir'),
  ('queijo-mucarela','m-queijo-mucarela'),
  ('queijo-ricota','m-queijo-ricota'),
  ('queijo-curado','m-queijos-curados'),
  ('queijo-gorgonzola','m-queijos-azuis')
) as v(alimento, marcador)
where a.id = v.alimento;

-- -----------------------------------------------------------------------------
-- O alimento que a paciente digitou
--
-- Quando ela registra "pão da padaria", não existe ligação nenhuma: o jeito
-- de achar é pelo nome. A comparação é sem acento e em minúsculas, e só casa
-- com nome IGUAL — nada de "parecido". Um palpite errado aqui viraria uma
-- informação errada na tela dela.
-- -----------------------------------------------------------------------------

-- `translate` em vez de `unaccent`: a extensão existe no Supabase e não no
-- Postgres cru da bateria de testes, e uma função que só roda em um dos dois
-- é uma função que ninguém testa. Esta aqui é português puro e roda igual nos
-- dois lugares.
create or replace function normalizar_nome(p_nome text)
returns text
language sql
immutable
set search_path = public
as $$
  select lower(translate(trim(coalesce(p_nome, '')),
    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
    'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'));
$$;

create or replace function marcador_por_nome(p_nome text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select m.id from alimentos_marcadores m
  where m.nome_busca = normalizar_nome(p_nome)
  limit 1;
$$;

revoke all on function normalizar_nome(text) from anon, public;
grant execute on function normalizar_nome(text) to authenticated;

revoke all on function marcador_por_nome(text) from anon, public;
grant execute on function marcador_por_nome(text) to authenticated;

-- -----------------------------------------------------------------------------
-- Como a marcação chega à tela
--
-- Devolve só o que está em MÉDIA ou acima. O material existe para responder
-- "o que este alimento tem de alto"; listar "oxalato muito baixa" encheria o
-- cartão de ruído e esconderia justamente o que interessa.
-- -----------------------------------------------------------------------------

create or replace function marcacao_do_alimento(p_marcador text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(x order by
    -- Muito alta primeiro: é o que a paciente precisa ver antes.
    case x ->> 'nivel' when 'muito_alta' then 1 when 'alta' then 2 else 3 end,
    x ->> 'nome'
  ), '[]'::jsonb)
  from alimentos_marcadores m,
  lateral (values
    ('Oxalato', m.oxalato), ('Histamina', m.histamina), ('Lectina', m.lectina)
  ) as c(nome, nivel),
  lateral (select jsonb_build_object('nome', c.nome, 'nivel', c.nivel) as x) as j
  where m.id = p_marcador
    and c.nivel in ('media', 'alta', 'muito_alta');
$$;

revoke all on function marcacao_do_alimento(text) from anon, public;
grant execute on function marcacao_do_alimento(text) to authenticated;

-- Leitura do catálogo de marcadores: mesma regra do resto do conteúdo.
alter table alimentos_marcadores enable row level security;

drop policy if exists alimentos_marcadores_leitura on alimentos_marcadores;
create policy alimentos_marcadores_leitura on alimentos_marcadores for select
  using (e_admin() or tem_acesso());

drop policy if exists alimentos_marcadores_admin on alimentos_marcadores;
create policy alimentos_marcadores_admin on alimentos_marcadores for all
  using (e_admin()) with check (e_admin());

grant select, insert, update, delete on alimentos_marcadores to authenticated;
revoke all on table alimentos_marcadores from anon;

-- -----------------------------------------------------------------------------
-- `reintroducao_json` passa a carregar a marcação
--
-- Vai no ITEM, e não no registro: é característica do alimento, não do dia.
-- Quem decide se aparece é a tela, pela única regra que ela deu — só quando
-- aquele registro tem sintoma.
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
        -- Do catálogo quando existe ligação; pelo nome quando a paciente
        -- digitou o alimento.
        'marcacao', marcacao_do_alimento(
          coalesce(a.marcador_id, marcador_por_nome(i.nome_livre))
        ),
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
        'marcacao', marcacao_do_alimento(
          coalesce(a.marcador_id, marcador_por_nome(i.nome_livre))
        ),
        'criadoEm', r.criado_em
      ) order by r.data desc, r.horario desc nulls last, r.criado_em desc), '[]'::jsonb)
      from reintroducao_registros r
      join reintroducao_itens i on i.id = r.item_id
      left join reintroducao_alimentos a on a.id = i.alimento_id
      where r.paciente_id = p_paciente
    )
  );
$$;
