-- 0107 — Realinhar duas funções de produção com o código testado
-- (auditoria pós-atualização, 24/11/2026).
--
-- A comparação função por função entre o banco de produção e as migrações
-- achou duas que nunca receberam a versão certa:
--
-- 1. apagar_marcadores_da_data: em produção estava uma versão feita à parte,
--    com o parâmetro `p_paciente_id` (o app chama `p_paciente`, então o botão
--    de apagar marcadores de uma data dava erro) e SEM a conferência "só a
--    nutricionista" (qualquer conta logada podia apagar marcadores de outra
--    paciente). Volta a versão da 0070.
-- 2. ligar_item_ao_mapa: em produção estava a versão antiga, que recusava
--    ligar quando a paciente já tinha o alimento na lista ("já foi
--    relacionado"). Volta a versão da 0072, que junta os registros.
--
-- Só troca funções. Nenhuma tabela, coluna ou dado muda.

-- A assinatura de produção tem os mesmos tipos, mas outro nome de parâmetro
-- e outro retorno: precisa sair antes.
drop function if exists public.apagar_marcadores_da_data(uuid, date);

create or replace function apagar_marcadores_da_data(
  p_paciente uuid,
  p_data date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista apaga marcadores.' using errcode = '42501';
  end if;

  delete from marcadores_exame
   where paciente_id = p_paciente and data = p_data;
  get diagnostics v_n = row_count;

  if v_n = 0 then
    raise exception 'Nenhum marcador nesta data.' using errcode = '22023';
  end if;

  return v_n;
end;
$$;

revoke all on function apagar_marcadores_da_data(uuid, date) from anon, public;
grant execute on function apagar_marcadores_da_data(uuid, date) to authenticated;

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
