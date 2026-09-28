-- =============================================================================
-- 0052 — Desafio sem "Enviei meu diário alimentar"
--
-- A ação pedia algo que o aplicativo não tem: não existe diário alimentar
-- para enviar. O diário com foto da refeição foi avaliado e descartado —
-- competiria com a Rastreabilidade, que já faz o registro que importa
-- (alimento × sintoma). Uma ação de desafio sem nada por trás é ponto dado
-- por uma coisa que ninguém confere.
--
-- DESATIVA, NÃO APAGA. Quem já marcou a ação e ganhou ponto continua com o
-- ponto: `pontos_lancamentos.acao_id` segura a referência, e o histórico do
-- ranking não muda. Com `ativo = false` a ação some da tela da paciente e
-- não aceita marcação nova (`registrar_acao` só aceita ação ativa).
--
-- Os desafios seguintes copiam as ações do último (copiar_acoes_do_ultimo),
-- inclusive o `ativo` — então desativar aqui já vale para os próximos. O
-- molde de quando não há desafio nenhum também deixa de trazê-la.
-- =============================================================================

update desafio_acoes set ativo = false, atualizado_em = now()
where chave = 'diario' and ativo;

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
      (new.id, 'redes', 'Compartilhei minha evolução e te marquei',
       'Uma vez por semana.', 10, 'semanal', 1, 3),
      (new.id, 'indicacao', 'Indiquei uma amiga',
       'Os pontos entram quando ela começa o acompanhamento.', 100, 'evento', 1, 4),
      (new.id, 'cupom', 'Usei o cupom da Nutri',
       'Comprou com um dos cupons abaixo? Mande o print no WhatsApp da Nutri e marque aqui. Uma vez por semana.',
       50, 'semanal', 1, 5);
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

-- Conferência: deve voltar zero (nenhuma ação de diário ativa em lugar nenhum).
select count(*) as diario_ainda_ativo from desafio_acoes where chave = 'diario' and ativo;
