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
