-- =============================================================================
-- CENTRAL DO PACIENTE — 0046: recebimentos e balanço
--
-- O PEDIDO: além da cobrança recorrente, uma aba para registrar o que entra
-- avulso — a paciente que pagou tudo no PIX de uma vez, a que pagou no
-- cartão, a transferência — e um balanço para ela saber quanto está
-- ganhando.
--
-- A DECISÃO QUE DEFINE ESTE ARQUIVO: UM LIVRO-CAIXA SÓ.
--
-- O caminho óbvio seria duas listas separadas — cobranças de um lado,
-- avulsos do outro — e somar as duas no fim. Esse caminho tem um defeito
-- que só aparece no mês seguinte: ela marca a cobrança como paga E registra
-- o PIX que recebeu, porque são a mesma entrada vista de dois lugares. O
-- balanço mostra o dobro, e ela não tem como saber, porque os dois números
-- estão certos cada um por si.
--
-- Então `recebimentos` é a ÚNICA fonte de dinheiro que entrou. Dar baixa
-- numa cobrança CRIA o recebimento; desfazer a baixa APAGA. A cobrança
-- continua sendo o que ela é — a previsão, quem deve o quê — e o dinheiro
-- mora num lugar só.
--
-- Contar duas vezes é impossível por construção, e não por cuidado.
--
-- RECEBIMENTO SEM PACIENTE É PERMITIDO, porque nem toda entrada vem de
-- paciente: palestra, material, consultoria. Uma tabela que exigisse
-- paciente forçaria ela a inventar uma.
-- =============================================================================

create table if not exists recebimentos (
  id uuid primary key default gen_random_uuid(),
  -- Nulo quando a entrada não vem de paciente (palestra, material).
  paciente_id uuid references pacientes(id) on delete set null,
  -- Preenchido quando nasceu de uma cobrança. `unique` é o que impede a
  -- mesma cobrança virar dois recebimentos.
  cobranca_id uuid unique references cobrancas(id) on delete cascade,
  descricao text,
  valor numeric(10, 2) not null check (valor > 0),
  data date not null default hoje_sp(),
  forma text not null default 'pix'
    check (forma in ('pix', 'cartao', 'transferencia', 'dinheiro', 'boleto', 'outro')),
  observacao text,
  criado_em timestamptz not null default now()
);

comment on table recebimentos is
  'O livro-caixa: a única fonte do que entrou. Baixa de cobrança cria a linha aqui; não existe soma paralela.';

create index if not exists recebimentos_por_data on recebimentos (data desc);
create index if not exists recebimentos_por_paciente on recebimentos (paciente_id);

alter table recebimentos enable row level security;

grant select, insert, update, delete on recebimentos to authenticated;

-- Só a nutricionista. A paciente não tem política nenhuma: nada do
-- financeiro aparece do lado dela, pelo mesmo motivo da cobrança.
drop policy if exists recebimentos_admin on recebimentos;
create policy recebimentos_admin on recebimentos
  for all using (e_admin()) with check (e_admin());

/**
 * Registra ou edita uma entrada avulsa.
 *
 * `p_id` nulo cria. Entrada ligada a cobrança NÃO se edita por aqui: ela é
 * consequência da baixa, e mexer nela pelo lado errado faria os dois
 * lugares discordarem sobre o mesmo dinheiro.
 */
create or replace function registrar_recebimento(
  p_id uuid, p_paciente uuid, p_descricao text, p_valor numeric,
  p_data date, p_forma text, p_observacao text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista registra recebimento.' using errcode = '42501';
  end if;
  if coalesce(p_valor, 0) <= 0 then
    raise exception 'O valor precisa ser maior que zero.' using errcode = '22023';
  end if;
  if coalesce(p_forma, 'pix') not in
     ('pix', 'cartao', 'transferencia', 'dinheiro', 'boleto', 'outro') then
    raise exception 'Forma de pagamento inválida.' using errcode = '22023';
  end if;
  if p_paciente is not null
     and not exists (select 1 from pacientes where id = p_paciente) then
    raise exception 'Paciente não encontrada.' using errcode = '22023';
  end if;

  if p_id is null then
    insert into recebimentos (paciente_id, descricao, valor, data, forma, observacao)
    values (p_paciente, nullif(trim(p_descricao), ''), p_valor,
            coalesce(p_data, hoje_sp()), coalesce(p_forma, 'pix'),
            nullif(trim(p_observacao), ''))
    returning id into v_id;
  else
    if exists (select 1 from recebimentos where id = p_id and cobranca_id is not null) then
      raise exception
        'Esta entrada veio de uma cobrança. Mude pela cobrança, para os dois não discordarem.'
        using errcode = '42501';
    end if;
    update recebimentos
       set paciente_id = p_paciente,
           descricao = nullif(trim(p_descricao), ''),
           valor = p_valor,
           data = coalesce(p_data, data),
           forma = coalesce(p_forma, forma),
           observacao = nullif(trim(p_observacao), '')
     where id = p_id
    returning id into v_id;
    if v_id is null then
      raise exception 'Recebimento não encontrado.' using errcode = '22023';
    end if;
  end if;

  return v_id;
end;
$$;

revoke all on function registrar_recebimento(uuid, uuid, text, numeric, date, text, text)
  from anon, public;
grant execute on function registrar_recebimento(uuid, uuid, text, numeric, date, text, text)
  to authenticated;

/** Apaga uma entrada avulsa. A que veio de cobrança sai desfazendo a baixa. */
create or replace function apagar_recebimento(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista apaga recebimento.' using errcode = '42501';
  end if;
  if exists (select 1 from recebimentos where id = p_id and cobranca_id is not null) then
    raise exception
      'Esta entrada veio de uma cobrança. Desfaça a baixa da cobrança para tirá-la do caixa.'
      using errcode = '42501';
  end if;

  delete from recebimentos where id = p_id;
  return found;
end;
$$;

revoke all on function apagar_recebimento(uuid) from anon, public;
grant execute on function apagar_recebimento(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- A baixa da cobrança passa a alimentar o caixa
-- -----------------------------------------------------------------------------
--
-- É esta função que garante que não há dupla contagem: quem dá baixa não
-- precisa lembrar de registrar o recebimento, porque ele nasce aqui.

create or replace function baixar_cobranca(
  p_id uuid, p_paga boolean, p_forma text default null, p_pago_em date default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_cobranca cobrancas;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista dá baixa.' using errcode = '42501';
  end if;

  select * into v_cobranca from cobrancas where id = p_id;
  if v_cobranca.id is null then
    raise exception 'Cobrança não encontrada.' using errcode = '22023';
  end if;

  update cobrancas
     set status = case when coalesce(p_paga, false) then 'paga' else 'aberta' end,
         -- Desfazer a baixa limpa a data e a forma: uma cobrança "aberta"
         -- carregando data de pagamento seria contraditória, e um dia
         -- alguém somaria isso achando que entrou.
         pago_em = case when coalesce(p_paga, false)
                        then coalesce(p_pago_em, hoje_sp()) else null end,
         forma = case when coalesce(p_paga, false)
                      then nullif(trim(p_forma), '') else null end
   where id = p_id
  returning status into v_status;

  if coalesce(p_paga, false) then
    -- Nasce no caixa. `on conflict` porque dar baixa duas vezes é clique
    -- repetido, não dinheiro que entrou duas vezes.
    insert into recebimentos (paciente_id, cobranca_id, descricao, valor, data, forma)
    values (v_cobranca.paciente_id, v_cobranca.id,
            'Acompanhamento ' || to_char(v_cobranca.competencia, 'MM/YYYY'),
            v_cobranca.valor,
            coalesce(p_pago_em, hoje_sp()),
            coalesce(nullif(trim(p_forma), ''), 'pix'))
    on conflict (cobranca_id) do update
      set data = excluded.data, forma = excluded.forma, valor = excluded.valor;
  else
    -- Desfazer a baixa tira do caixa. Sem isto, o dinheiro continuaria
    -- somado depois de ela dizer que não entrou.
    delete from recebimentos where cobranca_id = p_id;
  end if;

  return v_status;
end;
$$;

revoke all on function baixar_cobranca(uuid, boolean, text, date) from anon, public;
grant execute on function baixar_cobranca(uuid, boolean, text, date) to authenticated;

/**
 * Cancelar uma cobrança também tira do caixa, se ela estava paga.
 *
 * Hoje a função recusa cancelar cobrança paga, então isto é cinto e
 * suspensório — mas se a regra mudar um dia, o caixa não fica com dinheiro
 * de uma cobrança que deixou de existir.
 */
create or replace function cancelar_cobranca(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  -- `FOUND` é reescrito por CADA comando. Sem guardar o resultado do
  -- `update` aqui, o `delete` seguinte sobrescreveria — e a função
  -- devolveria "não cancelei" depois de ter cancelado, com a tela mostrando
  -- erro para uma operação que deu certo. A bateria pegou isto.
  v_cancelou boolean;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista cancela.' using errcode = '42501';
  end if;
  -- Cancelar em vez de apagar: uma cobrança que some não deixa rastro de
  -- que existiu, e no fim do ano a conta não fecha com ninguém sabendo por
  -- quê.
  update cobrancas set status = 'cancelada', pago_em = null, forma = null
   where id = p_id and status <> 'paga';
  v_cancelou := found;

  if v_cancelou then
    delete from recebimentos where cobranca_id = p_id;
  end if;

  return v_cancelou;
end;
$$;

revoke all on function cancelar_cobranca(uuid) from anon, public;
grant execute on function cancelar_cobranca(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- O balanço
-- -----------------------------------------------------------------------------

/**
 * Quanto entrou, por mês e por forma de pagamento.
 *
 * Os meses vêm de uma SÉRIE, e não dos recebimentos que existem. Sem isso,
 * um mês em que ela não recebeu nada simplesmente não apareceria — e um
 * buraco invisível no gráfico se lê como "não teve mês", quando o que
 * houve foi "não entrou nada". São coisas diferentes, e a segunda é
 * justamente a que ela precisa ver.
 *
 * A COMPARAÇÃO COM O MÊS ANTERIOR não vem daqui: é conta de tela, feita no
 * TypeScript testado, pelo mesmo motivo da adesão e da pontuação. Aqui só
 * o dinheiro, que precisa de uma soma só.
 */
create or replace function balanco_financeiro(p_meses integer default 6)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_quantos integer;
  v_primeiro date;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê o balanço.' using errcode = '42501';
  end if;

  v_quantos := least(greatest(coalesce(p_meses, 6), 1), 36);
  v_primeiro := date_trunc('month', hoje_sp()::timestamp)::date
                - make_interval(months => v_quantos - 1);

  return jsonb_build_object(
    'meses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'mes', m.mes,
        'total', coalesce((select sum(r.valor) from recebimentos r
                            where date_trunc('month', r.data) = m.mes), 0),
        'entradas', (select count(*) from recebimentos r
                      where date_trunc('month', r.data) = m.mes))
      order by m.mes)
      from (
        select generate_series(v_primeiro,
                               date_trunc('month', hoje_sp()::timestamp)::date,
                               interval '1 month')::date as mes
      ) m
    ), '[]'::jsonb),

    -- Por forma de pagamento, no período inteiro. Responde "quanto do meu
    -- faturamento é PIX", que é o que decide se vale ter maquininha.
    'porForma', coalesce((
      select jsonb_agg(jsonb_build_object(
        'forma', f.forma, 'total', f.total, 'entradas', f.entradas)
      order by f.total desc)
      from (
        select forma, sum(valor) as total, count(*) as entradas
          from recebimentos
         where data >= v_primeiro
         group by forma
      ) f
    ), '[]'::jsonb),

    'totais', jsonb_build_object(
      'noPeriodo', coalesce((select sum(valor) from recebimentos
                              where data >= v_primeiro), 0),
      'noMes', coalesce((select sum(valor) from recebimentos
                          where date_trunc('month', data)
                                = date_trunc('month', hoje_sp()::timestamp)), 0),
      'mesPassado', coalesce((select sum(valor) from recebimentos
                               where date_trunc('month', data)
                                     = date_trunc('month', hoje_sp()::timestamp)
                                       - interval '1 month'), 0),
      -- A média exclui o mês corrente, que ainda está acontecendo: incluí-lo
      -- puxaria a média para baixo todo dia 2 e a faria subir até o dia 30.
      'mediaMensal', coalesce((
        select round(avg(t), 2) from (
          select coalesce(sum(r.valor), 0) as t
            from (select generate_series(v_primeiro,
                                         date_trunc('month', hoje_sp()::timestamp)::date
                                           - interval '1 month',
                                         interval '1 month')::date as mes) m
            left join recebimentos r on date_trunc('month', r.data) = m.mes
           group by m.mes
        ) x
      ), 0)),

    'recebimentos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'pacienteId', r.paciente_id,
        'paciente', p.nome,
        'cobrancaId', r.cobranca_id,
        -- A tela precisa saber que esta linha nasceu de uma cobranca: ela
        -- nao se edita nem se apaga por aqui, e o botao some em vez de
        -- aparecer e ser recusado depois do clique.
        'deCobranca', r.cobranca_id is not null,
        'descricao', r.descricao,
        'valor', r.valor,
        'data', r.data,
        'forma', r.forma,
        'observacao', r.observacao)
      order by r.data desc, r.criado_em desc)
      from recebimentos r
      left join pacientes p on p.id = r.paciente_id
      where r.data >= v_primeiro
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function balanco_financeiro(integer) from anon, public;
grant execute on function balanco_financeiro(integer) to authenticated;

-- -----------------------------------------------------------------------------
-- O painel de cobrança passa a ler o recebido do CAIXA
-- -----------------------------------------------------------------------------
--
-- Antes ele somava as cobranças pagas. Agora que existe entrada avulsa,
-- essa soma responderia só metade da pergunta — e as duas telas mostrariam
-- números diferentes para "recebido no mês", que é o começo de ela não
-- confiar em nenhum dos dois.

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
