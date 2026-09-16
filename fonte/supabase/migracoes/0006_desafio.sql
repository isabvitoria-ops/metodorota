-- =============================================================================
-- CENTRAL DO PACIENTE — 0006: Desafio do mês (Ponto de Virada)
--
-- A regra de pontuação mora AQUI, não na tela. O frontend não soma nada e não
-- escreve uma linha de ponto: ele mostra o que estas funções devolvem.
--
-- O caminho é sempre o mesmo:
--   paciente marca "eu fiz"  →  envio com status 'enviado', zero pontos
--   nutricionista aprova     →  função grava o lançamento no ledger
--   saldo e ranking          →  derivados do ledger, nunca de um total solto
--
-- Nada aqui altera tabela existente. Paciente, plano, convite, alimento e
-- conteúdo continuam exatamente como estavam.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Desafios
-- -----------------------------------------------------------------------------

create table if not exists desafios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  -- A frase que abre a tela. Fica no banco para ela trocar sem publicar de novo.
  lema text,
  data_inicio date not null,
  data_fim date not null,
  status text not null default 'rascunho'
    check (status in ('rascunho', 'ativo', 'encerrado')),
  capa_url text,
  regras text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint desafio_periodo_coerente check (data_fim >= data_inicio)
);

create index if not exists desafios_status_idx on desafios (status, data_inicio desc);

-- Não pode haver dois desafios cobrindo o mesmo dia: o card da Home e o
-- ranking precisam saber qual é o do momento sem adivinhar.
--
-- A trava é por PERÍODO, não por status. Um índice sobre `status = 'ativo'`
-- pareceria equivalente e não é: ele impediria ela de deixar o desafio de
-- outubro pronto enquanto o de setembro ainda está marcado como ativo — e
-- justamente preparar o mês seguinte com antecedência é o uso normal.
create or replace function desafio_sem_sobreposicao()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'rascunho' then
    return new;
  end if;
  if exists (
    select 1 from desafios d
    where d.id <> new.id
      and d.status <> 'rascunho'
      and daterange(d.data_inicio, d.data_fim, '[]')
          && daterange(new.data_inicio, new.data_fim, '[]')
  ) then
    raise exception 'Já existe um desafio cobrindo estas datas.' using errcode = '23505';
  end if;
  return new;
end;
$$;

drop trigger if exists desafio_sem_sobreposicao on desafios;
create trigger desafio_sem_sobreposicao
before insert or update on desafios
for each row execute function desafio_sem_sobreposicao();

-- -----------------------------------------------------------------------------
-- Ações que pontuam
--
-- Cadastradas como dado, não como enum: mudar a pontuação, desligar uma ação
-- ou criar outra é editar linha, não mexer em código (§23 do briefing dela).
-- -----------------------------------------------------------------------------

create table if not exists desafio_acoes (
  id uuid primary key default gen_random_uuid(),
  desafio_id uuid not null references desafios (id) on delete cascade,
  -- Chave estável para a tela saber que ícone/texto usar sem depender do nome.
  chave text not null,
  nome text not null,
  descricao text,
  pontos integer not null check (pontos > 0),
  -- 'semanal'  = uma vez por semana do desafio
  -- 'desafio'  = uma vez no desafio inteiro
  -- 'evento'   = quantas vezes acontecer (limitado por max_ocorrencias)
  periodicidade text not null default 'semanal'
    check (periodicidade in ('semanal', 'desafio', 'evento')),
  exige_validacao boolean not null default true,
  -- Nulo = sem teto. Vale para 'evento'.
  max_ocorrencias integer check (max_ocorrencias is null or max_ocorrencias > 0),
  ativo boolean not null default true,
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (desafio_id, chave)
);

-- -----------------------------------------------------------------------------
-- Participação
-- -----------------------------------------------------------------------------

create table if not exists desafio_participantes (
  id uuid primary key default gen_random_uuid(),
  desafio_id uuid not null references desafios (id) on delete cascade,
  paciente_id uuid not null references pacientes (id) on delete cascade,
  entrou_em timestamptz not null default now(),
  unique (desafio_id, paciente_id)
);

-- -----------------------------------------------------------------------------
-- Envios: "eu fiz isso"
--
-- `pontos_concedidos` existe só como registro do que foi concedido na
-- aprovação. Quem manda no saldo é o ledger.
-- -----------------------------------------------------------------------------

create table if not exists desafio_envios (
  id uuid primary key default gen_random_uuid(),
  desafio_id uuid not null references desafios (id) on delete cascade,
  acao_id uuid not null references desafio_acoes (id) on delete cascade,
  paciente_id uuid not null references pacientes (id) on delete cascade,
  -- Semana do desafio (1, 2, 3...). Nulo para ação que não é semanal.
  semana integer,
  status text not null default 'enviado'
    check (status in ('enviado', 'aprovado', 'recusado')),
  observacao text,
  enviado_em timestamptz not null default now(),
  revisado_em timestamptz,
  revisado_por uuid references perfis (id) on delete set null,
  motivo_recusa text,
  pontos_concedidos integer not null default 0
);

create index if not exists envios_pendentes_idx
  on desafio_envios (desafio_id, status, enviado_em);
create index if not exists envios_paciente_idx
  on desafio_envios (paciente_id, desafio_id);

-- A trava de duplicidade mora no banco, não na tela (§56).
-- Recusado fica de fora: se ela recusou, a paciente pode mandar de novo.
create unique index if not exists envios_sem_duplicata_semanal_idx
  on desafio_envios (desafio_id, acao_id, paciente_id, semana)
  where status <> 'recusado' and semana is not null;

create unique index if not exists envios_sem_duplicata_unica_idx
  on desafio_envios (desafio_id, acao_id, paciente_id)
  where status <> 'recusado' and semana is null;

-- -----------------------------------------------------------------------------
-- Ledger de pontos — a fonte única (§42)
--
-- Nunca se apaga uma linha daqui. Correção é lançamento novo, inclusive
-- negativo, com motivo. O saldo é a soma; o ranking é a soma filtrada pelo
-- desafio. Não existe "total" guardado em coluna para desencontrar do
-- histórico.
-- -----------------------------------------------------------------------------

create table if not exists pontos_lancamentos (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes (id) on delete cascade,
  -- Nulo quando o ponto não veio de desafio nenhum (ajuste avulso).
  desafio_id uuid references desafios (id) on delete set null,
  acao_id uuid references desafio_acoes (id) on delete set null,
  envio_id uuid references desafio_envios (id) on delete set null,
  indicacao_id uuid,
  pontos integer not null,
  tipo text not null
    check (tipo in ('acao', 'indicacao', 'ajuste', 'resgate')),
  descricao text not null,
  criado_em timestamptz not null default now(),
  criado_por uuid references perfis (id) on delete set null
);

create index if not exists lancamentos_paciente_idx
  on pontos_lancamentos (paciente_id, criado_em desc);
create index if not exists lancamentos_desafio_idx
  on pontos_lancamentos (desafio_id, paciente_id);

-- Um envio aprovado gera um lançamento, e só um.
create unique index if not exists lancamentos_um_por_envio_idx
  on pontos_lancamentos (envio_id) where envio_id is not null;

-- -----------------------------------------------------------------------------
-- Indicações
--
-- Os pontos (50 aqui, 100 desde o 0013) não saem porque alguém disse que
-- indicou: saem quando a
-- indicada vira paciente de verdade e a nutricionista confirma (§9, §26).
-- -----------------------------------------------------------------------------

create table if not exists indicacoes (
  id uuid primary key default gen_random_uuid(),
  desafio_id uuid references desafios (id) on delete set null,
  paciente_indicadora_id uuid not null references pacientes (id) on delete cascade,
  nome_indicada text not null,
  email_indicada citext,
  telefone_indicada text,
  -- Preenchido quando a indicada é encontrada no cadastro de pacientes.
  paciente_indicada_id uuid references pacientes (id) on delete set null,
  status text not null default 'registrada'
    check (status in ('registrada', 'iniciou', 'validada', 'recusada')),
  observacao text,
  pontos_concedidos integer not null default 0,
  criado_em timestamptz not null default now(),
  validado_em timestamptz,
  validado_por uuid references perfis (id) on delete set null
);

create index if not exists indicacoes_indicadora_idx
  on indicacoes (paciente_indicadora_id, criado_em desc);
create index if not exists indicacoes_status_idx on indicacoes (status);

alter table pontos_lancamentos
  drop constraint if exists pontos_lancamentos_indicacao_fk;
alter table pontos_lancamentos
  add constraint pontos_lancamentos_indicacao_fk
  foreign key (indicacao_id) references indicacoes (id) on delete set null;

-- Uma indicação validada gera um lançamento, e só um.
create unique index if not exists lancamentos_um_por_indicacao_idx
  on pontos_lancamentos (indicacao_id) where indicacao_id is not null;

-- -----------------------------------------------------------------------------
-- Recompensas do Ponto de Virada (§47)
--
-- Em tabela, e não em código, porque são as regras do programa dela — mas os
-- valores só mudam com a autorização dela.
-- -----------------------------------------------------------------------------

create table if not exists recompensas (
  id text primary key,
  pontos integer not null check (pontos > 0),
  nome text not null,
  descricao text,
  ordem integer not null default 0,
  ativo boolean not null default true
);

-- Mesmo gatilho de `atualizado_em` das tabelas antigas, pelo mesmo caminho.
do $$
declare t text;
begin
  foreach t in array array['desafios', 'desafio_acoes'] loop
    execute format('drop trigger if exists tocar_atualizado on %I', t);
    execute format(
      'create trigger tocar_atualizado before update on %I for each row execute function tocar_atualizado_em()',
      t
    );
  end loop;
end;
$$;
