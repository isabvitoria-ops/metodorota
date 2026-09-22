-- =============================================================================
-- CENTRAL DO PACIENTE — 0039: a condição principal da paciente
--
-- Item 8 da lista aprovada, e o mais barato de todos — hoje.
--
-- A LIÇÃO VEIO DA AUDITORIA, e é boa: no painel do concorrente, o gráfico
-- "distribuição por tipo de tratamento" aparece 100% "não informado". O
-- campo existe no cadastro e é opcional, então ninguém preenche, e o dia em
-- que alguém quis o relatório descobriu que não havia dado nenhum.
--
-- Campo de segmentação é o tipo de coisa que custa cinco segundos na
-- entrada e é IMPOSSÍVEL de recuperar depois: ninguém vai reabrir oitenta
-- fichas para lembrar qual era a queixa principal de cada uma.
--
-- POR QUE A COLUNA É NULA E NÃO `not null`
--
-- Porque já existem pacientes cadastradas. `not null` com default obrigaria
-- a inventar um valor para as oito — e "SII" chutado é pior do que vazio,
-- porque vazio se vê e chute não.
--
-- Quem exige é a TELA DE CADASTRO, para as novas. As que já existem
-- aparecem marcadas como pendentes na lista, para ela preencher quando
-- abrir a ficha. Vazio visível vira dado; vazio escondido vira 100% "não
-- informado" dois anos depois.
-- =============================================================================

alter table pacientes
  add column if not exists condicao text;

comment on column pacientes.condicao is
  'Queixa/condição principal — o eixo pelo qual ela vai querer agrupar as pacientes depois.';

create index if not exists pacientes_por_condicao on pacientes (condicao);
