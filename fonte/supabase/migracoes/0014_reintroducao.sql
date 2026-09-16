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
