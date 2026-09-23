-- =============================================================================
-- 0048 — Cupons da Nutri no desafio
-- =============================================================================
--
-- Duas coisas, pedidas juntas:
--
--   1. Uma ação nova na tabela de pontos: "Usei o cupom da Nutri", 50
--      pontos. Como as outras, a paciente MARCA e a nutricionista CONFERE —
--      a prova é o print da compra no WhatsApp, e é ela quem aprova. Uma vez
--      por semana: é o bastante para premiar quem usa sem virar a ação que
--      decide o ranking sozinha (as outras semanais somam 30).
--
--   2. A lista dos cupons, para aparecer pequena na tela do desafio. Fica em
--      `configuracoes` (chave `cupons`), e não no código: cupom muda — marca
--      nova, código novo — e ela troca em Configurações sem publicar nada.
--
-- Entra em todo desafio que ainda não terminou. Os próximos herdam do
-- último (copiar_acoes_do_ultimo), e o molde de quando não há nenhum passa
-- a trazê-la também.

insert into desafio_acoes
  (desafio_id, chave, nome, descricao, pontos, periodicidade, max_por_semana, ordem)
select d.id, 'cupom', 'Usei o cupom da Nutri',
       'Comprou com um dos cupons abaixo? Mande o print no WhatsApp da Nutri e marque aqui. Uma vez por semana.',
       50, 'semanal', 1,
       coalesce((select max(a.ordem) from desafio_acoes a where a.desafio_id = d.id), 0) + 1
from desafios d
where d.data_fim >= hoje_sp()
on conflict (desafio_id, chave) do nothing;

insert into configuracoes (chave, valor, descricao) values (
  'cupons',
  '[{"marca":"Puravida","codigo":"ISAMARCALPH"},
    {"marca":"Caffeine Army","codigo":"NUTRIBELAMARCAL"},
    {"marca":"Jui","codigo":"NUTRIBELAMARCALL"},
    {"marca":"Dux","codigo":"pacisamarcal"}]'::jsonb,
  'Cupons da nutricionista, mostrados na tela do desafio. Lista de {marca, codigo}.'
) on conflict (chave) do nothing;

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
       'Os pontos entram quando ela começa o acompanhamento.', 100, 'evento', 1, 5),
      (new.id, 'cupom', 'Usei o cupom da Nutri',
       'Comprou com um dos cupons abaixo? Mande o print no WhatsApp da Nutri e marque aqui. Uma vez por semana.',
       50, 'semanal', 1, 6);
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
