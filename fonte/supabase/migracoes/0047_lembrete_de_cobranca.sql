-- =============================================================================
-- 0047 — Lembrete de cobrança: quando foi lembrada, e quantas vezes
-- =============================================================================
--
-- O botão "Cobrar" abre o WhatsApp e o e-mail da paciente com a mensagem
-- pronta. O que faltava era a MEMÓRIA: sem registro, ela não sabe se já
-- lembrou a Mariana ontem, e lembrar duas vezes no mesmo dia é exatamente o
-- tipo de coisa que ela não quer que aconteça.
--
-- O registro é de que o botão foi APERTADO, não de que a mensagem chegou:
-- quem aperta enviar no WhatsApp é ela, e daqui não há como saber se
-- apertou. A tela diz "lembrada em", nunca "entregue".

alter table cobrancas add column if not exists lembrada_em timestamptz;
alter table cobrancas add column if not exists lembretes integer not null default 0;

create or replace function registrar_lembrete_cobranca(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quando timestamptz;
  v_quantos integer;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista registra lembrete.' using errcode = '42501';
  end if;

  -- Só cobrança em aberto: lembrar de uma paga ou cancelada seria cobrar
  -- quem não deve, e o botão nem aparece nesses casos.
  update cobrancas
     set lembrada_em = now(),
         lembretes = lembretes + 1
   where id = p_id and status = 'aberta'
  returning lembrada_em, lembretes into v_quando, v_quantos;

  if v_quando is null then
    raise exception 'Essa cobrança não está em aberto.' using errcode = 'P0002';
  end if;

  return jsonb_build_object('lembradaEm', v_quando, 'lembretes', v_quantos);
end;
$$;

revoke all on function registrar_lembrete_cobranca(uuid) from anon, public;
grant execute on function registrar_lembrete_cobranca(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- O painel passa a trazer o e-mail da paciente e o último lembrete
-- -----------------------------------------------------------------------------

create or replace function painel_financeiro(p_desde date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_desde date;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê o financeiro.' using errcode = '42501';
  end if;

  v_desde := coalesce(p_desde, date_trunc('month', hoje_sp()::timestamp)::date - 180);

  return jsonb_build_object(
    'cobrancas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'pacienteId', c.paciente_id,
        'paciente', p.nome,
        'telefone', p.telefone,
        'email', p.email,
        'lembradaEm', c.lembrada_em,
        'lembretes', c.lembretes,
        'competencia', c.competencia,
        'valor', c.valor,
        'vencimento', c.vencimento,
        'status', c.status,
        'situacao', situacao_cobranca(c.status, c.vencimento),
        'pagoEm', c.pago_em,
        'forma', c.forma,
        'observacao', c.observacao)
      order by c.vencimento desc, p.nome)
      from cobrancas c join pacientes p on p.id = c.paciente_id
      where c.competencia >= v_desde
    ), '[]'::jsonb),
    'totais', jsonb_build_object(
      'aberto', coalesce((select sum(valor) from cobrancas
                          where status = 'aberta' and competencia >= v_desde), 0),
      'atrasado', coalesce((select sum(valor) from cobrancas
                            where status = 'aberta' and vencimento < hoje_sp()
                              and competencia >= v_desde), 0),
      -- DO CAIXA, e não das cobranças: é a mesma pergunta em duas telas, e
      -- duas contas diferentes para ela acabariam discordando.
      'recebidoNoMes', coalesce((select sum(valor) from recebimentos
                                 where date_trunc('month', data)
                                       = date_trunc('month', hoje_sp()::timestamp)), 0),
      'previstoNoMes', coalesce((select sum(valor) from cobrancas
                                 where status <> 'cancelada'
                                   and competencia = date_trunc('month', hoje_sp()::timestamp)), 0)),
    'semValor', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome) order by p.nome)
      from pacientes p
      where p.valor_mensal is null and p.status <> 'suspenso'
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function painel_financeiro(date) from anon, public;
grant execute on function painel_financeiro(date) to authenticated;
