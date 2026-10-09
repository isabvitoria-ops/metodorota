-- =============================================================================
-- CENTRAL DO PACIENTE — 0072: fundir ao ligar ao Mapa
--
-- O QUE ELA VIU: "eu tô tentando relacionar o iogurte que ela escreveu com Y
-- ao iogurte mesmo, e não tô conseguindo porque tá falando que já foi
-- relacionado."
--
-- O QUE ESTÁ ACONTECENDO: a paciente digitou "Yogurt" à mão E tem "Iogurte"
-- vindo do Mapa na mesma lista. O índice único (paciente_id, alimento_id)
-- impede dois itens da mesma paciente apontarem para o mesmo alimento do
-- Mapa, e a função `ligar_item_ao_mapa` recusava com uma mensagem de erro.
--
-- A SOLUÇÃO É FUNDIR: ao ligar o item digitado a um alimento do Mapa que
-- outro item da mesma paciente já usa, os registros do item digitado migram
-- para o existente, e o item digitado é apagado. O resultado é um item com
-- todos os registros, sem perder nenhum dado.
-- =============================================================================

create or replace function ligar_item_ao_mapa(p_item uuid, p_alimento text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_outro uuid;
  v_paciente uuid;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista liga um alimento ao Mapa.' using errcode = '42501';
  end if;

  if not exists (select 1 from reintroducao_alimentos where id = p_alimento) then
    raise exception 'Este alimento não está no Mapa.' using errcode = 'P0002';
  end if;

  select paciente_id into v_paciente from reintroducao_itens where id = p_item;
  if v_paciente is null then
    raise exception 'Alimento não encontrado na lista.' using errcode = 'P0002';
  end if;

  -- Outro item da mesma paciente já aponta para este alimento do Mapa?
  select id into v_outro
    from reintroducao_itens
   where paciente_id = v_paciente
     and alimento_id = p_alimento
     and id <> p_item;

  if v_outro is not null then
    -- FUNDIR: os registros do item digitado migram para o existente.
    update reintroducao_registros
       set item_id = v_outro
     where item_id = p_item;

    -- A nota e o status que ela escreveu não se perdem: se o item que vai
    -- embora tem informação que o que fica não tem, copia.
    update reintroducao_itens destino
       set nota_nutri = coalesce(destino.nota_nutri, origem.nota_nutri),
           status = case
             when destino.status = 'nao_iniciado' and origem.status <> 'nao_iniciado'
             then origem.status
             else destino.status
           end,
           marcacao_nutri = coalesce(destino.marcacao_nutri, origem.marcacao_nutri)
      from reintroducao_itens origem
     where destino.id = v_outro
       and origem.id = p_item;

    delete from reintroducao_itens where id = p_item;
    return;
  end if;

  -- Caso normal: nenhum conflito, é só apontar.
  update reintroducao_itens
     set alimento_id = p_alimento,
         nome_livre = coalesce(nome_livre, (select nome from reintroducao_alimentos
                                             where id = p_alimento))
   where id = p_item;
end;
$$;
