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
