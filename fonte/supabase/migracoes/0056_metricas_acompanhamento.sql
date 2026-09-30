-- =============================================================================
-- 0056 — Métricas simplificadas de acompanhamento
--
-- Três números para a saúde do negócio, calculados na hora (nada é gravado,
-- então não há como ficarem desatualizados):
--
--   * ATIVAS: pacientes com acesso hoje (situação "ativo" ou "próximo do
--     vencimento"). Convite pendente, suspensa, ainda não iniciada e expirada
--     NÃO entram.
--   * TICKET MÉDIO: o que já entrou no caixa vindo de pacientes, dividido por
--     quantas pacientes já pagaram alguma vez. Entrada avulsa (palestra,
--     material), sem paciente, fica de fora — não é ticket de paciente.
--   * PERMANÊNCIA MÉDIA: dias entre o início e o fim do plano, só de quem já
--     encerrou (situação "expirado"). Quem ainda está em acompanhamento não
--     entra: a permanência dela ainda não terminou.
--
-- Extra que ajuda a ler o ticket: o valor mensal médio das ativas.
--
-- Só a nutricionista lê.
-- =============================================================================

create or replace function metricas_acompanhamento()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê as métricas.' using errcode = '42501';
  end if;

  with base as (
    select p.data_inicio, p.data_fim, p.valor_mensal,
           situacao_paciente(p.status, p.perfil_id, p.data_inicio, p.data_fim) as s
      from pacientes p
  ),
  pagas as (
    select r.paciente_id, sum(r.valor) as total
      from recebimentos r
     where r.paciente_id is not null
     group by r.paciente_id
  )
  select jsonb_build_object(
    'ativas',
      (select count(*) from base where s in ('ativo', 'proximo_do_vencimento')),
    'encerradas',
      (select count(*) from base where s = 'expirado'),
    'permanenciaMediaDias',
      (select round(avg(data_fim - data_inicio)::numeric, 1) from base where s = 'expirado'),
    'pacientesQuePagaram',
      (select count(*) from pagas),
    'totalRecebido',
      coalesce((select sum(total) from pagas), 0),
    'ticketMedio',
      (select round(sum(total) / nullif(count(*), 0), 2) from pagas),
    'valorMensalMedioAtivas',
      (select round(avg(valor_mensal), 2) from base
        where s in ('ativo', 'proximo_do_vencimento') and valor_mensal is not null)
  ) into v;

  return v;
end;
$$;

revoke all on function metricas_acompanhamento() from anon, public;
grant execute on function metricas_acompanhamento() to authenticated;
