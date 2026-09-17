-- =============================================================================
-- CENTRAL DO PACIENTE — instalação completa do banco
--
-- ARQUIVO GERADO por `npm run instalador`. Não edite aqui: edite os arquivos
-- de supabase/migracoes/ e gere de novo.
--
-- COMO USAR
--   1. Abra o seu projeto no Supabase.
--   2. Menu da esquerda → SQL Editor → New query.
--   3. Cole TODO o conteúdo deste arquivo.
--   4. Clique em Run.
--
-- Pode rodar mais de uma vez sem medo: tudo é "crie se não existir" e os
-- dados iniciais são inseridos com "on conflict do nothing", então nada que
-- você já tiver cadastrado é apagado ou duplicado.
--
-- Contém: 0001_esquema.sql, 0002_funcoes.sql, 0003_rls.sql, 0004_dados_iniciais.sql, 0005_permissoes.sql, 0006_desafio.sql, 0007_desafio_funcoes.sql, 0008_desafio_rls.sql, 0009_desafio_tela.sql, 0010_desafio_fechaduras.sql, 0011_desafio_dados.sql, 0012_desafio_criacao.sql, 0013_desafio_ajustes.sql, 0014_reintroducao.sql, 0015_reintroducao_catalogo.sql, 0016_reintroducao_funcoes.sql, 0017_reintroducao_admin.sql, 0018_marcadores.sql, 0019_marcadores_tabela.sql, 0020_marcadores_ligacao.sql, 0021_rastreio_por_paciente.sql, 0022_protocolo.sql, 0023_grupos_protocolo.sql, 0024_avaliacao_fisica.sql
-- =============================================================================


-- ###########################################################################
-- 0001_esquema.sql
-- ###########################################################################

-- =============================================================================
-- CENTRAL DO PACIENTE — 0001: esquema
--
-- Tabelas, índices e o vocabulário do domínio. Nada de política de acesso
-- aqui: isso está em 0003_rls.sql, depois das funções que as políticas usam.
--
-- Convenção de datas: `data_inicio` e `data_fim` são DATE, não timestamp. O
-- acesso de um paciente vale o dia inteiro da data de fim, no fuso de São
-- Paulo — quem termina em 30/06 continua entrando às 23h de 30/06.
-- =============================================================================

create extension if not exists citext;

-- -----------------------------------------------------------------------------
-- Pessoas
-- -----------------------------------------------------------------------------

-- Um perfil por conta autenticada. É criado automaticamente pelo gatilho
-- `ao_criar_usuario` (ver 0002) — o app nunca insere aqui.
create table if not exists perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text,
  email citext not null,
  papel text not null default 'paciente' check (papel in ('admin', 'paciente')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists perfis_email_idx on perfis (email);
create index if not exists perfis_papel_idx on perfis (papel);

-- -----------------------------------------------------------------------------
-- Planos e pacientes
-- -----------------------------------------------------------------------------

create table if not exists planos (
  id text primary key,
  nome text not null,
  duracao_dias integer not null check (duracao_dias > 0),
  descricao text,
  ordem integer not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- O paciente é cadastrado pela nutricionista ANTES de existir conta de
-- acesso: por isso `perfil_id` nasce nulo e o e-mail é a chave de encontro.
-- É essa separação que faz valer a regra "convite não é acesso" — a conta
-- pode existir sem que exista linha aqui, e aí o acesso é zero.
--
-- `status` guarda só o que é decisão humana: convite pendente, ativo,
-- suspenso. "Expirado", "próximo do vencimento" e "não iniciado" NÃO são
-- gravados: saem das datas, toda vez que são perguntados (ver `situacao` em
-- 0002). Sem isso seria preciso uma rotina diária virando status — e um dia
-- que a rotina falhasse, paciente vencido continuaria entrando.
create table if not exists pacientes (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid unique references perfis (id) on delete set null,
  email citext not null unique,
  nome text not null,
  telefone text,
  plano_id text references planos (id),
  data_inicio date not null,
  data_fim date not null,
  status text not null default 'convite_pendente'
    check (status in ('convite_pendente', 'ativo', 'suspenso')),
  observacoes text,
  ultimo_acesso timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint periodo_coerente check (data_fim >= data_inicio)
);

create index if not exists pacientes_status_idx on pacientes (status);
create index if not exists pacientes_data_fim_idx on pacientes (data_fim);
create index if not exists pacientes_perfil_idx on pacientes (perfil_id);

-- Registro de cada envio de convite. A linha de `pacientes` já diz que há um
-- convite pendente; esta tabela responde "quando mandei da última vez?", que
-- é o que a tela administrativa precisa mostrar.
create table if not exists convites (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes (id) on delete cascade,
  email citext not null,
  enviado_em timestamptz not null default now(),
  enviado_por uuid references perfis (id) on delete set null,
  aceito_em timestamptz
);

create index if not exists convites_paciente_idx on convites (paciente_id, enviado_em desc);

-- Trilha administrativa: quem fez o quê com qual paciente.
create table if not exists historico_admin (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid references pacientes (id) on delete cascade,
  ator_perfil_id uuid references perfis (id) on delete set null,
  evento text not null,
  detalhe jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);

create index if not exists historico_paciente_idx on historico_admin (paciente_id, criado_em desc);

-- -----------------------------------------------------------------------------
-- Catálogo de alimentos
-- -----------------------------------------------------------------------------

create table if not exists unidades (
  id text primary key,
  rotulo text not null,
  abreviacao text not null,
  singular text not null,
  continua boolean not null default true,
  ordem integer not null default 0,
  ativo boolean not null default true
);

create table if not exists grupos_alimentares (
  id text primary key,
  nome text not null,
  descricao text,
  ordem integer not null default 0,
  -- Regra do grupo. Hoje: {"tipo":"porcoes"} ou
  -- {"tipo":"livre","texto":"...","minimos":[{"refeicao":"Almoço","medida":{...}}]}
  regra jsonb,
  troca_por_porcao boolean not null default true,
  -- Grupos para os quais uma porção deste grupo pode ser convertida, além do
  -- próprio. É de MÃO ÚNICA: carboidratos leva {"frutas"}, e frutas leva {},
  -- porque no material carboidrato vira fruta e fruta não vira carboidrato.
  troca_para_grupos text[] not null default '{}',
  tags text[] not null default '{}',
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists alimentos (
  id text primary key,
  nome text not null,
  grupo_id text not null references grupos_alimentares (id),
  unidade_base_id text not null references unidades (id),
  -- Porção de referência. Nula enquanto a nutricionista não cadastrar: o
  -- alimento aparece na lista marcado como pendente e fica fora da
  -- calculadora, em vez de ganhar um valor plausível inventado.
  porcao_quantidade numeric,
  porcao_unidade_id text references unidades (id),
  -- Livre por decisão da nutricionista (o limão), que é diferente de porção
  -- nula por dado faltando. As telas contam os dois de formas opostas.
  quantidade_livre boolean not null default false,
  -- [{"unidadeId":"colher-sopa","equivalenteNaBase":25,"rotulo":null}]
  medidas jsonb not null default '[]'::jsonb,
  -- Três estados de propósito: true, false e NULL ("ainda não informei").
  sem_gluten boolean,
  sem_lactose boolean,
  tags text[] not null default '{}',
  imagem_url text,
  observacao text,
  nivel_acesso text not null default 'paciente'
    check (nivel_acesso in ('publico', 'paciente', 'premium')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint porcao_completa check (
    (porcao_quantidade is null and porcao_unidade_id is null)
    or (porcao_quantidade is not null and porcao_unidade_id is not null)
  )
);

create index if not exists alimentos_grupo_idx on alimentos (grupo_id);
create index if not exists alimentos_tags_idx on alimentos using gin (tags);

-- Equivalência entre dois alimentos. `tipo` + `regra` porque nem toda troca
-- é proporcional: "tabela" guarda pontos medidos e o sistema interpola entre
-- eles sem nunca extrapolar; "fixa" ignora a quantidade informada.
create table if not exists equivalencias (
  id text primary key,
  origem_alimento_id text not null references alimentos (id) on delete cascade,
  destino_alimento_id text not null references alimentos (id) on delete cascade,
  tipo text not null default 'proporcional' check (tipo in ('proporcional', 'tabela', 'fixa')),
  regra jsonb not null,
  bidirecional boolean not null default true,
  fonte text,
  observacao text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint alimentos_diferentes check (origem_alimento_id <> destino_alimento_id),
  unique (origem_alimento_id, destino_alimento_id)
);

create index if not exists equivalencias_origem_idx on equivalencias (origem_alimento_id);
create index if not exists equivalencias_destino_idx on equivalencias (destino_alimento_id);

-- -----------------------------------------------------------------------------
-- Conteúdo editorial (guias e comer fora)
-- -----------------------------------------------------------------------------

-- Uma tabela para os dois, porque a diferença está na forma do `corpo` e não
-- no ciclo de vida: os dois são escritos, publicados, marcados com nível de
-- acesso e buscados do mesmo jeito. Separar em duas tabelas (e mais duas de
-- categoria e tag, para uma dúzia de linhas) seria estrutura a mais sem
-- ganho nenhum.
--
-- corpo de um guia:       {"secoes":[{"id","titulo","paragrafos":[],"itens":[]}]}
-- corpo de comer fora:    {"introducao","lembretes":[],"decisoes":[{"id","titulo","pergunta","opcoes":[...]}]}
create table if not exists conteudos (
  id text primary key,
  tipo text not null check (tipo in ('guia', 'comer_fora')),
  titulo text not null,
  -- Agrupa na listagem: o tema do guia ("Digestão") ou nada, em comer fora.
  tema text,
  resumo text,
  icone text,
  ordem integer not null default 0,
  status text not null default 'rascunho' check (status in ('rascunho', 'publicado')),
  nivel_acesso text not null default 'paciente'
    check (nivel_acesso in ('publico', 'paciente', 'premium')),
  corpo jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  imagem_url text,
  -- §18 do briefing: a kcal fica guardada mesmo quando não é exibida.
  mostrar_kcal boolean not null default false,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists conteudos_tipo_idx on conteudos (tipo, ordem);
create index if not exists conteudos_tags_idx on conteudos using gin (tags);

-- -----------------------------------------------------------------------------
-- Dados do paciente e configuração do app
-- -----------------------------------------------------------------------------

create table if not exists favoritos (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references perfis (id) on delete cascade,
  tipo text not null,
  ref_id text not null,
  titulo text not null,
  subtitulo text,
  rota text not null,
  criado_em timestamptz not null default now(),
  unique (perfil_id, tipo, ref_id)
);

create index if not exists favoritos_perfil_idx on favoritos (perfil_id, criado_em desc);

-- Chave/valor para o que hoje seria constante no código: WhatsApp, nome da
-- Central, textos. Trocar o número da nutricionista tem que ser uma edição,
-- não uma caça pelo código inteiro.
create table if not exists configuracoes (
  chave text primary key,
  valor jsonb not null,
  descricao text,
  atualizado_em timestamptz not null default now()
);


-- ###########################################################################
-- 0002_funcoes.sql
-- ###########################################################################

-- =============================================================================
-- CENTRAL DO PACIENTE — 0002: funções, gatilhos e visões
--
-- Aqui mora a regra que o briefing chama de fundamental:
--
--   CONVITE ≠ ACESSO
--   acesso = conta autenticada + paciente vinculado + não suspenso
--            + hoje dentro do período
--
-- `tem_acesso()` é a única implementação dessa frase no sistema inteiro. As
-- políticas de 0003 chamam ela; o frontend chama `meu_acesso()`, que chama
-- ela. Não há uma segunda cópia da regra para sair de sincronia.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Auxiliares
-- -----------------------------------------------------------------------------

-- O dia de hoje no fuso de quem usa o app, não no fuso do servidor. Sem isso,
-- entre 21h e meia-noite o Brasil já estaria no "amanhã" do UTC e o acesso de
-- quem vence hoje cairia três horas antes da hora.
create or replace function hoje_sp()
returns date
language sql
stable
as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;

create or replace function config_inteiro(p_chave text, p_padrao integer)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select (valor #>> '{}')::integer from configuracoes where chave = p_chave), p_padrao);
$$;

-- `security definer` de propósito: a função precisa ler `perfis` sem passar
-- pela política de `perfis`, senão a política que chama esta função entraria
-- em recursão infinita.
create or replace function e_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from perfis where id = auth.uid() and papel = 'admin');
$$;

-- -----------------------------------------------------------------------------
-- Situação do paciente — derivada, nunca gravada
-- -----------------------------------------------------------------------------

-- "Expirado" não é um status que alguém escreve: é uma consequência da data.
-- Calcular na hora da pergunta significa que o acesso termina sozinho à
-- meia-noite, sem rotina diária, sem ninguém lembrar de rodar nada — e sem o
-- risco de um dia a rotina falhar e um plano vencido continuar aberto.
create or replace function situacao_paciente(
  p_status text,
  p_perfil_id uuid,
  p_data_inicio date,
  p_data_fim date
)
returns text
language sql
stable
as $$
  select case
    when p_perfil_id is null then 'convite_pendente'
    when p_status = 'suspenso' then 'suspenso'
    when hoje_sp() < p_data_inicio then 'nao_iniciado'
    when hoje_sp() > p_data_fim then 'expirado'
    when p_data_fim - hoje_sp() <= config_inteiro('alerta_vencimento_dias', 15)
      then 'proximo_do_vencimento'
    else 'ativo'
  end;
$$;

-- A frase do briefing, em SQL. Repare que ela não pergunta nada ao frontend:
-- mesmo que alguém chame a API direto, com um token válido de paciente
-- vencido, esta função devolve falso e as políticas não entregam linha
-- nenhuma.
create or replace function tem_acesso()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from pacientes p
    where p.perfil_id = auth.uid()
      and p.status = 'ativo'
      and hoje_sp() between p.data_inicio and p.data_fim
  );
$$;

-- `security_invoker = true` é obrigatório: sem isso a visão roda com os
-- poderes de quem a criou e entregaria a lista inteira de pacientes para
-- qualquer um que a consultasse, contornando a política da tabela.
create or replace view pacientes_visao
with (security_invoker = true)
as
select
  p.*,
  situacao_paciente(p.status, p.perfil_id, p.data_inicio, p.data_fim) as situacao,
  (p.data_fim - hoje_sp()) as dias_restantes,
  pl.nome as plano_nome,
  pl.duracao_dias as plano_duracao_dias,
  (select max(c.enviado_em) from convites c where c.paciente_id = p.id) as convite_enviado_em
from pacientes p
left join planos pl on pl.id = p.plano_id;

-- -----------------------------------------------------------------------------
-- Ciclo de vida da conta
-- -----------------------------------------------------------------------------

-- Criar conta cria PERFIL, não acesso. O vínculo com um paciente só acontece
-- se a nutricionista já tiver cadastrado aquele e-mail. Quem se cadastra sem
-- convite fica com uma conta autenticada e zero conteúdo — que é exatamente
-- o comportamento pedido.
create or replace function ao_criar_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into perfis (id, email, nome, papel)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'nome', ''), split_part(new.email, '@', 1)),
    'paciente'
  )
  on conflict (id) do nothing;

  update pacientes
     set perfil_id = new.id,
         status = case when status = 'convite_pendente' then 'ativo' else status end,
         atualizado_em = now()
   where email = new.email
     and perfil_id is null;

  update convites
     set aceito_em = now()
   where email = new.email
     and aceito_em is null;

  return new;
end;
$$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
after insert on auth.users
for each row execute function ao_criar_usuario();

-- O caminho inverso: a nutricionista cadastra alguém que já tinha conta.
--
-- E o caso que faltava: quando ela CORRIGE o e-mail de um paciente já
-- vinculado, a conta antiga precisa ser solta. Sem isso, o acesso continuaria
-- valendo para o endereço errado — que é justamente de quem ela quis tirar —
-- e o cadastro passaria a dizer uma coisa enquanto o banco fazia outra.
create or replace function vincular_paciente_ao_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil uuid;
  v_email_da_conta citext;
begin
  if tg_op = 'UPDATE' and new.perfil_id is not null and new.email is distinct from old.email then
    select email into v_email_da_conta from perfis where id = new.perfil_id;
    if v_email_da_conta is distinct from new.email then
      new.perfil_id := null;
      new.status := 'convite_pendente';
    end if;
  end if;

  if new.perfil_id is null then
    select id into v_perfil from perfis where email = new.email limit 1;
    if v_perfil is not null then
      new.perfil_id := v_perfil;
      if new.status = 'convite_pendente' then
        new.status := 'ativo';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists vincular_paciente on pacientes;
create trigger vincular_paciente
before insert or update of email, perfil_id on pacientes
for each row execute function vincular_paciente_ao_perfil();

-- -----------------------------------------------------------------------------
-- Trilha administrativa
-- -----------------------------------------------------------------------------

-- Gravar o histórico por gatilho, e não pela tela, garante que toda mudança
-- fique registrada — inclusive a feita direto no painel do Supabase.
create or replace function registrar_evento_paciente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_evento text;
  v_detalhe jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    v_evento := 'paciente_cadastrado';
    v_detalhe := jsonb_build_object('plano', new.plano_id, 'inicio', new.data_inicio, 'fim', new.data_fim);
  else
    if new.status is distinct from old.status then
      v_evento := case new.status
        when 'suspenso' then 'suspenso'
        when 'ativo' then case when old.status = 'suspenso' then 'reativado' else 'conta_ativada' end
        else 'status_alterado'
      end;
      v_detalhe := jsonb_build_object('de', old.status, 'para', new.status);
    elsif new.data_fim is distinct from old.data_fim or new.plano_id is distinct from old.plano_id then
      v_evento := 'renovado';
      v_detalhe := jsonb_build_object(
        'plano_anterior', old.plano_id, 'plano', new.plano_id,
        'fim_anterior', old.data_fim, 'fim', new.data_fim,
        'inicio_anterior', old.data_inicio, 'inicio', new.data_inicio
      );
    elsif new.perfil_id is distinct from old.perfil_id and new.perfil_id is not null then
      v_evento := 'conta_vinculada';
    else
      return new;
    end if;
  end if;

  insert into historico_admin (paciente_id, ator_perfil_id, evento, detalhe)
  values (new.id, auth.uid(), v_evento, v_detalhe);

  return new;
end;
$$;

drop trigger if exists registrar_evento on pacientes;
create trigger registrar_evento
after insert or update on pacientes
for each row execute function registrar_evento_paciente();

create or replace function tocar_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'perfis', 'planos', 'pacientes', 'grupos_alimentares',
    'alimentos', 'equivalencias', 'conteudos'
  ] loop
    execute format('drop trigger if exists tocar_atualizado on %I', t);
    execute format(
      'create trigger tocar_atualizado before update on %I for each row execute function tocar_atualizado_em()',
      t
    );
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- O que o app chama
-- -----------------------------------------------------------------------------

-- Uma chamada só, no carregamento: quem sou, o que posso ver, até quando.
-- Devolve sempre um objeto — nunca erro — para que a tela de "acesso
-- encerrado" seja um caminho normal do app e não um estado de falha.
create or replace function meu_acesso()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'autenticado', auth.uid() is not null,
    'perfilId', auth.uid(),
    'papel', coalesce((select papel from perfis where id = auth.uid()), 'paciente'),
    'nome', (select coalesce(pa.nome, pe.nome) from perfis pe
             left join pacientes pa on pa.perfil_id = pe.id where pe.id = auth.uid()),
    'email', (select email::text from perfis where id = auth.uid()),
    'temAcesso', tem_acesso() or e_admin(),
    'situacao', coalesce(
      (select situacao_paciente(p.status, p.perfil_id, p.data_inicio, p.data_fim)
         from pacientes p where p.perfil_id = auth.uid()),
      case when e_admin() then 'admin' else 'sem_cadastro' end
    ),
    'dataInicio', (select data_inicio from pacientes where perfil_id = auth.uid()),
    'dataFim', (select data_fim from pacientes where perfil_id = auth.uid()),
    'diasRestantes', (select data_fim - hoje_sp() from pacientes where perfil_id = auth.uid()),
    'plano', (select pl.nome from pacientes p join planos pl on pl.id = p.plano_id
               where p.perfil_id = auth.uid())
  );
$$;

-- O paciente não tem permissão de escrita na própria linha (senão poderia
-- esticar a própria data de fim). Marcar presença passa por aqui, que só
-- toca uma coluna.
create or replace function registrar_acesso()
returns void
language sql
security definer
set search_path = public
as $$
  update pacientes set ultimo_acesso = now() where perfil_id = auth.uid();
$$;


-- ###########################################################################
-- 0003_rls.sql
-- ###########################################################################

-- =============================================================================
-- CENTRAL DO PACIENTE — 0003: Row Level Security
--
-- O briefing é explícito (§34): esconder conteúdo no frontend não é
-- segurança. Um paciente vencido que abrir a URL antiga, ou que chamar a API
-- direto com o token dele, tem que receber vazio. É o que estas políticas
-- fazem — a decisão acontece no banco, antes de qualquer linha sair dele.
--
-- Duas funções decidem tudo:
--   e_admin()    — a conta é da nutricionista
--   tem_acesso() — paciente vinculado, não suspenso, dentro do período
-- =============================================================================

alter table perfis            enable row level security;
alter table planos            enable row level security;
alter table pacientes         enable row level security;
alter table convites          enable row level security;
alter table historico_admin   enable row level security;
alter table unidades          enable row level security;
alter table grupos_alimentares enable row level security;
alter table alimentos         enable row level security;
alter table equivalencias     enable row level security;
alter table conteudos         enable row level security;
alter table favoritos         enable row level security;
alter table configuracoes     enable row level security;

grant usage on schema public to anon, authenticated;
grant select on pacientes_visao to authenticated;

-- -----------------------------------------------------------------------------
-- Perfis
-- -----------------------------------------------------------------------------

drop policy if exists perfis_leitura on perfis;
create policy perfis_leitura on perfis
  for select using (id = auth.uid() or e_admin());

-- O paciente não escreve no próprio perfil: se pudesse, poderia trocar
-- `papel` para 'admin'. Nome e e-mail são mantidos pela nutricionista.
drop policy if exists perfis_admin_escreve on perfis;
create policy perfis_admin_escreve on perfis
  for all using (e_admin()) with check (e_admin());

-- -----------------------------------------------------------------------------
-- Planos
-- -----------------------------------------------------------------------------

drop policy if exists planos_leitura on planos;
create policy planos_leitura on planos
  for select to authenticated using (true);

drop policy if exists planos_admin on planos;
create policy planos_admin on planos
  for all using (e_admin()) with check (e_admin());

-- -----------------------------------------------------------------------------
-- Pacientes
-- -----------------------------------------------------------------------------

-- Cada paciente enxerga uma linha: a dele. Não existe política que devolva a
-- linha de outro paciente para quem não é admin.
drop policy if exists pacientes_leitura on pacientes;
create policy pacientes_leitura on pacientes
  for select using (perfil_id = auth.uid() or e_admin());

-- Escrita é só da nutricionista. É isto que impede o paciente de esticar a
-- própria `data_fim` ou de tirar a própria suspensão.
drop policy if exists pacientes_admin on pacientes;
create policy pacientes_admin on pacientes
  for all using (e_admin()) with check (e_admin());

-- -----------------------------------------------------------------------------
-- Convites e histórico — só administrativo
-- -----------------------------------------------------------------------------

drop policy if exists convites_admin on convites;
create policy convites_admin on convites
  for all using (e_admin()) with check (e_admin());

drop policy if exists historico_admin_politica on historico_admin;
create policy historico_admin_politica on historico_admin
  for all using (e_admin()) with check (e_admin());

-- -----------------------------------------------------------------------------
-- Vocabulário do catálogo
-- -----------------------------------------------------------------------------

-- Unidades e grupos são vocabulário ("Gramas", "Carboidratos"), não
-- conteúdo: qualquer conta autenticada lê, e isso não revela nada do
-- material da nutricionista.
drop policy if exists unidades_leitura on unidades;
create policy unidades_leitura on unidades for select to authenticated using (true);

drop policy if exists unidades_admin on unidades;
create policy unidades_admin on unidades for all using (e_admin()) with check (e_admin());

drop policy if exists grupos_leitura on grupos_alimentares;
create policy grupos_leitura on grupos_alimentares for select to authenticated using (true);

drop policy if exists grupos_admin on grupos_alimentares;
create policy grupos_admin on grupos_alimentares for all using (e_admin()) with check (e_admin());

-- -----------------------------------------------------------------------------
-- Conteúdo protegido
-- -----------------------------------------------------------------------------

-- A regra de acesso do briefing aplicada ao catálogo. Item inativo e item de
-- nível restrito só saem para quem tem acesso válido; a nutricionista vê
-- tudo, inclusive rascunho e desativado, porque é ela quem edita.
drop policy if exists alimentos_leitura on alimentos;
create policy alimentos_leitura on alimentos
  for select using (
    e_admin()
    or (ativo and (nivel_acesso = 'publico' or tem_acesso()))
  );

drop policy if exists alimentos_admin on alimentos;
create policy alimentos_admin on alimentos for all using (e_admin()) with check (e_admin());

drop policy if exists equivalencias_leitura on equivalencias;
create policy equivalencias_leitura on equivalencias
  for select using (e_admin() or (ativo and tem_acesso()));

drop policy if exists equivalencias_admin on equivalencias;
create policy equivalencias_admin on equivalencias for all using (e_admin()) with check (e_admin());

drop policy if exists conteudos_leitura on conteudos;
create policy conteudos_leitura on conteudos
  for select using (
    e_admin()
    or (
      ativo
      and status = 'publicado'
      and (nivel_acesso = 'publico' or tem_acesso())
    )
  );

drop policy if exists conteudos_admin on conteudos;
create policy conteudos_admin on conteudos for all using (e_admin()) with check (e_admin());

-- -----------------------------------------------------------------------------
-- Favoritos
-- -----------------------------------------------------------------------------

drop policy if exists favoritos_leitura on favoritos;
create policy favoritos_leitura on favoritos
  for select using (perfil_id = auth.uid());

-- Salvar exige acesso válido: não dá para guardar o que não se pode ver.
-- Ler o que já foi salvo continua permitido mesmo depois de vencer, porque
-- é dado do próprio paciente — mas a tela do conteúdo em si não abre.
drop policy if exists favoritos_insercao on favoritos;
create policy favoritos_insercao on favoritos
  for insert with check (perfil_id = auth.uid() and tem_acesso());

drop policy if exists favoritos_remocao on favoritos;
create policy favoritos_remocao on favoritos
  for delete using (perfil_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Configurações
-- -----------------------------------------------------------------------------

-- O WhatsApp e o nome da Central precisam aparecer até na tela de "acesso
-- encerrado", que é justamente onde o paciente vai querer falar com a
-- nutricionista. Por isso a leitura é aberta a qualquer autenticado.
drop policy if exists configuracoes_leitura on configuracoes;
create policy configuracoes_leitura on configuracoes for select to authenticated using (true);

drop policy if exists configuracoes_admin on configuracoes;
create policy configuracoes_admin on configuracoes for all using (e_admin()) with check (e_admin());


-- ###########################################################################
-- 0004_dados_iniciais.sql
-- ###########################################################################

-- =============================================================================
-- CENTRAL DO PACIENTE — 0004: dados iniciais
--
-- ARQUIVO GERADO. Não edite à mão: ele sai de src/central/dados/sementes/
-- pelo comando `npm run seed`. Editar aqui faz o banco e o modo local do app
-- discordarem na primeira vez que alguém rodar o gerador de novo.
--
-- Tudo é `on conflict do nothing`: rodar duas vezes não duplica nem apaga o
-- que você já tiver cadastrado pelo painel.
-- =============================================================================

-- Planos ----------------------------------------------------------------------
insert into planos (id, nome, duracao_dias, descricao, ordem, ativo) values ('mensal', 'Mensal', 30, 'Acesso por 30 dias.', 1, true) on conflict (id) do nothing;
insert into planos (id, nome, duracao_dias, descricao, ordem, ativo) values ('trimestral', 'Trimestral', 90, 'Acesso por 90 dias.', 2, true) on conflict (id) do nothing;
insert into planos (id, nome, duracao_dias, descricao, ordem, ativo) values ('semestral', 'Semestral', 180, 'Acesso por 180 dias.', 3, true) on conflict (id) do nothing;
insert into planos (id, nome, duracao_dias, descricao, ordem, ativo) values ('anual', 'Anual', 365, 'Acesso por 365 dias.', 4, true) on conflict (id) do nothing;

-- Unidades --------------------------------------------------------------------
insert into unidades (id, rotulo, abreviacao, singular, continua, ordem) values ('g', 'Gramas', 'g', 'g', true, 0) on conflict (id) do nothing;
insert into unidades (id, rotulo, abreviacao, singular, continua, ordem) values ('ml', 'Mililitros', 'ml', 'ml', true, 1) on conflict (id) do nothing;
insert into unidades (id, rotulo, abreviacao, singular, continua, ordem) values ('unidade', 'Unidades', 'un', 'unidade', false, 2) on conflict (id) do nothing;
insert into unidades (id, rotulo, abreviacao, singular, continua, ordem) values ('fatia', 'Fatias', 'fatias', 'fatia', false, 3) on conflict (id) do nothing;
insert into unidades (id, rotulo, abreviacao, singular, continua, ordem) values ('colher-sopa', 'Colheres de sopa', 'col. sopa', 'colher de sopa', false, 4) on conflict (id) do nothing;
insert into unidades (id, rotulo, abreviacao, singular, continua, ordem) values ('colher-cha', 'Colheres de chá', 'col. chá', 'colher de chá', false, 5) on conflict (id) do nothing;
insert into unidades (id, rotulo, abreviacao, singular, continua, ordem) values ('xicara', 'Xícaras', 'xíc.', 'xícara', false, 6) on conflict (id) do nothing;
insert into unidades (id, rotulo, abreviacao, singular, continua, ordem) values ('concha', 'Conchas', 'conchas', 'concha', false, 7) on conflict (id) do nothing;

-- Grupos alimentares ----------------------------------------------------------
insert into grupos_alimentares (id, nome, descricao, ordem, regra, troca_por_porcao, troca_para_grupos, tags) values ('carboidratos', 'Carboidratos', 'Arroz, massas, tubérculos, pães e raízes.', 1, '{"tipo":"porcoes"}'::jsonb, true, array['frutas']::text[], array['carboidrato', 'massa', 'arroz', 'pao', 'tuberculo']::text[]) on conflict (id) do nothing;
insert into grupos_alimentares (id, nome, descricao, ordem, regra, troca_por_porcao, troca_para_grupos, tags) values ('proteinas', 'Proteínas', 'Carnes, ovos, peixes e outras fontes proteicas.', 2, '{"tipo":"porcoes"}'::jsonb, true, '{}'::text[], array['proteina', 'carne', 'ovo', 'peixe', 'frango']::text[]) on conflict (id) do nothing;
insert into grupos_alimentares (id, nome, descricao, ordem, regra, troca_por_porcao, troca_para_grupos, tags) values ('gorduras', 'Gorduras', 'Azeites, oleaginosas, abacate e similares.', 3, '{"tipo":"porcoes"}'::jsonb, true, '{}'::text[], array['gordura', 'azeite', 'castanha', 'abacate']::text[]) on conflict (id) do nothing;
insert into grupos_alimentares (id, nome, descricao, ordem, regra, troca_por_porcao, troca_para_grupos, tags) values ('frutas', 'Frutas', 'Frutas in natura e suas porções.', 4, '{"tipo":"porcoes"}'::jsonb, true, '{}'::text[], array['fruta']::text[]) on conflict (id) do nothing;
insert into grupos_alimentares (id, nome, descricao, ordem, regra, troca_por_porcao, troca_para_grupos, tags) values ('vegetais-livres', 'Vegetais livres', 'Quantidade livre, respeitando a porção mínima das refeições principais.', 5, '{"tipo":"livre","minimos":[{"refeicao":"Almoço","medida":{"quantidade":150,"unidadeId":"g"}},{"refeicao":"Jantar","medida":{"quantidade":150,"unidadeId":"g"}}],"texto":"Quantidade livre. No almoço e no jantar, a porção mínima é de 150 g."}'::jsonb, false, '{}'::text[], array['vegetal', 'legume', 'verdura', 'salada', 'livre']::text[]) on conflict (id) do nothing;
insert into grupos_alimentares (id, nome, descricao, ordem, regra, troca_por_porcao, troca_para_grupos, tags) values ('outros', 'Outros', 'Itens que não se encaixam nos grupos acima.', 6, null, false, '{}'::text[], array['outros']::text[]) on conflict (id) do nothing;

-- Alimentos -------------------------------------------------------------------
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('achocolatado-em-po', 'Achocolatado em pó', 'carboidratos', 'g', 30, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('achocolatado-em-po-light-ou-com-maior-teor-de', 'Achocolatado em pó light ou com maior teor de cacau', 'carboidratos', 'g', 35, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('abobora-crua', 'Abóbora crua', 'carboidratos', 'g', 320, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('abobora-cozida', 'Abóbora cozida', 'carboidratos', 'g', 260, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('amaranto', 'Amaranto', 'carboidratos', 'g', 120, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('arroz-cozido', 'Arroz integral ou branco cozido', 'carboidratos', 'g', 100, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('arroz-integral-ou-branco-cru', 'Arroz integral ou branco cru', 'carboidratos', 'g', 35, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('aveia-em-flocos', 'Aveia em flocos', 'carboidratos', 'g', 30, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Pode fermentar e causar desconforto gástrico.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('aveia-em-farelo-ou-farinha', 'Aveia em farelo ou farinha', 'carboidratos', 'g', 50, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Pode fermentar e causar desconforto gástrico.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('batata-baroa-ou-mandioquinha-cozida', 'Batata baroa ou mandioquinha cozida', 'carboidratos', 'g', 150, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('batata-doce-crua', 'Batata doce crua', 'carboidratos', 'g', 105, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Pode fermentar e causar desconforto gástrico.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('batata-doce-cozida', 'Batata doce cozida', 'carboidratos', 'g', 160, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Pode fermentar e causar desconforto gástrico.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('batata-cozida', 'Batata inglesa cozida ou crua', 'carboidratos', 'g', 145, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('biscoito-de-arroz', 'Biscoito de arroz', 'carboidratos', 'g', 30, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('biscoito-de-maizena', 'Biscoito de maizena', 'carboidratos', 'g', 25, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('biscoito-de-polvilho', 'Biscoito de polvilho', 'carboidratos', 'g', 30, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('bolo-ou-broa', 'Bolo ou broa', 'carboidratos', 'g', 50, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Sem calda e sem recheio.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('cara-cozido', 'Cará cozido', 'carboidratos', 'g', 160, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('caldo-de-cana', 'Caldo de cana', 'carboidratos', 'g', 160, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('cereal-matinal', 'Cereal matinal', 'carboidratos', 'g', 30, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('chocolate-ao-leite', 'Chocolate ao leite', 'carboidratos', 'g', 20, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('chocolate-branco', 'Chocolate branco', 'carboidratos', 'g', 20, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('creme-de-arroz-em-po', 'Creme de arroz em pó', 'carboidratos', 'g', 30, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('cuscuz-cru', 'Cuscuz cru', 'carboidratos', 'g', 35, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Mesmo valor do floco de milho.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('cuscuz-marroquino', 'Cuscuz marroquino', 'carboidratos', 'g', 35, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Mesmo valor da semolina.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('doce-de-leite', 'Doce de leite', 'carboidratos', 'g', 35, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Prefira a versão com o mínimo de ingredientes possível.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('edamame', 'Edamame', 'carboidratos', 'g', 100, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Pode fermentar e causar desconforto gástrico.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('ervilha-cozida', 'Ervilha cozida', 'carboidratos', 'g', 150, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('farinha-de-arroz', 'Farinha de arroz', 'carboidratos', 'g', 30, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Pode fermentar e causar desconforto gástrico.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('farinha-de-batata-doce', 'Farinha de batata doce', 'carboidratos', 'g', 40, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Pode fermentar e causar desconforto gástrico.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('farinha-de-grao-de-bico', 'Farinha de grão-de-bico', 'carboidratos', 'g', 50, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Pode fermentar e causar desconforto gástrico.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('farinha-de-mandioca', 'Farinha de mandioca', 'carboidratos', 'g', 35, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('farinha-de-milho', 'Farinha de milho', 'carboidratos', 'g', 35, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('farinha-panko', 'Farinha panko', 'carboidratos', 'g', 40, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('farinha-de-teff', 'Farinha de teff', 'carboidratos', 'g', 35, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('feijao-cozido', 'Feijão cozido', 'carboidratos', 'g', 160, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Pode fermentar e causar desconforto gástrico.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('flocos-de-arroz', 'Flocos de arroz', 'carboidratos', 'g', 35, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('folha-ou-papel-de-arroz', 'Folha ou papel de arroz', 'carboidratos', 'g', 35, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('fuba', 'Fubá', 'carboidratos', 'g', 35, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('grao-de-bico-cozido', 'Grão-de-bico cozido', 'carboidratos', 'g', 75, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Pode fermentar e causar desconforto gástrico.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('goiabada-ou-qualquer-outro-doce-de-fruta', 'Goiabada ou qualquer outro doce de fruta', 'carboidratos', 'g', 50, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Prefira a versão com o mínimo de ingredientes possível.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('granola-sem-acucar', 'Granola sem açúcar', 'carboidratos', 'g', 30, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('inhame-cozido', 'Inhame cozido', 'carboidratos', 'g', 90, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('lentilha-cozida', 'Lentilha cozida', 'carboidratos', 'g', 130, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Pode fermentar e causar desconforto gástrico.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('leite-condensado', 'Leite condensado', 'carboidratos', 'g', 40, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('leite-condensado-light', 'Leite condensado light', 'carboidratos', 'g', 45, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('leite-de-arroz', 'Leite de arroz', 'carboidratos', 'g', 260, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Mínimo de ingredientes possível e sem açúcar.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('leite-de-aveia', 'Leite de aveia', 'carboidratos', 'g', 300, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Mínimo de ingredientes possível e sem açúcar.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('leite-de-soja', 'Leite de soja', 'carboidratos', 'g', 230, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('mandioca-cozida', 'Mandioca cozida', 'carboidratos', 'g', 100, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('macarrao-bifun', 'Macarrão bifun', 'carboidratos', 'g', 35, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('macarrao-cozido', 'Macarrão com ou sem glúten cozido', 'carboidratos', 'g', 80, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('mel', 'Mel', 'carboidratos', 'g', 30, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('melado', 'Melado', 'carboidratos', 'g', 30, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('milho-cozido', 'Milho cozido', 'carboidratos', 'g', 100, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('milho-cru', 'Milho cru', 'carboidratos', 'g', 90, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('nutella', 'Nutella', 'carboidratos', 'g', 20, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('nescau-60-menos-acucar', 'Nescau 60% menos açúcar', 'carboidratos', 'g', 40, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('pao', 'Pão com ou sem glúten', 'carboidratos', 'g', 50, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Prefira a versão com o mínimo de ingredientes possível.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('pudim', 'Pudim', 'carboidratos', 'g', 55, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('puff-de-trigo', 'Puff de trigo', 'carboidratos', 'g', 35, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('polvilho-azedo-ou-doce', 'Polvilho azedo ou doce', 'carboidratos', 'g', 35, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('wrap-com-ou-sem-gluten', 'Wrap com ou sem glúten', 'carboidratos', 'g', 50, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Prefira a versão com o mínimo de ingredientes possível.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('suco-integral-sem-acucar', 'Suco integral sem açúcar', 'carboidratos', 'g', 260, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Mínimo de ingredientes possível e sem açúcar.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('soja-em-graos-cozida', 'Soja em grãos cozida', 'carboidratos', 'g', 70, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Pode fermentar e causar desconforto gástrico.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('quinoa-cozida', 'Quinoa cozida', 'carboidratos', 'g', 100, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Pode fermentar e causar desconforto gástrico.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('tapioca', 'Tapioca', 'carboidratos', 'g', 45, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('acem', 'Acém', 'proteinas', 'g', 70, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('atum-cozido-em-lata-ou-grelhado', 'Atum cozido em lata ou grelhado', 'proteinas', 'g', 110, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('atum-cru', 'Atum cru', 'proteinas', 'g', 100, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('camarao-e-outros-frutos-do-mar', 'Camarão e outros frutos do mar', 'proteinas', 'g', 160, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('clara-de-ovo', 'Clara de ovo', 'proteinas', 'unidade', 9, 'unidade', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('clara-de-ovo-de-codorna', 'Clara de ovo de codorna', 'proteinas', 'unidade', 27, 'unidade', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('claras-pasteurizadas', 'Claras pasteurizadas', 'proteinas', 'g', 330, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Prefira a versão com o mínimo de ingredientes possível.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('creme-de-ricota-light-com-ou-sem-lactose', 'Creme de ricota light com ou sem lactose', 'proteinas', 'g', 100, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Prefira a versão com o mínimo de ingredientes possível.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('coalhada-desnatada-com-ou-sem-lactose', 'Coalhada desnatada com ou sem lactose', 'proteinas', 'g', 250, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Mínimo de ingredientes possível, sem açúcar e sem sabor. Adoçantes naturais: stevia, taumatina, eritritol. Evitar sucralose, acessulfame K, aspartame, acessulfame de potássio, ciclamato e xilitol.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('coracao-de-galinha', 'Coração de galinha', 'proteinas', 'g', 90, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('coxao-duro', 'Coxão duro', 'proteinas', 'g', 70, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('cupim', 'Cupim', 'proteinas', 'g', 70, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('frango-coxa-e-sobrecoxa-desossada', 'Frango coxa e sobrecoxa desossada', 'proteinas', 'g', 60, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('frango-peito', 'Frango peito', 'proteinas', 'g', 100, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('fraldinha', 'Fraldinha', 'proteinas', 'g', 60, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('figado', 'Fígado', 'proteinas', 'g', 75, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('file-mignon', 'Filé mignon', 'proteinas', 'g', 70, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('iogurte-desnatado-de-2-ingredientes-ou-0-de', 'Iogurte desnatado de 2 ingredientes ou 0% de gordura com ou sem lactose', 'proteinas', 'g', 250, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Mínimo de ingredientes possível, sem açúcar e sem sabor. Adoçantes naturais: stevia, taumatina, eritritol. Evitar sucralose, acessulfame K, aspartame, acessulfame de potássio, ciclamato e xilitol.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('kefir-desnatado-com-ou-sem-lactose', 'Kefir desnatado com ou sem lactose', 'proteinas', 'g', 430, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Mínimo de ingredientes possível, sem açúcar e sem sabor. Adoçantes naturais: stevia, taumatina, eritritol. Evitar sucralose, acessulfame K, aspartame, acessulfame de potássio, ciclamato e xilitol.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('musculo-bovino', 'Músculo bovino', 'proteinas', 'g', 80, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('patinho', 'Patinho', 'proteinas', 'g', 70, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('peixe-branco', 'Peixe branco', 'proteinas', 'g', 140, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('peru', 'Peru', 'proteinas', 'g', 100, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('picanha', 'Picanha', 'proteinas', 'g', 70, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('proteina-texturizada-da-soja-organica-pts', 'Proteína texturizada da soja orgânica (PTS) crua ou hidratada', 'proteinas', 'g', 60, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('proteina-em-po-albumina-beef-protein-clara-de', 'Proteína em pó (albumina, beef protein, clara de ovo em pó, colágeno, proteína vegetal, whey)', 'proteinas', 'g', 40, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Mínimo de ingredientes possível, sem açúcar e sem sabor. Adoçantes naturais: stevia, taumatina, eritritol. Evitar sucralose, acessulfame K, aspartame, acessulfame de potássio, ciclamato e xilitol.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('polenghi-light-com-ou-sem-lactose', 'Polenghi light com ou sem lactose', 'proteinas', 'g', 90, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('polenghi-frescatino-ultrafiltrado-com-ou-sem', 'Polenghi Frescatino ultrafiltrado com ou sem lactose', 'proteinas', 'g', 70, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('polenghi-frescatino-ultrafiltrado-light-com', 'Polenghi Frescatino ultrafiltrado light com ou sem lactose', 'proteinas', 'g', 100, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('polenghi-queijo-frescal-ultrafiltrado-light', 'Polenghi queijo frescal ultrafiltrado light com ou sem lactose', 'proteinas', 'g', 100, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('queijo-cottage-de-vaca-ou-de-bufala-com-ou', 'Queijo cottage de vaca ou de búfala com ou sem lactose', 'proteinas', 'g', 150, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('queijo-ricota-fresca-com-12-de-gordura-ou', 'Queijo ricota fresca com 12% de gordura ou menos com ou sem lactose', 'proteinas', 'g', 100, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('queijo-minas-frescal-light-com-ou-sem-lactose', 'Queijo minas frescal light com ou sem lactose', 'proteinas', 'g', 85, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('queijo-parmesao-light-com-ou-sem-lactose', 'Queijo parmesão light com ou sem lactose', 'proteinas', 'g', 50, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('queijo-de-soro-de-leite-com-ou-sem-lactose', 'Queijo de soro de leite com ou sem lactose', 'proteinas', 'g', 75, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('queijo-quark-light-com-ou-sem-lactose', 'Queijo quark light com ou sem lactose', 'proteinas', 'g', 95, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('salmao', 'Salmão', 'proteinas', 'g', 60, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('salmao-cru', 'Salmão cru', 'proteinas', 'g', 85, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('sardinha-em-lata', 'Sardinha em lata', 'proteinas', 'g', 80, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('suino-lombo', 'Suíno lombo', 'proteinas', 'g', 70, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('suino-file-mignon', 'Suíno filé mignon', 'proteinas', 'g', 100, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('suino-pernil', 'Suíno pernil', 'proteinas', 'g', 55, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('tempeh-organico', 'Tempeh orgânico', 'proteinas', 'g', 75, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('tofu-organico', 'Tofu orgânico', 'proteinas', 'g', 200, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('abacate-ou-avocado', 'Abacate ou avocado', 'gorduras', 'g', 60, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Pode fermentar e causar desconforto gástrico.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('amendoas', 'Amêndoas', 'gorduras', 'g', 15, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('amendoim-cru', 'Amendoim cru', 'gorduras', 'g', 15, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Pode fermentar e causar desconforto gástrico.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('avela', 'Avelã', 'gorduras', 'g', 13, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('azeite', 'Azeite', 'gorduras', 'g', 10, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('azeitona', 'Azeitona', 'gorduras', 'g', 75, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('cafes-termogenicos', 'Cafés termogênicos', 'gorduras', 'g', 20, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('castanhas', 'Castanhas', 'gorduras', 'g', 15, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('chocolate-60-ou-mais', 'Chocolate 60% ou mais', 'gorduras', 'g', 15, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('coalhada-com-ou-sem-lactose', 'Coalhada com ou sem lactose', 'gorduras', 'g', 90, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Mínimo de ingredientes possível, sem açúcar e sem sabor. Adoçantes naturais: stevia, taumatina, eritritol. Evitar sucralose, acessulfame K, aspartame, acessulfame de potássio, ciclamato e xilitol.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('coco-em-lascas-ou-desidratado', 'Coco em lascas ou desidratado', 'gorduras', 'g', 15, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('coco-em-pedacos', 'Coco em pedaços', 'gorduras', 'g', 25, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'O da casca marrom.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('creme-de-castanha-de-caju', 'Creme de castanha de caju', 'gorduras', 'g', 30, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Prefira a versão com o mínimo de ingredientes possível.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('creme-de-leite-com-ou-sem-lactose', 'Creme de leite com ou sem lactose', 'gorduras', 'g', 30, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Melhor opção: o fresco, em garrafinha ou latinha.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('creme-de-ricota-original-com-ou-sem-lactose', 'Creme de ricota original com ou sem lactose', 'gorduras', 'g', 45, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Prefira a versão com o mínimo de ingredientes possível.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('creme-de-queijo-minas-frescal-com-ou-sem', 'Creme de queijo minas frescal com ou sem lactose', 'gorduras', 'g', 30, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Prefira a versão com o mínimo de ingredientes possível.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('creme-de-queijo-minas-frescal-light-com-ou', 'Creme de queijo minas frescal light com ou sem lactose', 'gorduras', 'g', 45, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Prefira a versão com o mínimo de ingredientes possível.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('cream-cheese-com-ou-sem-lactose', 'Cream cheese com ou sem lactose', 'gorduras', 'g', 30, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Prefira a versão com o mínimo de ingredientes possível.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('cream-cheese-light-com-ou-sem-lactose', 'Cream cheese light com ou sem lactose', 'gorduras', 'g', 40, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Prefira a versão com o mínimo de ingredientes possível.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('farinha-de-amendoas', 'Farinha de amêndoas', 'gorduras', 'g', 15, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('farinha-de-coco', 'Farinha de coco', 'gorduras', 'g', 15, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('farinha-de-linhaca', 'Farinha de linhaça', 'gorduras', 'g', 15, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('gema-ou-ovo-inteiro', 'Gema ou ovo inteiro', 'gorduras', 'unidade', 1, 'unidade', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('iogurte-de-2-ou-3-ingredientes-com-ou-sem', 'Iogurte de 2 ou 3 ingredientes com ou sem lactose', 'gorduras', 'g', 140, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Mínimo de ingredientes possível, sem açúcar e sem sabor. Adoçantes naturais: stevia, taumatina, eritritol. Evitar sucralose, acessulfame K, aspartame, acessulfame de potássio, ciclamato e xilitol.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('kefir-integral-com-ou-sem-lactose', 'Kefir integral com ou sem lactose', 'gorduras', 'g', 135, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Mínimo de ingredientes possível, sem açúcar e sem sabor. Adoçantes naturais: stevia, taumatina, eritritol. Evitar sucralose, acessulfame K, aspartame, acessulfame de potássio, ciclamato e xilitol.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('leite-integral-com-ou-sem-lactose', 'Leite integral com ou sem lactose', 'gorduras', 'ml', 130, 'ml', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('leite-desnatado-ou-semidesnatado-com-ou-sem', 'Leite desnatado ou semidesnatado com ou sem lactose', 'gorduras', 'ml', 260, 'ml', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('leite-em-po-com-ou-sem-lactose-ou-leite-de', 'Leite em pó com ou sem lactose ou leite de coco em pó', 'gorduras', 'g', 15, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Mínimo de ingredientes possível e sem açúcar.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('leite-em-po-desnatado-com-ou-sem-lactose', 'Leite em pó desnatado com ou sem lactose', 'gorduras', 'g', 25, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Mínimo de ingredientes possível e sem açúcar.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('leite-vegetal-amendoas-coco-castanha-de-caju', 'Leite vegetal (amêndoas, coco, castanha de caju e outros)', 'gorduras', 'ml', 300, 'ml', false, '[]'::jsonb, null, null, '{}'::text[], 'Mínimo de ingredientes possível e sem açúcar.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('macadamia', 'Macadâmia', 'gorduras', 'g', 10, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('manteiga', 'Manteiga', 'gorduras', 'g', 10, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('manteiga-de-bufala', 'Manteiga de búfala', 'gorduras', 'g', 10, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('manteiga-de-coco', 'Manteiga de coco', 'gorduras', 'g', 10, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('manteiga-ghee', 'Manteiga ghee', 'gorduras', 'g', 10, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('manteiga-vegana', 'Manteiga vegana', 'gorduras', 'g', 10, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('mct-ou-tcm', 'MCT ou TCM', 'gorduras', 'g', 10, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('nozes', 'Nozes', 'gorduras', 'g', 15, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('oleo-de-coco', 'Óleo de coco', 'gorduras', 'g', 10, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('ovo-de-codorna-inteiro', 'Ovo de codorna inteiro', 'gorduras', 'unidade', 5, 'unidade', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('pasta-de-amendoim-avela-amendoas-castanha-de', 'Pasta de amendoim, avelã, amêndoas, castanha de caju, macadâmia e outras', 'gorduras', 'g', 15, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Mínimo de ingredientes possível, sem açúcar e sem sabor. Adoçantes naturais: stevia, taumatina, eritritol. Evitar sucralose, acessulfame K, aspartame, acessulfame de potássio, ciclamato e xilitol.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('pacoca', 'Paçoca', 'gorduras', 'g', 15, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('pistache-torrado', 'Pistache torrado', 'gorduras', 'g', 15, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('polenguinho', 'Polenguinho', 'gorduras', 'g', 35, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('queijo-brie-ou-queijo-de-cabra-com-ou-sem', 'Queijo brie ou queijo de cabra com ou sem lactose', 'gorduras', 'g', 25, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('queijo-burrata-com-ou-sem-lactose', 'Queijo burrata com ou sem lactose', 'gorduras', 'g', 30, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('queijo-coalho-normal-ou-light-com-ou-sem', 'Queijo coalho, normal ou light, com ou sem lactose', 'gorduras', 'g', 25, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('queijo-canastra-com-ou-sem-lactose', 'Queijo canastra com ou sem lactose', 'gorduras', 'g', 20, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('queijo-curado-com-ou-sem-lactose', 'Queijo curado com ou sem lactose', 'gorduras', 'g', 20, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('queijo-gorgonzola-com-ou-sem-lactose', 'Queijo gorgonzola com ou sem lactose', 'gorduras', 'g', 25, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('queijo-meia-cura-com-ou-sem-lactose', 'Queijo meia cura com ou sem lactose', 'gorduras', 'g', 25, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('queijo-minas-frescal-com-ou-sem-lactose', 'Queijo minas frescal com ou sem lactose', 'gorduras', 'g', 35, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('queijo-minas-padrao-com-ou-sem-lactose', 'Queijo minas padrão com ou sem lactose', 'gorduras', 'g', 30, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('queijo-mussarela-ou-de-bufala-normal-ou-light', 'Queijo mussarela ou de búfala, normal ou light, com ou sem lactose', 'gorduras', 'g', 30, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('queijo-parmesao-com-ou-sem-lactose', 'Queijo parmesão com ou sem lactose', 'gorduras', 'g', 20, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('queijo-prato-com-ou-sem-lactose', 'Queijo prato com ou sem lactose', 'gorduras', 'g', 20, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('queijo-ricota-fresca-com-mais-de-12-de', 'Queijo ricota fresca com mais de 12% de gordura com ou sem lactose', 'gorduras', 'g', 60, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('requeijao-com-ou-sem-lactose', 'Requeijão com ou sem lactose', 'gorduras', 'g', 35, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Prefira a versão com o mínimo de ingredientes possível.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('requeijao-light-com-ou-sem-lactose', 'Requeijão light com ou sem lactose', 'gorduras', 'g', 50, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Prefira a versão com o mínimo de ingredientes possível.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('requeijao-vegano', 'Requeijão vegano', 'gorduras', 'g', 30, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Prefira a versão com o mínimo de ingredientes possível.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('sementes', 'Sementes', 'gorduras', 'g', 15, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Inclui chia e todos os tipos, sem exceção.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('tahine', 'Tahine', 'gorduras', 'g', 10, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Prefira a versão com o mínimo de ingredientes possível.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('abacaxi', 'Abacaxi', 'frutas', 'g', 200, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('acai-polpa-pura-sem-acucar', 'Açaí polpa pura sem açúcar', 'frutas', 'g', 175, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Únicos ingredientes: polpa de açaí e água. Sem açúcar e sem sabor. Adoçantes naturais: stevia, taumatina, eritritol. Evitar sucralose, acessulfame K, aspartame, acessulfame de potássio, ciclamato e xilitol.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('acerola', 'Acerola', 'frutas', 'g', 310, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('agua-de-coco-in-natura', 'Água de coco in natura', 'frutas', 'ml', 500, 'ml', false, '[]'::jsonb, null, null, '{}'::text[], 'Pode fermentar e causar desconforto gástrico.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('ameixa', 'Ameixa', 'frutas', 'g', 210, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('ameixa-seca', 'Ameixa seca', 'frutas', 'g', 40, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Mínimo de ingredientes possível e sem açúcar. Pode fermentar e causar desconforto gástrico.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('amora', 'Amora', 'frutas', 'g', 230, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('atemoia', 'Atemóia', 'frutas', 'g', 100, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('banana-da-terra', 'Banana da terra', 'frutas', 'g', 80, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('banana', 'Banana', 'frutas', 'g', 90, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('banana-chips', 'Banana chips', 'frutas', 'g', 20, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Mínimo de ingredientes possível e sem açúcar.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('blueberry-ou-mirtilo', 'Blueberry ou mirtilo', 'frutas', 'g', 175, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('caja-manga', 'Cajá-manga', 'frutas', 'g', 220, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('caju', 'Caju', 'frutas', 'g', 230, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('caqui', 'Caqui', 'frutas', 'g', 80, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('carambola', 'Carambola', 'frutas', 'g', 320, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('cereja', 'Cereja', 'frutas', 'g', 200, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('ciriguela', 'Ciriguela', 'frutas', 'g', 125, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('cranberry', 'Cranberry', 'frutas', 'g', 30, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('cupuacu', 'Cupuaçu', 'frutas', 'g', 200, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('damasco-seco', 'Damasco seco', 'frutas', 'g', 40, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Mínimo de ingredientes possível e sem açúcar. Pode fermentar e causar desconforto gástrico.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('figo', 'Figo', 'frutas', 'g', 135, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('figo-seco', 'Figo seco', 'frutas', 'g', 40, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Mínimo de ingredientes possível e sem açúcar. Pode fermentar e causar desconforto gástrico.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('framboesa', 'Framboesa', 'frutas', 'g', 180, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('geleia-100-fruta', 'Geleia 100% fruta', 'frutas', 'g', 55, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Mínimo de ingredientes possível, sem açúcar e sem sabor. Adoçantes naturais: stevia, taumatina, eritritol. Evitar sucralose, acessulfame K, aspartame, acessulfame de potássio, ciclamato e xilitol.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('goiaba', 'Goiaba', 'frutas', 'g', 150, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('graviola', 'Graviola', 'frutas', 'g', 150, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('jabuticaba', 'Jabuticaba', 'frutas', 'g', 170, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('jaca', 'Jaca', 'frutas', 'g', 105, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('jambo', 'Jambo', 'frutas', 'g', 200, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('kiwi', 'Kiwi', 'frutas', 'g', 160, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('laranja', 'Laranja', 'frutas', 'g', 210, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('lichia', 'Lichia', 'frutas', 'g', 140, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('limao', 'Limão', 'frutas', 'g', null, null, true, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('maca', 'Maçã', 'frutas', 'g', 190, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('mamao', 'Mamão', 'frutas', 'g', 230, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('manga', 'Manga', 'frutas', 'g', 160, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('maracuja', 'Maracujá', 'frutas', 'g', 140, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('melancia', 'Melancia', 'frutas', 'g', 330, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('melao', 'Melão', 'frutas', 'g', 340, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('mexerica-ou-tangerina', 'Mexerica ou tangerina', 'frutas', 'g', 200, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('morango', 'Morango', 'frutas', 'g', 300, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('nespera', 'Nêspera', 'frutas', 'g', 210, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('pera', 'Pêra', 'frutas', 'g', 175, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('pessego', 'Pêssego', 'frutas', 'g', 250, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('pinha-ou-fruta-do-conde', 'Pinha ou fruta do conde', 'frutas', 'g', 125, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('pitanga', 'Pitanga', 'frutas', 'g', 300, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('pitaya', 'Pitaya', 'frutas', 'g', 165, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('roma', 'Romã', 'frutas', 'g', 200, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('tamarindo', 'Tamarindo', 'frutas', 'g', 30, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('tamara-seca', 'Tâmara seca', 'frutas', 'g', 35, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Mínimo de ingredientes possível e sem açúcar. Pode fermentar e causar desconforto gástrico.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('tucuma', 'Tucumã', 'frutas', 'g', 35, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('uva-verde-ou-roxa-sem-caroco', 'Uva verde ou roxa sem caroço', 'frutas', 'g', 180, 'g', false, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('uva-passas', 'Uva passas', 'frutas', 'g', 30, 'g', false, '[]'::jsonb, null, null, '{}'::text[], 'Mínimo de ingredientes possível e sem açúcar. Pode fermentar e causar desconforto gástrico.') on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('abobrinha', 'Abobrinha', 'vegetais-livres', 'g', null, null, true, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('aspargos', 'Aspargos', 'vegetais-livres', 'g', null, null, true, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('alho', 'Alho', 'vegetais-livres', 'g', null, null, true, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('alho-poro', 'Alho-poró', 'vegetais-livres', 'g', null, null, true, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('berinjela', 'Berinjela', 'vegetais-livres', 'g', null, null, true, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('beterraba', 'Beterraba', 'vegetais-livres', 'g', null, null, true, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('brocolis', 'Brócolis', 'vegetais-livres', 'g', null, null, true, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('cebola', 'Cebola', 'vegetais-livres', 'g', null, null, true, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('cenoura', 'Cenoura', 'vegetais-livres', 'g', null, null, true, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('chuchu', 'Chuchu', 'vegetais-livres', 'g', null, null, true, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('cogumelos', 'Cogumelos', 'vegetais-livres', 'g', null, null, true, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('couve-flor', 'Couve-flor', 'vegetais-livres', 'g', null, null, true, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('couve-de-bruxelas', 'Couve-de-bruxelas', 'vegetais-livres', 'g', null, null, true, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('ervilha-torta', 'Ervilha-torta', 'vegetais-livres', 'g', null, null, true, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('jilo', 'Jiló', 'vegetais-livres', 'g', null, null, true, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('maxixe', 'Maxixe', 'vegetais-livres', 'g', null, null, true, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('nabo', 'Nabo', 'vegetais-livres', 'g', null, null, true, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('palmito', 'Palmito', 'vegetais-livres', 'g', null, null, true, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('pimentao', 'Pimentão', 'vegetais-livres', 'g', null, null, true, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('pepino', 'Pepino', 'vegetais-livres', 'g', null, null, true, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('repolho', 'Repolho', 'vegetais-livres', 'g', null, null, true, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('quiabo', 'Quiabo', 'vegetais-livres', 'g', null, null, true, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('rabanete', 'Rabanete', 'vegetais-livres', 'g', null, null, true, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('tomate', 'Tomate', 'vegetais-livres', 'g', null, null, true, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('tomatinho', 'Tomatinho', 'vegetais-livres', 'g', null, null, true, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('vagem', 'Vagem', 'vegetais-livres', 'g', null, null, true, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;
insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values ('folhas-e-brotos', 'Folhas e brotos', 'vegetais-livres', 'g', null, null, true, '[]'::jsonb, null, null, '{}'::text[], null) on conflict (id) do nothing;

-- Equivalências ---------------------------------------------------------------
insert into equivalencias (id, origem_alimento_id, destino_alimento_id, tipo, regra, bidirecional, fonte, observacao) values ('arroz-para-macarrao', 'arroz-cozido', 'macarrao-cozido', 'proporcional', '{"tipo":"proporcional","de":{"quantidade":100,"unidadeId":"g"},"para":{"quantidade":80,"unidadeId":"g"}}'::jsonb, true, 'Lista de substituição', null) on conflict (id) do nothing;

-- Comer fora ------------------------------------------------------------------
insert into conteudos (id, tipo, titulo, tema, resumo, icone, ordem, status, corpo, tags) values ('hamburguer', 'comer_fora', 'Hambúrguer', null, 'Como montar o lanche do jeito que cabe no seu dia.', 'hamburguer', 1, 'publicado', '{"introducao":"Escolha o lugar e veja o que pedir. A diferença entre uma opção e outra costuma estar nos acompanhamentos, não no lanche em si.","decisoes":[],"lembretes":[]}'::jsonb, array['hamburguer', 'lanche', 'burger']::text[]) on conflict (id) do nothing;
insert into conteudos (id, tipo, titulo, tema, resumo, icone, ordem, status, corpo, tags) values ('japonesa', 'comer_fora', 'Comida japonesa', null, 'Entradas, combinados e o que costuma pesar no rodízio.', 'japonesa', 2, 'publicado', '{"introducao":"Comece pelas entradas, escolha o combinado e deixe as preparações fritas e os molhos cremosos como parte menor da refeição.","decisoes":[],"lembretes":[]}'::jsonb, array['japonesa', 'japones', 'sushi', 'sashimi', 'rodizio', 'temaki']::text[]) on conflict (id) do nothing;
insert into conteudos (id, tipo, titulo, tema, resumo, icone, ordem, status, corpo, tags) values ('massas', 'comer_fora', 'Massas', null, 'Quantidade da massa, proteína e molho.', 'massas', 3, 'publicado', '{"introducao":"Três escolhas definem o prato: quanto de massa, se entra proteína e qual molho acompanha.","decisoes":[],"lembretes":["Prefira o molho ao sugo.","Adicione proteína para trazer mais saciedade: massa e frango, massa e camarão, massa e carne magra."]}'::jsonb, array['massa', 'macarrao', 'italiano', 'molho', 'spoleto', 'lasanha']::text[]) on conflict (id) do nothing;
insert into conteudos (id, tipo, titulo, tema, resumo, icone, ordem, status, corpo, tags) values ('pizza', 'comer_fora', 'Pizza', null, 'Quantas fatias fecham uma refeição, por tipo de massa.', 'pizza', 4, 'publicado', '{"introducao":"A conta muda com a massa: quanto mais densa, menos fatias fecham a mesma refeição.","decisoes":[],"lembretes":["Prefira opções com proteína e sem muita adição de queijo, como frango ou carne seca."]}'::jsonb, array['pizza', 'pizzaria', 'fatia', 'borda']::text[]) on conflict (id) do nothing;
insert into conteudos (id, tipo, titulo, tema, resumo, icone, ordem, status, corpo, tags) values ('acai', 'comer_fora', 'Açaí', null, 'Tamanho da tigela e o que entra junto.', 'acai', 5, 'publicado', '{"introducao":"O tamanho decide se o açaí é a refeição livre inteira ou metade dela.","decisoes":[],"lembretes":[]}'::jsonb, array['acai', 'tigela', 'copo']::text[]) on conflict (id) do nothing;
insert into conteudos (id, tipo, titulo, tema, resumo, icone, ordem, status, corpo, tags) values ('doces', 'comer_fora', 'Doces e sobremesas', null, 'Cada uma destas conta como meia refeição livre.', 'doces', 6, 'publicado', '{"introducao":"Duas destas opções somam uma refeição livre completa.","decisoes":[{"id":"sobremesas","titulo":"Meias refeições doces","pergunta":"O que está na mesa?","observacoes":["Doceria não tem tabela publicada, então estes números são estimativa. Use como ordem de grandeza, não como medida."],"opcoes":[{"id":"doce-gelato","titulo":"Gelato: 1 copo médio com 2 sabores","descricao":"Bacio di Latte, Lullo, Mi Garba.","nivel":"melhor","energia":{"kcal":250,"mostrarKcal":true,"observacao":"Estimativa."},"detalhes":[],"tags":["gelato","sorvete"]},{"id":"doce-milkshake","titulo":"Milkshake pequeno","descricao":"Bob''s, McDonald''s.","nivel":"boa","energia":{"kcal":400,"mostrarKcal":true,"observacao":"Estimativa."},"detalhes":[],"tags":["milkshake"]},{"id":"doce-bolo","titulo":"1 fatia média de bolo ou torta com calda","descricao":null,"nivel":"boa","energia":{"kcal":400,"mostrarKcal":true,"observacao":"Estimativa."},"detalhes":[],"tags":["bolo","torta"]},{"id":"doce-cookie","titulo":"1 cookie artesanal grande, estilo americano","descricao":"Mr. Cheney, American Day.","nivel":"ocasional","energia":{"kcal":500,"mostrarKcal":true,"observacao":"Estimativa."},"detalhes":[],"tags":["cookie"]},{"id":"doce-brownie","titulo":"1 brownie com 1 bola de sorvete","descricao":null,"nivel":"ocasional","energia":{"kcal":630,"mostrarKcal":true,"observacao":"Estimativa."},"detalhes":[],"tags":["brownie","sorvete"]}]}],"lembretes":[]}'::jsonb, array['doce', 'sobremesa', 'chocolate', 'bolo', 'sorvete', 'cookie']::text[]) on conflict (id) do nothing;
insert into conteudos (id, tipo, titulo, tema, resumo, icone, ordem, status, corpo, tags) values ('barzinho', 'comer_fora', 'Barzinho', null, 'O que pedir para beber, e o que costuma acompanhar.', 'taca', 7, 'publicado', '{"introducao":"As contas abaixo são para duas doses — é o mínimo que costuma acontecer numa saída. Os números são estimativa: bar não publica tabela, e a receita muda de casa para casa.","decisoes":[{"id":"com-drink","titulo":"Com drink","pergunta":"Duas doses, mais o que vem para beliscar.","observacoes":[],"opcoes":[{"id":"drink-melhor","titulo":"Caipirinha, vodka soda ou Moscow Mule","descricao":"Duas doses, com porção pequena de azeitonas ou castanhas.","nivel":"melhor","energia":{"kcal":450,"mostrarKcal":true,"observacao":"Estimativa do total."},"detalhes":["2 drinks — 360 kcal","Azeitonas ou castanhas, porção pequena — 90 kcal"],"tags":["barzinho","combo"]},{"id":"drink-boa","titulo":"Margarita, Cosmopolitan ou caipiroska","descricao":"Duas doses, com tábua de queijos pequena.","nivel":"boa","energia":{"kcal":700,"mostrarKcal":true,"observacao":"Estimativa do total."},"detalhes":["2 drinks — 500 kcal","Tábua de queijos pequena — 200 kcal"],"tags":["barzinho","combo"]},{"id":"drink-ocasional","titulo":"Piña colada, sex on the beach ou caipirinha de frutas","descricao":"Duas doses, com três bruschettas.","nivel":"ocasional","energia":{"kcal":950,"mostrarKcal":true,"observacao":"Estimativa do total."},"detalhes":["2 drinks — 800 kcal","Bruschettas, 3 unidades — 150 kcal"],"tags":["barzinho","combo"]}]},{"id":"com-chopp","titulo":"Com chopp","pergunta":"Duas doses, mais o que vem para beliscar.","observacoes":[],"opcoes":[{"id":"chopp-melhor","titulo":"Dois chopps pequenos","descricao":"300 ml cada, com porção pequena de azeitonas ou castanhas.","nivel":"melhor","energia":{"kcal":330,"mostrarKcal":true,"observacao":"Estimativa do total."},"detalhes":["2 chopps de 300 ml — 240 kcal","Azeitonas ou castanhas, porção pequena — 90 kcal"],"tags":["barzinho","combo"]},{"id":"chopp-boa","titulo":"Dois chopps médios","descricao":"500 ml cada, com tábua de queijos pequena.","nivel":"boa","energia":{"kcal":600,"mostrarKcal":true,"observacao":"Estimativa do total."},"detalhes":["2 chopps de 500 ml — 400 kcal","Tábua de queijos pequena — 200 kcal"],"tags":["barzinho","combo"]},{"id":"chopp-ocasional","titulo":"Dois chopps grandes","descricao":"700 ml cada, com três bruschettas.","nivel":"ocasional","energia":{"kcal":710,"mostrarKcal":true,"observacao":"Estimativa do total."},"detalhes":["2 chopps de 700 ml — 560 kcal","Bruschettas, 3 unidades — 150 kcal"],"tags":["barzinho","combo"]}]}],"lembretes":[]}'::jsonb, array['barzinho', 'bar', 'drink', 'chopp', 'cerveja', 'happy hour', 'alcool', 'petisco']::text[]) on conflict (id) do nothing;
insert into conteudos (id, tipo, titulo, tema, resumo, icone, ordem, status, corpo, tags) values ('cinema', 'comer_fora', 'Cinema', null, 'O tamanho da pipoca é a escolha inteira.', 'restaurante', 8, 'publicado', '{"introducao":"A bebida zero não entra na conta, então o que decide é o balde. Os números são estimativa: a rede não publica tabela, e a manteiga muda tudo.","decisoes":[{"id":"pipoca","titulo":"Pipoca e bebida","pergunta":"Qual balde?","observacoes":[],"opcoes":[{"id":"cinema-melhor","titulo":"Pipoca pequena","descricao":"Com refrigerante zero.","nivel":"melhor","energia":{"kcal":200,"mostrarKcal":true,"observacao":"Estimativa do total."},"detalhes":["Pipoca pequena — 200 kcal","Refrigerante zero — 0 kcal"],"tags":["cinema","pipoca"]},{"id":"cinema-boa","titulo":"Pipoca média","descricao":"Com refrigerante zero.","nivel":"boa","energia":{"kcal":450,"mostrarKcal":true,"observacao":"Estimativa do total."},"detalhes":["Pipoca média — 450 kcal","Refrigerante zero — 0 kcal"],"tags":["cinema","pipoca"]},{"id":"cinema-ocasional","titulo":"Pipoca grande com um pacotinho de Fini","descricao":"Com refrigerante zero.","nivel":"ocasional","energia":{"kcal":790,"mostrarKcal":true,"observacao":"Estimativa do total."},"detalhes":["Pipoca grande — 700 kcal","Fini, pacotinho — 90 kcal","Refrigerante zero — 0 kcal"],"tags":["cinema","pipoca","fini","bala"]}]}],"lembretes":[]}'::jsonb, array['cinema', 'pipoca', 'filme', 'fini', 'bala']::text[]) on conflict (id) do nothing;
insert into conteudos (id, tipo, titulo, tema, resumo, icone, ordem, status, corpo, tags) values ('restaurantes', 'comer_fora', 'Restaurantes', null, null, 'restaurante', 9, 'rascunho', '{"introducao":null,"decisoes":[],"lembretes":[]}'::jsonb, array['restaurante', 'self service', 'buffet', 'por quilo']::text[]) on conflict (id) do nothing;
insert into conteudos (id, tipo, titulo, tema, resumo, icone, ordem, status, corpo, tags) values ('delivery', 'comer_fora', 'Delivery', null, null, 'delivery', 10, 'rascunho', '{"introducao":null,"decisoes":[],"lembretes":[]}'::jsonb, array['delivery', 'ifood', 'entrega']::text[]) on conflict (id) do nothing;

-- Guias -----------------------------------------------------------------------
insert into conteudos (id, tipo, titulo, tema, resumo, icone, ordem, status, corpo, tags) values ('rotulos', 'guia', 'Como ler um rótulo', 'Compras', 'A regra de ouro da lista de ingredientes.', null, 1, 'publicado', '{"secoes":[{"id":"regra-de-ouro","titulo":"Regra de ouro dos ingredientes","paragrafos":["Quanto menos ingredientes, melhor."],"itens":["Até 5 ingredientes: geralmente tudo certo.","De 6 a 10 ingredientes: vale olhar com atenção.","Lista longa e cheia de nomes estranhos: melhor evitar."]}]}'::jsonb, array['rotulo', 'ingredientes', 'industrializado', 'supermercado', 'embalagem']::text[]) on conflict (id) do nothing;
insert into conteudos (id, tipo, titulo, tema, resumo, icone, ordem, status, corpo, tags) values ('marcas-mercado', 'guia', 'Marcas sugeridas no mercado', 'Compras', 'O que procurar na prateleira, por categoria.', null, 2, 'publicado', '{"secoes":[{"id":"iogurte","titulo":"Iogurte","paragrafos":[],"itens":["Vigor Viv Simples e Vigor Viv Natural","Vigor Natural consistência firme","Nestlé Natural Desnatado e Nestlé Natural Integral (2 ingredientes)","Itambé Integral e Itambé Natural Milk","Fazenda Bela Vista Natural","Verde Campo LacFree","Verde Campo Natural Whey","Ati Latte natural","Batavo Naturais Integral","Yorgus Grego"]},{"id":"pao-de-forma","titulo":"Pão de forma","paragrafos":[],"itens":["Seven Boys Benefice e Benefice Light 7 Grãos","Seven Boys Integral, 12 Grãos e Castanha & Nozes","Wickbold 100% Integral (Girassol & Castanha, + Fibras, Pão Integral, Pão Forno)","Nutrella 14 Grãos, 7 Grãos e 100% Integral","Pullman Integral e Pullman 100% Integral 12 Grãos","Visconti Pão Integral"]},{"id":"geleia","titulo":"Geleia","paragrafos":[],"itens":["St. Dalfour (100% fruta)","Queensberry Wellness (100% fruta)","Casa Madeira frutas vermelhas, sem adição de açúcar","Ritter Geleia com Pedaços, 100% fruta"]},{"id":"frutas-congeladas","titulo":"Frutas congeladas","paragrafos":[],"itens":["Original Food"]},{"id":"vegetais-congelados","titulo":"Vegetais congelados","paragrafos":[],"itens":["De Marchi","Grano"]},{"id":"praticos","titulo":"Prontos que ajudam na correria","paragrafos":["Nas opções prontas, escolha sempre a de menos ingredientes."],"itens":["Frango desfiado congelado: Nat Pronto Já, peito de frango cozido desfiado","Lanche proteico: Verde Campo Natural Whey"]}]}'::jsonb, array['marcas', 'supermercado', 'iogurte', 'pao', 'geleia', 'congelados', 'compras']::text[]) on conflict (id) do nothing;
insert into conteudos (id, tipo, titulo, tema, resumo, icone, ordem, status, corpo, tags) values ('proteinas-em-casa', 'guia', 'Proteínas para ter em casa', 'Compras', 'Os cortes e itens que resolvem a semana.', null, 3, 'publicado', '{"secoes":[{"id":"lista","titulo":null,"paragrafos":[],"itens":["Tilápia","Atum","Peito de frango","Sobrecoxa de frango","Ovos","Filé mignon suíno","Camarão","Alcatra","Patinho","Peito de peru","Frango desfiado pronto — escolhendo sempre a opção com menos ingredientes"]}]}'::jsonb, array['proteina', 'carne', 'frango', 'peixe', 'ovo', 'compras']::text[]) on conflict (id) do nothing;
insert into conteudos (id, tipo, titulo, tema, resumo, icone, ordem, status, corpo, tags) values ('marmitas-comecar', 'guia', 'Marmitas: por onde começar', 'Marmitas', 'Higienizar, armazenar e deixar pronto para a semana.', null, 4, 'publicado', '{"secoes":[{"id":"higienizar","titulo":"Como higienizar frutas e legumes","paragrafos":["A higienização correta elimina bactérias, parasitas e resíduos.","Fruta organizada é fruta consumida: deixar já lavada, cortada e visível aumenta muito o consumo ao longo do dia."],"itens":["Lave em água corrente, esfregando fruta por fruta e legume por legume com as mãos.","Prepare a solução: 1 colher de sopa de água sanitária para 1 litro de água.","Deixe de molho por 15 minutos.","Enxágue novamente em água corrente.","Seque bem, ou deixe escorrer, antes de guardar.","Nunca misture água sanitária com vinagre."]},{"id":"mamao","titulo":"Mamão","paragrafos":["Dura até 3 dias na geladeira e 30 dias no congelador."],"itens":["Descasque, corte ao meio e retire as sementes.","Pique em cubos.","Armazene em pote fechado na geladeira."]},{"id":"morango","titulo":"Morango","paragrafos":["Lave apenas na hora de consumir. Dura até 3 dias na geladeira e 30 dias no congelador."],"itens":["Retire os morangos estragados.","Não lave antes de guardar.","Guarde os morangos secos em um pote com papel-toalha no fundo.","Tampe, mas sem vedar totalmente."]},{"id":"manga","titulo":"Manga","paragrafos":["Dura até 3 dias na geladeira e 30 dias no congelador."],"itens":["Descasque e pique.","Armazene em pote fechado."]},{"id":"abacaxi","titulo":"Abacaxi","paragrafos":["Dura até 3 dias na geladeira e 30 dias no congelador."],"itens":["Descasque e retire o miolo duro.","Corte em cubos ou rodelas.","Armazene em pote bem fechado."]},{"id":"basico","titulo":"O básico bem feito","paragrafos":["Não precisa inventar moda. Uma base bem feita, repetida ao longo da semana, gera constância e resultado."],"itens":[]}]}'::jsonb, array['marmita', 'higienizar', 'armazenar', 'fruta', 'legume', 'preparo', 'semana']::text[]) on conflict (id) do nothing;
insert into conteudos (id, tipo, titulo, tema, resumo, icone, ordem, status, corpo, tags) values ('marmitas-receitas', 'guia', 'Receitas para a semana', 'Marmitas', 'As bases que rendem várias marmitas.', null, 5, 'publicado', '{"secoes":[{"id":"frango-desfiado","titulo":"Frango desfiado bem temperado","paragrafos":["Fica soltinho, suculento e super versátil."],"itens":["1 kg de frango sassami","Tomate em bastante quantidade — quanto mais, mais molhadinho","1 cebola, alho a gosto","Sal, pimenta-do-reino, colorau, chimichurri e páprica defumada","Refogue o alho, a cebola e o tomate; acrescente o frango e tempere","Coloque água até um dedo antes de cobrir","Cozinhe na pressão: 20 minutos depois de pegar pressão","Abra, desfie e ajuste o sal"]},{"id":"sobrecoxa","titulo":"Sobrecoxa sem osso com cenoura","paragrafos":["Mesmo processo do frango sassami, trocando o sassami por sobrecoxa sem osso e acrescentando cenoura em rodelas. Carne mais palatável e muito saborosa."],"itens":[]},{"id":"pures","titulo":"Purês fáceis","paragrafos":[],"itens":["Batata: cozinhe, descarte a água (ajuda a reduzir o amido) e bata no liquidificador com leite desnatado, sal e um pouco de manteiga.","Mandioquinha: cozinhe por 20 a 25 minutos e bata no processador com sal e um pouco de manteiga.","Abóbora: cozinhe por 20 a 25 minutos e bata no processador com sal e um pouco de manteiga."]},{"id":"creme-de-milho","titulo":"Creme de milho fit","paragrafos":["Para colocar por cima do frango em cubos. Bata tudo e aqueça até engrossar."],"itens":["1 lata de milho","100 ml de leite desnatado","1 colher de creme de ricota light","Sal"]},{"id":"legumes","titulo":"Legumes rápidos e saborosos","paragrafos":[],"itens":["Cozinhe no vapor, ou","Refogue rapidamente, por 5 minutos, com alho, sal e um fio de azeite — só para pegar sabor, sem perder a textura."]},{"id":"estrogonofe","titulo":"Estrogonofe fit com batata palha crocante","paragrafos":["Quanto mais seca a batata antes de ir para a airfryer, mais crocante ela fica."],"itens":["Estrogonofe: frango em cubos, os temperos do frango sassami, creme de ricota light e um pouco de leite desnatado.","Batata palha: descasque e rale na lâmina julienne, a que deixa a batata bem fininha.","Deixe a batata ralada em água fria por 2 minutos para tirar o excesso de amido.","Escorra e seque muito bem, pode usar papel-toalha.","Tempere com sal e curry.","Airfryer por cerca de 15 minutos, mexendo durante o processo para dourar por igual."]},{"id":"frango-agridoce","titulo":"Frango agridoce simples","paragrafos":["Doce na medida certa, sem exageros."],"itens":["Frango","Alho","Um fio de mel","Páprica","Suco de laranja"]},{"id":"rap10","titulo":"Rap10 ou pão sírio recheado, para congelar","paragrafos":["Misture tudo cru, espalhe no rap10 ou no pão sírio, congele em saquinhos e leve direto à frigideira na hora de comer."],"itens":["Carne moída (patinho ou acém)","Cebola bem picada","Sal, azeite, páprica defumada","Cheiro-verde ou cebolinha"]},{"id":"shake","titulo":"Shake ou smoothie proteico","paragrafos":["É só bater tudo no liquidificador."],"itens":["150 g da fruta congelada da sua preferência","1 scoop de whey","Um pouco de água"]}]}'::jsonb, array['receita', 'frango', 'pure', 'estrogonofe', 'marmita', 'airfryer', 'batata palha']::text[]) on conflict (id) do nothing;
insert into conteudos (id, tipo, titulo, tema, resumo, icone, ordem, status, corpo, tags) values ('sem-tempo', 'guia', 'Sem tempo: o que fazer', 'Marmitas', 'Atalhos que mantêm a alimentação de pé numa semana corrida.', null, 6, 'publicado', '{"secoes":[{"id":"congelados","titulo":"Congelados que resolvem","paragrafos":["Nas opções prontas, escolha sempre a de menos ingredientes."],"itens":["Vegetais congelados: De Marchi, Grano","Frutas congeladas: Original Food","Frango desfiado congelado: Nat Pronto Já","Lanche proteico: Verde Campo Natural Whey"]},{"id":"links","titulo":"Links úteis","paragrafos":["Potes e sacos de plástico também são fáceis de achar em atacados como Atacadão, Assaí e Mineirão."],"itens":["Saco hermético para armazenar comida, dá para reutilizar 3 ou 4 vezes: https://br.shp.ee/UhjNXte","Saco mais barato, sem zip lock — tem que dar um nó: https://br.shp.ee/xZNjQNe","Potes herméticos: https://a.co/d/04xz4d14","Balança: https://br.shp.ee/eva5PxT","Potes de vidro para marmita, 600 ml: https://br.shp.ee/dNXK3vQ","Potes de plástico: https://br.shp.ee/powmiJJ"]}]}'::jsonb, array['sem tempo', 'correria', 'congelado', 'pratico', 'atalho', 'potes', 'balanca']::text[]) on conflict (id) do nothing;
insert into conteudos (id, tipo, titulo, tema, resumo, icone, ordem, status, corpo, tags) values ('variar-em-casa', 'guia', 'Variar em casa', 'Marmitas', 'Ideias para fugir da repetição sem sair do plano.', null, 7, 'rascunho', '{"secoes":[]}'::jsonb, array['variar', 'sexta', 'ideias', 'receita', 'rotina']::text[]) on conflict (id) do nothing;
insert into conteudos (id, tipo, titulo, tema, resumo, icone, ordem, status, corpo, tags) values ('constipacao', 'guia', 'Constipação', 'Digestão', null, null, 13, 'rascunho', '{"secoes":[]}'::jsonb, array['constipacao', 'intestino preso', 'fibra']::text[]) on conflict (id) do nothing;
insert into conteudos (id, tipo, titulo, tema, resumo, icone, ordem, status, corpo, tags) values ('gases', 'guia', 'Gases', 'Digestão', null, null, 14, 'rascunho', '{"secoes":[]}'::jsonb, array['gases', 'flatulencia']::text[]) on conflict (id) do nothing;
insert into conteudos (id, tipo, titulo, tema, resumo, icone, ordem, status, corpo, tags) values ('distensao-abdominal', 'guia', 'Distensão abdominal', 'Digestão', null, null, 15, 'rascunho', '{"secoes":[]}'::jsonb, array['distensao', 'inchaco', 'barriga']::text[]) on conflict (id) do nothing;
insert into conteudos (id, tipo, titulo, tema, resumo, icone, ordem, status, corpo, tags) values ('diarreia', 'guia', 'Diarreia', 'Digestão', null, null, 16, 'rascunho', '{"secoes":[]}'::jsonb, array['diarreia', 'intestino solto']::text[]) on conflict (id) do nothing;
insert into conteudos (id, tipo, titulo, tema, resumo, icone, ordem, status, corpo, tags) values ('lactose', 'guia', 'Lactose', 'Restrições', null, null, 17, 'rascunho', '{"secoes":[]}'::jsonb, array['lactose', 'leite', 'laticinio']::text[]) on conflict (id) do nothing;
insert into conteudos (id, tipo, titulo, tema, resumo, icone, ordem, status, corpo, tags) values ('fodmap', 'guia', 'FODMAP', 'Restrições', null, null, 18, 'rascunho', '{"secoes":[]}'::jsonb, array['fodmap', 'sii', 'intestino irritavel']::text[]) on conflict (id) do nothing;

-- Configurações ---------------------------------------------------------------
insert into configuracoes (chave, valor, descricao) values ('nome_central', '"Central do Paciente"'::jsonb, 'Nome exibido no topo do app.') on conflict (chave) do nothing;
insert into configuracoes (chave, valor, descricao) values ('frase_home', '"Facilite suas escolhas no dia a dia."'::jsonb, 'Frase da tela inicial.') on conflict (chave) do nothing;
insert into configuracoes (chave, valor, descricao) values ('lema', '"Na sexta o cardápio muda — mas o plano continua."'::jsonb, 'Frase curta de identidade, exibida na tela inicial. Deixe em branco para não mostrar.') on conflict (chave) do nothing;
insert into configuracoes (chave, valor, descricao) values ('comer_fora_introducao', '"Duas meias refeições equivalem a uma completa. Uma completa mais uma meia equivalem a uma refeição e meia."'::jsonb, 'Frase no topo de Comer fora. Deixe em branco para não mostrar.') on conflict (chave) do nothing;
insert into configuracoes (chave, valor, descricao) values ('whatsapp', '"5531994503318"'::jsonb, 'Número do WhatsApp da nutricionista, só dígitos com DDI e DDD (ex.: 5511999999999).') on conflict (chave) do nothing;
insert into configuracoes (chave, valor, descricao) values ('nome_nutricionista', '"Isabela Marçal"'::jsonb, 'Nome que aparece nos textos de contato.') on conflict (chave) do nothing;
insert into configuracoes (chave, valor, descricao) values ('alerta_vencimento_dias', '15'::jsonb, 'A partir de quantos dias antes do fim o paciente entra em ''próximo do vencimento''.') on conflict (chave) do nothing;


-- ###########################################################################
-- 0005_permissoes.sql
-- ###########################################################################

-- =============================================================================
-- CENTRAL DO PACIENTE — 0005: permissões de tabela
--
-- O Supabase já concede isto por padrão às contas anônima e autenticada; a
-- declaração explícita existe para que as migrações rodem iguais em qualquer
-- Postgres (é assim que a bateria de testes de acesso é executada antes do
-- deploy) e para deixar por escrito quem alcança o quê.
--
-- Conceder acesso à tabela NÃO é conceder acesso à linha: quem filtra linha
-- é a política de 0003. Sem política, a tabela com RLS ligado não devolve
-- nada, nem para quem tem GRANT.
-- =============================================================================

grant usage on schema public to anon, authenticated;

grant select on
  planos, unidades, grupos_alimentares, alimentos, equivalencias,
  conteudos, configuracoes, perfis, pacientes, pacientes_visao
to authenticated;

grant select, insert, delete on favoritos to authenticated;

-- A nutricionista usa a mesma conta autenticada de todo mundo: o que a
-- separa é `e_admin()` dentro das políticas, não um papel de banco diferente.
grant insert, update, delete on
  pacientes, planos, perfis, convites, historico_admin,
  unidades, grupos_alimentares, alimentos, equivalencias, conteudos, configuracoes
to authenticated;

grant select on historico_admin, convites to authenticated;

grant usage, select on all sequences in schema public to authenticated;


-- ###########################################################################
-- 0006_desafio.sql
-- ###########################################################################

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


-- ###########################################################################
-- 0007_desafio_funcoes.sql
-- ###########################################################################

-- =============================================================================
-- CENTRAL DO PACIENTE — 0007: as regras do desafio
--
-- REGRA MAIS IMPORTANTE (dela, e o motivo deste arquivo existir):
-- o sistema NÃO confia no checkbox da paciente para dar pontos.
--
-- A paciente não tem permissão de escrever em `desafio_envios` nem em
-- `pontos_lancamentos` — ver 0008. O único caminho é `enviar_acao()`, que
-- grava status 'enviado' e zero pontos, sempre. Quem transforma isso em ponto
-- é `aprovar_envio()`, e essa só roda para admin.
--
-- Mesmo com o app aberto no console do navegador, a paciente não consegue
-- somar um ponto sequer para si.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Semanas do desafio (§12)
--
-- Calculadas a partir do período, nunca escritas à mão. Um desafio que começa
-- 01/09 e termina 30/09 tem 5 semanas; a última tem 2 dias, e tudo bem.
-- -----------------------------------------------------------------------------

create or replace function semana_do_desafio(p_desafio uuid, p_data date default null)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when d.id is null then null
    when coalesce(p_data, hoje_sp()) < d.data_inicio then null
    when coalesce(p_data, hoje_sp()) > d.data_fim then null
    else floor((coalesce(p_data, hoje_sp()) - d.data_inicio) / 7)::int + 1
  end
  from desafios d
  where d.id = p_desafio;
$$;

/** Quantas semanas o desafio tem no total. */
create or replace function total_de_semanas(p_desafio uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select floor((d.data_fim - d.data_inicio) / 7)::int + 1
  from desafios d where d.id = p_desafio;
$$;

/** Início e fim de uma semana do desafio, para a tela mostrar "08/09 — 14/09". */
create or replace function periodo_da_semana(p_desafio uuid, p_semana integer)
returns table (inicio date, fim date)
language sql
stable
security definer
set search_path = public
as $$
  select
    d.data_inicio + ((p_semana - 1) * 7),
    least(d.data_inicio + ((p_semana - 1) * 7) + 6, d.data_fim)
  from desafios d where d.id = p_desafio;
$$;

-- -----------------------------------------------------------------------------
-- Encerramento automático (§36)
--
-- Sem cron: a data decide. Qualquer leitura já vê o desafio como encerrado
-- depois do último dia, do mesmo jeito que o acesso da paciente expira sozinho.
-- -----------------------------------------------------------------------------

create or replace function situacao_desafio(p_status text, p_inicio date, p_fim date)
returns text
language sql
immutable
as $$
  select case
    when p_status = 'rascunho' then 'rascunho'
    when p_status = 'encerrado' then 'encerrado'
    when hoje_sp() > p_fim then 'encerrado'
    when hoje_sp() < p_inicio then 'agendado'
    else 'ativo'
  end;
$$;

/** O desafio que está valendo hoje. Nulo quando não há nenhum. */
create or replace function desafio_atual()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select d.id from desafios d
  where d.status = 'ativo'
    and hoje_sp() between d.data_inicio and d.data_fim
  order by d.data_inicio desc
  limit 1;
$$;

-- -----------------------------------------------------------------------------
-- O paciente de quem está logado
-- -----------------------------------------------------------------------------

create or replace function meu_paciente_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from pacientes where perfil_id = auth.uid() limit 1;
$$;

-- -----------------------------------------------------------------------------
-- Saldo e ranking — derivados do ledger, nunca de coluna guardada (§42)
-- -----------------------------------------------------------------------------

/** Saldo oficial do Ponto de Virada: soma tudo, de todos os desafios. Não expira. */
create or replace function saldo_de_pontos(p_paciente uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(pontos), 0)::int
  from pontos_lancamentos where paciente_id = p_paciente;
$$;

/** Pontos de um desafio só — é o que o ranking mensal usa (§15). */
create or replace function pontos_no_desafio(p_paciente uuid, p_desafio uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(pontos), 0)::int
  from pontos_lancamentos
  where paciente_id = p_paciente and desafio_id = p_desafio;
$$;

/**
 * Nome como o ranking mostra. A configuração `ranking_nome` decide entre
 * 'completo', 'primeiro' e 'primeiro_inicial' (o padrão).
 *
 * Existe porque o ranking é a única tela em que uma paciente vê outra: a
 * política de `pacientes` continua fechada, e o que sai daqui é só o nome
 * tratado — nunca e-mail, plano, data ou qualquer dado de saúde (§19).
 */
create or replace function nome_para_ranking(p_nome text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_modo text;
  v_partes text[];
begin
  select coalesce(valor #>> '{}', 'primeiro_inicial') into v_modo
  from configuracoes where chave = 'ranking_nome';

  if v_modo = 'completo' then
    return p_nome;
  end if;

  v_partes := regexp_split_to_array(trim(p_nome), '\s+');
  if array_length(v_partes, 1) is null then
    return p_nome;
  end if;

  if v_modo = 'primeiro' or array_length(v_partes, 1) = 1 then
    return v_partes[1];
  end if;

  return v_partes[1] || ' ' || upper(left(v_partes[array_length(v_partes, 1)], 1)) || '.';
end;
$$;

/**
 * Ranking de um desafio.
 *
 * Empate (§31): quem empata divide a posição — 1º, 1º, 3º. É a regra de
 * competição comum, e não obriga a inventar um critério de desempate que
 * puniria alguém por ter pontuado mais tarde.
 *
 * Só entra ponto já lançado, ou seja, já aprovado (§16).
 */
create or replace function ranking_do_desafio(p_desafio uuid)
returns table (posicao integer, paciente_id uuid, nome text, pontos integer, sou_eu boolean)
language sql
stable
security definer
set search_path = public
as $$
  -- Entra no ranking quem participou OU quem tem ponto no desafio.
  --
  -- A segunda metade não é redundância: uma paciente que só indicou uma amiga,
  -- ou que recebeu um ajuste manual, tem pontos do mês sem ter marcado ação
  -- nenhuma. Montar o ranking só pela lista de participantes a deixaria de
  -- fora com pontos e tudo — foi o que os testes pegaram.
  with envolvidas as (
    select paciente_id from desafio_participantes where desafio_id = p_desafio
    union
    select paciente_id from pontos_lancamentos where desafio_id = p_desafio
  ),
  somas as (
    select p.id, p.nome, coalesce(sum(l.pontos), 0)::int as pontos
    from envolvidas e
    join pacientes p on p.id = e.paciente_id
    left join pontos_lancamentos l
      on l.paciente_id = p.id and l.desafio_id = p_desafio
    group by p.id, p.nome
  )
  select
    rank() over (order by pontos desc)::int,
    s.id,
    nome_para_ranking(s.nome),
    s.pontos,
    s.id = meu_paciente_id()
  from somas s
  order by pontos desc, s.nome;
$$;

-- -----------------------------------------------------------------------------
-- O que a paciente envia
-- -----------------------------------------------------------------------------

/**
 * "Eu fiz isso."
 *
 * Confere tudo aqui dentro, porque a tela não é autoridade: acesso válido,
 * desafio em andamento, ação ativa, e o limite de repetição da ação. Grava
 * sempre com status 'enviado' e zero ponto.
 */
create or replace function enviar_acao(p_acao uuid, p_observacao text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
  v_acao desafio_acoes;
  v_desafio desafios;
  v_semana integer;
  v_id uuid;
  v_ocorrencias integer;
begin
  if not tem_acesso() then
    raise exception 'Seu acesso não está liberado.' using errcode = '42501';
  end if;

  v_paciente := meu_paciente_id();
  if v_paciente is null then
    raise exception 'Não encontrei seu cadastro de paciente.' using errcode = '42501';
  end if;

  select * into v_acao from desafio_acoes where id = p_acao and ativo;
  if not found then
    raise exception 'Esta ação não está disponível.' using errcode = '22023';
  end if;

  select * into v_desafio from desafios where id = v_acao.desafio_id;
  if situacao_desafio(v_desafio.status, v_desafio.data_inicio, v_desafio.data_fim) <> 'ativo' then
    raise exception 'Este desafio não está em andamento.' using errcode = '22023';
  end if;

  -- Semana só existe para ação semanal; nas demais fica nula de propósito, e é
  -- o índice único parcial que garante a unicidade certa para cada caso.
  if v_acao.periodicidade = 'semanal' then
    v_semana := semana_do_desafio(v_desafio.id);
    if v_semana is null then
      raise exception 'Hoje está fora do período do desafio.' using errcode = '22023';
    end if;
  else
    v_semana := null;
  end if;

  if v_acao.periodicidade = 'evento' and v_acao.max_ocorrencias is not null then
    select count(*) into v_ocorrencias
    from desafio_envios
    where acao_id = v_acao.id and paciente_id = v_paciente and status <> 'recusado';
    if v_ocorrencias >= v_acao.max_ocorrencias then
      raise exception 'Você já usou todas as vezes desta ação.' using errcode = '22023';
    end if;
  end if;

  -- Entra no desafio na primeira ação, sem tela de inscrição.
  insert into desafio_participantes (desafio_id, paciente_id)
  values (v_desafio.id, v_paciente)
  on conflict (desafio_id, paciente_id) do nothing;

  insert into desafio_envios (desafio_id, acao_id, paciente_id, semana, observacao)
  values (v_desafio.id, v_acao.id, v_paciente, v_semana, nullif(trim(p_observacao), ''))
  returning id into v_id;

  return v_id;
exception
  when unique_violation then
    raise exception 'Você já enviou esta ação.' using errcode = '23505';
end;
$$;

/** Desfazer o próprio envio, enquanto ainda não foi conferido. */
create or replace function cancelar_envio(p_envio uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_paciente uuid;
begin
  v_paciente := meu_paciente_id();
  delete from desafio_envios
  where id = p_envio and paciente_id = v_paciente and status = 'enviado';
  if not found then
    raise exception 'Este envio não pode mais ser desfeito.' using errcode = '22023';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- O que só a nutricionista faz
-- -----------------------------------------------------------------------------

/** Aprovar: é aqui, e só aqui, que um ponto de ação nasce. */
create or replace function aprovar_envio(p_envio uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_envio desafio_envios;
  v_acao desafio_acoes;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista aprova.' using errcode = '42501';
  end if;

  select * into v_envio from desafio_envios where id = p_envio for update;
  if not found then
    raise exception 'Envio não encontrado.' using errcode = '22023';
  end if;
  if v_envio.status = 'aprovado' then
    return; -- já aprovado: não gera ponto de novo
  end if;

  select * into v_acao from desafio_acoes where id = v_envio.acao_id;

  update desafio_envios
     set status = 'aprovado',
         revisado_em = now(),
         revisado_por = auth.uid(),
         motivo_recusa = null,
         pontos_concedidos = v_acao.pontos
   where id = p_envio;

  insert into pontos_lancamentos
    (paciente_id, desafio_id, acao_id, envio_id, pontos, tipo, descricao, criado_por)
  values
    (v_envio.paciente_id, v_envio.desafio_id, v_acao.id, v_envio.id, v_acao.pontos,
     'acao',
     v_acao.nome || coalesce(' · semana ' || v_envio.semana, ''),
     auth.uid());
end;
$$;

/** Recusar: não gera ponto, e a paciente vê o motivo. */
create or replace function recusar_envio(p_envio uuid, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista recusa.' using errcode = '42501';
  end if;

  -- Se já havia sido aprovado, o ponto sai por estorno — o lançamento
  -- original fica no histórico. Nada se apaga do ledger (§30).
  insert into pontos_lancamentos
    (paciente_id, desafio_id, acao_id, pontos, tipo, descricao, criado_por)
  select l.paciente_id, l.desafio_id, l.acao_id, -l.pontos, 'ajuste',
         'Estorno: ' || l.descricao, auth.uid()
  from pontos_lancamentos l
  where l.envio_id = p_envio;

  update desafio_envios
     set status = 'recusado',
         revisado_em = now(),
         revisado_por = auth.uid(),
         motivo_recusa = nullif(trim(p_motivo), ''),
         pontos_concedidos = 0
   where id = p_envio;
end;
$$;

/** Correção manual, sempre com motivo e sempre virando histórico (§30). */
create or replace function ajustar_pontos(
  p_paciente uuid,
  p_pontos integer,
  p_motivo text,
  p_desafio uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista ajusta pontos.' using errcode = '42501';
  end if;
  if p_pontos = 0 then
    raise exception 'Informe um valor diferente de zero.' using errcode = '22023';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Escreva o motivo do ajuste.' using errcode = '22023';
  end if;

  insert into pontos_lancamentos
    (paciente_id, desafio_id, pontos, tipo, descricao, criado_por)
  values (p_paciente, p_desafio, p_pontos, 'ajuste', trim(p_motivo), auth.uid());
end;
$$;

-- -----------------------------------------------------------------------------
-- Indicações
-- -----------------------------------------------------------------------------

/** A paciente registra que indicou alguém. Isso não vale ponto nenhum ainda. */
create or replace function registrar_indicacao(
  p_nome text,
  p_email text default null,
  p_telefone text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
  v_id uuid;
begin
  if not tem_acesso() then
    raise exception 'Seu acesso não está liberado.' using errcode = '42501';
  end if;
  v_paciente := meu_paciente_id();
  if coalesce(trim(p_nome), '') = '' then
    raise exception 'Escreva o nome de quem você indicou.' using errcode = '22023';
  end if;

  -- Indicar também é participar: sem isto ela só entraria no ranking depois
  -- de marcar alguma ação semanal.
  if desafio_atual() is not null then
    insert into desafio_participantes (desafio_id, paciente_id)
    values (desafio_atual(), v_paciente)
    on conflict (desafio_id, paciente_id) do nothing;
  end if;

  insert into indicacoes
    (desafio_id, paciente_indicadora_id, nome_indicada, email_indicada, telefone_indicada)
  values
    (desafio_atual(), v_paciente, trim(p_nome), nullif(trim(p_email), ''), nullif(trim(p_telefone), ''))
  returning id into v_id;

  return v_id;
end;
$$;

/**
 * Validar a indicação: os pontos saem aqui (50 na época deste arquivo, 100
 * desde o 0013), e só quando ela confirma que a
 * indicada começou o acompanhamento de verdade.
 */
create or replace function validar_indicacao(p_indicacao uuid, p_paciente_indicada uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ind indicacoes;
  v_pontos integer;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista valida indicação.' using errcode = '42501';
  end if;

  select * into v_ind from indicacoes where id = p_indicacao for update;
  if not found then
    raise exception 'Indicação não encontrada.' using errcode = '22023';
  end if;
  if v_ind.status = 'validada' then
    return;
  end if;

  select coalesce(max(pontos), 50) into v_pontos
  from desafio_acoes
  where chave = 'indicacao' and desafio_id = coalesce(v_ind.desafio_id, desafio_atual());

  update indicacoes
     set status = 'validada',
         paciente_indicada_id = coalesce(p_paciente_indicada, paciente_indicada_id),
         pontos_concedidos = v_pontos,
         validado_em = now(),
         validado_por = auth.uid()
   where id = p_indicacao;

  insert into pontos_lancamentos
    (paciente_id, desafio_id, indicacao_id, pontos, tipo, descricao, criado_por)
  values
    (v_ind.paciente_indicadora_id, coalesce(v_ind.desafio_id, desafio_atual()), p_indicacao,
     v_pontos, 'indicacao', 'Indicação de ' || v_ind.nome_indicada, auth.uid());
end;
$$;

/** Recusar uma indicação: zero ponto, e o registro fica. */
create or replace function recusar_indicacao(p_indicacao uuid, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista recusa indicação.' using errcode = '42501';
  end if;
  update indicacoes
     set status = 'recusada',
         observacao = nullif(trim(p_motivo), ''),
         validado_em = now(),
         validado_por = auth.uid()
   where id = p_indicacao and status <> 'validada';
end;
$$;


-- ###########################################################################
-- 0008_desafio_rls.sql
-- ###########################################################################

-- =============================================================================
-- CENTRAL DO PACIENTE — 0008: quem pode o quê no desafio
--
-- O desenho é curto de explicar: a paciente LÊ. Ela não escreve em lugar
-- nenhum que vire ponto. Não há política de insert, update ou delete para ela
-- em `desafio_envios`, `pontos_lancamentos` ou `indicacoes` — o caminho é
-- sempre uma função `security definer` do 0007, que confere as regras antes.
--
-- Isso é o que responde ao §44 (anti-fraude): não é o app que impede, é o
-- banco. Tirar o app do caminho não abre porta nenhuma.
-- =============================================================================

alter table desafios enable row level security;
alter table desafio_acoes enable row level security;
alter table desafio_participantes enable row level security;
alter table desafio_envios enable row level security;
alter table pontos_lancamentos enable row level security;
alter table indicacoes enable row level security;
alter table recompensas enable row level security;

-- -----------------------------------------------------------------------------
-- Desafios e ações: conteúdo, lido por quem tem acesso válido
-- -----------------------------------------------------------------------------

drop policy if exists desafios_leitura on desafios;
create policy desafios_leitura on desafios for select
  using (e_admin() or (status <> 'rascunho' and tem_acesso()));

drop policy if exists desafios_admin on desafios;
create policy desafios_admin on desafios for all
  using (e_admin()) with check (e_admin());

drop policy if exists acoes_leitura on desafio_acoes;
create policy acoes_leitura on desafio_acoes for select
  using (
    e_admin() or (
      tem_acesso()
      and exists (select 1 from desafios d where d.id = desafio_id and d.status <> 'rascunho')
    )
  );

drop policy if exists acoes_admin on desafio_acoes;
create policy acoes_admin on desafio_acoes for all
  using (e_admin()) with check (e_admin());

-- -----------------------------------------------------------------------------
-- Participação
--
-- A paciente lê a lista de participantes do desafio porque o ranking depende
-- disso — mas a linha não carrega nada além do vínculo. Nome, e-mail, plano e
-- datas continuam atrás da política de `pacientes`, que não mudou.
-- -----------------------------------------------------------------------------

drop policy if exists participantes_leitura on desafio_participantes;
create policy participantes_leitura on desafio_participantes for select
  using (e_admin() or tem_acesso());

drop policy if exists participantes_admin on desafio_participantes;
create policy participantes_admin on desafio_participantes for all
  using (e_admin()) with check (e_admin());

-- -----------------------------------------------------------------------------
-- Envios: cada uma vê os seus
-- -----------------------------------------------------------------------------

drop policy if exists envios_leitura on desafio_envios;
create policy envios_leitura on desafio_envios for select
  using (e_admin() or paciente_id = meu_paciente_id());

drop policy if exists envios_admin on desafio_envios;
create policy envios_admin on desafio_envios for all
  using (e_admin()) with check (e_admin());

-- Repare no que NÃO existe: política de insert/update/delete para paciente.
-- Marcar uma ação passa por `enviar_acao()`; desfazer, por `cancelar_envio()`.

-- -----------------------------------------------------------------------------
-- Ledger: leitura do próprio histórico, e nada mais
-- -----------------------------------------------------------------------------

drop policy if exists lancamentos_leitura on pontos_lancamentos;
create policy lancamentos_leitura on pontos_lancamentos for select
  using (e_admin() or paciente_id = meu_paciente_id());

drop policy if exists lancamentos_admin on pontos_lancamentos;
create policy lancamentos_admin on pontos_lancamentos for all
  using (e_admin()) with check (e_admin());

-- -----------------------------------------------------------------------------
-- Indicações
-- -----------------------------------------------------------------------------

drop policy if exists indicacoes_leitura on indicacoes;
create policy indicacoes_leitura on indicacoes for select
  using (e_admin() or paciente_indicadora_id = meu_paciente_id());

drop policy if exists indicacoes_admin on indicacoes;
create policy indicacoes_admin on indicacoes for all
  using (e_admin()) with check (e_admin());

-- -----------------------------------------------------------------------------
-- Recompensas: tabela de leitura para todo mundo com acesso
-- -----------------------------------------------------------------------------

drop policy if exists recompensas_leitura on recompensas;
create policy recompensas_leitura on recompensas for select
  using (e_admin() or (ativo and tem_acesso()));

drop policy if exists recompensas_admin on recompensas;
create policy recompensas_admin on recompensas for all
  using (e_admin()) with check (e_admin());

-- -----------------------------------------------------------------------------
-- Permissões de execução
-- -----------------------------------------------------------------------------

grant execute on function enviar_acao(uuid, text) to authenticated;
grant execute on function cancelar_envio(uuid) to authenticated;
grant execute on function registrar_indicacao(text, text, text) to authenticated;
grant execute on function ranking_do_desafio(uuid) to authenticated;
grant execute on function saldo_de_pontos(uuid) to authenticated;
grant execute on function pontos_no_desafio(uuid, uuid) to authenticated;
grant execute on function semana_do_desafio(uuid, date) to authenticated;
grant execute on function total_de_semanas(uuid) to authenticated;
grant execute on function periodo_da_semana(uuid, integer) to authenticated;
grant execute on function desafio_atual() to authenticated;
grant execute on function meu_paciente_id() to authenticated;
grant execute on function nome_para_ranking(text) to authenticated;
grant execute on function situacao_desafio(text, date, date) to authenticated;

-- Estas são de administração. O `e_admin()` dentro delas já recusa qualquer
-- outra conta, mas não custa não oferecer.
grant execute on function aprovar_envio(uuid) to authenticated;
grant execute on function recusar_envio(uuid, text) to authenticated;
grant execute on function ajustar_pontos(uuid, integer, text, uuid) to authenticated;
grant execute on function validar_indicacao(uuid, uuid) to authenticated;
grant execute on function recusar_indicacao(uuid, text) to authenticated;

grant select on desafios, desafio_acoes, desafio_participantes,
  desafio_envios, pontos_lancamentos, indicacoes, recompensas to authenticated;
grant insert, update, delete on desafios, desafio_acoes, desafio_participantes,
  desafio_envios, pontos_lancamentos, indicacoes, recompensas to authenticated;


-- ###########################################################################
-- 0009_desafio_tela.sql
-- ###########################################################################

-- =============================================================================
-- CENTRAL DO PACIENTE — 0009: o que a tela do desafio lê
--
-- Uma função só, como `meu_acesso()`. A tela pergunta e obedece: ela não soma
-- ponto, não decide posição e não sabe a regra. Se um dia a regra mudar, muda
-- aqui e a tela acompanha sem saber que mudou.
-- =============================================================================

create or replace function meu_desafio()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_desafio desafios;
  v_paciente uuid;
  v_semana integer;
  v_pontos_mes integer;
  v_saldo integer;
  v_posicao integer;
  v_proxima integer;
begin
  v_paciente := meu_paciente_id();
  select * into v_desafio from desafios where id = desafio_atual();

  -- Saldo acumulado existe mesmo sem desafio no ar: ele é do programa, não do mês.
  v_saldo := coalesce(saldo_de_pontos(v_paciente), 0);

  if v_desafio.id is null then
    return jsonb_build_object(
      'temDesafio', false,
      'saldoAcumulado', v_saldo,
      'recompensas', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', r.id, 'pontos', r.pontos, 'nome', r.nome, 'descricao', r.descricao,
          'alcancada', v_saldo >= r.pontos
        ) order by r.ordem), '[]'::jsonb)
        from recompensas r where r.ativo
      )
    );
  end if;

  v_semana := semana_do_desafio(v_desafio.id);
  v_pontos_mes := coalesce(pontos_no_desafio(v_paciente, v_desafio.id), 0);

  select posicao into v_posicao
  from ranking_do_desafio(v_desafio.id) where sou_eu;

  -- Quantos pontos faltam para alcançar quem está logo acima.
  select min(pontos) - v_pontos_mes into v_proxima
  from ranking_do_desafio(v_desafio.id)
  where pontos > v_pontos_mes;

  return jsonb_build_object(
    'temDesafio', true,
    'desafio', jsonb_build_object(
      'id', v_desafio.id,
      'nome', v_desafio.nome,
      'descricao', v_desafio.descricao,
      'lema', v_desafio.lema,
      'regras', v_desafio.regras,
      'dataInicio', v_desafio.data_inicio,
      'dataFim', v_desafio.data_fim,
      'situacao', situacao_desafio(v_desafio.status, v_desafio.data_inicio, v_desafio.data_fim),
      'semanaAtual', v_semana,
      'totalDeSemanas', total_de_semanas(v_desafio.id)
    ),
    'pontosNoMes', v_pontos_mes,
    'saldoAcumulado', v_saldo,
    'posicao', v_posicao,
    'pontosParaProxima', v_proxima,
    'acoes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id,
        'chave', a.chave,
        'nome', a.nome,
        'descricao', a.descricao,
        'pontos', a.pontos,
        'periodicidade', a.periodicidade,
        -- O envio desta semana, quando a ação é semanal; o do desafio, quando não é.
        'envio', (
          select jsonb_build_object(
            'id', e.id, 'status', e.status, 'semana', e.semana,
            'observacao', e.observacao, 'motivoRecusa', e.motivo_recusa,
            'enviadoEm', e.enviado_em, 'pontosConcedidos', e.pontos_concedidos
          )
          from desafio_envios e
          where e.acao_id = a.id and e.paciente_id = v_paciente
            and (a.periodicidade <> 'semanal' or e.semana = v_semana)
            and e.status <> 'recusado'
          order by e.enviado_em desc limit 1
        ),
        -- Quantas vezes já pontuou nesta ação, para a tela mostrar o histórico.
        'aprovadas', (
          select count(*) from desafio_envios e
          where e.acao_id = a.id and e.paciente_id = v_paciente and e.status = 'aprovado'
        )
      ) order by a.ordem), '[]'::jsonb)
      from desafio_acoes a
      where a.desafio_id = v_desafio.id and a.ativo
    ),
    'ranking', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'posicao', r.posicao, 'nome', r.nome, 'pontos', r.pontos, 'souEu', r.sou_eu
      ) order by r.posicao, r.nome), '[]'::jsonb)
      from ranking_do_desafio(v_desafio.id) r
    ),
    'historico', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', l.id, 'pontos', l.pontos, 'descricao', l.descricao,
        'tipo', l.tipo, 'criadoEm', l.criado_em
      ) order by l.criado_em desc), '[]'::jsonb)
      from pontos_lancamentos l
      where l.paciente_id = v_paciente and l.desafio_id = v_desafio.id
    ),
    'indicacoes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', i.id, 'nome', i.nome_indicada, 'status', i.status,
        'pontos', i.pontos_concedidos, 'criadoEm', i.criado_em
      ) order by i.criado_em desc), '[]'::jsonb)
      from indicacoes i where i.paciente_indicadora_id = v_paciente
    ),
    'recompensas', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', r.id, 'pontos', r.pontos, 'nome', r.nome, 'descricao', r.descricao,
        'alcancada', v_saldo >= r.pontos
      ) order by r.ordem), '[]'::jsonb)
      from recompensas r where r.ativo
    )
  );
end;
$$;

grant execute on function meu_desafio() to authenticated;

-- -----------------------------------------------------------------------------
-- O que o painel da nutricionista lê
-- -----------------------------------------------------------------------------

create or replace function painel_do_desafio(p_desafio uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_desafio desafios;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê o painel.' using errcode = '42501';
  end if;
  select * into v_desafio from desafios where id = p_desafio;

  return jsonb_build_object(
    'elegiveis', (
      select count(*) from pacientes p
      where situacao_paciente(p.status, p.perfil_id, p.data_inicio, p.data_fim)
            in ('ativo', 'proximo_do_vencimento')
    ),
    'participantes', (
      select count(*) from desafio_participantes where desafio_id = p_desafio
    ),
    'semAcao', (
      select count(*) from desafio_participantes dp
      where dp.desafio_id = p_desafio
        and not exists (
          select 1 from desafio_envios e
          where e.desafio_id = p_desafio and e.paciente_id = dp.paciente_id
        )
    ),
    'pendentes', (
      select count(*) from desafio_envios
      where desafio_id = p_desafio and status = 'enviado'
    ),
    'indicacoesPendentes', (
      select count(*) from indicacoes
      where status in ('registrada', 'iniciou')
    ),
    'maiorPontuacao', (
      select coalesce(max(pontos), 0) from ranking_do_desafio(p_desafio)
    ),
    'media', (
      select coalesce(round(avg(pontos))::int, 0) from ranking_do_desafio(p_desafio)
    ),
    'acoesMaisFeitas', (
      -- Cast para int: ordenar por texto poria '9' na frente de '10'.
      select coalesce(jsonb_agg(x order by (x->>'total')::int desc), '[]'::jsonb) from (
        select jsonb_build_object('nome', a.nome, 'total', count(e.id)) as x
        from desafio_acoes a
        left join desafio_envios e on e.acao_id = a.id and e.status = 'aprovado'
        where a.desafio_id = p_desafio
        group by a.nome
      ) t
    )
  );
end;
$$;

grant execute on function painel_do_desafio(uuid) to authenticated;


-- ###########################################################################
-- 0010_desafio_fechaduras.sql
-- ###########################################################################

-- =============================================================================
-- CENTRAL DO PACIENTE — 0010: fechando o que o verificador do Supabase achou
--
-- Duas falhas reais, encontradas depois que o 0006–0009 subiu. Vale registrar
-- o que eram, porque a lição serve para qualquer função nova daqui em diante.
--
-- 1. FUNÇÃO SEM DONO DA PERGUNTA
--
--    `saldo_de_pontos(paciente)` recebia um id e devolvia o saldo — sem
--    perguntar de quem era o id. Uma paciente autenticada poderia ler o saldo
--    de outra passando o id dela. A política de `pontos_lancamentos` está
--    certa, mas a função é `security definer`: ela passa por cima da política,
--    e por isso precisa fazer a checagem no corpo. O mesmo valia para
--    `pontos_no_desafio` e `ranking_do_desafio`.
--
-- 2. FUNÇÃO ABERTA PARA QUEM NEM ENTROU
--
--    O Supabase publica toda função de `public` como endereço REST, e o papel
--    `anon` — visitante sem login — vinha com permissão de executar. A chave
--    pública do app está dentro do HTML publicado, de propósito, então
--    qualquer pessoa poderia chamar `desafio_atual()`, pegar o id, chamar
--    `ranking_do_desafio(id)` e receber os nomes e pontos das pacientes dela.
--
--    Sem login. Sem ser paciente. Só com o endereço do site.
--
--    A correção é tirar `anon` e `public` de tudo que toca dado, e deixar o
--    `grant` só para `authenticated` — que ainda passa pelas checagens acima.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. As funções que devolvem dado passam a perguntar de quem é
-- -----------------------------------------------------------------------------

create or replace function saldo_de_pontos(p_paciente uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- Cada uma vê o seu; a nutricionista vê o de todas.
  --
  -- O `coalesce` não é enfeite: `null = qualquer coisa` dá null, e `if null`
  -- não entra — um id nulo passaria direto pela checagem. Devolveria zero, o
  -- que é inofensivo, mas uma guarda que depende de sorte não é guarda.
  if not coalesce(e_admin() or p_paciente = meu_paciente_id(), false) then
    raise exception 'Você só pode ver os seus pontos.' using errcode = '42501';
  end if;
  return (
    select coalesce(sum(pontos), 0)::int
    from pontos_lancamentos where paciente_id = p_paciente
  );
end;
$$;

create or replace function pontos_no_desafio(p_paciente uuid, p_desafio uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not coalesce(e_admin() or p_paciente = meu_paciente_id(), false) then
    raise exception 'Você só pode ver os seus pontos.' using errcode = '42501';
  end if;
  return (
    select coalesce(sum(pontos), 0)::int
    from pontos_lancamentos
    where paciente_id = p_paciente and desafio_id = p_desafio
  );
end;
$$;

/**
 * O ranking é a única tela em que uma paciente vê outra, e continua sendo —
 * mas agora só para quem está autenticado E com acesso válido. Uma paciente
 * vencida ou suspensa não lê mais os nomes das outras.
 */
create or replace function ranking_do_desafio(p_desafio uuid)
returns table (posicao integer, paciente_id uuid, nome text, pontos integer, sou_eu boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not coalesce(e_admin() or tem_acesso(), false) then
    raise exception 'Seu acesso não está liberado.' using errcode = '42501';
  end if;

  return query
  with envolvidas as (
    select dp.paciente_id from desafio_participantes dp where dp.desafio_id = p_desafio
    union
    select l.paciente_id from pontos_lancamentos l where l.desafio_id = p_desafio
  ),
  somas as (
    select p.id, p.nome, coalesce(sum(l.pontos), 0)::int as pontos
    from envolvidas e
    join pacientes p on p.id = e.paciente_id
    left join pontos_lancamentos l on l.paciente_id = p.id and l.desafio_id = p_desafio
    group by p.id, p.nome
  )
  select
    rank() over (order by s.pontos desc)::int,
    s.id,
    nome_para_ranking(s.nome),
    s.pontos,
    s.id = meu_paciente_id()
  from somas s
  order by s.pontos desc, s.nome;
end;
$$;

-- `meu_desafio()` chama `saldo_de_pontos` para o próprio id, então continua
-- funcionando — mas sem paciente vinculado ele agora explodiria. Trata antes.
create or replace function meu_desafio()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_desafio desafios;
  v_paciente uuid;
  v_semana integer;
  v_pontos_mes integer;
  v_saldo integer;
  v_posicao integer;
  v_proxima integer;
begin
  v_paciente := meu_paciente_id();

  -- Sem cadastro de paciente vinculado não há desafio nenhum a mostrar. É o
  -- caso de quem tem conta mas ainda não é paciente — e da nutricionista.
  if v_paciente is null then
    return jsonb_build_object('temDesafio', false, 'saldoAcumulado', 0, 'recompensas', '[]'::jsonb);
  end if;

  select * into v_desafio from desafios where id = desafio_atual();
  v_saldo := coalesce(saldo_de_pontos(v_paciente), 0);

  if v_desafio.id is null then
    return jsonb_build_object(
      'temDesafio', false,
      'saldoAcumulado', v_saldo,
      'recompensas', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', r.id, 'pontos', r.pontos, 'nome', r.nome, 'descricao', r.descricao,
          'alcancada', v_saldo >= r.pontos
        ) order by r.ordem), '[]'::jsonb)
        from recompensas r where r.ativo
      )
    );
  end if;

  v_semana := semana_do_desafio(v_desafio.id);
  v_pontos_mes := coalesce(pontos_no_desafio(v_paciente, v_desafio.id), 0);
  select r.posicao into v_posicao from ranking_do_desafio(v_desafio.id) r where r.sou_eu;
  select min(r.pontos) - v_pontos_mes into v_proxima
  from ranking_do_desafio(v_desafio.id) r where r.pontos > v_pontos_mes;

  return jsonb_build_object(
    'temDesafio', true,
    'desafio', jsonb_build_object(
      'id', v_desafio.id, 'nome', v_desafio.nome, 'descricao', v_desafio.descricao,
      'lema', v_desafio.lema, 'regras', v_desafio.regras,
      'dataInicio', v_desafio.data_inicio, 'dataFim', v_desafio.data_fim,
      'situacao', situacao_desafio(v_desafio.status, v_desafio.data_inicio, v_desafio.data_fim),
      'semanaAtual', v_semana, 'totalDeSemanas', total_de_semanas(v_desafio.id)
    ),
    'pontosNoMes', v_pontos_mes,
    'saldoAcumulado', v_saldo,
    'posicao', v_posicao,
    'pontosParaProxima', v_proxima,
    'acoes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id, 'chave', a.chave, 'nome', a.nome, 'descricao', a.descricao,
        'pontos', a.pontos, 'periodicidade', a.periodicidade,
        'envio', (
          select jsonb_build_object(
            'id', e.id, 'status', e.status, 'semana', e.semana,
            'observacao', e.observacao, 'motivoRecusa', e.motivo_recusa,
            'enviadoEm', e.enviado_em, 'pontosConcedidos', e.pontos_concedidos
          )
          from desafio_envios e
          where e.acao_id = a.id and e.paciente_id = v_paciente
            and (a.periodicidade <> 'semanal' or e.semana = v_semana)
            and e.status <> 'recusado'
          order by e.enviado_em desc limit 1
        ),
        'aprovadas', (
          select count(*) from desafio_envios e
          where e.acao_id = a.id and e.paciente_id = v_paciente and e.status = 'aprovado'
        )
      ) order by a.ordem), '[]'::jsonb)
      from desafio_acoes a where a.desafio_id = v_desafio.id and a.ativo
    ),
    'ranking', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'posicao', r.posicao, 'nome', r.nome, 'pontos', r.pontos, 'souEu', r.sou_eu
      ) order by r.posicao, r.nome), '[]'::jsonb)
      from ranking_do_desafio(v_desafio.id) r
    ),
    'historico', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', l.id, 'pontos', l.pontos, 'descricao', l.descricao,
        'tipo', l.tipo, 'criadoEm', l.criado_em
      ) order by l.criado_em desc), '[]'::jsonb)
      from pontos_lancamentos l
      where l.paciente_id = v_paciente and l.desafio_id = v_desafio.id
    ),
    'indicacoes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', i.id, 'nome', i.nome_indicada, 'status', i.status,
        'pontos', i.pontos_concedidos, 'criadoEm', i.criado_em
      ) order by i.criado_em desc), '[]'::jsonb)
      from indicacoes i where i.paciente_indicadora_id = v_paciente
    ),
    'recompensas', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', r.id, 'pontos', r.pontos, 'nome', r.nome, 'descricao', r.descricao,
        'alcancada', v_saldo >= r.pontos
      ) order by r.ordem), '[]'::jsonb)
      from recompensas r where r.ativo
    )
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. `search_path` fixo em tudo
--
-- Sem isto, quem conseguisse criar um schema antes de `public` no caminho de
-- busca poderia trocar o significado de uma função chamada lá dentro.
-- -----------------------------------------------------------------------------

alter function hoje_sp() set search_path = public;
alter function situacao_paciente(text, uuid, date, date) set search_path = public;
alter function tocar_atualizado_em() set search_path = public;
alter function desafio_sem_sobreposicao() set search_path = public;
alter function situacao_desafio(text, date, date) set search_path = public;

-- -----------------------------------------------------------------------------
-- 3. `anon` sai de tudo
--
-- O visitante sem login não precisa de nenhuma destas funções: a tela de
-- entrar usa só o serviço de autenticação do próprio Supabase.
-- -----------------------------------------------------------------------------

-- Só as funções DESTE projeto. As que vieram junto com uma extensão ficam
-- como estão: `citext_eq`, por exemplo, é o que compara dois e-mails, e
-- revogar isso quebraria o login e toda busca por e-mail no app inteiro.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (
        select 1 from pg_depend d
        where d.objid = p.oid
          and d.classid = 'pg_proc'::regclass
          and d.deptype = 'e'
      )
  loop
    execute format('revoke all on function %s from anon, public', f.assinatura);
  end loop;
end;
$$;

-- E os gatilhos não são para ninguém chamar pela mão.
revoke all on function ao_criar_usuario() from authenticated;
revoke all on function vincular_paciente_ao_perfil() from authenticated;
revoke all on function registrar_evento_paciente() from authenticated;
revoke all on function tocar_atualizado_em() from authenticated;
revoke all on function desafio_sem_sobreposicao() from authenticated;

-- O que a pessoa logada continua podendo chamar.
grant execute on function tem_acesso() to authenticated;
grant execute on function e_admin() to authenticated;
grant execute on function meu_acesso() to authenticated;
grant execute on function registrar_acesso() to authenticated;
grant execute on function hoje_sp() to authenticated;
grant execute on function situacao_paciente(text, uuid, date, date) to authenticated;
grant execute on function situacao_desafio(text, date, date) to authenticated;
grant execute on function config_inteiro(text, integer) to authenticated;
grant execute on function enviar_acao(uuid, text) to authenticated;
grant execute on function cancelar_envio(uuid) to authenticated;
grant execute on function registrar_indicacao(text, text, text) to authenticated;
grant execute on function ranking_do_desafio(uuid) to authenticated;
grant execute on function saldo_de_pontos(uuid) to authenticated;
grant execute on function pontos_no_desafio(uuid, uuid) to authenticated;
grant execute on function semana_do_desafio(uuid, date) to authenticated;
grant execute on function total_de_semanas(uuid) to authenticated;
grant execute on function periodo_da_semana(uuid, integer) to authenticated;
grant execute on function desafio_atual() to authenticated;
grant execute on function meu_paciente_id() to authenticated;
grant execute on function nome_para_ranking(text) to authenticated;
grant execute on function meu_desafio() to authenticated;
grant execute on function painel_do_desafio(uuid) to authenticated;
grant execute on function aprovar_envio(uuid) to authenticated;
grant execute on function recusar_envio(uuid, text) to authenticated;
grant execute on function ajustar_pontos(uuid, integer, text, uuid) to authenticated;
grant execute on function validar_indicacao(uuid, uuid) to authenticated;
grant execute on function recusar_indicacao(uuid, text) to authenticated;

-- E as tabelas também: `anon` não lê nada.
do $$
declare t text;
begin
  foreach t in array array[
    'perfis', 'planos', 'pacientes', 'convites', 'historico_admin', 'unidades',
    'grupos_alimentares', 'alimentos', 'equivalencias', 'conteudos', 'favoritos',
    'configuracoes', 'desafios', 'desafio_acoes', 'desafio_participantes',
    'desafio_envios', 'pontos_lancamentos', 'indicacoes', 'recompensas'
  ] loop
    execute format('revoke all on table %I from anon', t);
  end loop;
end;
$$;


-- ###########################################################################
-- 0011_desafio_dados.sql
-- ###########################################################################

-- =============================================================================
-- CENTRAL DO PACIENTE — 0011: o primeiro desafio e as recompensas
--
-- Os valores aqui são os do programa dela, copiados do briefing e de mais
-- nada. Nenhuma ação foi inventada, e duas que existem no documento original
-- ficaram DE FORA a pedido dela: participar da comunidade e enviar feedback
-- não geram pontos nesta implementação.
--
-- O desafio nasce com as datas do mês corrente, não com "setembro" escrito à
-- mão: quem instalar isto em outubro ganha o desafio de outubro. Daqui em
-- diante ela cria os próximos pelo painel, sem tocar em código.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Recompensas do Ponto de Virada (§47)
--
-- Os quatro degraus do programa. Os pontos não expiram e trocar uma
-- recompensa não zera o saldo — quem soma é o ledger, e ele não apaga nada.
-- -----------------------------------------------------------------------------

insert into recompensas (id, pontos, nome, descricao, ordem) values
  ('r200', 200, '30 dias de acompanhamento', null, 1),
  ('r300', 300, 'Kit degustação', 'Dois produtos de marcas parceiras.', 2),
  ('r400', 400, 'Consulta extra', null, 3),
  ('r500', 500, 'Kit completo', 'Um produto de cada marca parceira, mais um mimo exclusivo.', 4)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Como o ranking mostra os nomes (§19)
--
-- 'primeiro_inicial' = "Ana M.". Ela troca por 'primeiro' ou 'completo' em
-- Configurações, sem publicar o site de novo.
-- -----------------------------------------------------------------------------

insert into configuracoes (chave, valor, descricao) values
  ('ranking_nome', '"primeiro_inicial"'::jsonb,
   'Como o nome aparece no ranking: completo, primeiro ou primeiro_inicial.')
on conflict (chave) do nothing;

-- -----------------------------------------------------------------------------
-- O desafio do mês corrente
-- -----------------------------------------------------------------------------

do $$
declare
  v_inicio date := date_trunc('month', hoje_sp())::date;
  v_fim date := (date_trunc('month', hoje_sp()) + interval '1 month - 1 day')::date;
  v_meses text[] := array[
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];
  v_nome text;
  v_id uuid;
begin
  -- Se já existe desafio cobrindo este mês, não faz nada: rodar duas vezes
  -- não pode criar um segundo nem sobrescrever o que ela já editou.
  if exists (
    select 1 from desafios
    where status <> 'rascunho'
      and daterange(data_inicio, data_fim, '[]') && daterange(v_inicio, v_fim, '[]')
  ) then
    return;
  end if;

  v_nome := 'Desafio de ' || initcap(v_meses[extract(month from v_inicio)::int]);

  insert into desafios (nome, lema, descricao, data_inicio, data_fim, status, regras)
  values (
    v_nome,
    'Cada pequena ação conta.',
    'Um mês de constância. Marque o que você fez, e eu confiro.',
    v_inicio,
    v_fim,
    'ativo',
    'O ranking mostra sua constância no desafio, não o seu resultado corporal. '
    || 'Marcar uma ação não dá pontos na hora: eu confiro cada uma, e os pontos entram depois disso.'
  )
  returning id into v_id;

  -- As cinco ações, com a pontuação exata do programa.
  insert into desafio_acoes
    (desafio_id, chave, nome, descricao, pontos, periodicidade, max_ocorrencias, ordem)
  values
    (v_id, 'questionario', 'Respondi meu questionário semanal',
     null, 5, 'semanal', null, 1),
    (v_id, 'metas', 'Cumpri minhas metas da semana',
     null, 5, 'semanal', null, 2),
    (v_id, 'diario', 'Enviei meu diário alimentar',
     null, 5, 'semanal', null, 3),
    (v_id, 'redes', 'Compartilhei minha evolução e te marquei',
     'Uma vez por semana.', 10, 'semanal', null, 4),
    (v_id, 'indicacao', 'Indiquei uma amiga',
     'Os pontos entram quando ela começa o acompanhamento.', 50, 'evento', null, 5);
end;
$$;


-- ###########################################################################
-- 0012_desafio_criacao.sql
-- ###########################################################################

-- =============================================================================
-- CENTRAL DO PACIENTE — 0012: dois buracos que só apareceram no uso real
--
-- 1. DESAFIO NOVO NASCIA VAZIO
--
--    Criar um desafio pelo painel gravava só a linha do desafio. As cinco
--    ações não vinham junto — e desafio sem ação é um checklist em branco: a
--    paciente abre, não tem o que marcar, e não há como pontuar.
--
--    O §22 dela pede para criar desafio sem tocar em código. Um formulário
--    que produz algo inútil não cumpre isso.
--
-- 2. A NUTRICIONISTA NÃO CONSEGUIA VER A TELA DA PACIENTE
--
--    `meu_desafio()` devolve vazio quando não há cadastro de paciente ligado
--    à conta — e a conta dela é exatamente esse caso. Resultado: ela abria o
--    Desafio e lia "Nenhum desafio no ar", enquanto as pacientes viam o
--    desafio normalmente. A Central inteira é feita para ela conferir o que a
--    paciente vê; essa tela tinha ficado de fora.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Todo desafio nasce com as ações
--
-- Copia do desafio mais recente que tenha ações. Assim a pontuação que ela
-- ajustar uma vez vale para os meses seguintes, sem precisar recadastrar —
-- e sem nenhum valor escrito em código.
-- -----------------------------------------------------------------------------

create or replace function copiar_acoes_do_ultimo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_modelo uuid;
begin
  select a.desafio_id into v_modelo
  from desafio_acoes a
  join desafios d on d.id = a.desafio_id
  where d.id <> new.id
  group by a.desafio_id, d.data_inicio
  order by d.data_inicio desc
  limit 1;

  if v_modelo is null then
    -- Primeiro desafio do sistema: as cinco ações do programa dela.
    insert into desafio_acoes
      (desafio_id, chave, nome, descricao, pontos, periodicidade, ordem)
    values
      (new.id, 'questionario', 'Respondi meu questionário semanal', null, 5, 'semanal', 1),
      (new.id, 'metas', 'Cumpri minhas metas da semana', null, 5, 'semanal', 2),
      (new.id, 'diario', 'Enviei meu diário alimentar', null, 5, 'semanal', 3),
      (new.id, 'redes', 'Compartilhei minha evolução e te marquei', 'Uma vez por semana.', 10, 'semanal', 4),
      (new.id, 'indicacao', 'Indiquei uma amiga',
       'Os pontos entram quando ela começa o acompanhamento.', 50, 'evento', 5);
  else
    insert into desafio_acoes
      (desafio_id, chave, nome, descricao, pontos, periodicidade, max_ocorrencias, ativo, ordem)
    select new.id, a.chave, a.nome, a.descricao, a.pontos, a.periodicidade,
           a.max_ocorrencias, a.ativo, a.ordem
    from desafio_acoes a
    where a.desafio_id = v_modelo;
  end if;

  return new;
end;
$$;

drop trigger if exists copiar_acoes on desafios;
create trigger copiar_acoes
after insert on desafios
for each row execute function copiar_acoes_do_ultimo();

-- Os desafios que já nasceram vazios ganham as ações agora.
do $$
declare d record;
begin
  -- `des.id` qualificado de propósito: `desafio_acoes` também tem uma coluna
  -- `id`, e um `id` solto aqui dentro se liga à tabela de DENTRO do subselect.
  -- A condição vira `a.desafio_id = a.id`, que nunca é verdadeira — e o
  -- `not exists` passaria a valer para todo desafio, inclusive os que já têm
  -- ações. Foi o que aconteceu na primeira versão, e o teste acusou.
  for d in
    select des.id from desafios des
    where des.status <> 'encerrado'
      and not exists (select 1 from desafio_acoes a where a.desafio_id = des.id)
  loop
    insert into desafio_acoes
      (desafio_id, chave, nome, descricao, pontos, periodicidade, max_ocorrencias, ativo, ordem)
    select d.id, a.chave, a.nome, a.descricao, a.pontos, a.periodicidade,
           a.max_ocorrencias, a.ativo, a.ordem
    from desafio_acoes a
    where a.desafio_id = (
      select a2.desafio_id from desafio_acoes a2
      join desafios d2 on d2.id = a2.desafio_id
      group by a2.desafio_id, d2.data_inicio
      order by d2.data_inicio desc limit 1
    );
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. A nutricionista vê a tela da paciente
--
-- Sem cadastro de paciente ela entra em modo de prévia: vê o desafio, o
-- checklist e o ranking, com `previa: true` — a tela usa isso para explicar
-- que ali ela não pontua. Quem não é admin nem paciente continua sem nada.
-- -----------------------------------------------------------------------------

create or replace function meu_desafio()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_desafio desafios;
  v_paciente uuid;
  v_previa boolean;
  v_semana integer;
  v_pontos_mes integer;
  v_saldo integer;
  v_posicao integer;
  v_proxima integer;
begin
  v_paciente := meu_paciente_id();
  v_previa := v_paciente is null and e_admin();

  if v_paciente is null and not v_previa then
    return jsonb_build_object('temDesafio', false, 'previa', false,
                              'saldoAcumulado', 0, 'recompensas', '[]'::jsonb);
  end if;

  select * into v_desafio from desafios where id = desafio_atual();
  v_saldo := case when v_previa then 0 else coalesce(saldo_de_pontos(v_paciente), 0) end;

  if v_desafio.id is null then
    return jsonb_build_object(
      'temDesafio', false, 'previa', v_previa, 'saldoAcumulado', v_saldo,
      'recompensas', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', r.id, 'pontos', r.pontos, 'nome', r.nome, 'descricao', r.descricao,
          'alcancada', v_saldo >= r.pontos) order by r.ordem), '[]'::jsonb)
        from recompensas r where r.ativo));
  end if;

  v_semana := semana_do_desafio(v_desafio.id);
  v_pontos_mes := case when v_previa then 0
                  else coalesce(pontos_no_desafio(v_paciente, v_desafio.id), 0) end;

  if not v_previa then
    select r.posicao into v_posicao from ranking_do_desafio(v_desafio.id) r where r.sou_eu;
    select min(r.pontos) - v_pontos_mes into v_proxima
    from ranking_do_desafio(v_desafio.id) r where r.pontos > v_pontos_mes;
  end if;

  return jsonb_build_object(
    'temDesafio', true,
    'previa', v_previa,
    'desafio', jsonb_build_object(
      'id', v_desafio.id, 'nome', v_desafio.nome, 'descricao', v_desafio.descricao,
      'lema', v_desafio.lema, 'regras', v_desafio.regras,
      'dataInicio', v_desafio.data_inicio, 'dataFim', v_desafio.data_fim,
      'situacao', situacao_desafio(v_desafio.status, v_desafio.data_inicio, v_desafio.data_fim),
      'semanaAtual', v_semana, 'totalDeSemanas', total_de_semanas(v_desafio.id)),
    'pontosNoMes', v_pontos_mes,
    'saldoAcumulado', v_saldo,
    'posicao', v_posicao,
    'pontosParaProxima', v_proxima,
    'acoes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id, 'chave', a.chave, 'nome', a.nome, 'descricao', a.descricao,
        'pontos', a.pontos, 'periodicidade', a.periodicidade,
        'envio', (
          select jsonb_build_object('id', e.id, 'status', e.status, 'semana', e.semana,
            'observacao', e.observacao, 'motivoRecusa', e.motivo_recusa,
            'enviadoEm', e.enviado_em, 'pontosConcedidos', e.pontos_concedidos)
          from desafio_envios e
          where e.acao_id = a.id and e.paciente_id = v_paciente
            and (a.periodicidade <> 'semanal' or e.semana = v_semana)
            and e.status <> 'recusado'
          order by e.enviado_em desc limit 1),
        'aprovadas', (
          select count(*) from desafio_envios e
          where e.acao_id = a.id and e.paciente_id = v_paciente and e.status = 'aprovado')
      ) order by a.ordem), '[]'::jsonb)
      from desafio_acoes a where a.desafio_id = v_desafio.id and a.ativo),
    'ranking', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'posicao', r.posicao, 'nome', r.nome, 'pontos', r.pontos, 'souEu', r.sou_eu
      ) order by r.posicao, r.nome), '[]'::jsonb)
      from ranking_do_desafio(v_desafio.id) r),
    'historico', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', l.id, 'pontos', l.pontos, 'descricao', l.descricao,
        'tipo', l.tipo, 'criadoEm', l.criado_em) order by l.criado_em desc), '[]'::jsonb)
      from pontos_lancamentos l
      where l.paciente_id = v_paciente and l.desafio_id = v_desafio.id),
    'indicacoes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', i.id, 'nome', i.nome_indicada, 'status', i.status,
        'pontos', i.pontos_concedidos, 'criadoEm', i.criado_em) order by i.criado_em desc), '[]'::jsonb)
      from indicacoes i where i.paciente_indicadora_id = v_paciente),
    'recompensas', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', r.id, 'pontos', r.pontos, 'nome', r.nome, 'descricao', r.descricao,
        'alcancada', v_saldo >= r.pontos) order by r.ordem), '[]'::jsonb)
      from recompensas r where r.ativo));
end;
$$;

grant execute on function meu_desafio() to authenticated;
revoke all on function copiar_acoes_do_ultimo() from anon, public, authenticated;


-- ###########################################################################
-- 0013_desafio_ajustes.sql
-- ###########################################################################

-- =============================================================================
-- CENTRAL DO PACIENTE — 0013: o que ela pediu depois de usar o desafio
--
-- Cinco mudanças, todas autorizadas por ela:
--
-- 1. Lembrete de frequência em toda ação, não só na das redes. E o diário
--    alimentar passa a valer DUAS vezes por semana — o que o banco não sabia
--    fazer: 'semanal' significava "uma vez", ponto final.
-- 2. Indicação passa de 50 para 100 pontos.
-- 3. A escada de benefícios da indicação vira tabela, do mesmo jeito que as
--    recompensas: é regra do programa dela, não texto de tela.
-- 4. Indicação não zera no fim do mês — o total de cada paciente é de sempre.
-- 5. Ela pode lançar a ação por uma paciente que fez e esqueceu de marcar,
--    sem inventar ponto solto: entra pelo mesmo caminho de um envio aprovado.
--
-- O que NÃO muda: a paciente continua sem conseguir escrever um ponto. Lançar
-- por ela é função de admin, e cai no mesmo ledger, com o mesmo histórico.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Uma ação pode valer mais de uma vez por semana
--
-- `max_por_semana` é dado, não código: o dia em que ela quiser o diário 3x,
-- é uma linha de update. O envio ganha `ocorrencia` (1, 2, ...) porque a
-- trava de duplicidade é um índice único, e sem esse número a segunda marca
-- da semana bateria de frente com a primeira.
-- -----------------------------------------------------------------------------

alter table desafio_acoes
  add column if not exists max_por_semana integer not null default 1;

alter table desafio_acoes
  drop constraint if exists desafio_acoes_max_por_semana_check;
alter table desafio_acoes
  add constraint desafio_acoes_max_por_semana_check check (max_por_semana > 0);

alter table desafio_envios
  add column if not exists ocorrencia integer not null default 1;

alter table desafio_envios
  drop constraint if exists desafio_envios_ocorrencia_check;
alter table desafio_envios
  add constraint desafio_envios_ocorrencia_check check (ocorrencia > 0);

drop index if exists envios_sem_duplicata_semanal_idx;
create unique index if not exists envios_sem_duplicata_semanal_idx
  on desafio_envios (desafio_id, acao_id, paciente_id, semana, ocorrencia)
  where status <> 'recusado' and semana is not null;

/**
 * "Eu fiz isso."
 *
 * Mesma função de sempre, com uma conta a mais: quantas vezes esta ação já
 * foi marcada nesta semana. Enquanto couber, a próxima marca ganha o número
 * seguinte; quando não couber, a recusa vem daqui e não da tela.
 */
create or replace function enviar_acao(p_acao uuid, p_observacao text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
  v_acao desafio_acoes;
  v_desafio desafios;
  v_semana integer;
  v_id uuid;
  v_ocorrencias integer;
  v_ocorrencia integer := 1;
begin
  if not tem_acesso() then
    raise exception 'Seu acesso não está liberado.' using errcode = '42501';
  end if;

  v_paciente := meu_paciente_id();
  if v_paciente is null then
    raise exception 'Não encontrei seu cadastro de paciente.' using errcode = '42501';
  end if;

  select * into v_acao from desafio_acoes where id = p_acao and ativo;
  if not found then
    raise exception 'Esta ação não está disponível.' using errcode = '22023';
  end if;

  select * into v_desafio from desafios where id = v_acao.desafio_id;
  if situacao_desafio(v_desafio.status, v_desafio.data_inicio, v_desafio.data_fim) <> 'ativo' then
    raise exception 'Este desafio não está em andamento.' using errcode = '22023';
  end if;

  if v_acao.periodicidade = 'semanal' then
    v_semana := semana_do_desafio(v_desafio.id);
    if v_semana is null then
      raise exception 'Hoje está fora do período do desafio.' using errcode = '22023';
    end if;

    -- Quantas vezes já marcou nesta semana. Recusado não conta: se ela
    -- recusou, a vaga volta a existir.
    select coalesce(max(e.ocorrencia), 0) into v_ocorrencias
    from desafio_envios e
    where e.acao_id = v_acao.id and e.paciente_id = v_paciente
      and e.semana = v_semana and e.status <> 'recusado';

    if v_ocorrencias >= v_acao.max_por_semana then
      raise exception 'Você já marcou esta ação o número de vezes desta semana.'
        using errcode = '23505';
    end if;
    v_ocorrencia := v_ocorrencias + 1;
  else
    v_semana := null;
  end if;

  if v_acao.periodicidade = 'evento' and v_acao.max_ocorrencias is not null then
    select count(*) into v_ocorrencias
    from desafio_envios
    where acao_id = v_acao.id and paciente_id = v_paciente and status <> 'recusado';
    if v_ocorrencias >= v_acao.max_ocorrencias then
      raise exception 'Você já usou todas as vezes desta ação.' using errcode = '22023';
    end if;
  end if;

  insert into desafio_participantes (desafio_id, paciente_id)
  values (v_desafio.id, v_paciente)
  on conflict (desafio_id, paciente_id) do nothing;

  insert into desafio_envios
    (desafio_id, acao_id, paciente_id, semana, ocorrencia, observacao)
  values
    (v_desafio.id, v_acao.id, v_paciente, v_semana, v_ocorrencia,
     nullif(trim(p_observacao), ''))
  returning id into v_id;

  return v_id;
exception
  when unique_violation then
    raise exception 'Você já enviou esta ação.' using errcode = '23505';
end;
$$;

grant execute on function enviar_acao(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Ela lança a ação pela paciente
--
-- O caso é o dela: "a paciente que faz tudo mas esquece de registrar". Não
-- vira ponto solto de ajuste — vira um envio como qualquer outro, já
-- aprovado por ela, com o nome dela no histórico. Assim o número bate com o
-- resto: a ação aparece marcada para a paciente, conta no `aprovadas`, e o
-- índice de duplicidade impede lançar duas vezes a mesma semana.
-- -----------------------------------------------------------------------------

create or replace function conceder_acao(
  p_paciente uuid,
  p_acao uuid,
  p_semana integer default null,
  p_observacao text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acao desafio_acoes;
  v_desafio desafios;
  v_semana integer;
  v_ocorrencias integer;
  v_id uuid;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista lança ação por alguém.' using errcode = '42501';
  end if;

  select * into v_acao from desafio_acoes where id = p_acao;
  if not found then
    raise exception 'Ação não encontrada.' using errcode = '22023';
  end if;
  select * into v_desafio from desafios where id = v_acao.desafio_id;

  -- Lançar num desafio encerrado é legítimo — é o caso de corrigir o mês
  -- passado. Lançar num rascunho não: a paciente nem sabe que ele existe, e
  -- o ponto apareceria no saldo dela vindo de lugar nenhum.
  if v_desafio.status = 'rascunho' then
    raise exception 'Este desafio ainda é um rascunho. Publique antes de lançar pontos.'
      using errcode = '22023';
  end if;

  if not exists (select 1 from pacientes where id = p_paciente) then
    raise exception 'Paciente não encontrada.' using errcode = '22023';
  end if;

  if v_acao.periodicidade = 'semanal' then
    v_semana := coalesce(p_semana, semana_do_desafio(v_desafio.id));
    if v_semana is null then
      raise exception 'Escolha a semana: hoje está fora do período do desafio.'
        using errcode = '22023';
    end if;
    select coalesce(max(e.ocorrencia), 0) into v_ocorrencias
    from desafio_envios e
    where e.acao_id = v_acao.id and e.paciente_id = p_paciente
      and e.semana = v_semana and e.status <> 'recusado';
    if v_ocorrencias >= v_acao.max_por_semana then
      raise exception 'Esta ação já está lançada para esta semana.' using errcode = '23505';
    end if;
  else
    v_semana := null;
    v_ocorrencias := 0;
  end if;

  insert into desafio_participantes (desafio_id, paciente_id)
  values (v_desafio.id, p_paciente)
  on conflict (desafio_id, paciente_id) do nothing;

  insert into desafio_envios
    (desafio_id, acao_id, paciente_id, semana, ocorrencia, observacao)
  values
    (v_desafio.id, v_acao.id, p_paciente, v_semana, v_ocorrencias + 1,
     coalesce(nullif(trim(p_observacao), ''), 'Lançado pela nutricionista.'))
  returning id into v_id;

  perform aprovar_envio(v_id);
  return v_id;
end;
$$;

revoke all on function conceder_acao(uuid, uuid, integer, text) from anon, public;
grant execute on function conceder_acao(uuid, uuid, integer, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. A escada de benefícios da indicação
--
-- Em tabela, como as recompensas, pelo mesmo motivo: é regra do programa
-- dela. Os valores vieram do pedido dela e só mudam com autorização dela.
-- -----------------------------------------------------------------------------

create table if not exists indicacao_beneficios (
  nivel integer primary key check (nivel > 0),
  texto text not null,
  ativo boolean not null default true
);

alter table indicacao_beneficios enable row level security;

drop policy if exists indicacao_beneficios_leitura on indicacao_beneficios;
create policy indicacao_beneficios_leitura on indicacao_beneficios for select
  using (e_admin() or (ativo and tem_acesso()));

drop policy if exists indicacao_beneficios_admin on indicacao_beneficios;
create policy indicacao_beneficios_admin on indicacao_beneficios for all
  using (e_admin()) with check (e_admin());

grant select, insert, update, delete on indicacao_beneficios to authenticated;
revoke all on table indicacao_beneficios from anon;

insert into indicacao_beneficios (nivel, texto) values
  (1, '100 pontos'),
  (2, '100 pontos + 20% de desconto na renovação do plano'),
  (3, '100 pontos + 1 consulta bônus'),
  (4, '100 pontos + 1 consulta bônus + 1 kit completo das marcas parceiras')
on conflict (nivel) do update set texto = excluded.texto, ativo = true;

-- -----------------------------------------------------------------------------
-- 4. Quantas indicações cada paciente já fez, de sempre
--
-- O ranking é do mês; isto não é. A conta ignora desafio de propósito: a
-- indicação de março continua contando em setembro, igual ao saldo de
-- pontos, que também não expira.
-- -----------------------------------------------------------------------------

create or replace function indicacoes_validadas(p_paciente uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- A mesma fechadura do `saldo_de_pontos` (0010): sem isto, uma paciente
  -- passaria o id de outra e descobriria quantas amigas a colega indicou.
  -- O `coalesce` é o que impede o nulo de escapar: `if null` não entra no
  -- bloco, e a checagem inteira viraria enfeite.
  if not coalesce(e_admin() or p_paciente = meu_paciente_id(), false) then
    raise exception 'Você só pode ver as suas indicações.' using errcode = '42501';
  end if;

  return (
    select count(*)::int from indicacoes
    where paciente_indicadora_id = p_paciente and status = 'validada'
  );
end;
$$;

revoke all on function indicacoes_validadas(uuid) from anon, public;
grant execute on function indicacoes_validadas(uuid) to authenticated;

/** O quadro de quem já indicou — "Alana · 1 indicação". Só para admin. */
create or replace function resumo_indicacoes()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê o resumo.' using errcode = '42501';
  end if;

  return (
    select coalesce(jsonb_agg(x order by (x->>'validadas')::int desc, x->>'nome'), '[]'::jsonb)
    from (
      select jsonb_build_object(
        'pacienteId', p.id,
        'nome', p.nome,
        'validadas', count(*) filter (where i.status = 'validada'),
        'emAndamento', count(*) filter (where i.status in ('registrada', 'iniciou'))
      ) as x
      from indicacoes i
      join pacientes p on p.id = i.paciente_indicadora_id
      group by p.id, p.nome
    ) t
  );
end;
$$;

revoke all on function resumo_indicacoes() from anon, public;
grant execute on function resumo_indicacoes() to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Indicação vale 100
--
-- Vale para os desafios que já existem e para os que vierem. O fallback da
-- validação também sobe: ele é a rede de segurança para uma indicação sem
-- desafio nenhum ligado, e deixá-lo em 50 daria dois valores diferentes para
-- a mesma coisa.
-- -----------------------------------------------------------------------------

update desafio_acoes set pontos = 100 where chave = 'indicacao' and pontos = 50;

create or replace function validar_indicacao(p_indicacao uuid, p_paciente_indicada uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ind indicacoes;
  v_pontos integer;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista valida indicação.' using errcode = '42501';
  end if;

  select * into v_ind from indicacoes where id = p_indicacao for update;
  if not found then
    raise exception 'Indicação não encontrada.' using errcode = '22023';
  end if;
  if v_ind.status = 'validada' then
    return;
  end if;

  select coalesce(max(pontos), 100) into v_pontos
  from desafio_acoes
  where chave = 'indicacao' and desafio_id = coalesce(v_ind.desafio_id, desafio_atual());

  update indicacoes
     set status = 'validada',
         paciente_indicada_id = coalesce(p_paciente_indicada, paciente_indicada_id),
         pontos_concedidos = v_pontos,
         validado_em = now(),
         validado_por = auth.uid()
   where id = p_indicacao;

  insert into pontos_lancamentos
    (paciente_id, desafio_id, indicacao_id, pontos, tipo, descricao, criado_por)
  values
    (v_ind.paciente_indicadora_id, coalesce(v_ind.desafio_id, desafio_atual()), p_indicacao,
     v_pontos, 'indicacao', 'Indicação de ' || v_ind.nome_indicada, auth.uid());
end;
$$;

grant execute on function validar_indicacao(uuid, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 1 (continuação). O lembrete de frequência em toda ação
--
-- Só onde o texto ainda é o de fábrica: se ela já reescreveu a descrição de
-- alguma ação pelo banco, a dela fica.
-- -----------------------------------------------------------------------------

update desafio_acoes set descricao = 'Uma vez por semana.'
 where chave in ('questionario', 'metas', 'redes')
   and (descricao is null or descricao = 'Uma vez por semana.');

update desafio_acoes set descricao = 'Duas vezes por semana.', max_por_semana = 2
 where chave = 'diario'
   and (descricao is null or descricao in ('Uma vez por semana.', 'Duas vezes por semana.'));

-- E o molde dos próximos desafios nasce já assim.
create or replace function copiar_acoes_do_ultimo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_modelo uuid;
begin
  select a.desafio_id into v_modelo
  from desafio_acoes a
  join desafios d on d.id = a.desafio_id
  where d.id <> new.id
  group by a.desafio_id, d.data_inicio
  order by d.data_inicio desc
  limit 1;

  if v_modelo is null then
    insert into desafio_acoes
      (desafio_id, chave, nome, descricao, pontos, periodicidade, max_por_semana, ordem)
    values
      (new.id, 'questionario', 'Respondi meu questionário semanal',
       'Uma vez por semana.', 5, 'semanal', 1, 1),
      (new.id, 'metas', 'Cumpri minhas metas da semana',
       'Uma vez por semana.', 5, 'semanal', 1, 2),
      (new.id, 'diario', 'Enviei meu diário alimentar',
       'Duas vezes por semana.', 5, 'semanal', 2, 3),
      (new.id, 'redes', 'Compartilhei minha evolução e te marquei',
       'Uma vez por semana.', 10, 'semanal', 1, 4),
      (new.id, 'indicacao', 'Indiquei uma amiga',
       'Os pontos entram quando ela começa o acompanhamento.', 100, 'evento', 1, 5);
  else
    insert into desafio_acoes
      (desafio_id, chave, nome, descricao, pontos, periodicidade,
       max_por_semana, max_ocorrencias, ativo, ordem)
    select new.id, a.chave, a.nome, a.descricao, a.pontos, a.periodicidade,
           a.max_por_semana, a.max_ocorrencias, a.ativo, a.ordem
    from desafio_acoes a
    where a.desafio_id = v_modelo;
  end if;

  return new;
end;
$$;

revoke all on function copiar_acoes_do_ultimo() from anon, public, authenticated;

-- -----------------------------------------------------------------------------
-- O que a tela da paciente passa a receber
--
-- Três campos novos, e nenhum deles é conta feita no navegador:
--   `maxPorSemana` e `podeMarcar` — quem decide se ainda cabe marcar é o
--        banco, que é quem também recusa o envio a mais.
--   `envios` no lugar de `envio` — uma ação de duas vezes por semana tem
--        dois estados ao mesmo tempo, e um campo só não conseguia mostrar.
--   `indicacoesValidadas` e `beneficiosIndicacao` — a escada dela, com o
--        degrau em que a paciente está.
-- -----------------------------------------------------------------------------

create or replace function meu_desafio()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_desafio desafios;
  v_paciente uuid;
  v_previa boolean;
  v_semana integer;
  v_pontos_mes integer;
  v_saldo integer;
  v_posicao integer;
  v_proxima integer;
  v_indicacoes integer;
  v_beneficios jsonb;
  v_ativo boolean;
begin
  v_paciente := meu_paciente_id();
  v_previa := v_paciente is null and e_admin();

  if v_paciente is null and not v_previa then
    return jsonb_build_object('temDesafio', false, 'previa', false,
                              'saldoAcumulado', 0, 'indicacoesValidadas', 0,
                              'beneficiosIndicacao', '[]'::jsonb,
                              'recompensas', '[]'::jsonb);
  end if;

  select * into v_desafio from desafios where id = desafio_atual();
  v_saldo := case when v_previa then 0 else coalesce(saldo_de_pontos(v_paciente), 0) end;
  v_indicacoes := case when v_previa then 0
                  else coalesce(indicacoes_validadas(v_paciente), 0) end;
  v_beneficios := (
    select coalesce(jsonb_agg(jsonb_build_object(
      'nivel', b.nivel, 'texto', b.texto, 'alcancado', v_indicacoes >= b.nivel
    ) order by b.nivel), '[]'::jsonb)
    from indicacao_beneficios b where b.ativo);

  if v_desafio.id is null then
    return jsonb_build_object(
      'temDesafio', false, 'previa', v_previa, 'saldoAcumulado', v_saldo,
      'indicacoesValidadas', v_indicacoes,
      'beneficiosIndicacao', v_beneficios,
      'recompensas', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', r.id, 'pontos', r.pontos, 'nome', r.nome, 'descricao', r.descricao,
          'alcancada', v_saldo >= r.pontos) order by r.ordem), '[]'::jsonb)
        from recompensas r where r.ativo));
  end if;

  v_semana := semana_do_desafio(v_desafio.id);
  v_ativo := situacao_desafio(v_desafio.status, v_desafio.data_inicio, v_desafio.data_fim) = 'ativo';
  v_pontos_mes := case when v_previa then 0
                  else coalesce(pontos_no_desafio(v_paciente, v_desafio.id), 0) end;

  if not v_previa then
    select r.posicao into v_posicao from ranking_do_desafio(v_desafio.id) r where r.sou_eu;
    select min(r.pontos) - v_pontos_mes into v_proxima
    from ranking_do_desafio(v_desafio.id) r where r.pontos > v_pontos_mes;
  end if;

  return jsonb_build_object(
    'temDesafio', true,
    'previa', v_previa,
    'desafio', jsonb_build_object(
      'id', v_desafio.id, 'nome', v_desafio.nome, 'descricao', v_desafio.descricao,
      'lema', v_desafio.lema, 'regras', v_desafio.regras,
      'dataInicio', v_desafio.data_inicio, 'dataFim', v_desafio.data_fim,
      'situacao', situacao_desafio(v_desafio.status, v_desafio.data_inicio, v_desafio.data_fim),
      'semanaAtual', v_semana, 'totalDeSemanas', total_de_semanas(v_desafio.id)),
    'pontosNoMes', v_pontos_mes,
    'saldoAcumulado', v_saldo,
    'posicao', v_posicao,
    'pontosParaProxima', v_proxima,
    'indicacoesValidadas', v_indicacoes,
    'beneficiosIndicacao', v_beneficios,
    'acoes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id, 'chave', a.chave, 'nome', a.nome, 'descricao', a.descricao,
        'pontos', a.pontos, 'periodicidade', a.periodicidade,
        'maxPorSemana', a.max_por_semana,
        -- Os envios da semana, o recusado inclusive: a paciente precisa ler o
        -- motivo, e o lugar de ler é o cartão da ação.
        'envios', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'id', e.id, 'status', e.status, 'semana', e.semana,
            'observacao', e.observacao, 'motivoRecusa', e.motivo_recusa,
            'enviadoEm', e.enviado_em, 'pontosConcedidos', e.pontos_concedidos
          ) order by e.enviado_em), '[]'::jsonb)
          from desafio_envios e
          where e.acao_id = a.id and e.paciente_id = v_paciente
            and (a.periodicidade <> 'semanal' or e.semana = v_semana)),
        -- Se ainda cabe marcar. Quem decide é aqui, não o botão.
        'podeMarcar', (
          v_ativo and not v_previa and v_paciente is not null
          and case
            when a.periodicidade = 'semanal' then
              v_semana is not null and (
                select count(*) from desafio_envios e
                where e.acao_id = a.id and e.paciente_id = v_paciente
                  and e.semana = v_semana and e.status <> 'recusado'
              ) < a.max_por_semana
            when a.periodicidade = 'evento' then
              a.max_ocorrencias is null or (
                select count(*) from desafio_envios e
                where e.acao_id = a.id and e.paciente_id = v_paciente
                  and e.status <> 'recusado'
              ) < a.max_ocorrencias
            else not exists (
              select 1 from desafio_envios e
              where e.acao_id = a.id and e.paciente_id = v_paciente
                and e.status <> 'recusado')
          end),
        'aprovadas', (
          select count(*) from desafio_envios e
          where e.acao_id = a.id and e.paciente_id = v_paciente and e.status = 'aprovado')
      ) order by a.ordem), '[]'::jsonb)
      from desafio_acoes a where a.desafio_id = v_desafio.id and a.ativo),
    'ranking', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'posicao', r.posicao, 'nome', r.nome, 'pontos', r.pontos, 'souEu', r.sou_eu
      ) order by r.posicao, r.nome), '[]'::jsonb)
      from ranking_do_desafio(v_desafio.id) r),
    'historico', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', l.id, 'pontos', l.pontos, 'descricao', l.descricao,
        'tipo', l.tipo, 'criadoEm', l.criado_em) order by l.criado_em desc), '[]'::jsonb)
      from pontos_lancamentos l
      where l.paciente_id = v_paciente and l.desafio_id = v_desafio.id),
    'indicacoes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', i.id, 'nome', i.nome_indicada, 'status', i.status,
        'pontos', i.pontos_concedidos, 'criadoEm', i.criado_em) order by i.criado_em desc), '[]'::jsonb)
      from indicacoes i where i.paciente_indicadora_id = v_paciente),
    'recompensas', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', r.id, 'pontos', r.pontos, 'nome', r.nome, 'descricao', r.descricao,
        'alcancada', v_saldo >= r.pontos) order by r.ordem), '[]'::jsonb)
      from recompensas r where r.ativo));
end;
$$;

grant execute on function meu_desafio() to authenticated;

-- E o `anon` continua sem nada do que nasceu aqui.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('conceder_acao', 'indicacoes_validadas', 'resumo_indicacoes',
                        'enviar_acao', 'meu_desafio', 'validar_indicacao',
                        'copiar_acoes_do_ultimo')
  loop
    execute format('revoke all on function %s from anon, public', f.assinatura);
  end loop;
end;
$$;


-- ###########################################################################
-- 0014_reintroducao.sql
-- ###########################################################################

-- =============================================================================
-- CENTRAL DO PACIENTE — 0014: Rastreabilidade alimentar e reintrodução
--
-- O material dela é o "Mapa de Reintrodução — Rota da Regulação Intestinal".
-- Este arquivo é a tradução dele para o banco, com UMA regra acima de todas:
--
--   O APLICATIVO REGISTRA O PROCESSO. ELE NÃO DITA O PROCESSO.
--
-- Por isso, repare no que NÃO existe aqui:
--
--   * nenhuma trava de tempo entre um alimento e o seguinte. O material
--     sugere "um alimento novo a cada 2 dias", e sugestão é o que continua
--     sendo: a paciente pode registrar três alimentos no mesmo dia se foi
--     isso que ela combinou com a nutricionista;
--   * nenhuma lista obrigatória. A lista de cada paciente é montada pela
--     nutricionista, e a própria paciente pode tirar da frente o que não come;
--   * nenhuma conclusão automática. Sintoma registrado NÃO vira "intolerante
--     a este alimento": vira uma linha no histórico, e quem lê é a
--     nutricionista;
--   * nenhuma cobrança. Não há prazo, meta, contagem regressiva nem alerta de
--     atraso. Um alimento não testado fica 'nao_iniciado' e pronto.
--
-- A semana aqui é só uma forma de agrupar o histórico no tempo. Ela não
-- fecha, não vence e não exige nada: o que sobrou da semana 1 continua
-- disponível na semana 2 sem virar pendência.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- O catálogo do material
--
-- Conteúdo, como os alimentos e os guias: é a referência dela, não dado de
-- paciente. `semana_sugerida` é a etapa em que o alimento aparece no PDF —
-- uma sugestão de ordem, nada que o sistema faça valer.
-- -----------------------------------------------------------------------------

create table if not exists reintroducao_alimentos (
  id text primary key,
  nome text not null,
  categoria text not null
    check (categoria in ('carboidratos', 'gorduras', 'proteinas', 'frutas', 'vegetais', 'outros')),
  -- 1 a 4 conforme o material; nulo para o que ela cadastrar fora dele.
  semana_sugerida integer check (semana_sugerida is null or semana_sugerida between 1 and 5),
  -- Texto, não número: o material tem "60g", "600ml" e "livre".
  porcao_referencia text,
  observacao text,
  ordem integer not null default 0,
  ativo boolean not null default true
);

create index if not exists reintroducao_alimentos_idx
  on reintroducao_alimentos (semana_sugerida, categoria, ordem);

-- -----------------------------------------------------------------------------
-- O acompanhamento de cada paciente
--
-- `inicio` existe só para a semana do histórico ter uma âncora. Quando está
-- nulo, a âncora é o primeiro registro da paciente — assim ninguém precisa
-- "abrir" nada para começar a usar.
-- -----------------------------------------------------------------------------

create table if not exists reintroducao_acompanhamento (
  paciente_id uuid primary key references pacientes (id) on delete cascade,
  inicio date,
  -- Recado da nutricionista para aquela paciente, no topo da tela dela.
  orientacao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- A lista daquela paciente
--
-- Personalizada de propósito (§5 do pedido dela): não existe "a lista", só a
-- lista de cada uma. Um item pode vir do catálogo ou ser um nome digitado —
-- o material diz que o que não está na lista entra na semana 5, e é esse o
-- caminho.
-- -----------------------------------------------------------------------------

create table if not exists reintroducao_itens (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes (id) on delete cascade,
  alimento_id text references reintroducao_alimentos (id) on delete set null,
  nome_livre text,
  -- Estados neutros (§10 e §12). Nenhum deles significa "proibido", e nenhum
  -- é atribuído automaticamente por causa de um sintoma.
  status text not null default 'nao_iniciado'
    check (status in (
      'nao_iniciado', 'em_teste', 'bem_tolerado', 'tolerancia_parcial',
      'sintomas_observados', 'necessita_reavaliacao', 'pausado', 'nao_relevante'
    )),
  nota_nutri text,
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint item_precisa_de_nome
    check (alimento_id is not null or coalesce(trim(nome_livre), '') <> '')
);

create index if not exists reintroducao_itens_paciente_idx
  on reintroducao_itens (paciente_id, ordem);

-- O mesmo alimento do catálogo não entra duas vezes na lista da mesma
-- paciente. Nome livre pode repetir: "pão da padaria" e "pão sem glúten" são
-- testes diferentes.
create unique index if not exists reintroducao_item_sem_repeticao_idx
  on reintroducao_itens (paciente_id, alimento_id)
  where alimento_id is not null;

-- -----------------------------------------------------------------------------
-- Os registros
--
-- Um por vez que a paciente comeu o alimento. O mesmo item pode ter quantos
-- registros forem precisos — é assim que "tapioca no dia 1, dia 2 e dia 3"
-- acontece, sem que o terceiro dia seja obrigatório.
-- -----------------------------------------------------------------------------

create table if not exists reintroducao_registros (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references reintroducao_itens (id) on delete cascade,
  -- Repetido de propósito: a política de leitura da paciente fica direta, sem
  -- precisar visitar a tabela de itens a cada linha.
  paciente_id uuid not null references pacientes (id) on delete cascade,
  data date not null,
  horario time,
  quantidade text,
  preparo text,
  -- Vários ao mesmo tempo, porque é assim que sintoma acontece.
  sintomas text[] not null default '{}',
  intensidade integer check (intensidade is null or intensidade between 0 and 10),
  -- Escala de Bristol, que está no protocolo de rastreio do material dela.
  bristol integer check (bristol is null or bristol between 1 and 7),
  observacao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists reintroducao_registros_paciente_idx
  on reintroducao_registros (paciente_id, data desc, horario);
create index if not exists reintroducao_registros_item_idx
  on reintroducao_registros (item_id, data);

do $$
declare t text;
begin
  foreach t in array array[
    'reintroducao_acompanhamento', 'reintroducao_itens', 'reintroducao_registros'
  ] loop
    execute format('drop trigger if exists tocar_atualizado on %I', t);
    execute format(
      'create trigger tocar_atualizado before update on %I for each row execute function tocar_atualizado_em()',
      t
    );
  end loop;
end;
$$;


-- ###########################################################################
-- 0015_reintroducao_catalogo.sql
-- ###########################################################################

-- =============================================================================
-- CENTRAL DO PACIENTE — 0015: o catálogo do Mapa de Reintrodução
--
-- Alimento por alimento do material dela, com a porção de referência que está
-- escrita no PDF. Nada foi acrescentado de fora: o que não está no documento
-- não está aqui.
--
-- `semana_sugerida` é a etapa em que o alimento aparece no material. É
-- sugestão de ordem, e o sistema não a faz valer: a nutricionista monta a
-- lista de cada paciente na ordem que quiser, e a paciente registra quando
-- acontecer.
--
-- A porção também é referência, não regra. O próprio material explica o
-- limiar de tolerância: testar a porção proposta, e se houver sintoma,
-- reduzir pela metade e observar de novo — o objetivo não é excluir o
-- alimento, é achar a quantidade que cabe.
-- =============================================================================

insert into reintroducao_alimentos
  (id, nome, categoria, semana_sugerida, porcao_referencia, observacao, ordem) values

-- ------------------------------------------------------------------ semana 1
  ('abacate',        'Abacate / avocado',        'gorduras',     1, '60g',   null, 101),
  ('pera',           'Pêra',                     'frutas',       1, '175g',  null, 102),
  ('pessego',        'Pêssego',                  'frutas',       1, '250g',  null, 103),
  ('manga',          'Manga',                    'frutas',       1, '160g',  null, 104),

-- ------------------------------------------------------------------ semana 2
  ('cara',           'Cará',                     'carboidratos', 2, '160g',  null, 201),
  ('inhame',         'Inhame',                   'carboidratos', 2, '90g',   null, 202),
  ('avela',          'Avelã',                    'gorduras',     2, '13g',   null, 203),
  ('azeitona',       'Azeitona',                 'gorduras',     2, '25g',   null, 204),
  ('chocolate-60',   'Chocolate 60% ou mais',    'gorduras',     2, '15g',   null, 205),
  ('nozes',          'Nozes',                    'gorduras',     2, '15g',   null, 206),
  ('cottage-vaca',   'Queijo cottage de vaca',   'proteinas',    2, '150g',
   'Prefira sem lactose.', 207),
  ('cottage-bufala', 'Queijo cottage de búfala', 'proteinas',    2, '150g',
   'Prefira sem lactose.', 208),
  ('acerola',        'Acerola',                  'frutas',       2, '310g',  null, 209),
  ('goiaba',         'Goiaba',                   'frutas',       2, '150g',  null, 210),
  ('jabuticaba',     'Jabuticaba',               'frutas',       2, '170g',  null, 211),
  ('lichia',         'Lichia',                   'frutas',       2, '140g',  null, 212),
  ('aspargos',       'Aspargos',                 'vegetais',     2, 'Livre',
   'Vegetais em quantidade livre, com porção mínima de 200g no almoço e no jantar.', 213),
  ('cogumelos',      'Cogumelos',                'vegetais',     2, 'Livre',
   'Vegetais em quantidade livre, com porção mínima de 200g no almoço e no jantar.', 214),
  ('ervilha-torta',  'Ervilha torta',            'vegetais',     2, 'Livre',
   'Vegetais em quantidade livre, com porção mínima de 200g no almoço e no jantar.', 215),
  ('nabo',           'Nabo',                     'vegetais',     2, 'Livre',
   'Vegetais em quantidade livre, com porção mínima de 200g no almoço e no jantar.', 216),
  ('vagem',          'Vagem',                    'vegetais',     2, 'Livre',
   'Vegetais em quantidade livre, com porção mínima de 200g no almoço e no jantar.', 217),

-- ------------------------------------------------------------------ semana 3
  ('mel',            'Mel',                      'carboidratos', 3, '30g',   null, 301),
  ('batata-doce',    'Batata doce',              'carboidratos', 3, '160g',  null, 302),
  ('manteiga',       'Manteiga',                 'gorduras',     3, '10g',   null, 303),
  ('manteiga-bufala','Manteiga de búfala',       'gorduras',     3, '10g',   null, 304),
  ('queijo-brie',    'Queijo brie',              'gorduras',     3, '25g',   null, 305),
  ('pistache',       'Pistache torrado',         'gorduras',     3, '15g',   null, 306),
  ('queijos-bufala', 'Queijos de búfala',        'gorduras',     3, '30g',   null, 307),
  ('carne-vermelha', 'Carne vermelha',           'proteinas',    3, '70g',   null, 308),
  ('carne-porco',    'Carne de porco',           'proteinas',    3, '70g',   null, 309),
  ('whey',           'Proteína em pó — whey',    'proteinas',    3, '40g',   null, 310),
  ('agua-de-coco',   'Água de coco',             'frutas',       3, '600ml',
   'Da fruta.', 311),
  ('banana-da-terra','Banana da terra',          'frutas',       3, '80g',   null, 312),
  ('melancia',       'Melancia',                 'frutas',       3, '330g',  null, 313),
  ('alho-poro',      'Alho poró',                'vegetais',     3, 'Livre',
   'Vegetais em quantidade livre, com porção mínima de 200g no almoço e no jantar.', 314),
  ('brocolis',       'Brócolis',                 'vegetais',     3, 'Livre',
   'Vegetais em quantidade livre, com porção mínima de 200g no almoço e no jantar.', 315),
  ('couve-flor',     'Couve-flor',               'vegetais',     3, 'Livre',
   'Vegetais em quantidade livre, com porção mínima de 200g no almoço e no jantar.', 316),
  ('couve-bruxelas', 'Couve-de-bruxelas',        'vegetais',     3, 'Livre',
   'Vegetais em quantidade livre, com porção mínima de 200g no almoço e no jantar.', 317),
  ('repolho',        'Repolho',                  'vegetais',     3, 'Livre',
   'Vegetais em quantidade livre, com porção mínima de 200g no almoço e no jantar.', 318),
  ('folhas-e-brotos','Todas as folhas e brotos', 'vegetais',     3, 'Livre',
   'Vegetais em quantidade livre, com porção mínima de 200g no almoço e no jantar.', 319),

-- ------------------------------------------------------------------ semana 4
  ('lentilha',       'Lentilha',                 'carboidratos', 4, '130g',  null, 401),
  ('quinoa',         'Quinoa',                   'carboidratos', 4, '100g',  null, 402),
  ('ervilha',        'Ervilha',                  'carboidratos', 4, '150g',  null, 403),
  ('feijao',         'Feijão cozido',            'carboidratos', 4, '160g',  null, 404),
  ('grao-de-bico',   'Grão-de-bico cozido',      'carboidratos', 4, '75g',   null, 405),
  ('alho',           'Alho',                     'vegetais',     4, 'Livre',
   'Vegetais em quantidade livre, com porção mínima de 200g no almoço e no jantar.', 406),
  ('cebola',         'Cebola',                   'vegetais',     4, 'Livre',
   'Vegetais em quantidade livre, com porção mínima de 200g no almoço e no jantar.', 407),
  ('amendoim',       'Amendoim',                 'gorduras',     4, '15g',   null, 408),
  ('iogurte-2-3',    'Iogurte de 2 ou 3 ingredientes', 'gorduras', 4, '165g',
   'Prefira sem lactose. Em industrializado, leia a tabela nutricional.', 409),
  ('coalhada',       'Coalhada',                 'gorduras',     4, '90g',
   'Prefira sem lactose.', 410),
  ('kefir-integral', 'Kefir integral',           'gorduras',     4, '135g',
   'Prefira sem lactose.', 411),
  ('iogurte-desnatado', 'Iogurte desnatado de 2 ingredientes ou 0% gordura',
   'proteinas', 4, '250g', 'Prefira sem lactose.', 412),
  ('kefir-desnatado','Kefir desnatado',          'proteinas',    4, '250g',
   'Prefira sem lactose.', 413),

  -- Os queijos de vaca do material vêm um a um, com a porção de cada: é assim
  -- que estão listados nas dicas extras, e é assim que dá para descobrir que
  -- um cai bem e outro não.
  ('queijo-coalho',  'Queijo coalho (normal ou light)', 'gorduras', 4, '25g',
   'Queijo de vaca. Prefira sem lactose.', 414),
  ('queijo-canastra','Queijo canastra',          'gorduras',     4, '20g',
   'Queijo de vaca. Prefira sem lactose.', 415),
  ('queijo-curado',  'Queijo curado',            'gorduras',     4, '20g',
   'Queijo de vaca. Prefira sem lactose.', 416),
  ('queijo-gorgonzola', 'Gorgonzola',            'gorduras',     4, '25g',
   'Queijo de vaca. Prefira sem lactose.', 417),
  ('queijo-meia-cura', 'Queijo meia cura',       'gorduras',     4, '25g',
   'Queijo de vaca. Prefira sem lactose.', 418),
  ('queijo-minas-frescal', 'Minas frescal',      'gorduras',     4, '35g',
   'Queijo de vaca. Prefira sem lactose.', 419),
  ('queijo-minas-padrao', 'Minas padrão',        'gorduras',     4, '30g',
   'Queijo de vaca. Prefira sem lactose.', 420),
  ('queijo-mucarela','Muçarela',                 'gorduras',     4, '30g',
   'Queijo de vaca. Prefira sem lactose.', 421),
  ('queijo-parmesao','Parmesão',                 'gorduras',     4, '20g',
   'Queijo de vaca. Prefira sem lactose.', 422),
  ('queijo-prato',   'Queijo prato',             'gorduras',     4, '20g',
   'Queijo de vaca. Prefira sem lactose.', 423),
  ('queijo-ricota',  'Ricota fresca',            'gorduras',     4, '60g',
   'Queijo de vaca. Prefira sem lactose.', 424)

on conflict (id) do update set
  nome = excluded.nome,
  categoria = excluded.categoria,
  semana_sugerida = excluded.semana_sugerida,
  porcao_referencia = excluded.porcao_referencia,
  observacao = excluded.observacao,
  ordem = excluded.ordem;

-- -----------------------------------------------------------------------------
-- O texto que abre a tela da paciente
--
-- Sai do material dela e do que ela pediu: linguagem que acolhe, sem prazo e
-- sem cobrança. Fica em `configuracoes` para ela reescrever sem publicar o
-- site de novo.
-- -----------------------------------------------------------------------------

insert into configuracoes (chave, valor, descricao) values
  ('reintroducao_orientacao',
   to_jsonb(
     'Você não precisa conseguir reintroduzir todos os alimentos de uma vez. '
     'Esse processo é individual e pode acontecer no seu ritmo, de acordo com '
     'a sua tolerância e com a orientação da sua nutricionista.'
     || chr(10) || chr(10) ||
     'Se você não conseguir testar todos os alimentos nesta semana, tudo bem. '
     'Podemos continuar na próxima.'
     || chr(10) || chr(10) ||
     'Você também não precisa testar alimentos que não fazem parte da sua '
     'alimentação ou que você não gosta. O objetivo é entender quais alimentos '
     'fazem sentido para você e como o seu corpo responde a eles.'
   ),
   'Texto de abertura da Rastreabilidade alimentar, na tela da paciente.')
on conflict (chave) do nothing;


-- ###########################################################################
-- 0016_reintroducao_funcoes.sql
-- ###########################################################################

-- =============================================================================
-- CENTRAL DO PACIENTE — 0016: as regras da rastreabilidade
--
-- Vale a pena dizer de novo o que NÃO tem neste arquivo, porque é a parte
-- mais importante dele:
--
--   * nenhuma função recusa um registro por causa do intervalo desde o
--     anterior. Três alimentos às 10h, 15h e 20h do mesmo dia entram os três;
--   * nenhuma função olha um sintoma e muda o status para algo que signifique
--     "não pode". O único status que o sistema atribui sozinho é 'em_teste',
--     e só porque passou a existir registro — é fato, não julgamento;
--   * nenhuma função devolve pendência, atraso ou meta. Item não testado é
--     'nao_iniciado', e ficar assim para sempre é um resultado válido.
--
-- Quem conclui é a nutricionista, na tela dela, com o histórico na frente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Vocabulário dos sintomas
--
-- Em função e não espalhado pelo código: a tela, o registro e a edição
-- conferem contra a mesma lista. Os cinco primeiros vêm do protocolo de
-- rastreio do material dela; 'manchas_pele' também é dele.
-- -----------------------------------------------------------------------------

create or replace function sintomas_da_reintroducao()
returns text[]
language sql
immutable
-- `search_path` fixo mesmo sem ser `security definer`: sem ele, quem chama
-- escolhe qual `sintomas_da_reintroducao` a conferência enxerga, e a
-- conferência inteira passa a valer o que o chamador quiser.
set search_path = public
as $$
  select array[
    'nenhum', 'distensao', 'gases', 'dor_abdominal', 'colica',
    'alteracao_evacuacao', 'diarreia', 'constipacao', 'urgencia',
    'nausea', 'refluxo', 'manchas_pele', 'outros'
  ];
$$;

/** Recusa um sintoma que a tela não conhece, antes de ele virar linha. */
create or replace function conferir_sintomas(p_sintomas text[])
returns text[]
language plpgsql
immutable
set search_path = public
as $$
declare s text;
begin
  if p_sintomas is null then
    return '{}';
  end if;
  foreach s in array p_sintomas loop
    if not (s = any (sintomas_da_reintroducao())) then
      raise exception 'Sintoma desconhecido: %', s using errcode = '22023';
    end if;
  end loop;
  -- 'nenhum' junto de qualquer outro é contradição: o outro manda.
  if 'nenhum' = any (p_sintomas) and array_length(p_sintomas, 1) > 1 then
    return array_remove(p_sintomas, 'nenhum');
  end if;
  return p_sintomas;
end;
$$;

-- -----------------------------------------------------------------------------
-- A semana do histórico
--
-- Só agrupa o tempo. Quando a nutricionista não marcou um início, a âncora é
-- o primeiro registro da paciente — assim ninguém precisa "abrir" o processo
-- para começar a usar, e a semana 1 é a semana em que ela de fato começou.
-- -----------------------------------------------------------------------------

-- As duas conferem o dono antes de responder. Sem isso, o id de outra
-- paciente devolveria quando ela começou o processo — que é dado dela, e do
-- mesmo tipo que já vazou uma vez por `saldo_de_pontos` sem essa checagem.
-- O `coalesce` é o que impede o nulo de escapar: `if null` não entra no
-- bloco, e a conferência inteira viraria enfeite.
create or replace function inicio_da_reintroducao(p_paciente uuid)
returns date
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not coalesce(e_admin() or p_paciente = meu_paciente_id(), false) then
    raise exception 'Você só pode ver o seu acompanhamento.' using errcode = '42501';
  end if;
  return coalesce(
    (select a.inicio from reintroducao_acompanhamento a where a.paciente_id = p_paciente),
    (select min(r.data) from reintroducao_registros r where r.paciente_id = p_paciente)
  );
end;
$$;

create or replace function semana_da_reintroducao(p_paciente uuid, p_data date)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_inicio date;
begin
  if not coalesce(e_admin() or p_paciente = meu_paciente_id(), false) then
    raise exception 'Você só pode ver o seu acompanhamento.' using errcode = '42501';
  end if;
  v_inicio := inicio_da_reintroducao(p_paciente);
  return case
    when v_inicio is null then 1
    when p_data < v_inicio then 1
    else floor((p_data - v_inicio) / 7)::int + 1
  end;
end;
$$;

-- -----------------------------------------------------------------------------
-- O que as duas telas leem
--
-- Um construtor só para a tela da paciente e a da nutricionista: se as duas
-- lessem de lugares diferentes, um dia mostrariam coisas diferentes sobre a
-- mesma paciente.
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
    -- Quantas semanas já correram. Não é meta nem prazo: é só até onde a
    -- linha do tempo chega hoje.
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
        'criadoEm', r.criado_em
      ) order by r.data desc, r.horario desc nulls last, r.criado_em desc), '[]'::jsonb)
      from reintroducao_registros r
      join reintroducao_itens i on i.id = r.item_id
      left join reintroducao_alimentos a on a.id = i.alimento_id
      where r.paciente_id = p_paciente
    )
  );
$$;

-- -----------------------------------------------------------------------------
-- A tela da paciente
--
-- Mesmo caminho do desafio: a nutricionista, que não tem cadastro de
-- paciente, entra em modo de prévia e vê como a tela fica.
-- -----------------------------------------------------------------------------

create or replace function minha_reintroducao()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
  v_previa boolean;
  v_orientacao text;
begin
  v_paciente := meu_paciente_id();
  v_previa := v_paciente is null and e_admin();

  if v_paciente is null and not v_previa then
    return jsonb_build_object('previa', false, 'orientacao', null,
                              'itens', '[]'::jsonb, 'registros', '[]'::jsonb);
  end if;

  select valor #>> '{}' into v_orientacao
  from configuracoes where chave = 'reintroducao_orientacao';

  -- A orientação da nutricionista para aquela paciente vem antes da geral.
  return jsonb_build_object('orientacao', coalesce(
    (select nullif(trim(a.orientacao), '') from reintroducao_acompanhamento a
      where a.paciente_id = v_paciente),
    v_orientacao
  )) || reintroducao_json(v_paciente, v_previa);
end;
$$;

-- -----------------------------------------------------------------------------
-- A paciente registra
--
-- Aceita item da lista dela OU um nome digitado: o material manda o que não
-- está na lista entrar na semana 5, e é por aqui que isso acontece.
--
-- Não há conferência de intervalo. De propósito.
-- -----------------------------------------------------------------------------

create or replace function registrar_reintroducao(
  p_item uuid default null,
  p_nome_novo text default null,
  p_data date default null,
  p_horario time default null,
  p_quantidade text default null,
  p_preparo text default null,
  p_sintomas text[] default '{}',
  p_intensidade integer default null,
  p_bristol integer default null,
  p_observacao text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
  v_item uuid;
  v_id uuid;
begin
  if not tem_acesso() then
    raise exception 'Seu acesso não está liberado.' using errcode = '42501';
  end if;
  v_paciente := meu_paciente_id();
  if v_paciente is null then
    raise exception 'Não encontrei seu cadastro de paciente.' using errcode = '42501';
  end if;

  if p_item is not null then
    select i.id into v_item from reintroducao_itens i
     where i.id = p_item and i.paciente_id = v_paciente;
    if v_item is null then
      raise exception 'Este alimento não está na sua lista.' using errcode = '42501';
    end if;
  elsif coalesce(trim(p_nome_novo), '') <> '' then
    -- Alimento fora da lista: entra como item da paciente, sem pedir licença.
    insert into reintroducao_itens (paciente_id, nome_livre, status, ordem)
    values (v_paciente, trim(p_nome_novo), 'em_teste',
            coalesce((select max(ordem) + 1 from reintroducao_itens
                       where paciente_id = v_paciente), 1))
    returning id into v_item;
  else
    raise exception 'Escolha um alimento ou escreva o nome.' using errcode = '22023';
  end if;

  insert into reintroducao_registros
    (item_id, paciente_id, data, horario, quantidade, preparo,
     sintomas, intensidade, bristol, observacao)
  values
    (v_item, v_paciente, coalesce(p_data, hoje_sp()), p_horario,
     nullif(trim(p_quantidade), ''), nullif(trim(p_preparo), ''),
     conferir_sintomas(p_sintomas), p_intensidade, p_bristol,
     nullif(trim(p_observacao), ''))
  returning id into v_id;

  -- 'em_teste' é o único status que o sistema mexe sozinho, e é constatação,
  -- não conclusão: passou a existir registro, então o teste começou. O que a
  -- nutricionista já tiver classificado fica como está — inclusive
  -- 'nao_relevante', que ela pode ter marcado por um motivo.
  update reintroducao_itens set status = 'em_teste'
   where id = v_item and status = 'nao_iniciado';

  return v_id;
end;
$$;

/** Corrigir o próprio registro — errar o horário não pode custar o registro. */
create or replace function editar_registro_reintroducao(
  p_registro uuid,
  p_data date default null,
  p_horario time default null,
  p_quantidade text default null,
  p_preparo text default null,
  p_sintomas text[] default '{}',
  p_intensidade integer default null,
  p_bristol integer default null,
  p_observacao text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_paciente uuid;
begin
  v_paciente := meu_paciente_id();
  update reintroducao_registros
     set data = coalesce(p_data, data),
         horario = p_horario,
         quantidade = nullif(trim(p_quantidade), ''),
         preparo = nullif(trim(p_preparo), ''),
         sintomas = conferir_sintomas(p_sintomas),
         intensidade = p_intensidade,
         bristol = p_bristol,
         observacao = nullif(trim(p_observacao), '')
   where id = p_registro
     and (paciente_id = v_paciente or e_admin());
  if not found then
    raise exception 'Registro não encontrado.' using errcode = '22023';
  end if;
end;
$$;

create or replace function excluir_registro_reintroducao(p_registro uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_paciente uuid;
begin
  v_paciente := meu_paciente_id();
  delete from reintroducao_registros
   where id = p_registro and (paciente_id = v_paciente or e_admin());
  if not found then
    raise exception 'Registro não encontrado.' using errcode = '22023';
  end if;
end;
$$;

/**
 * "Esse alimento não faz parte da minha alimentação."
 *
 * É o §4 do pedido dela virando código: a paciente tira da frente o que ela
 * não come, e o app para de mostrar — sem cobrar, sem marcar como falha.
 *
 * Só funciona a partir de 'nao_iniciado' ou do próprio 'nao_relevante'. Se a
 * nutricionista já classificou o alimento, a classificação dela fica: quem
 * desfaz um julgamento clínico é quem o fez.
 */
create or replace function marcar_relevancia_reintroducao(p_item uuid, p_relevante boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
  v_status text;
begin
  v_paciente := meu_paciente_id();
  select status into v_status from reintroducao_itens
   where id = p_item and paciente_id = v_paciente;
  if v_status is null then
    raise exception 'Este alimento não está na sua lista.' using errcode = '42501';
  end if;
  if v_status not in ('nao_iniciado', 'nao_relevante') then
    raise exception 'Este alimento já está em acompanhamento com a sua nutricionista.'
      using errcode = '22023';
  end if;

  update reintroducao_itens
     set status = case when p_relevante then 'nao_iniciado' else 'nao_relevante' end
   where id = p_item;
end;
$$;


-- ###########################################################################
-- 0017_reintroducao_admin.sql
-- ###########################################################################

-- =============================================================================
-- CENTRAL DO PACIENTE — 0017: o lado da nutricionista, e as fechaduras
--
-- É aqui que ela monta a lista de cada paciente, muda status e lê a linha do
-- tempo. E é aqui que se garante o de sempre: uma paciente não vê o diário de
-- outra, e o visitante sem login não vê nada.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Montar a lista daquela paciente (§5)
-- -----------------------------------------------------------------------------

/** Puxa alimentos do catálogo para a lista da paciente. Repetido é ignorado. */
create or replace function adicionar_itens_reintroducao(p_paciente uuid, p_alimentos text[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base integer;
  v_incluidos integer;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista monta a lista.' using errcode = '42501';
  end if;
  if not exists (select 1 from pacientes where id = p_paciente) then
    raise exception 'Paciente não encontrada.' using errcode = '22023';
  end if;

  select coalesce(max(ordem), 0) into v_base
  from reintroducao_itens where paciente_id = p_paciente;

  with novos as (
    insert into reintroducao_itens (paciente_id, alimento_id, ordem)
    select p_paciente, a.id, v_base + row_number() over (order by a.ordem)
    from reintroducao_alimentos a
    where a.id = any (p_alimentos) and a.ativo
    on conflict (paciente_id, alimento_id) where alimento_id is not null
    do nothing
    returning 1
  )
  select count(*) into v_incluidos from novos;

  insert into reintroducao_acompanhamento (paciente_id)
  values (p_paciente) on conflict (paciente_id) do nothing;

  return v_incluidos;
end;
$$;

/** Um alimento que não está no material — o "entra na semana 5" dela. */
create or replace function adicionar_item_livre_reintroducao(p_paciente uuid, p_nome text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista monta a lista.' using errcode = '42501';
  end if;
  if coalesce(trim(p_nome), '') = '' then
    raise exception 'Escreva o nome do alimento.' using errcode = '22023';
  end if;

  insert into reintroducao_itens (paciente_id, nome_livre, ordem)
  values (p_paciente, trim(p_nome),
          coalesce((select max(ordem) + 1 from reintroducao_itens
                     where paciente_id = p_paciente), 1))
  returning id into v_id;

  insert into reintroducao_acompanhamento (paciente_id)
  values (p_paciente) on conflict (paciente_id) do nothing;

  return v_id;
end;
$$;

/**
 * Tirar um alimento da lista.
 *
 * Com registro no histórico, some o alimento E some o que a paciente
 * escreveu. Quando é isso que ela quer, 'nao_relevante' é o caminho — por
 * isso a recusa aqui explica a alternativa em vez de só negar.
 */
create or replace function remover_item_reintroducao(p_item uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista mexe na lista.' using errcode = '42501';
  end if;
  if exists (select 1 from reintroducao_registros where item_id = p_item) then
    raise exception 'Este alimento já tem registros. Marque como "não relevante" para tirá-lo da frente sem apagar o histórico.'
      using errcode = '22023';
  end if;
  delete from reintroducao_itens where id = p_item;
end;
$$;

/**
 * O status é dela (§12).
 *
 * Nenhum destes valores é atribuído por conta de um sintoma: ela lê o
 * histórico e decide. Os nomes são neutros de propósito — não existe
 * "proibido" nesta lista.
 */
create or replace function definir_status_reintroducao(
  p_item uuid,
  p_status text,
  p_nota text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista classifica.' using errcode = '42501';
  end if;
  update reintroducao_itens
     set status = p_status,
         nota_nutri = nullif(trim(p_nota), '')
   where id = p_item;
  if not found then
    raise exception 'Alimento não encontrado.' using errcode = '22023';
  end if;
end;
$$;

/** A ordem em que os alimentos aparecem para a paciente. */
create or replace function reordenar_reintroducao(p_itens uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista reordena.' using errcode = '42501';
  end if;
  update reintroducao_itens i
     set ordem = pos.n
    from unnest(p_itens) with ordinality as pos(id, n)
   where i.id = pos.id;
end;
$$;

/** Início do acompanhamento e o recado dela para aquela paciente. */
create or replace function definir_acompanhamento_reintroducao(
  p_paciente uuid,
  p_inicio date default null,
  p_orientacao text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista define o acompanhamento.' using errcode = '42501';
  end if;
  insert into reintroducao_acompanhamento (paciente_id, inicio, orientacao)
  values (p_paciente, p_inicio, nullif(trim(p_orientacao), ''))
  on conflict (paciente_id) do update
    set inicio = excluded.inicio,
        orientacao = excluded.orientacao;
end;
$$;

/** A linha do tempo de uma paciente, para a tela dela. */
create or replace function reintroducao_do_paciente(p_paciente uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê o acompanhamento de uma paciente.'
      using errcode = '42501';
  end if;
  return jsonb_build_object(
    'orientacao', (select orientacao from reintroducao_acompanhamento
                    where paciente_id = p_paciente)
  ) || reintroducao_json(p_paciente, false);
end;
$$;

-- -----------------------------------------------------------------------------
-- Quem vê o quê
-- -----------------------------------------------------------------------------

alter table reintroducao_alimentos enable row level security;
alter table reintroducao_acompanhamento enable row level security;
alter table reintroducao_itens enable row level security;
alter table reintroducao_registros enable row level security;

-- O catálogo é conteúdo: quem tem acesso válido lê.
drop policy if exists reintroducao_alimentos_leitura on reintroducao_alimentos;
create policy reintroducao_alimentos_leitura on reintroducao_alimentos for select
  using (e_admin() or (ativo and tem_acesso()));

drop policy if exists reintroducao_alimentos_admin on reintroducao_alimentos;
create policy reintroducao_alimentos_admin on reintroducao_alimentos for all
  using (e_admin()) with check (e_admin());

-- Diário é dado de paciente: cada uma lê o seu, e ninguém lê o da outra.
--
-- Repare no que NÃO existe: política de insert, update ou delete para
-- paciente. Tudo o que ela grava passa pelas funções, que conferem o acesso
-- e o dono antes de escrever.
do $$
declare t text;
begin
  foreach t in array array[
    'reintroducao_acompanhamento', 'reintroducao_itens', 'reintroducao_registros'
  ] loop
    execute format('drop policy if exists %I on %I', t || '_leitura', t);
    execute format(
      'create policy %I on %I for select using (e_admin() or (paciente_id = meu_paciente_id() and tem_acesso()))',
      t || '_leitura', t
    );
    execute format('drop policy if exists %I on %I', t || '_admin', t);
    execute format(
      'create policy %I on %I for all using (e_admin()) with check (e_admin())',
      t || '_admin', t
    );
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Permissões
-- -----------------------------------------------------------------------------

grant select on reintroducao_alimentos, reintroducao_acompanhamento,
  reintroducao_itens, reintroducao_registros to authenticated;
grant insert, update, delete on reintroducao_alimentos, reintroducao_acompanhamento,
  reintroducao_itens, reintroducao_registros to authenticated;

-- E nada disso chega ao visitante sem login.
do $$
declare t text;
begin
  foreach t in array array[
    'reintroducao_alimentos', 'reintroducao_acompanhamento',
    'reintroducao_itens', 'reintroducao_registros'
  ] loop
    execute format('revoke all on table %I from anon', t);
  end loop;
end;
$$;

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'sintomas_da_reintroducao', 'conferir_sintomas', 'inicio_da_reintroducao',
        'semana_da_reintroducao', 'reintroducao_json', 'minha_reintroducao',
        'registrar_reintroducao', 'editar_registro_reintroducao',
        'excluir_registro_reintroducao', 'marcar_relevancia_reintroducao',
        'adicionar_itens_reintroducao', 'adicionar_item_livre_reintroducao',
        'remover_item_reintroducao', 'definir_status_reintroducao',
        'reordenar_reintroducao', 'definir_acompanhamento_reintroducao',
        'reintroducao_do_paciente'
      )
  loop
    execute format('revoke all on function %s from anon, public', f.assinatura);
  end loop;
end;
$$;

-- `reintroducao_json` fica de fora: ela aceita o id de qualquer paciente e não
-- confere dono nenhum. É auxiliar das duas funções acima, que conferem — e é
-- exatamente por isso que ninguém a chama pela mão.
grant execute on function sintomas_da_reintroducao() to authenticated;
grant execute on function conferir_sintomas(text[]) to authenticated;
grant execute on function inicio_da_reintroducao(uuid) to authenticated;
grant execute on function semana_da_reintroducao(uuid, date) to authenticated;
grant execute on function minha_reintroducao() to authenticated;
grant execute on function registrar_reintroducao(uuid, text, date, time, text, text, text[], integer, integer, text) to authenticated;
grant execute on function editar_registro_reintroducao(uuid, date, time, text, text, text[], integer, integer, text) to authenticated;
grant execute on function excluir_registro_reintroducao(uuid) to authenticated;
grant execute on function marcar_relevancia_reintroducao(uuid, boolean) to authenticated;
grant execute on function adicionar_itens_reintroducao(uuid, text[]) to authenticated;
grant execute on function adicionar_item_livre_reintroducao(uuid, text) to authenticated;
grant execute on function remover_item_reintroducao(uuid) to authenticated;
grant execute on function definir_status_reintroducao(uuid, text, text) to authenticated;
grant execute on function reordenar_reintroducao(uuid[]) to authenticated;
grant execute on function definir_acompanhamento_reintroducao(uuid, date, text) to authenticated;
grant execute on function reintroducao_do_paciente(uuid) to authenticated;


-- ###########################################################################
-- 0018_marcadores.sql
-- ###########################################################################

-- =============================================================================
-- CENTRAL DO PACIENTE — 0018: oxalato, histamina e lectina
--
-- A tabela dela ("Tabela Oxalato, Histamina e Lectina — Semana Desinflama")
-- vira dado aqui. Serve para uma coisa só, e é a que ela pediu: quando a
-- paciente registra um SINTOMA com um alimento, aparece embaixo, pequeno, o
-- que aquele alimento tem de alto.
--
-- O porquê está na introdução do material dela: "se o alimento que te faz mal
-- é muito alto em oxalato, provavelmente outros alimentos altos em oxalato
-- também farão mal". É pista para comparar, não veredito.
--
-- Por isso, duas regras que o resto do módulo já seguia e que continuam:
--
--   * a marcação NÃO aparece quando o registro é sem sintoma. Alimento que
--     caiu bem não precisa de rótulo nenhum;
--   * a marcação NÃO muda status, não sugere exclusão e não entra em conta
--     nenhuma. Ela é texto ao lado do que a paciente escreveu.
--
-- Nada aqui altera o catálogo de reintrodução nem o que já estava gravado.
-- =============================================================================

create table if not exists alimentos_marcadores (
  id text primary key,
  nome text not null,
  -- Nome em minúsculas e sem acento, para casar com o que a paciente digita
  -- quando o alimento não está na lista dela.
  nome_busca text not null,
  categoria text not null
    check (categoria in ('carboidratos', 'frutas', 'vegetais', 'proteinas', 'gorduras', 'outros')),
  -- Nulo = o material traz um traço naquela coluna, ou seja, sem informação.
  -- Sem informação e "baixa" são coisas diferentes, e o nulo preserva isso.
  oxalato text check (oxalato is null or oxalato in ('muito_baixa','baixa','media','alta','muito_alta')),
  histamina text check (histamina is null or histamina in ('muito_baixa','baixa','media','alta','muito_alta')),
  lectina text check (lectina is null or lectina in ('muito_baixa','baixa','media','alta','muito_alta')),
  -- As notas de rodapé do material: "grandes chances de fermentar" e afins.
  observacao text
);

create index if not exists alimentos_marcadores_busca_idx
  on alimentos_marcadores (nome_busca);

-- O alimento do Mapa de Reintrodução aponta para a linha da tabela quando os
-- dois materiais falam do mesmo alimento. Fica explícito, um a um, em vez de
-- adivinhado por semelhança de nome: "manteiga de búfala" e "manteiga" são
-- parecidos e não são a mesma linha.
alter table reintroducao_alimentos
  add column if not exists marcador_id text references alimentos_marcadores (id) on delete set null;


-- ###########################################################################
-- 0019_marcadores_tabela.sql
-- ###########################################################################

-- =============================================================================
-- CENTRAL DO PACIENTE — 0019: a tabela dela, alimento por alimento
--
-- Transcrição do material "Tabela Oxalato, Histamina e Lectina". Nada foi
-- acrescentado de fora e nada foi arredondado: onde o material traz um traço,
-- aqui vai nulo — porque "não sei" não é "baixa".
-- =============================================================================

insert into alimentos_marcadores
  (id, nome, nome_busca, categoria, oxalato, histamina, lectina, observacao) values

-- ------------------------------------------------------------- carboidratos
('arroz','Arroz','arroz','carboidratos','media','muito_baixa','muito_alta',null),
('arroz-selvagem','Arroz selvagem','arroz selvagem','carboidratos','media','muito_baixa','alta',null),
('aveia','Aveia','aveia','carboidratos','muito_baixa','muito_baixa','muito_alta',null),
('acucar','Açúcar','acucar','carboidratos','muito_baixa','muito_baixa','muito_alta',null),
('batata','Batata','batata','carboidratos','muito_alta','muito_baixa','muito_alta',null),
('m-batata-doce','Batata doce','batata doce','carboidratos','muito_alta','muito_baixa','baixa','Grandes chances de fermentar.'),
('centeio','Centeio','centeio','carboidratos','muito_alta','media','muito_alta',null),
('chufa','Chufa','chufa','carboidratos',null,'muito_baixa',null,null),
('espelta','Espelta','espelta','carboidratos','media','muito_baixa','muito_alta',null),
('favas','Favas','favas','carboidratos','muito_alta','muito_alta','muito_alta',null),
('m-feijao','Feijão','feijao','carboidratos','muito_alta','muito_alta','muito_alta',null),
('feijao-borlotti','Feijão Borlotti','feijao borlotti','carboidratos','muito_alta','alta','muito_alta',null),
('feijao-mungo','Feijão Mungo (germinado)','feijao mungo','carboidratos','alta','alta','alta',null),
('flocos-de-milho','Flocos de Milho','flocos de milho','carboidratos','muito_baixa','muito_baixa','muito_alta',null),
('germen-de-trigo','Gérmen de trigo','germen de trigo','carboidratos','muito_alta','muito_alta','muito_alta',null),
('m-grao-de-bico','Grão-de-Bico','grao-de-bico','carboidratos','media','alta','muito_alta',null),
('m-inhame','Inhame','inhame','carboidratos','muito_alta','muito_baixa','muito_baixa',null),
('leguminosas','Leguminosas','leguminosas','carboidratos','muito_alta','muito_alta','muito_alta',null),
('leite-de-arroz','Leite de arroz','leite de arroz','carboidratos','media','baixa','muito_alta',null),
('m-lentilha','Lentilha','lentilha','carboidratos','baixa','alta','muito_alta',null),
('macarrao','Macarrão','macarrao','carboidratos',null,null,'alta','A depender da farinha usada para fazer a massa.'),
('macarrao-de-arroz','Macarrão de arroz','macarrao de arroz','carboidratos','media','muito_baixa','muito_alta',null),
('mandioca','Mandioca','mandioca','carboidratos','alta','muito_baixa','muito_baixa',null),
('m-mel','Mel','mel','carboidratos','muito_baixa','muito_baixa','muito_baixa','Grandes chances de fermentar.'),
('milho','Milho','milho','carboidratos','muito_baixa','muito_baixa',null,null),
('milho-doce','Milho doce','milho doce','carboidratos','media','muito_baixa','muito_alta',null),
('painco','Painço','painco','carboidratos','muito_alta','muito_baixa','muito_baixa',null),
('m-pao','Pão','pao','carboidratos','alta','media','muito_alta','Vale para pães feitos com farinha de trigo.'),
('pastinaga','Pastinaga','pastinaga','carboidratos','alta','muito_baixa','muito_baixa',null),
('m-quinoa','Quinoa','quinoa','carboidratos','muito_alta','muito_baixa','muito_alta',null),
('soja','Soja (grãos ou farinha)','soja','carboidratos','muito_alta','muito_alta','muito_alta',null),
('trigo','Trigo','trigo','carboidratos','muito_alta','media','muito_alta',null),
('trigo-sarraceno','Trigo Sarraceno','trigo sarraceno','carboidratos','muito_alta','alta','alta',null),

-- -------------------------------------------------------------------- frutas
('m-abacate','Abacate','abacate','frutas','muito_alta','muito_alta','baixa',null),
('abacaxi','Abacaxi','abacaxi','frutas','muito_alta','muito_alta','muito_baixa',null),
('m-acerola','Acerola','acerola','frutas','baixa','baixa','media',null),
('ameixa','Ameixa','ameixa','frutas','muito_baixa','alta','muito_baixa',null),
('ameixa-seca','Ameixa seca','ameixa seca','frutas','alta','baixa','muito_baixa','Apesar de ser segura, é fruta seca e pode fermentar.'),
('amora','Amora','amora','frutas','media','muito_baixa','media',null),
('amora-silvestre','Amora Silvestre','amora silvestre','frutas','muito_alta','alta','media',null),
('m-banana','Banana','banana','frutas','baixa','alta','media',null),
('boysenberry','Boysenberry','boysenberry','frutas','baixa','media','media',null),
('cereja','Cereja','cereja','frutas','baixa','baixa','muito_baixa',null),
('cereja-azeda','Cereja azeda','cereja azeda','frutas',null,'baixa',null,null),
('cerejas-morello','Cerejas Morello','cerejas morello','frutas','baixa','baixa','baixa',null),
('coco','Coco e derivados','coco','frutas','muito_baixa','baixa','muito_baixa',null),
('damasco','Damasco','damasco','frutas','muito_baixa','muito_baixa','muito_baixa','Apesar de ser segura, é fruta seca e pode fermentar.'),
('figo','Figo (fresco ou seco)','figo','frutas','media','baixa','muito_baixa',null),
('figueira-da-india','Figueira da Índia','figueira da india','frutas',null,'media',null,null),
('framboesa','Framboesa','framboesa','frutas','muito_alta','alta','baixa',null),
('frutas-citricas','Frutas Cítricas','frutas citricas','frutas','media','muito_alta','media',null),
('frutas-secas','Frutas secas','frutas secas','frutas','media',null,'media','Apesar de ser segura, é fruta seca e pode fermentar.'),
('m-goiaba','Goiaba','goiaba','frutas','muito_alta','alta','media',null),
('gojiberry','Gojiberry','gojiberry','frutas','muito_alta','muito_baixa','muito_alta',null),
('groselha','Groselha','groselha','frutas','alta','muito_baixa','alta',null),
('groselhas-vermelhas','Groselhas vermelhas','groselhas vermelhas','frutas','muito_alta','muito_baixa','alta',null),
('kiwi','Kiwi','kiwi','frutas','muito_alta','alta','muito_baixa',null),
('laranja','Laranja','laranja','frutas','muito_alta','muito_alta','media',null),
('m-lichia','Lichia','lichia','frutas','muito_baixa','muito_baixa','alta',null),
('lima','Lima','lima','frutas','media','muito_alta','media',null),
('limao','Limão','limao','frutas','media',null,'media',null),
('mamao','Mamão','mamao','frutas','muito_baixa','muito_alta','muito_baixa',null),
('mandarim','Mandarim orange','mandarim orange','frutas','muito_alta',null,'media',null),
('m-manga','Manga','manga','frutas','alta','baixa','muito_baixa','Pela alta quantidade de beta-caroteno pode causar irritações na pele e espinhas.'),
('maracuja','Maracujá','maracuja','frutas','muito_baixa','muito_baixa','muito_baixa',null),
('maca','Maçã','maca','frutas','muito_baixa','muito_baixa','muito_baixa',null),
('m-melancia','Melancia','melancia','frutas','muito_baixa','muito_alta','alta',null),
('melao','Melão','melao','frutas','muito_baixa','baixa','muito_alta',null),
('mirtilo','Mirtilo','mirtilo','frutas',null,'muito_baixa',null,null),
('morango','Morango','morango','frutas','muito_baixa','muito_alta','muito_baixa',null),
('nectarina','Nectarina','nectarina','frutas','muito_baixa','alta','muito_baixa',null),
('m-pera','Pera','pera','frutas','baixa','media','muito_baixa',null),
('m-pessego','Pêssego','pessego','frutas','baixa','muito_baixa','muito_baixa',null),
('pinhoes','Pinhões','pinhoes','frutas',null,'media',null,null),
('pitaia','Pitaia','pitaia','frutas','muito_alta','muito_baixa','media',null),
('roma','Romã','roma','frutas','muito_alta','muito_baixa','muito_baixa',null),
('tamara','Tâmara','tamara','frutas','alta','media','media',null),
('toranja','Toranja','toranja','frutas','muito_alta','muito_alta','media',null),
('uva','Uva','uva','frutas','muito_baixa','media','media',null),
('uvas-passas','Uvas Passas','uvas passas','frutas','baixa','muito_baixa','media','Se não tiver enxofre. Apesar de segura, é fruta seca e pode fermentar.'),

-- ------------------------------------------------------------------ vegetais
('abobora','Abóbora','abobora','vegetais','media','muito_baixa','alta','Pela alta quantidade de beta-caroteno pode causar irritações na pele e espinhas.'),
('abobrinha','Abobrinha','abobrinha','vegetais','muito_baixa','muito_baixa','alta',null),
('acelga','Acelga','acelga','vegetais','muito_alta','media','muito_baixa',null),
('acelga-chinesa','Acelga Chinesa','acelga chinesa','vegetais','muito_baixa','muito_baixa','muito_baixa',null),
('agriao','Agrião','agriao','vegetais','muito_alta','muito_baixa','muito_baixa',null),
('agriao-de-jardim','Agrião de Jardim','agriao de jardim','vegetais','muito_alta','baixa','media',null),
('airela','Airela ou Oxicoco','airela','vegetais','muito_baixa','muito_baixa','muito_baixa',null),
('alcachofra','Alcachofra','alcachofra','vegetais','alta','muito_baixa','baixa',null),
('alecrim','Alecrim','alecrim','vegetais','muito_baixa','muito_baixa','muito_baixa',null),
('alface','Alface','alface','vegetais','muito_baixa','muito_baixa','muito_baixa',null),
('alga','Alga','alga','vegetais','baixa','muito_alta','baixa',null),
('m-alho','Alho','alho','vegetais','baixa','baixa','muito_baixa','Alto risco de aumentar a fermentação intestinal.'),
('m-alho-poro','Alho-poró','alho-poro','vegetais','baixa','baixa','baixa',null),
('amoreira','Amoreira','amoreira','vegetais','alta','media','muito_alta',null),
('anis','Anis','anis','vegetais',null,'media',null,null),
('m-aspargos','Aspargo','aspargo','vegetais','media','muito_baixa','media',null),
('berinjela','Berinjela','berinjela','vegetais','muito_alta','alta','muito_alta',null),
('beterraba','Beterraba','beterraba','vegetais','muito_alta','muito_baixa','muito_baixa',null),
('m-brocolis','Brócolis','brocolis','vegetais','media','muito_baixa','muito_baixa',null),
('broto-de-bambu','Broto de Bambu','broto de bambu','vegetais','muito_alta','media','muito_baixa',null),
('broto-de-ervilha','Broto de ervilha','broto de ervilha','vegetais','media','muito_baixa','muito_alta',null),
('m-cebola','Cebola','cebola','vegetais','muito_baixa','baixa','muito_baixa',null),
('cebola-branca','Cebola Branca','cebola branca','vegetais',null,'baixa',null,'Grandes chances de fermentar.'),
('cebolinha','Cebolinha','cebolinha','vegetais','muito_baixa','baixa','muito_baixa',null),
('cenoura','Cenoura','cenoura','vegetais','alta','muito_baixa','muito_baixa','Pela alta quantidade de beta-caroteno pode causar irritações na pele e espinhas.'),
('chicoria','Chicória','chicoria','vegetais','muito_alta','muito_baixa','muito_baixa',null),
('coentro','Coentro','coentro','vegetais','baixa','baixa','muito_baixa',null),
('cogumelo-branco','Cogumelo Branco','cogumelo branco','vegetais','baixa','alta','muito_baixa','Grandes chances de fermentar.'),
('cogumelo-morel','Cogumelo Morel','cogumelo morel','vegetais','alta','alta','muito_baixa','Grandes chances de fermentar.'),
('cogumelo-porcino','Cogumelo Porcino','cogumelo porcino','vegetais','baixa','alta','muito_baixa','Grandes chances de fermentar.'),
('m-cogumelos','Cogumelos','cogumelos','vegetais','baixa',null,'muito_baixa','Grandes chances de fermentar.'),
('couve','Couve','couve','vegetais','muito_baixa','muito_baixa','muito_baixa','Grandes chances de fermentar.'),
('m-couve-bruxelas','Couve de Bruxelas','couve de bruxelas','vegetais','media','media','muito_baixa',null),
('couve-pak-choi','Couve pak choi','couve pak choi','vegetais',null,'muito_baixa',null,null),
('m-couve-flor','Couve-Flor','couve-flor','vegetais','muito_baixa','muito_baixa','muito_baixa','Grandes chances de fermentar.'),
('endivia','Endívia','endivia','vegetais','muito_baixa','muito_baixa','muito_baixa',null),
('endro','Endro','endro','vegetais','baixa','baixa','baixa',null),
('m-ervilha','Ervilhas verdes','ervilhas verdes','vegetais','muito_baixa','media','media',null),
('espinafre','Espinafre','espinafre','vegetais','muito_alta','muito_alta','muito_baixa',null),
('flor-de-sabugueiro','Flor de Sabugueiro','flor de sabugueiro','vegetais','muito_alta','muito_baixa','alta',null),
('m-nabo','Nabo','nabo','vegetais','muito_alta','baixa','muito_baixa',null),
('nabo-rebolho','Nabo-rebolho','nabo-rebolho','vegetais','muito_baixa','baixa','muito_baixa',null),
('opuntia','Opuntia','opuntia','vegetais','alta','media','muito_baixa',null),
('pepino','Pepino','pepino','vegetais','muito_baixa','muito_baixa','alta',null),
('pimentao-apimentado','Pimentão Apimentado','pimentao apimentado','vegetais','muito_alta','alta','muito_alta',null),
('pimentao-doce','Pimentão Doce','pimentao doce','vegetais','media','muito_baixa','muito_alta',null),
('rabanete','Rabanete','rabanete','vegetais','muito_baixa','muito_baixa','muito_baixa',null),
('m-repolho','Repolho','repolho','vegetais','muito_baixa','muito_baixa','muito_baixa','Grandes chances de fermentar.'),
('repolho-napa','Repolho napa','repolho napa','vegetais','muito_baixa','muito_baixa','muito_baixa',null),
('repolho-roxo','Repolho roxo','repolho roxo','vegetais','muito_baixa','muito_baixa','muito_baixa','Grandes chances de fermentar.'),
('repolho-savoy','Repolho Savoy','repolho savoy','vegetais','muito_baixa','baixa','muito_baixa',null),
('ruibarbo','Ruibarbo','ruibarbo','vegetais','muito_alta','baixa','baixa',null),
('salsao','Salsão','salsao','vegetais','muito_alta','muito_baixa','muito_baixa',null),
('salvia','Sálvia','salvia','vegetais','muito_alta','muito_baixa','muito_baixa',null),
('sauerkraut','Sauerkraut','sauerkraut','vegetais','baixa',null,null,null),
('tomate','Tomate','tomate','vegetais','muito_alta','muito_alta','muito_alta',null),
('urtiga','Urtiga','urtiga','vegetais','media','muito_alta','muito_alta',null),

-- ----------------------------------------------------------------- proteínas
('anchova','Anchova','anchova','proteinas','baixa','muito_alta','muito_baixa',null),
('atum','Atum','atum','proteinas','muito_baixa',null,'muito_baixa',null),
('avestruz','Avestruz','avestruz','proteinas','muito_baixa','muito_baixa','muito_baixa',null),
('bufalo','Búfalo','bufalo','proteinas','muito_baixa','muito_baixa','muito_baixa',null),
('camarao','Camarão','camarao','proteinas','muito_baixa','muito_alta','alta',null),
('caranguejo','Caranguejo','caranguejo','proteinas','muito_baixa','muito_alta','muito_baixa',null),
('m-carne-vermelha','Carne Bovina','carne bovina','proteinas','muito_baixa','muito_baixa','muito_baixa',null),
('carne-de-aves','Carne de aves','carne de aves','proteinas','muito_baixa','muito_baixa','muito_baixa',null),
('carne-de-caca','Carne de Caça','carne de caca','proteinas','muito_baixa','baixa','muito_baixa',null),
('m-carne-porco','Carne de porco','carne de porco','proteinas','muito_baixa','muito_baixa','muito_baixa',null),
('carne-defumada','Carne defumada','carne defumada','proteinas','muito_baixa','muito_alta','muito_baixa',null),
('carne-moida','Carne moída','carne moida','proteinas','muito_baixa','baixa','muito_baixa',null),
('carne-seca','Carne Seca','carne seca','proteinas','muito_baixa','muito_alta','muito_baixa',null),
('carnes-defumadas','Carnes Defumadas','carnes defumadas','proteinas','muito_baixa','muito_alta','muito_baixa',null),
('codorna','Codorna','codorna','proteinas',null,'muito_baixa',null,null),
('coelho','Coelho','coelho','proteinas','muito_baixa','muito_baixa','muito_baixa',null),
('cordeiro','Cordeiro','cordeiro','proteinas','muito_baixa','muito_baixa','muito_baixa',null),
('frutos-do-mar','Frutos do mar','frutos do mar','proteinas','muito_baixa','muito_alta','media',null),
('galinha','Galinha','galinha','proteinas','muito_baixa','muito_baixa','muito_baixa',null),
('ganso','Ganso','ganso','proteinas','muito_baixa','muito_baixa','muito_baixa',null),
('lagosta','Lagosta','lagosta','proteinas','muito_baixa','muito_alta','muito_baixa',null),
('lagostim','Lagostim','lagostim','proteinas','muito_baixa','muito_alta','muito_alta',null),
('mariscos','Mariscos','mariscos','proteinas','muito_baixa','muito_alta','alta',null),
('moluscos','Moluscos','moluscos','proteinas','muito_baixa','muito_alta','media',null),
('ostra','Ostra','ostra','proteinas','muito_baixa','muito_alta','media',null),
('pato','Pato','pato','proteinas','muito_baixa','muito_baixa','muito_baixa',null),
('peixe','Peixe','peixe','proteinas','muito_baixa','muito_alta','media',null),
('peixe-defumado','Peixe defumado','peixe defumado','proteinas','muito_baixa','muito_alta','muito_baixa',null),
('peru','Peru','peru','proteinas','muito_baixa','muito_baixa','muito_baixa',null),
('salmao','Salmão','salmao','proteinas','muito_baixa','muito_alta','muito_baixa',null),
('truta','Truta','truta','proteinas','muito_baixa','muito_alta','alta',null),
('veado','Veado','veado','proteinas','muito_baixa','baixa','muito_baixa',null),

-- ------------------------------------------------------------------ gorduras
('amendoas','Amêndoas','amendoas','gorduras','muito_alta','media','media','Dentre todas as castanhas, tende a ser a mais segura.'),
('m-amendoim','Amendoim','amendoim','gorduras','muito_alta','muito_alta','muito_alta','Altas chances de fermentar.'),
('m-avela','Avelã','avela','gorduras','muito_alta','media','muito_baixa',null),
('azeite-de-oliva','Azeite de oliva','azeite de oliva','gorduras','muito_baixa','muito_baixa','baixa',null),
('m-azeitona','Azeitonas','azeitonas','gorduras','alta','alta','baixa',null),
('castanha-europeia','Castanha Européia','castanha europeia','gorduras',null,'muito_baixa',null,null),
('castanha-de-caju','Castanha-de-Caju','castanha-de-caju','gorduras','muito_alta','alta','muito_alta',null),
('castanha-do-para','Castanha-do-Pará','castanha-do-para','gorduras','muito_alta','baixa','muito_baixa',null),
('m-chocolate','Chocolate 70%','chocolate','gorduras','muito_alta','alta','baixa',null),
('cream-cheese','Cream Cheese','cream cheese','gorduras','muito_baixa','media','media',null),
('gema-do-ovo','Gema do Ovo','gema do ovo','gorduras','muito_baixa','media','media',null),
('gergelim','Gergelim','gergelim','gorduras','muito_alta','baixa','muito_alta',null),
('m-iogurte','Iogurte Integral','iogurte integral','gorduras','muito_baixa','muito_alta','media',null),
('m-kefir','Kefir','kefir','gorduras','muito_baixa','muito_alta','muito_alta',null),
('leite','Leite','leite','gorduras','muito_baixa','muito_baixa','media',null),
('leite-cru','Leite cru','leite cru','gorduras','muito_baixa','muito_baixa',null,null),
('leite-de-cabra','Leite de cabra','leite de cabra','gorduras','muito_baixa','muito_baixa','muito_baixa',null),
('leite-de-ovelha','Leite de ovelha','leite de ovelha','gorduras','muito_baixa','muito_baixa','muito_baixa',null),
('linhaca','Linhaça','linhaca','gorduras','media','muito_baixa','muito_baixa',null),
('macadamia','Macadâmia','macadamia','gorduras','muito_alta','baixa','muito_baixa',null),
('m-manteiga','Manteiga','manteiga','gorduras','muito_baixa','muito_baixa','baixa',null),
('manteiga-de-cacau','Manteiga de Cacau','manteiga de cacau','gorduras','muito_alta','alta','baixa',null),
('margarina','Margarina','margarina','gorduras','muito_baixa','muito_alta','muito_alta',null),
('nata-azeda','Nata azeda','nata azeda','gorduras','muito_baixa','media',null,null),
('noz','Noz','noz','gorduras','muito_alta','muito_alta','media',null),
('noz-moscada','Noz-moscada','noz-moscada','gorduras','alta','alta','media',null),
('m-nozes','Nozes','nozes','gorduras','muito_alta',null,'media',null),
('oleo-de-canola','Óleo de Canola','oleo de canola','gorduras','muito_baixa','baixa','muito_alta',null),
('oleo-de-girassol','Óleo de girassol','oleo de girassol','gorduras','baixa','alta','muito_alta',null),
('oleo-de-palma','Óleo de palma','oleo de palma','gorduras',null,'muito_baixa',null,null),
('oleo-semente-abobora','Óleo de semente de abóbora','oleo de semente de abobora','gorduras','media','muito_baixa','muito_alta',null),
('oleo-semente-palmeira','Óleo de semente de Palmeira','oleo de semente de palmeira','gorduras',null,'muito_baixa',null,null),
('ovo-branco','Ovo Branco','ovo branco','gorduras','muito_baixa','baixa','media',null),
('ovos-de-codorna','Ovos de codorna','ovos de codorna','gorduras',null,'muito_baixa',null,null),
('m-pistache','Pistache','pistache','gorduras','muito_alta','baixa','media',null),
('queijo-cheddar','Queijo Cheddar','queijo cheddar','gorduras','muito_baixa','muito_alta','muito_alta','Deve ser zero lactose, sempre que possível.'),
('m-queijo-feta','Queijo feta','queijo feta','gorduras','muito_baixa','media','media','Deve ser zero lactose, sempre que possível.'),
('queijo-gouda','Queijo Gouda','queijo gouda','gorduras','muito_baixa','muito_alta','muito_alta','Deve ser zero lactose, sempre que possível.'),
('queijo-macio','Queijo Macio','queijo macio','gorduras','muito_baixa','media','media','Deve ser zero lactose, sempre que possível.'),
('queijo-mascarpone','Queijo mascarpone','queijo mascarpone','gorduras',null,'media','media','Deve ser zero lactose, sempre que possível.'),
('m-queijo-mucarela','Queijo mussarela','queijo mussarela','gorduras','muito_baixa','baixa','media','Deve ser zero lactose, sempre que possível.'),
('queijo-processado','Queijo processado','queijo processado','gorduras',null,'muito_alta','alta','Deve ser zero lactose, sempre que possível.'),
('queijo-raclette','Queijo Raclette','queijo raclette','gorduras','muito_baixa','muito_alta','baixa','Deve ser zero lactose, sempre que possível.'),
('m-queijo-ricota','Queijo ricota','queijo ricota','gorduras','muito_baixa','baixa','media','Deve ser zero lactose, sempre que possível.'),
('queijo-roquefort','Queijo Roquefort','queijo roquefort','gorduras','muito_baixa','alta','media','Deve ser zero lactose, sempre que possível.'),
('m-queijos-azuis','Queijos Azuis','queijos azuis','gorduras','alta','muito_alta','media','Deve ser zero lactose, sempre que possível.'),
('m-queijos-curados','Queijos Curados','queijos curados','gorduras','muito_baixa','muito_alta',null,'Deve ser zero lactose, sempre que possível.'),
('queijos-nao-pasteurizados','Queijos feitos de leite não pasteurizado','queijos feitos de leite nao pasteurizado','gorduras','muito_baixa','muito_alta','media','Deve ser zero lactose, sempre que possível.'),
('semente-de-chia','Semente de Chia','semente de chia','gorduras','muito_alta','muito_baixa','muito_alta',null),
('sementes-de-abobora','Sementes de abóbora','sementes de abobora','gorduras','media','baixa','muito_alta',null),
('sementes-de-canhamo','Sementes de cânhamo','sementes de canhamo','gorduras','baixa','muito_baixa','muito_baixa',null),
('sementes-de-girassol','Sementes de girassol','sementes de girassol','gorduras','baixa','alta','muito_alta',null),
('sementes-de-papoula','Sementes de Papoula','sementes de papoula','gorduras','muito_alta','baixa','muito_alta',null),
('m-whey','Soro de leite','soro de leite','gorduras',null,'baixa',null,null),
('sour-cream','Sour cream','sour cream','gorduras',null,null,'media',null),

-- -------------------------------------------------------------------- outros
('adocante','Adoçante','adocante','outros','muito_baixa','muito_baixa','muito_alta',null),
('agua-de-torneira','Água de torneira','agua de torneira','outros',null,'muito_baixa',null,null),
('alcool','Álcool ou Bebidas Alcoólicas','alcool','outros','baixa','muito_alta',null,null),
('alimentos-em-conserva','Alimentos em conserva','alimentos em conserva','outros','muito_alta','muito_alta','muito_baixa',null),
('baunilha','Baunilha','baunilha','outros','muito_alta','media','muito_baixa',null),
('cafe','Café','cafe','outros','muito_baixa','media','media',null),
('camomila','Camomila e Chá de Camomila','camomila','outros','muito_baixa','muito_baixa','muito_baixa',null),
('canela','Canela','canela','outros','muito_alta','alta','muito_baixa',null),
('cardamomo','Cardamomo','cardamomo','outros','muito_alta','muito_baixa','media',null),
('casca-physallis','Casca de semente de physallis','casca de semente de physallis','outros',null,'muito_baixa',null,null),
('cha-de-ervas','Chá de ervas','cha de ervas','outros','media','media','muito_baixa',null),
('cha-de-hortela','Chá de Hortelã','cha de hortela','outros','muito_baixa','muito_baixa','muito_baixa',null),
('cha-de-urtiga','Chá de urtiga','cha de urtiga','outros','media','alta','muito_alta',null),
('cha-mate','Chá mate','cha mate','outros','alta','muito_alta','muito_baixa',null),
('cha-preto','Chá preto','cha preto','outros','muito_alta','muito_alta','muito_baixa',null),
('cha-rooibos','Chá Rooibos','cha rooibos','outros','muito_baixa','muito_baixa','muito_baixa',null),
('cha-verde','Chá verde','cha verde','outros','alta','media','baixa',null),
('champagne','Champagne','champagne','outros','baixa','muito_alta','media',null),
('cominho','Cominho','cominho','outros','muito_alta','media','baixa',null),
('cominho-preto','Cominho Preto','cominho preto','outros','muito_alta','muito_baixa','alta',null),
('cravo','Cravo','cravo','outros','muito_alta','alta','muito_alta',null),
('curcuma','Cúrcuma','curcuma','outros','muito_alta','muito_baixa','muito_baixa',null),
('curry','Curry','curry','outros','media','media','baixa',null),
('cacau-em-po','Cacau em pó','cacau em po','outros','muito_alta','muito_alta','baixa',null),
('erva-benta','Erva Benta','erva benta','outros','muito_baixa','muito_baixa','muito_alta',null),
('expresso','Expresso','expresso','outros','muito_baixa','media','baixa',null),
('extrato-de-levedura','Extrato de levedura','extrato de levedura','outros',null,'muito_alta',null,null),
('extrato-de-malte','Extrato de malte','extrato de malte','outros','muito_alta','muito_alta','muito_alta',null),
('feno-grego','Feno-grego','feno-grego','outros','alta','alta','media',null),
('feno-grego-azul','Feno-grego azul','feno-grego azul','outros','muito_alta','alta','media',null),
('fermento','Fermento','fermento','outros','alta','alta','muito_alta',null),
('frutose','Frutose','frutose','outros','media','muito_baixa','alta',null),
('funcho','Funcho','funcho','outros','muito_alta','muito_baixa','muito_baixa',null),
('gengibre','Gengibre','gengibre','outros','muito_alta','baixa','muito_baixa',null),
('hortela','Hortelã','hortela','outros','baixa','muito_baixa','muito_baixa',null),
('louro','Louro','louro','outros','muito_alta','media',null,null),
('maltodextrina','Maltodextrina','maltodextrina','outros','media','media','muito_alta',null),
('manjericao','Manjericão','manjericao','outros','baixa','muito_baixa','muito_baixa',null),
('mostarda','Mostarda e sementes de mostarda','mostarda','outros','muito_baixa','alta','muito_baixa',null),
('oregano','Orégano','oregano','outros','media','muito_baixa','alta',null),
('paprica-doce','Páprica Doce','paprica doce','outros',null,'muito_baixa',null,null),
('paprica-picante','Páprica Picante','paprica picante','outros',null,'muito_alta',null,null),
('pimenta','Pimenta','pimenta','outros',null,'alta',null,null),
('pimenta-malagueta','Pimenta Malagueta','pimenta malagueta','outros','media','alta','muito_alta',null),
('presunto','Presunto','presunto','outros','muito_baixa','muito_alta','muito_baixa',null),
('salame','Salame','salame','outros','muito_baixa','muito_alta','muito_baixa',null),
('salsa','Salsa','salsa','outros','alta','muito_baixa','alta',null),
('salsichas','Salsichas de todo tipo','salsichas','outros','muito_baixa','muito_alta','muito_baixa',null),
('stevia','Stevia','stevia','outros','muito_alta','muito_baixa','baixa',null),
('tomilho','Tomilho','tomilho','outros','baixa','muito_baixa','baixa',null),
('tutano','Tutano','tutano','outros','muito_baixa','muito_baixa','alta',null),
('vinagre-balsamico','Vinagre balsâmico','vinagre balsamico','outros','muito_baixa','muito_alta','muito_baixa',null),
('vinagre-branco','Vinagre branco destilado','vinagre branco destilado','outros','muito_baixa','muito_alta','muito_baixa',null),
('vinagre-de-maca','Vinagre de Maçã','vinagre de maca','outros','muito_baixa','media','muito_baixa',null),
('vinagre-vinho-branco','Vinagre de vinho branco','vinagre de vinho branco','outros',null,'muito_alta',null,null),
('vinagre-vinho-tinto','Vinagre de vinho tinto','vinagre de vinho tinto','outros','muito_baixa','muito_alta','baixa',null),
('xarope-de-acer','Xarope de Ácer (bordo)','xarope de acer','outros','media','muito_baixa','muito_alta',null),
('xarope-de-agave','Xarope de Agave','xarope de agave','outros','alta','muito_baixa','muito_alta',null),
('zimbro','Zimbro','zimbro','outros','muito_baixa','muito_baixa','media',null)

on conflict (id) do update set
  nome = excluded.nome, nome_busca = excluded.nome_busca, categoria = excluded.categoria,
  oxalato = excluded.oxalato, histamina = excluded.histamina, lectina = excluded.lectina,
  observacao = excluded.observacao;


-- ###########################################################################
-- 0020_marcadores_ligacao.sql
-- ###########################################################################

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


-- ###########################################################################
-- 0021_rastreio_por_paciente.sql
-- ###########################################################################

-- =============================================================================
-- CENTRAL DO PACIENTE — 0021: rastreio é para quem precisa, e a marcação é só
-- dos alimentos do Mapa
--
-- Dois pedidos dela, e os dois vão na mesma direção: menos coisa na frente de
-- quem não precisa dela.
--
-- 1. NEM TODA PACIENTE FAZ RASTREAMENTO
--
--    O módulo passa a ser ligado paciente por paciente. Desligado — que é como
--    todo mundo começa — a paciente não vê o atalho, não vê a tela e não tem
--    o que responder. Para quem não tem queixa intestinal, o módulo
--    simplesmente não existe.
--
-- 2. A MARCAÇÃO SÓ VALE PARA OS ALIMENTOS DO MAPA
--
--    A Tabela de oxalato, histamina e lectina tem 283 alimentos; o Mapa de
--    Reintrodução tem 64. Vinho, tomate, café e companhia estão na Tabela e
--    não fazem parte do protocolo de reintrodução — e por isso não devem
--    aparecer marcados.
--
--    O que sai daqui é a busca por nome: um alimento que a paciente digitasse
--    como "champagne" casava com a linha da Tabela e ganhava marcação. Agora
--    só recebe marcação o alimento que veio do Mapa e tem ligação explícita.
--    A Tabela inteira continua guardada, para o dia em que ela quiser ligar
--    mais algum — mas ligar é decisão dela, não semelhança de nome.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. O interruptor
-- -----------------------------------------------------------------------------

alter table reintroducao_acompanhamento
  add column if not exists ativo boolean not null default false;

/** Quem tem rastreio ligado. Sem linha de acompanhamento, está desligado. */
create or replace function rastreio_ativo(p_paciente uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select a.ativo from reintroducao_acompanhamento a where a.paciente_id = p_paciente),
    false
  );
$$;

revoke all on function rastreio_ativo(uuid) from anon, public;
grant execute on function rastreio_ativo(uuid) to authenticated;

create or replace function definir_rastreio_do_paciente(p_paciente uuid, p_ativo boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista liga ou desliga o rastreio.' using errcode = '42501';
  end if;
  if not exists (select 1 from pacientes where id = p_paciente) then
    raise exception 'Paciente não encontrada.' using errcode = '22023';
  end if;

  insert into reintroducao_acompanhamento (paciente_id, ativo)
  values (p_paciente, p_ativo)
  on conflict (paciente_id) do update set ativo = excluded.ativo;
end;
$$;

revoke all on function definir_rastreio_do_paciente(uuid, boolean) from anon, public;
grant execute on function definir_rastreio_do_paciente(uuid, boolean) to authenticated;

/** Quem já está com o rastreio ligado, para a lista de pacientes dela. */
create or replace function rastreios_ativos()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê isso.' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_agg(a.paciente_id), '[]'::jsonb)
    from reintroducao_acompanhamento a where a.ativo
  );
end;
$$;

revoke all on function rastreios_ativos() from anon, public;
grant execute on function rastreios_ativos() to authenticated;

-- Montar a lista de alguém é decidir que aquela paciente faz o rastreio. Sem
-- isto, ela cadastraria dez alimentos, a paciente continuaria sem ver nada e
-- a conclusão seria "o app não funciona" — que foi exatamente o que aconteceu
-- com o desafio antes do 0012.
create or replace function adicionar_itens_reintroducao(p_paciente uuid, p_alimentos text[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base integer;
  v_incluidos integer;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista monta a lista.' using errcode = '42501';
  end if;
  if not exists (select 1 from pacientes where id = p_paciente) then
    raise exception 'Paciente não encontrada.' using errcode = '22023';
  end if;

  select coalesce(max(ordem), 0) into v_base
  from reintroducao_itens where paciente_id = p_paciente;

  with novos as (
    insert into reintroducao_itens (paciente_id, alimento_id, ordem)
    select p_paciente, a.id, v_base + row_number() over (order by a.ordem)
    from reintroducao_alimentos a
    where a.id = any (p_alimentos) and a.ativo
    on conflict (paciente_id, alimento_id) where alimento_id is not null
    do nothing
    returning 1
  )
  select count(*) into v_incluidos from novos;

  insert into reintroducao_acompanhamento (paciente_id, ativo)
  values (p_paciente, true)
  on conflict (paciente_id) do update set ativo = true;

  return v_incluidos;
end;
$$;

create or replace function adicionar_item_livre_reintroducao(p_paciente uuid, p_nome text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista monta a lista.' using errcode = '42501';
  end if;
  if coalesce(trim(p_nome), '') = '' then
    raise exception 'Escreva o nome do alimento.' using errcode = '22023';
  end if;

  insert into reintroducao_itens (paciente_id, nome_livre, ordem)
  values (p_paciente, trim(p_nome),
          coalesce((select max(ordem) + 1 from reintroducao_itens
                     where paciente_id = p_paciente), 1))
  returning id into v_id;

  insert into reintroducao_acompanhamento (paciente_id, ativo)
  values (p_paciente, true)
  on conflict (paciente_id) do update set ativo = true;

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- A tela da paciente respeita o interruptor
-- -----------------------------------------------------------------------------

/**
 * Desligado, a paciente não registra nada.
 *
 * A conferência fica aqui e não só na tela: com o módulo desligado, o botão
 * some — e quem chamasse a função por fora também não passa.
 */
create or replace function registrar_reintroducao(
  p_item uuid default null,
  p_nome_novo text default null,
  p_data date default null,
  p_horario time default null,
  p_quantidade text default null,
  p_preparo text default null,
  p_sintomas text[] default '{}',
  p_intensidade integer default null,
  p_bristol integer default null,
  p_observacao text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
  v_item uuid;
  v_id uuid;
begin
  if not tem_acesso() then
    raise exception 'Seu acesso não está liberado.' using errcode = '42501';
  end if;
  v_paciente := meu_paciente_id();
  if v_paciente is null then
    raise exception 'Não encontrei seu cadastro de paciente.' using errcode = '42501';
  end if;
  if not rastreio_ativo(v_paciente) then
    raise exception 'A rastreabilidade não está ativa para você.' using errcode = '42501';
  end if;

  if p_item is not null then
    select i.id into v_item from reintroducao_itens i
     where i.id = p_item and i.paciente_id = v_paciente;
    if v_item is null then
      raise exception 'Este alimento não está na sua lista.' using errcode = '42501';
    end if;
  elsif coalesce(trim(p_nome_novo), '') <> '' then
    insert into reintroducao_itens (paciente_id, nome_livre, status, ordem)
    values (v_paciente, trim(p_nome_novo), 'em_teste',
            coalesce((select max(ordem) + 1 from reintroducao_itens
                       where paciente_id = v_paciente), 1))
    returning id into v_item;
  else
    raise exception 'Escolha um alimento ou escreva o nome.' using errcode = '22023';
  end if;

  insert into reintroducao_registros
    (item_id, paciente_id, data, horario, quantidade, preparo,
     sintomas, intensidade, bristol, observacao)
  values
    (v_item, v_paciente, coalesce(p_data, hoje_sp()), p_horario,
     nullif(trim(p_quantidade), ''), nullif(trim(p_preparo), ''),
     conferir_sintomas(p_sintomas), p_intensidade, p_bristol,
     nullif(trim(p_observacao), ''))
  returning id into v_id;

  update reintroducao_itens set status = 'em_teste'
   where id = v_item and status = 'nao_iniciado';

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. A marcação só dos alimentos do Mapa
--
-- A busca por nome sai de cena. Ela existia para alcançar o alimento que a
-- paciente digitasse, e é justamente por ali que "champagne" entrava.
-- -----------------------------------------------------------------------------

drop function if exists marcador_por_nome(text);
drop function if exists normalizar_nome(text);

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
        'nome', coalesce(a.nome, i.nome_livre),
        'categoria', coalesce(a.categoria, 'outros'),
        'semanaSugerida', a.semana_sugerida,
        'porcaoReferencia', a.porcao_referencia,
        'observacaoMaterial', a.observacao,
        'doCatalogo', i.alimento_id is not null,
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

-- -----------------------------------------------------------------------------
-- O app inteiro precisa saber, e numa chamada que ele já faz
--
-- O atalho da tela inicial some quando o rastreio está desligado. Pendurar
-- isso em `meu_acesso()` custa um campo numa leitura que já acontece; uma
-- chamada só para isso custaria uma volta de rede em toda abertura do app.
-- -----------------------------------------------------------------------------

create or replace function meu_acesso()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'autenticado', auth.uid() is not null,
    'perfilId', auth.uid(),
    'papel', coalesce((select papel from perfis where id = auth.uid()), 'paciente'),
    'nome', (select coalesce(pa.nome, pe.nome) from perfis pe
             left join pacientes pa on pa.perfil_id = pe.id where pe.id = auth.uid()),
    'email', (select email::text from perfis where id = auth.uid()),
    'temAcesso', tem_acesso() or e_admin(),
    'situacao', coalesce(
      (select situacao_paciente(p.status, p.perfil_id, p.data_inicio, p.data_fim)
         from pacientes p where p.perfil_id = auth.uid()),
      case when e_admin() then 'admin' else 'sem_cadastro' end
    ),
    'dataInicio', (select data_inicio from pacientes where perfil_id = auth.uid()),
    'dataFim', (select data_fim from pacientes where perfil_id = auth.uid()),
    'diasRestantes', (select data_fim - hoje_sp() from pacientes where perfil_id = auth.uid()),
    'plano', (select pl.nome from pacientes p join planos pl on pl.id = p.plano_id
               where p.perfil_id = auth.uid()),
    -- A nutricionista enxerga sempre, para conferir a tela da paciente.
    'rastreio', e_admin() or coalesce(rastreio_ativo(meu_paciente_id()), false)
  );
$$;

grant execute on function meu_acesso() to authenticated;

/**
 * Com o rastreio desligado, a tela da paciente volta vazia.
 *
 * Os dados dela continuam guardados — desligar não apaga histórico, e religar
 * traz tudo de volta. O que muda é que o app para de entregar: se a
 * nutricionista desligou, a paciente não vê nem o que já tinha registrado,
 * e é isso que "não faz rastreamento" quer dizer.
 */
create or replace function minha_reintroducao()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
  v_previa boolean;
  v_orientacao text;
begin
  v_paciente := meu_paciente_id();
  v_previa := v_paciente is null and e_admin();

  if v_paciente is null and not v_previa then
    return jsonb_build_object('ativo', false, 'previa', false, 'orientacao', null,
                              'itens', '[]'::jsonb, 'registros', '[]'::jsonb);
  end if;

  if not v_previa and not rastreio_ativo(v_paciente) then
    return jsonb_build_object('ativo', false, 'previa', false, 'orientacao', null,
                              'itens', '[]'::jsonb, 'registros', '[]'::jsonb);
  end if;

  select valor #>> '{}' into v_orientacao
  from configuracoes where chave = 'reintroducao_orientacao';

  return jsonb_build_object('orientacao', coalesce(
    (select nullif(trim(a.orientacao), '') from reintroducao_acompanhamento a
      where a.paciente_id = v_paciente),
    v_orientacao
  )) || reintroducao_json(v_paciente, v_previa);
end;
$$;

grant execute on function minha_reintroducao() to authenticated;

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('rastreio_ativo', 'definir_rastreio_do_paciente',
                        'rastreios_ativos', 'minha_reintroducao', 'meu_acesso',
                        'reintroducao_json', 'registrar_reintroducao',
                        'adicionar_itens_reintroducao', 'adicionar_item_livre_reintroducao')
  loop
    execute format('revoke all on function %s from anon, public', f.assinatura);
  end loop;
end;
$$;

grant execute on function meu_acesso() to authenticated;
grant execute on function minha_reintroducao() to authenticated;
grant execute on function registrar_reintroducao(uuid, text, date, time, text, text, text[], integer, integer, text) to authenticated;
grant execute on function adicionar_itens_reintroducao(uuid, text[]) to authenticated;
grant execute on function adicionar_item_livre_reintroducao(uuid, text) to authenticated;
grant execute on function rastreio_ativo(uuid) to authenticated;
grant execute on function definir_rastreio_do_paciente(uuid, boolean) to authenticated;
grant execute on function rastreios_ativos() to authenticated;


-- ###########################################################################
-- 0022_protocolo.sql
-- ###########################################################################

-- =============================================================================
-- CENTRAL DO PACIENTE — 0022: protocolo alimentar
--
-- A nutricionista calcula a dieta fora, do jeito dela, e cola o resultado
-- aqui. O app NÃO calcula nada: não guarda caloria, não guarda macro, não
-- guarda porção. Ele guarda o que ela escreveu e mostra bonito para a
-- paciente — que era a razão de existir disto, ter um aplicativo só em vez
-- de dois.
--
-- O protocolo inteiro cabe num `jsonb`. Isso é decisão, não preguiça:
--
--   * ele é um documento, não uma planilha. Ninguém vai pesquisar "todas as
--     pacientes que comem tapioca no café" — vai abrir o protocolo de uma
--     paciente e ler de cima a baixo;
--   * editar é reescrever o documento, e não costurar quinze tabelas;
--   * o formato dela muda (hoje três colunas, amanhã quatro). Um documento
--     acompanha; um esquema rígido vira migração toda vez.
--
-- Três situações, e só uma delas a paciente enxerga:
--
--   rascunho   — ela está montando. Ninguém mais vê.
--   publicado  — no ar para a paciente. No máximo um por paciente.
--   arquivado  — versão anterior. Fica de história, só para a nutricionista.
-- =============================================================================

create table if not exists protocolos (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes (id) on delete cascade,
  titulo text not null default 'Protocolo alimentar',
  conteudo jsonb not null default '{"orientacoes":[],"refeicoes":[],"secoes":[]}'::jsonb,
  -- Recado curto que aparece em destaque em cima do protocolo. Serve para o
  -- ajuste de uma semana sem refazer o documento inteiro.
  ajustes text,
  situacao text not null default 'rascunho'
    check (situacao in ('rascunho', 'publicado', 'arquivado')),
  versao integer not null default 1,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  publicado_em timestamptz
);

create index if not exists protocolos_por_paciente on protocolos (paciente_id, situacao);

-- Um rascunho e um publicado por paciente. Arquivado pode ter quantos vierem.
create unique index if not exists protocolo_um_rascunho
  on protocolos (paciente_id) where situacao = 'rascunho';
create unique index if not exists protocolo_um_publicado
  on protocolos (paciente_id) where situacao = 'publicado';

alter table protocolos enable row level security;

-- A paciente lê o protocolo publicado dela, e mais nada: nem rascunho (que
-- ainda está sendo escrito), nem arquivado (que já foi substituído), nem o
-- de outra paciente. Quem garante isso é esta política, não a ausência de
-- botão na tela.
drop policy if exists protocolos_nutri on protocolos;
create policy protocolos_nutri on protocolos for all
  using (e_admin()) with check (e_admin());

drop policy if exists protocolos_paciente on protocolos;
create policy protocolos_paciente on protocolos for select
  using (situacao = 'publicado' and paciente_id = meu_paciente_id());

grant select, insert, update, delete on protocolos to authenticated;
revoke all on table protocolos from anon;

-- -----------------------------------------------------------------------------
-- Lado da paciente
-- -----------------------------------------------------------------------------

/**
 * O protocolo da paciente, ou nulo.
 *
 * Nulo não é erro: é a paciente que ainda não recebeu dieta, e a tela dela
 * não deve nem mostrar o atalho nesse caso.
 */
create or replace function meu_protocolo()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(p) - 'paciente_id'
  from protocolos p
  where p.situacao = 'publicado'
    and p.paciente_id = meu_paciente_id();
$$;

revoke all on function meu_protocolo() from anon, public;
grant execute on function meu_protocolo() to authenticated;

/** Tem protocolo publicado? Entra no `meu_acesso()` para a home decidir. */
create or replace function tenho_protocolo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from protocolos
    where situacao = 'publicado' and paciente_id = meu_paciente_id()
  );
$$;

revoke all on function tenho_protocolo() from anon, public;
grant execute on function tenho_protocolo() to authenticated;

-- -----------------------------------------------------------------------------
-- Lado da nutricionista
-- -----------------------------------------------------------------------------

/**
 * O que a tela de edição precisa: o rascunho (se houver), o publicado (se
 * houver) e a lista das versões anteriores.
 *
 * Vem tudo numa chamada só porque a tela mostra tudo junto — e porque uma
 * volta de rede a menos, no celular dela, é meio segundo a menos de espera.
 */
create or replace function protocolo_do_paciente(p_paciente uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista abre o protocolo de um paciente.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'rascunho', (select to_jsonb(p) from protocolos p
                  where p.paciente_id = p_paciente and p.situacao = 'rascunho'),
    'publicado', (select to_jsonb(p) from protocolos p
                   where p.paciente_id = p_paciente and p.situacao = 'publicado'),
    'historico', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'titulo', p.titulo, 'versao', p.versao,
               'publicadoEm', p.publicado_em, 'atualizadoEm', p.atualizado_em)
             order by p.versao desc)
      from protocolos p
      where p.paciente_id = p_paciente and p.situacao = 'arquivado'
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function protocolo_do_paciente(uuid) from anon, public;
grant execute on function protocolo_do_paciente(uuid) to authenticated;

/**
 * Salva o rascunho. Cria se não existir, sobrescreve se existir.
 *
 * Salvar nunca publica. A paciente só passa a ver quando ela apertar
 * publicar, e essa separação é de propósito: metade de um protocolo colado
 * é pior do que nenhum.
 */
create or replace function salvar_rascunho_protocolo(
  p_paciente uuid,
  p_titulo text,
  p_conteudo jsonb,
  p_ajustes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista escreve protocolo.' using errcode = '42501';
  end if;

  if not exists (select 1 from pacientes where id = p_paciente) then
    raise exception 'Paciente não encontrado.' using errcode = 'P0002';
  end if;

  if p_conteudo is null or jsonb_typeof(p_conteudo) <> 'object' then
    raise exception 'O conteúdo do protocolo precisa ser um objeto.' using errcode = '22023';
  end if;

  insert into protocolos (paciente_id, titulo, conteudo, ajustes, situacao)
  values (p_paciente, coalesce(nullif(trim(p_titulo), ''), 'Protocolo alimentar'),
          p_conteudo, p_ajustes, 'rascunho')
  on conflict (paciente_id) where situacao = 'rascunho'
  do update set titulo = excluded.titulo,
                conteudo = excluded.conteudo,
                ajustes = excluded.ajustes,
                atualizado_em = now()
  returning id into v_id;

  return (select to_jsonb(p) from protocolos p where p.id = v_id);
end;
$$;

revoke all on function salvar_rascunho_protocolo(uuid, text, jsonb, text) from anon, public;
grant execute on function salvar_rascunho_protocolo(uuid, text, jsonb, text) to authenticated;

/**
 * Publica o rascunho.
 *
 * O que estava publicado vira arquivado — não some. Se ela publicar uma
 * dieta errada, a anterior está a um clique de voltar, e é isso que faz
 * publicar deixar de ser assustador.
 */
create or replace function publicar_protocolo(p_paciente uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rascunho protocolos;
  v_versao integer;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista publica protocolo.' using errcode = '42501';
  end if;

  select * into v_rascunho from protocolos
  where paciente_id = p_paciente and situacao = 'rascunho';

  if v_rascunho.id is null then
    raise exception 'Não há rascunho para publicar.' using errcode = 'P0002';
  end if;

  if jsonb_array_length(coalesce(v_rascunho.conteudo -> 'refeicoes', '[]'::jsonb)) = 0 then
    raise exception 'O protocolo não tem nenhuma refeição.' using errcode = '22023';
  end if;

  -- O próprio rascunho já nasce com versao = 1; contá-lo aqui faria a
  -- primeira publicação sair como versão 2. Só o que já foi ao ar conta.
  select coalesce(max(versao), 0) + 1 into v_versao
  from protocolos
  where paciente_id = p_paciente and situacao in ('publicado', 'arquivado');

  update protocolos set situacao = 'arquivado', atualizado_em = now()
  where paciente_id = p_paciente and situacao = 'publicado';

  update protocolos
  set situacao = 'publicado', versao = v_versao,
      publicado_em = now(), atualizado_em = now()
  where id = v_rascunho.id;

  return (select to_jsonb(p) from protocolos p where p.id = v_rascunho.id);
end;
$$;

revoke all on function publicar_protocolo(uuid) from anon, public;
grant execute on function publicar_protocolo(uuid) to authenticated;

/**
 * Muda só o recado de ajustes do protocolo que já está no ar.
 *
 * É o atalho para "essa semana troca o lanche": chega na paciente na hora,
 * sem versão nova e sem refazer o documento.
 */
create or replace function definir_ajustes_protocolo(p_paciente uuid, p_ajustes text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista muda os ajustes.' using errcode = '42501';
  end if;

  update protocolos
  set ajustes = nullif(trim(coalesce(p_ajustes, '')), ''), atualizado_em = now()
  where paciente_id = p_paciente and situacao = 'publicado';

  if not found then
    raise exception 'Este paciente não tem protocolo publicado.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function definir_ajustes_protocolo(uuid, text) from anon, public;
grant execute on function definir_ajustes_protocolo(uuid, text) to authenticated;

/** Joga o rascunho fora. O que está publicado não se mexe. */
create or replace function descartar_rascunho_protocolo(p_paciente uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista descarta rascunho.' using errcode = '42501';
  end if;
  delete from protocolos where paciente_id = p_paciente and situacao = 'rascunho';
end;
$$;

revoke all on function descartar_rascunho_protocolo(uuid) from anon, public;
grant execute on function descartar_rascunho_protocolo(uuid) to authenticated;

/**
 * Traz uma versão antiga de volta como rascunho.
 *
 * Não republica sozinho: ela olha, mexe se quiser, e publica. Voltar uma
 * dieta para o ar sem ela conferir seria decidir no lugar dela.
 */
create or replace function restaurar_protocolo(p_protocolo uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antigo protocolos;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista restaura protocolo.' using errcode = '42501';
  end if;

  select * into v_antigo from protocolos where id = p_protocolo;
  if v_antigo.id is null then
    raise exception 'Versão não encontrada.' using errcode = 'P0002';
  end if;

  return salvar_rascunho_protocolo(
    v_antigo.paciente_id, v_antigo.titulo, v_antigo.conteudo, v_antigo.ajustes
  );
end;
$$;

revoke all on function restaurar_protocolo(uuid) from anon, public;
grant execute on function restaurar_protocolo(uuid) to authenticated;

/**
 * Quem tem protocolo, e em que pé está.
 *
 * A tela da nutricionista abre com a lista das pacientes; sem isto ela teria
 * de abrir uma por uma para lembrar quem ainda não recebeu dieta.
 */
create or replace function protocolos_das_pacientes()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê a lista.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'pacienteId', pa.id,
             'nome', pa.nome,
             'situacao', coalesce(
               (select p.situacao from protocolos p
                 where p.paciente_id = pa.id and p.situacao = 'publicado'), 'sem'),
             'temRascunho', exists (
               select 1 from protocolos p
                where p.paciente_id = pa.id and p.situacao = 'rascunho'),
             'publicadoEm', (select p.publicado_em from protocolos p
                              where p.paciente_id = pa.id and p.situacao = 'publicado')
           ) order by pa.nome)
    from pacientes pa
  ), '[]'::jsonb);
end;
$$;

revoke all on function protocolos_das_pacientes() from anon, public;
grant execute on function protocolos_das_pacientes() to authenticated;

-- -----------------------------------------------------------------------------
-- O app precisa saber, e numa chamada que ele já faz
-- -----------------------------------------------------------------------------

create or replace function meu_acesso()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'autenticado', auth.uid() is not null,
    'perfilId', auth.uid(),
    'papel', coalesce((select papel from perfis where id = auth.uid()), 'paciente'),
    'nome', (select coalesce(pa.nome, pe.nome) from perfis pe
             left join pacientes pa on pa.perfil_id = pe.id where pe.id = auth.uid()),
    'email', (select email::text from perfis where id = auth.uid()),
    'temAcesso', tem_acesso() or e_admin(),
    'situacao', coalesce(
      (select situacao_paciente(p.status, p.perfil_id, p.data_inicio, p.data_fim)
         from pacientes p where p.perfil_id = auth.uid()),
      case when e_admin() then 'admin' else 'sem_cadastro' end
    ),
    'dataInicio', (select data_inicio from pacientes where perfil_id = auth.uid()),
    'dataFim', (select data_fim from pacientes where perfil_id = auth.uid()),
    'diasRestantes', (select data_fim - hoje_sp() from pacientes where perfil_id = auth.uid()),
    'plano', (select pl.nome from pacientes p join planos pl on pl.id = p.plano_id
               where p.perfil_id = auth.uid()),
    'rastreio', e_admin() or coalesce(rastreio_ativo(meu_paciente_id()), false),
    -- A nutricionista enxerga sempre, para conferir a tela da paciente.
    'protocolo', e_admin() or tenho_protocolo()
  );
$$;

grant execute on function meu_acesso() to authenticated;


-- ###########################################################################
-- 0023_grupos_protocolo.sql
-- ###########################################################################

-- =============================================================================
-- CENTRAL DO PACIENTE — 0023: grupos de alimentos do protocolo
--
-- "Preciso de um banco de dados com alimentos já salvos, tipo grupo de frutas
-- já com porção, grupo de carbos pro almoço."
--
-- É a lista que ela monta UMA vez e usa em toda paciente: dezessete frutas
-- com a porção de cada uma, sete fontes de carboidrato para o almoço. Sem
-- isto ela redigita a mesma lista a cada protocolo.
--
-- O QUE ESTA TABELA NÃO É
--
-- Não é tabela nutricional. Não há caloria, macro nem composição em lugar
-- nenhum — só nome e quantidade, escritos por ela. O aplicativo continua sem
-- calcular dieta, que é a regra desde o começo: quem calcula é a
-- nutricionista, fora daqui.
--
-- CÓPIA, NÃO LIGAÇÃO
--
-- Ao entrar num protocolo, o grupo é copiado para dentro dele. Mexer no
-- grupo depois NÃO muda o protocolo de ninguém que já recebeu — a dieta que
-- a paciente está seguindo não pode mudar sozinha porque ela ajustou uma
-- lista. Quando quiser propagar, ela entra no protocolo e acrescenta o grupo
-- de novo.
-- =============================================================================

create table if not exists grupos_protocolo (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  -- [{ "alimento": "Banana", "quantidade": "1 unidade" }, …]
  itens jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create unique index if not exists grupo_protocolo_nome on grupos_protocolo (lower(nome));

alter table grupos_protocolo enable row level security;

-- A paciente não lê esta tabela. Ela não precisa: o que vale para a dieta
-- dela já foi copiado para dentro do protocolo dela.
drop policy if exists grupos_protocolo_nutri on grupos_protocolo;
create policy grupos_protocolo_nutri on grupos_protocolo for all
  using (e_admin()) with check (e_admin());

grant select, insert, update, delete on grupos_protocolo to authenticated;
revoke all on table grupos_protocolo from anon;

create or replace function listar_grupos_protocolo()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê os grupos.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object('id', g.id, 'nome', g.nome, 'itens', g.itens)
                     order by g.nome)
    from grupos_protocolo g
  ), '[]'::jsonb);
end;
$$;

revoke all on function listar_grupos_protocolo() from anon, public;
grant execute on function listar_grupos_protocolo() to authenticated;

/**
 * Cria ou atualiza um grupo. Sem `p_id`, cria.
 *
 * Grupo sem nome não entra: a lista dela é encontrada pelo nome, e um grupo
 * chamado "" some no meio dos outros.
 */
create or replace function salvar_grupo_protocolo(
  p_id uuid,
  p_nome text,
  p_itens jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_nome text := nullif(trim(coalesce(p_nome, '')), '');
begin
  if not e_admin() then
    raise exception 'Só a nutricionista escreve grupos.' using errcode = '42501';
  end if;

  if v_nome is null then
    raise exception 'O grupo precisa de um nome.' using errcode = '22023';
  end if;

  if p_itens is null or jsonb_typeof(p_itens) <> 'array' then
    raise exception 'A lista de alimentos do grupo precisa ser uma lista.' using errcode = '22023';
  end if;

  if p_id is null then
    insert into grupos_protocolo (nome, itens) values (v_nome, p_itens)
    returning id into v_id;
  else
    update grupos_protocolo
    set nome = v_nome, itens = p_itens, atualizado_em = now()
    where id = p_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Grupo não encontrado.' using errcode = 'P0002';
    end if;
  end if;

  return (select jsonb_build_object('id', g.id, 'nome', g.nome, 'itens', g.itens)
          from grupos_protocolo g where g.id = v_id);
end;
$$;

revoke all on function salvar_grupo_protocolo(uuid, text, jsonb) from anon, public;
grant execute on function salvar_grupo_protocolo(uuid, text, jsonb) to authenticated;

/**
 * Apaga o grupo.
 *
 * Os protocolos que já usaram esse grupo não sentem nada: eles guardam a
 * cópia, não uma ligação. Apagar aqui é tirar da lista de atalhos dela.
 */
create or replace function excluir_grupo_protocolo(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista apaga grupos.' using errcode = '42501';
  end if;
  delete from grupos_protocolo where id = p_id;
end;
$$;

revoke all on function excluir_grupo_protocolo(uuid) from anon, public;
grant execute on function excluir_grupo_protocolo(uuid) to authenticated;


-- ###########################################################################
-- 0024_avaliacao_fisica.sql
-- ###########################################################################

-- =============================================================================
-- CENTRAL DO PACIENTE — 0024: avaliação física
--
-- "Ao lado do protocolo, um negocinho clicável, que a paciente clica para
-- ver a última avaliação física dela."
--
-- A conta é feita FORA daqui, na ferramenta de cálculo. Esta tabela guarda o
-- resultado que a nutricionista lançou: as medidas, as dobras, o método que
-- ela usou e o percentual que deu. O app não recalcula nada — se
-- recalculasse, um dia mostraria um número diferente do que ela entregou na
-- consulta, e quem estaria certo seria impossível dizer.
--
-- Uma linha por avaliação. O histórico é o ponto: "cada retorno mostra a
-- variação" é o que o material dela promete à paciente.
-- =============================================================================

create table if not exists avaliacoes_fisicas (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes (id) on delete cascade,
  data date not null default hoje_sp(),
  /**
   * { metodo, peso, altura, idade, percentualGordura, massaGorda,
   *   massaMagra, imc, somaDobras, dobras: [{nome, valor}],
   *   circunferencias: [{nome, valor}], observacao }
   *
   * Documento, não planilha: o conjunto de dobras muda com o protocolo, e
   * uma coluna por dobra viraria migração a cada material novo.
   */
  dados jsonb not null default '{}'::jsonb,
  publicada boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists avaliacoes_por_paciente
  on avaliacoes_fisicas (paciente_id, data desc);

alter table avaliacoes_fisicas enable row level security;

drop policy if exists avaliacoes_nutri on avaliacoes_fisicas;
create policy avaliacoes_nutri on avaliacoes_fisicas for all
  using (e_admin()) with check (e_admin());

-- A paciente lê as avaliações publicadas dela, e mais nada. Rascunho de
-- avaliação não aparece: um percentual lançado pela metade não pode chegar
-- em quem vai lê-lo sobre o próprio corpo.
drop policy if exists avaliacoes_paciente on avaliacoes_fisicas;
create policy avaliacoes_paciente on avaliacoes_fisicas for select
  using (publicada and paciente_id = meu_paciente_id());

grant select, insert, update, delete on avaliacoes_fisicas to authenticated;
revoke all on table avaliacoes_fisicas from anon;

/** A última avaliação publicada da paciente, e quantas vieram antes. */
create or replace function minha_avaliacao()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
  v_ultima avaliacoes_fisicas;
  v_total integer;
begin
  v_paciente := meu_paciente_id();
  if v_paciente is null then return null; end if;

  select * into v_ultima from avaliacoes_fisicas
  where paciente_id = v_paciente and publicada
  order by data desc, criado_em desc
  limit 1;

  if v_ultima.id is null then return null; end if;

  select count(*) into v_total from avaliacoes_fisicas
  where paciente_id = v_paciente and publicada;

  return jsonb_build_object(
    'id', v_ultima.id,
    'data', v_ultima.data,
    'dados', v_ultima.dados,
    'total', v_total,
    -- A data da primeira: é o "ponto de partida" do material dela.
    'inicio', (select min(data) from avaliacoes_fisicas
                where paciente_id = v_paciente and publicada)
  );
end;
$$;

revoke all on function minha_avaliacao() from anon, public;
grant execute on function minha_avaliacao() to authenticated;

/** Tem avaliação publicada? Entra no `meu_acesso()` para a tela decidir. */
create or replace function tenho_avaliacao()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from avaliacoes_fisicas
    where publicada and paciente_id = meu_paciente_id()
  );
$$;

revoke all on function tenho_avaliacao() from anon, public;
grant execute on function tenho_avaliacao() to authenticated;

create or replace function avaliacoes_do_paciente(p_paciente uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê as avaliações.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', a.id, 'data', a.data, 'dados', a.dados, 'publicada', a.publicada)
           order by a.data desc, a.criado_em desc)
    from avaliacoes_fisicas a where a.paciente_id = p_paciente
  ), '[]'::jsonb);
end;
$$;

revoke all on function avaliacoes_do_paciente(uuid) from anon, public;
grant execute on function avaliacoes_do_paciente(uuid) to authenticated;

create or replace function salvar_avaliacao_fisica(
  p_id uuid,
  p_paciente uuid,
  p_data date,
  p_dados jsonb,
  p_publicada boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista lança avaliação.' using errcode = '42501';
  end if;

  if not exists (select 1 from pacientes where id = p_paciente) then
    raise exception 'Paciente não encontrado.' using errcode = 'P0002';
  end if;

  if p_dados is null or jsonb_typeof(p_dados) <> 'object' then
    raise exception 'Os dados da avaliação precisam ser um objeto.' using errcode = '22023';
  end if;

  if p_id is null then
    insert into avaliacoes_fisicas (paciente_id, data, dados, publicada)
    values (p_paciente, coalesce(p_data, hoje_sp()), p_dados, coalesce(p_publicada, false))
    returning id into v_id;
  else
    update avaliacoes_fisicas
    set data = coalesce(p_data, data),
        dados = p_dados,
        publicada = coalesce(p_publicada, publicada),
        atualizado_em = now()
    where id = p_id and paciente_id = p_paciente
    returning id into v_id;

    if v_id is null then
      raise exception 'Avaliação não encontrada.' using errcode = 'P0002';
    end if;
  end if;

  return (select jsonb_build_object('id', a.id, 'data', a.data, 'dados', a.dados,
                                    'publicada', a.publicada)
          from avaliacoes_fisicas a where a.id = v_id);
end;
$$;

revoke all on function salvar_avaliacao_fisica(uuid, uuid, date, jsonb, boolean) from anon, public;
grant execute on function salvar_avaliacao_fisica(uuid, uuid, date, jsonb, boolean) to authenticated;

create or replace function excluir_avaliacao_fisica(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista apaga avaliação.' using errcode = '42501';
  end if;
  delete from avaliacoes_fisicas where id = p_id;
end;
$$;

revoke all on function excluir_avaliacao_fisica(uuid) from anon, public;
grant execute on function excluir_avaliacao_fisica(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- O acesso passa a dizer se há avaliação, para a tela não oferecer porta vazia
-- -----------------------------------------------------------------------------

create or replace function meu_acesso()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'autenticado', auth.uid() is not null,
    'perfilId', auth.uid(),
    'papel', coalesce((select papel from perfis where id = auth.uid()), 'paciente'),
    'nome', (select coalesce(pa.nome, pe.nome) from perfis pe
             left join pacientes pa on pa.perfil_id = pe.id where pe.id = auth.uid()),
    'email', (select email::text from perfis where id = auth.uid()),
    'temAcesso', tem_acesso() or e_admin(),
    'situacao', coalesce(
      (select situacao_paciente(p.status, p.perfil_id, p.data_inicio, p.data_fim)
         from pacientes p where p.perfil_id = auth.uid()),
      case when e_admin() then 'admin' else 'sem_cadastro' end
    ),
    'dataInicio', (select data_inicio from pacientes where perfil_id = auth.uid()),
    'dataFim', (select data_fim from pacientes where perfil_id = auth.uid()),
    'diasRestantes', (select data_fim - hoje_sp() from pacientes where perfil_id = auth.uid()),
    'plano', (select pl.nome from pacientes p join planos pl on pl.id = p.plano_id
               where p.perfil_id = auth.uid()),
    'rastreio', e_admin() or coalesce(rastreio_ativo(meu_paciente_id()), false),
    'protocolo', e_admin() or tenho_protocolo(),
    'avaliacao', e_admin() or tenho_avaliacao()
  );
$$;

grant execute on function meu_acesso() to authenticated;
