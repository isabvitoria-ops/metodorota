-- =============================================================================
-- Bateria das trocas de exercício e do biset (0109):
--   * a nutricionista grava trocas (com e sem vídeo) e o biset;
--   * troca sem nome e lixo no campo são descartados, nunca viram linha;
--   * a paciente lê as trocas e o biset no treino dela;
--   * treino escrito sem os campos novos sai sem troca e sem biset;
--   * o resto do exercício (faixas, vídeo) continua igual.
-- =============================================================================

truncate resultados_teste;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000f6b01', 'tb-a@paciente.test');
insert into pacientes (email, nome, plano_id, data_inicio, data_fim) values
  ('tb-a@paciente.test', 'Bia Biset', 'mensal', hoje_sp() - 5, hoje_sp() + 25);
create or replace function tb_bia() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'tb-a@paciente.test' $$;
grant execute on function tb_bia() to anon, authenticated;

begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select definir_treino_do_paciente(tb_bia(), true);
select salvar_treino(null, tb_bia(), 'Treino A', null, true, jsonb_build_array(
  jsonb_build_object('nome', 'Glúteo na máquina', 'seriesPlanejadas', '3',
    'trocas', jsonb_build_array(
      jsonb_build_object('nome', 'Glúteo com caneleira no solo', 'videoUrl', 'https://youtube.com/watch?v=a'),
      jsonb_build_object('nome', '  Elevação pélvica  ', 'videoUrl', '  '),
      jsonb_build_object('nome', '   '),
      'lixo')),
  jsonb_build_object('nome', 'Apoio no solo', 'videoUrl', 'https://youtube.com/watch?v=b', 'bisetComProximo', true,
    'faixas', jsonb_build_array(jsonb_build_object('tipo', 'Working', 'series', 3, 'repMin', 8, 'repMax', 12))),
  jsonb_build_object('nome', 'Abdominal remador', 'videoUrl', 'https://youtube.com/watch?v=c',
    'faixas', jsonb_build_array(jsonb_build_object('tipo', 'Working', 'series', 3, 'repMin', 15, 'repMax', 20))),
  jsonb_build_object('nome', 'Sem campos novos', 'trocas', 'não é lista', 'bisetComProximo', 'talvez')
));
commit;

create or replace function treinos_do_paciente_teste() returns jsonb language sql stable security definer as $$
  select coalesce(jsonb_agg(jsonb_build_object('exercicios', (
    select jsonb_agg(jsonb_build_object('nome', e.nome, 'trocas', e.trocas, 'bisetComProximo', e.biset_com_proximo,
                                        'videoUrl', e.video_url, 'faixas', e.faixas) order by e.ordem)
    from treino_exercicios e where e.treino_id = t.id))), '[]'::jsonb)
  from treinos t where t.paciente_id = tb_bia() $$;
create or replace function tb_ex(p_nome text) returns jsonb language sql stable security definer as $$
  select e from jsonb_array_elements(treinos_do_paciente_teste() -> 0 -> 'exercicios') e where e ->> 'nome' = p_nome $$;

select teste('as trocas com nome ficam, na ordem, com o vídeo quando tem',
  tb_ex('Glúteo na máquina') -> 'trocas' = jsonb_build_array(
    jsonb_build_object('nome', 'Glúteo com caneleira no solo', 'videoUrl', 'https://youtube.com/watch?v=a'),
    jsonb_build_object('nome', 'Elevação pélvica', 'videoUrl', null)));
select teste('o biset fica marcado no primeiro do par', (tb_ex('Apoio no solo') ->> 'bisetComProximo')::boolean);
select teste('e o segundo do par não puxa um terceiro', not (tb_ex('Abdominal remador') ->> 'bisetComProximo')::boolean);
select teste('cada um do biset mantém o próprio vídeo e as próprias faixas',
  tb_ex('Apoio no solo') ->> 'videoUrl' = 'https://youtube.com/watch?v=b'
  and tb_ex('Abdominal remador') -> 'faixas' -> 0 ->> 'repMax' = '20');
select teste('lixo no campo vira vazio, não erro',
  tb_ex('Sem campos novos') -> 'trocas' = '[]'::jsonb and not (tb_ex('Sem campos novos') ->> 'bisetComProximo')::boolean);

-- A nutricionista lê pela função de sempre.
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select teste('a nutricionista lê trocas e biset',
  (select bool_or(jsonb_array_length(e -> 'trocas') = 2) and bool_or((e ->> 'bisetComProximo')::boolean)
   from jsonb_array_elements(treinos_do_paciente(tb_bia()) -> 0 -> 'exercicios') e));
commit;

-- A paciente lê no treino dela.
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000f6b01', true);
select teste('a paciente vê as trocas (meus_treinos)',
  (select e -> 'trocas' -> 0 ->> 'nome' from jsonb_array_elements(meus_treinos() -> 0 -> 'exercicios') e
   where e ->> 'nome' = 'Glúteo na máquina') = 'Glúteo com caneleira no solo');
select teste('a paciente vê o biset (meu_treino)',
  (select (e ->> 'bisetComProximo')::boolean from jsonb_array_elements(meu_treino() -> 'exercicios') e
   where e ->> 'nome' = 'Apoio no solo'));
commit;

-- Exercício gravado antes da 0109 (sem os campos) sai vazio.
insert into treinos (paciente_id, nome, ativo, origem) values (tb_bia(), 'Antigo', false, 'nutricionista');
insert into treino_exercicios (treino_id, nome, ordem)
  select id, 'Supino antigo', 1 from treinos where paciente_id = tb_bia() and nome = 'Antigo';
select teste('exercício antigo nasce sem troca e sem biset',
  (select trocas = '[]'::jsonb and not biset_com_proximo from treino_exercicios where nome = 'Supino antigo'));
select teste('troca que não é lista é recusada pelo banco',
  estado_de('update treino_exercicios set trocas = ''{}''::jsonb where nome = ''Supino antigo''') = '23514');

select case when bool_and(passou) then count(*) || '/' || count(*) || ' verificacoes das trocas e do biset passaram'
            else (count(*) filter (where not passou)) || ' verificacoes das trocas e do biset falharam' end
    as resultado
from resultados_teste;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% verificacao(oes) das trocas e do biset falharam', v_falhas;
  end if;
end;
$$;
