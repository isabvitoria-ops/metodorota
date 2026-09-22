-- =============================================================================
-- CENTRAL DO PACIENTE — 0043: cobrança recorrente
--
-- O QUE ISTO É E O QUE NÃO É
--
-- NÃO é gateway de pagamento. O dinheiro continua entrando por PIX, cartão
-- na maquininha ou o que ela já usa. Isto é o CONTROLE: quem deve, quanto,
-- desde quando, e quem já pagou.
--
-- Cobrar de verdade dentro do aplicativo exigiria integração com Stripe,
-- Asaas ou Mercado Pago — taxa por transação, dados de cartão, contrato,
-- obrigação fiscal e uma tela de checkout que precisa estar certa no dia em
-- que a paciente paga. É trabalho de outro tamanho, e ela disse que não
-- quer custo agora. O controle resolve 90% da dor (esquecer de cobrar) com
-- 10% do trabalho, e a arquitetura deixa o gateway entrar depois.
--
-- NÃO HÁ AGENDADOR, pelo mesmo motivo do check-in: o plano dela não tem
-- `pg_cron`. Ela aperta "gerar cobranças do mês" e elas nascem. Uma tarefa
-- de madrugada que ninguém confere é pior do que um botão: quando falha,
-- falha calada, e o primeiro a notar é o caixa no fim do mês.
--
-- A PACIENTE NÃO VÊ NADA DISTO. Nenhuma função devolve cobrança para o
-- lado dela, e não há política de leitura para ela nestas tabelas. Um
-- aviso de "você está devendo" dentro do aplicativo de acompanhamento
-- misturaria a relação clínica com a comercial na tela em que ela vai
-- registrar sintoma.
-- =============================================================================

/** Quanto cada paciente paga. Nulo = ainda não combinado. */
alter table pacientes
  add column if not exists valor_mensal numeric(10, 2);

alter table pacientes
  add column if not exists dia_de_vencimento integer
    check (dia_de_vencimento is null or dia_de_vencimento between 1 and 28);

comment on column pacientes.valor_mensal is
  'Valor combinado por mês. Nulo quando ainda não há valor definido.';
comment on column pacientes.dia_de_vencimento is
  'Dia do mês do vencimento. Vai até 28 de propósito: 29, 30 e 31 não existem em todo mês, e um vencimento que some em fevereiro é defeito garantido.';

create table if not exists cobrancas (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes(id) on delete cascade,
  -- O primeiro dia do mês a que a cobrança se refere. É o que impede gerar
  -- duas vezes o mesmo mês, e o que faz "outubro" ser uma coisa só.
  competencia date not null,
  valor numeric(10, 2) not null check (valor >= 0),
  vencimento date not null,
  status text not null default 'aberta'
    check (status in ('aberta', 'paga', 'cancelada')),
  pago_em date,
  forma text,
  observacao text,
  criado_em timestamptz not null default now(),
  unique (paciente_id, competencia)
);

comment on table cobrancas is
  'Controle de cobrança. Não é gateway: o dinheiro entra fora do aplicativo.';

create index if not exists cobrancas_por_vencimento on cobrancas (vencimento);

alter table cobrancas enable row level security;

grant select, insert, update, delete on cobrancas to authenticated;

-- Só a nutricionista. A paciente não tem política nenhuma aqui, e é de
-- propósito (ver o cabeçalho).
drop policy if exists cobrancas_admin on cobrancas;
create policy cobrancas_admin on cobrancas
  for all using (e_admin()) with check (e_admin());

/**
 * "Atrasada" NÃO é um status gravado, é uma conta.
 *
 * Se fosse coluna, alguém teria que virar 'aberta' em 'atrasada' à
 * meia-noite do vencimento — e sem agendador isso nunca aconteceria. A
 * cobrança ficaria eternamente "aberta" e a tela mentiria.
 *
 * Derivando de `vencimento < hoje`, a verdade não depende de nada rodar.
 */
create or replace function situacao_cobranca(
  p_status text, p_vencimento date)
returns text
language sql
stable
as $$
  select case
    when p_status = 'paga' then 'paga'
    when p_status = 'cancelada' then 'cancelada'
    when p_vencimento < hoje_sp() then 'atrasada'
    when p_vencimento <= hoje_sp() + 7 then 'vencendo'
    else 'aberta'
  end;
$$;

grant execute on function situacao_cobranca(text, date) to authenticated;

/**
 * Gera as cobranças de um mês para todas as pacientes com valor combinado.
 *
 * `on conflict do nothing` sobre (paciente, competência): apertar o botão
 * duas vezes no mesmo mês não cria cobrança dobrada. Isso importa porque o
 * botão não tem como saber se já foi apertado — e ela vai apertar de novo
 * só para conferir.
 *
 * Quem NÃO entra: paciente sem `valor_mensal` (não há o que cobrar) e
 * paciente suspensa. Paciente com acesso vencido ENTRA: deixar de cobrar
 * quem venceu é justamente perder a renovação.
 */
create or replace function gerar_cobrancas(p_competencia date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mes date;
  v_criadas integer;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista gera cobranças.' using errcode = '42501';
  end if;

  -- Sempre o primeiro dia do mês, venha o que vier da tela.
  v_mes := date_trunc('month', coalesce(p_competencia, hoje_sp())::timestamp)::date;

  insert into cobrancas (paciente_id, competencia, valor, vencimento)
  select p.id,
         v_mes,
         p.valor_mensal,
         v_mes + (coalesce(p.dia_de_vencimento, 10) - 1)
  from pacientes p
  where p.valor_mensal is not null
    and p.valor_mensal > 0
    and p.status <> 'suspenso'
  on conflict (paciente_id, competencia) do nothing;

  get diagnostics v_criadas = row_count;
  return v_criadas;
end;
$$;

revoke all on function gerar_cobrancas(date) from anon, public;
grant execute on function gerar_cobrancas(date) to authenticated;

/** Marca como paga, ou desfaz. Devolve o estado GRAVADO. */
create or replace function baixar_cobranca(
  p_id uuid, p_paga boolean, p_forma text default null, p_pago_em date default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista dá baixa.' using errcode = '42501';
  end if;
  if not exists (select 1 from cobrancas where id = p_id) then
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

  return v_status;
end;
$$;

revoke all on function baixar_cobranca(uuid, boolean, text, date) from anon, public;
grant execute on function baixar_cobranca(uuid, boolean, text, date) to authenticated;

/** Cria, edita ou cancela uma cobrança avulsa. */
create or replace function salvar_cobranca(
  p_id uuid, p_paciente uuid, p_competencia date, p_valor numeric,
  p_vencimento date, p_observacao text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_mes date;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista mexe em cobrança.' using errcode = '42501';
  end if;
  if coalesce(p_valor, -1) < 0 then
    raise exception 'O valor não pode ser negativo.' using errcode = '22023';
  end if;

  v_mes := date_trunc('month', coalesce(p_competencia, hoje_sp())::timestamp)::date;

  if p_id is null then
    if not exists (select 1 from pacientes where id = p_paciente) then
      raise exception 'Paciente não encontrada.' using errcode = '22023';
    end if;
    insert into cobrancas (paciente_id, competencia, valor, vencimento, observacao)
    values (p_paciente, v_mes, p_valor,
            coalesce(p_vencimento, v_mes + 9), nullif(trim(p_observacao), ''))
    returning id into v_id;
  else
    update cobrancas
       set valor = p_valor,
           vencimento = coalesce(p_vencimento, vencimento),
           competencia = v_mes,
           observacao = nullif(trim(p_observacao), '')
     where id = p_id
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

revoke all on function salvar_cobranca(uuid, uuid, date, numeric, date, text) from anon, public;
grant execute on function salvar_cobranca(uuid, uuid, date, numeric, date, text) to authenticated;

create or replace function cancelar_cobranca(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista cancela.' using errcode = '42501';
  end if;
  -- Cancelar em vez de apagar: uma cobrança que some não deixa rastro de
  -- que existiu, e no fim do ano a conta não fecha com ninguém sabendo por
  -- quê.
  update cobrancas set status = 'cancelada', pago_em = null, forma = null
   where id = p_id and status <> 'paga';
  return found;
end;
$$;

revoke all on function cancelar_cobranca(uuid) from anon, public;
grant execute on function cancelar_cobranca(uuid) to authenticated;

/**
 * O painel financeiro: as cobranças e os totais, num pedido só.
 *
 * Os totais vêm CONTADOS AQUI porque são soma de dinheiro — a conta tem que
 * ser uma só, e não uma por tela que resolva somar. (Diferente da adesão e
 * da pontuação, que são interpretação e moram no TypeScript testado.)
 */
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
      'recebidoNoMes', coalesce((select sum(valor) from cobrancas
                                 where status = 'paga'
                                   and pago_em >= date_trunc('month', hoje_sp()::timestamp)::date), 0),
      'previstoNoMes', coalesce((select sum(valor) from cobrancas
                                 where status <> 'cancelada'
                                   and competencia = date_trunc('month', hoje_sp()::timestamp)::date), 0)),
    -- Quem ainda não tem valor combinado. Sem esta lista, a paciente
    -- cadastrada sem valor some da cobrança para sempre e ninguém nota.
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

/** O valor e o dia de vencimento de uma paciente. */
create or replace function definir_valor_do_paciente(
  p_paciente uuid, p_valor numeric, p_dia integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista define o valor.' using errcode = '42501';
  end if;
  if not exists (select 1 from pacientes where id = p_paciente) then
    raise exception 'Paciente não encontrada.' using errcode = '22023';
  end if;
  if p_valor is not null and p_valor < 0 then
    raise exception 'O valor não pode ser negativo.' using errcode = '22023';
  end if;
  if p_dia is not null and (p_dia < 1 or p_dia > 28) then
    raise exception 'O dia do vencimento vai de 1 a 28.' using errcode = '22023';
  end if;

  update pacientes
     set valor_mensal = p_valor,
         dia_de_vencimento = p_dia
   where id = p_paciente;

  return (select jsonb_build_object('valor', valor_mensal, 'dia', dia_de_vencimento)
            from pacientes where id = p_paciente);
end;
$$;

revoke all on function definir_valor_do_paciente(uuid, numeric, integer) from anon, public;
grant execute on function definir_valor_do_paciente(uuid, numeric, integer) to authenticated;

-- -----------------------------------------------------------------------------
-- O valor fica fora do alcance da paciente
-- -----------------------------------------------------------------------------

/*
 * POR QUE O VALOR NAO ESTA TRANCADO POR COLUNA -- e por que esta certo.
 *
 * A RLS e por LINHA, nao por coluna: a politica que deixa a paciente ler a
 * propria ficha deixa junto o `valor_mensal` e o `dia_de_vencimento`. A
 * primeira ideia foi trancar as duas colunas com `revoke select (coluna)`.
 *
 * Nao funciona: um `grant select` de TABELA cobre todas as colunas, as
 * futuras inclusive, e revogar uma coluna dele nao tem efeito. Para valer,
 * seria preciso revogar a tabela inteira e listar coluna por coluna as que
 * ficam -- e ai TODA coluna nova precisaria ser lembrada nessa lista, senao
 * a tela da nutricionista quebra no dia seguinte, longe daqui.
 *
 * Essa armadilha nao se paga. O que a paciente enxergaria e QUANTO ELA
 * PROPRIA PAGA -- que ela sabe, porque e ela quem paga. O que importa de
 * verdade continua trancado e testado: ela nao ve o valor de OUTRA
 * paciente (RLS por linha), nao ve a tabela `cobrancas` (sem politica para
 * ela), e nao ve nada disso em tela nenhuma do aplicativo.
 *
 * Se um dia entrar aqui algo que ela realmente nao possa ver -- custo,
 * margem, anotacao comercial -- o lugar e uma tabela separada, com politica
 * so para a nutricionista, e nao mais uma coluna nesta.
 */

-- A `condicao` (0039) nunca entrou na visao, e a visao e por onde a ficha
-- le. Resultado: a queixa principal aparecia vazia na tela de Pacientes,
-- mesmo gravada. Aparecia certo no Acompanhamento, que le pelo panorama --
-- e foi por isso que passou batido.
-- `create or replace view` nao deixa inserir coluna no MEIO da lista: ele
-- casa as colunas por POSICAO, e tentar isso vira "cannot change name of
-- view column ultimo_acesso to condicao". Derrubar e recriar e o caminho.
drop view if exists pacientes_visao;

create view pacientes_visao
with (security_invoker = true) as
  select p.id,
         p.perfil_id,
         p.email,
         p.nome,
         p.telefone,
         p.plano_id,
         p.data_inicio,
         p.data_fim,
         p.status,
         p.observacoes,
         p.condicao,
         p.ultimo_acesso,
         p.criado_em,
         p.atualizado_em,
         situacao_paciente(p.status, p.perfil_id, p.data_inicio, p.data_fim) as situacao,
         p.data_fim - hoje_sp() as dias_restantes,
         pl.nome as plano_nome,
         pl.duracao_dias as plano_duracao_dias,
         (select max(c.enviado_em) from convites c where c.paciente_id = p.id)
           as convite_enviado_em
    from pacientes p
    left join planos pl on pl.id = p.plano_id;

grant select on pacientes_visao to authenticated;

/**
 * O valor combinado de cada paciente, para a tela do financeiro.
 *
 * Existe porque o grant por coluna acima fecha a leitura direta — e a tela
 * dela precisa mostrar quanto cada uma paga para poder mudar.
 */
create or replace function valores_dos_pacientes()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê os valores.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'nome', p.nome, 'telefone', p.telefone,
      'situacao', situacao_paciente(p.status, p.perfil_id, p.data_inicio, p.data_fim),
      'valorMensal', p.valor_mensal,
      'diaDeVencimento', p.dia_de_vencimento)
    order by p.nome)
    from pacientes p
    where p.status <> 'suspenso'
  ), '[]'::jsonb);
end;
$$;

revoke all on function valores_dos_pacientes() from anon, public;
grant execute on function valores_dos_pacientes() to authenticated;
