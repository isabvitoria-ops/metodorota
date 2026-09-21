-- =============================================================================
-- CENTRAL DO PACIENTE — 0026: ligar ao Mapa o alimento digitado à mão
--
-- O QUE ELA VIU: "não está aparecendo para mim aquelas informações de
-- oxalato alto, histamina alto."
--
-- O QUE ESTÁ ACONTECENDO, olhando os dados: a lista da Daniela tem seis
-- alimentos e os SEIS foram digitados à mão — Abacate com mel, Carne boi,
-- Carne de porco, Couve flor, Mel, Mussarela de búfala. Alimento digitado
-- não tem ligação com o Mapa, e sem ligação não há marcação. A da Marina,
-- montada pelo Mapa, mostra a marcação normalmente.
--
-- Não era a semana, e não era a tela: era a ligação que nunca existiu.
--
-- A BUSCA POR NOME NÃO VOLTA. Ela foi tirada na 0021 de propósito — era por
-- ali que "champagne" achava "champignon". Adivinhar a ligação é pior que
-- não ter nenhuma: um marcador errado num alimento é uma pista falsa numa
-- investigação clínica. Quem liga é ela, olhando, um a um.
-- =============================================================================

/**
 * Aponta um item da lista da paciente para um alimento do Mapa.
 *
 * O `nome_livre` FICA. A paciente escreveu "Abacate com mel" e é isso que
 * ela precisa continuar vendo no diário dela: trocar o nome por "Abacate /
 * avocado" mudaria, sem aviso, um registro que é dela. O que entra é só a
 * ligação — e com ela a marcação.
 */
create or replace function ligar_item_ao_mapa(p_item uuid, p_alimento text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista liga um alimento ao Mapa.' using errcode = '42501';
  end if;

  if not exists (select 1 from reintroducao_alimentos where id = p_alimento) then
    raise exception 'Este alimento não está no Mapa.' using errcode = 'P0002';
  end if;

  -- A mesma paciente não tem o mesmo alimento do Mapa duas vezes (índice
  -- único da 0014). Sem esta conferência, ligar "Abacate com mel" numa
  -- paciente que já tem o abacate do Mapa estouraria com erro de banco, que
  -- não diz nada a quem está na tela. Recusar aqui, com o nome do alimento
  -- que já está lá, transforma o acidente em instrução.
  if exists (
    select 1 from reintroducao_itens outro
     where outro.alimento_id = p_alimento
       and outro.id <> p_item
       and outro.paciente_id = (select paciente_id from reintroducao_itens where id = p_item)
  ) then
    raise exception 'Esta paciente já tem % na lista. Dois alimentos dela não podem apontar para o mesmo item do Mapa.',
      (select nome from reintroducao_alimentos where id = p_alimento)
      using errcode = '23505';
  end if;

  update reintroducao_itens
     set alimento_id = p_alimento,
         -- Sem `nome_livre` a ligação apagaria o nome da paciente, porque a
         -- leitura passaria a cair no do Mapa. Guardar o que ela escreveu é
         -- o que torna esta operação reversível de verdade.
         nome_livre = coalesce(nome_livre, (select nome from reintroducao_alimentos
                                             where id = p_alimento))
   where id = p_item;

  if not found then
    raise exception 'Alimento não encontrado na lista.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function ligar_item_ao_mapa(uuid, text) from anon, public;
grant execute on function ligar_item_ao_mapa(uuid, text) to authenticated;

/**
 * Desfazer a ligação.
 *
 * Existe porque uma ligação errada é PIOR que nenhuma: ela pendura oxalato
 * ou histamina num alimento que não os tem, e a marcação errada some no meio
 * das certas. Errar tem de custar um clique, não uma conversa comigo.
 */
create or replace function desligar_item_do_mapa(p_item uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista desfaz a ligação.' using errcode = '42501';
  end if;

  update reintroducao_itens
     set alimento_id = null,
         nome_livre = coalesce(nome_livre, (select nome from reintroducao_alimentos a
                                             where a.id = reintroducao_itens.alimento_id))
   where id = p_item;

  if not found then
    raise exception 'Alimento não encontrado na lista.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function desligar_item_do_mapa(uuid) from anon, public;
grant execute on function desligar_item_do_mapa(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- O nome que a paciente conhece passa a mandar
--
-- Até aqui a leitura era `coalesce(a.nome, i.nome_livre)`: existindo ligação,
-- o nome do Mapa ganhava. Com a ligação feita depois do fato, isso renomearia
-- o registro da paciente pelas costas dela. Invertido, o alimento vindo do
-- Mapa continua igual (nasce sem `nome_livre`) e o digitado à mão mantém a
-- palavra dela mesmo depois de ligado.
--
-- Conferido em produção antes de inverter: nenhum item tem os dois campos
-- preenchidos hoje, então a troca não mexe em nada do que já existe.
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
        -- Ligado DEPOIS, por ela, e não escolhido do Mapa desde o começo.
        -- Os dois campos preenchidos só acontecem por `ligar_item_ao_mapa`:
        -- alimento vindo do Mapa nasce sem nome próprio. A tela usa isto
        -- para oferecer "desfazer a ligação" onde há ligação a desfazer, e
        -- não num alimento que sempre foi do Mapa.
        'ligadoDepois', i.alimento_id is not null and i.nome_livre is not null,
        'status', i.status,
        'notaNutri', i.nota_nutri,
        'ordem', i.ordem,
        -- Só o que veio do Mapa e tem ligação explícita. Alimento digitado
        -- fica sem marcação, mesmo que exista um nome igual na Tabela.
        'marcacao', marcacao_do_alimento(a.marcador_id),
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
        'marcacao', marcacao_do_alimento(a.marcador_id),
        'criadoEm', r.criado_em
      ) order by r.data desc, r.horario desc nulls last, r.criado_em desc), '[]'::jsonb)
      from reintroducao_registros r
      join reintroducao_itens i on i.id = r.item_id
      left join reintroducao_alimentos a on a.id = i.alimento_id
      where r.paciente_id = p_paciente
    )
  );
$$;
