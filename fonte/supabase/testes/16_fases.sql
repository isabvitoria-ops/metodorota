-- =============================================================================
-- Bateria das fases do metodo (0044)
--
-- O que nao pode falhar:
--
--   * o HISTORICO e o produto. Mover grava LINHA NOVA, nao sobrescreve
--     campo -- e e isso que deixa responder "quanto tempo ela ficou na
--     restricao" seis meses depois;
--   * apagar uma fase que tem historico apagaria o passado de quem passou
--     por ela. O banco recusa, e a funcao desativa em vez de apagar;
--   * a OBSERVACAO da nutricionista nao chega na paciente: e anotacao para
--     ela mesma, nao recado;
--   * a paciente nao muda a propria fase, nem a de ninguem;
--   * sem fase registrada, a resposta e vazia -- e nao "voce ainda nao esta
--     em nenhuma fase", que informaria que existe algo do qual ela esta fora.
-- =============================================================================

truncate resultados_teste;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000fe01', 'fase-a@paciente.test'),
  ('00000000-0000-0000-0000-00000000fe02', 'fase-b@paciente.test');

insert into pacientes (email, nome, plano_id, data_inicio, data_fim) values
  ('fase-a@paciente.test', 'Fabia Fase', 'mensal', hoje_sp() - 5, hoje_sp() + 25),
  ('fase-b@paciente.test', 'Gisa Fase', 'mensal', hoje_sp() - 5, hoje_sp() + 25);

create or replace function fabia() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'fase-a@paciente.test' $$;
create or replace function gisa() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'fase-b@paciente.test' $$;
-- `security definer`: dentro da sessao da paciente a RLS esconde a linha e
-- um `select` simples devolve NULL -- comparar com NULL passa por engano.
create or replace function fase_id(p_nome text) returns uuid
  language sql stable security definer as $$
  select id from fases where nome = p_nome $$;
create or replace function quantas_mudancas(p_paciente uuid) returns integer
  language sql stable security definer as $$
  select count(*)::integer from paciente_fases where paciente_id = p_paciente $$;
create or replace function fase_atual_de(p_paciente uuid) returns text
  language sql stable security definer as $$
  select f.nome from paciente_fases pf join fases f on f.id = pf.fase_id
   where pf.paciente_id = p_paciente
   order by pf.inicio desc, pf.criado_em desc limit 1 $$;
create or replace function quantas_fases() returns integer
  language sql stable security definer as $$
  select count(*)::integer from fases $$;
create or replace function fase_ativa(p_nome text) returns boolean
  language sql stable security definer as $$
  select ativa from fases where nome = p_nome $$;

grant execute on function fabia(), gisa(), fase_id(text), quantas_mudancas(uuid),
  fase_atual_de(uuid), quantas_fases(), fase_ativa(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- So a nutricionista define
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000fe01', true);

select teste('a paciente nao cria fase',
  estado_de($q$select salvar_fase(null, 'Minha fase', null, 1, true)$q$) = '42501');
select teste('nem escreve na tabela',
  nao_alterou($q$insert into fases (nome) values ('pela porta dos fundos')$q$));
select teste('nem lista pela funcao da nutricionista',
  estado_de('select listar_fases()') = '42501');
commit;

-- -----------------------------------------------------------------------------
-- Ela monta o caminho
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select salvar_fase(null, 'Avaliacao', 'Entender o quadro', 1, true);
select salvar_fase(null, 'Restricao', 'Retirar o que provoca sintoma', 2, true);
select salvar_fase(null, 'Reintroducao', 'Testar um a um', 3, true);
select salvar_fase(null, 'Manutencao', null, 4, true);

select teste('as quatro foram criadas', quantas_fases() = 4);
select teste('a ordem veio dela, e nao do acaso',
  (listar_fases() -> 0 ->> 'nome') = 'Avaliacao');
select teste('e a ultima e a manutencao',
  (listar_fases() -> 3 ->> 'nome') = 'Manutencao');
select teste('fase sem nome e recusada',
  estado_de($q$select salvar_fase(null, '   ', null, 1, true)$q$) = '22023');
select teste('fase que nao existe nao se edita',
  estado_de(format('select salvar_fase(%L, %L, null, 1, true)',
    '00000000-0000-0000-0000-0000000000fc', 'X')) = '22023');
commit;

-- -----------------------------------------------------------------------------
-- Mover grava LINHA NOVA -- o historico e o produto
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select mover_de_fase(fabia(), fase_id('Avaliacao'), hoje_sp() - 60, null);
select teste('a primeira mudanca virou linha', quantas_mudancas(fabia()) = 1);
select teste('e ela esta na avaliacao', fase_atual_de(fabia()) = 'Avaliacao');

select mover_de_fase(fabia(), fase_id('Restricao'), hoje_sp() - 30, 'tolerou mal lactose');
select teste('mover NAO sobrescreve: agora sao duas linhas', quantas_mudancas(fabia()) = 2);
select teste('e a atual e a mais recente', fase_atual_de(fabia()) = 'Restricao');
select teste('o passado continua la, e e o que responde "quanto tempo ficou"',
  (select count(*) from paciente_fases where paciente_id = fabia()
    and fase_id = fase_id('Avaliacao')) = 1);

-- O clique repetido nao vira linha.
select teste('mover para a mesma fase no mesmo dia devolve nulo',
  mover_de_fase(fabia(), fase_id('Restricao'), hoje_sp() - 30, null) is null);
select teste('e continua com duas linhas', quantas_mudancas(fabia()) = 2);

-- Mas a mesma fase em OUTRO dia e uma volta, e volta e informacao.
select mover_de_fase(fabia(), fase_id('Reintroducao'), hoje_sp() - 10, null);
select mover_de_fase(fabia(), fase_id('Restricao'), hoje_sp() - 2, 'voltou apos sintoma');
select teste('voltar para uma fase anterior e registrado, e nao recusado',
  quantas_mudancas(fabia()) = 4);
select teste('e a atual e a restricao de novo', fase_atual_de(fabia()) = 'Restricao');

select teste('paciente que nao existe e recusada',
  estado_de(format('select mover_de_fase(%L, %L, null, null)',
    '00000000-0000-0000-0000-0000000000fb', fase_id('Avaliacao'))) = '22023');
select teste('fase que nao existe e recusada',
  estado_de(format('select mover_de_fase(%L, %L, null, null)',
    fabia(), '00000000-0000-0000-0000-0000000000fa')) = '22023');
commit;

-- -----------------------------------------------------------------------------
-- Apagar fase com historico apagaria o passado
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select teste('fase COM historico e desativada, nao apagada',
  excluir_fase(fase_id('Restricao')) = 'desativada');
select teste('e continua existindo', fase_id('Restricao') is not null);
select teste('so que desligada', not fase_ativa('Restricao'));
select teste('e o historico de quem passou por ela ficou', quantas_mudancas(fabia()) = 4);

select teste('fase SEM historico some de verdade',
  excluir_fase(fase_id('Manutencao')) = 'apagada');
select teste('e sumiu mesmo', fase_id('Manutencao') is null);

-- A tranca do banco, para quem tentar por fora da funcao.
select teste('o banco recusa apagar fase referenciada',
  estado_de(format('delete from fases where id = %L', fase_id('Restricao'))) = '23503');
commit;

-- -----------------------------------------------------------------------------
-- O lado da paciente
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000fe01', true);

select teste('ela ve que tem fase', (minha_fase() ->> 'temFase')::boolean);
select teste('e ve o caminho inteiro, nao so o proprio ponto',
  jsonb_array_length(minha_fase() -> 'fases') >= 2);
select teste('com o ponto dela marcado',
  (select count(*) from jsonb_array_elements(minha_fase() -> 'fases') x
    where (x ->> 'atual')::boolean) = 1);
-- A fase dela foi DESATIVADA no bloco anterior. Ela tem que continuar
-- aparecendo no mapa: desativar quer dizer "nao coloco mais ninguem aqui",
-- e nao "quem esta some". Sem isso, ela veria o caminho e nenhum "voce esta
-- aqui" -- foi esta linha que pegou o defeito.
select teste('a fase desativada em que ela esta continua no mapa dela',
  minha_fase()::text like '%Restricao%');

-- A anotacao da nutricionista e para ela mesma.
select teste('a OBSERVACAO nao chega na paciente',
  minha_fase()::text not like '%voltou apos sintoma%');
-- Nenhum prazo, nenhuma contagem que vire cobranca.
select teste('nao vem contagem de dias na fase',
  not (minha_fase() ? 'diasNaFase'));

select teste('ela nao muda a propria fase',
  estado_de(format('select mover_de_fase(%L, %L, null, null)',
    fabia(), fase_id('Avaliacao'))) = '42501');
select teste('nem a de outra',
  estado_de(format('select mover_de_fase(%L, %L, null, null)',
    gisa(), fase_id('Avaliacao'))) = '42501');
select teste('nem apaga o proprio historico',
  estado_de(format('select apagar_mudanca_de_fase(%L)',
    (select id from paciente_fases limit 1))) = '42501');
select teste('nem le o historico de fases da outra pela funcao da nutri',
  estado_de(format('select fases_do_paciente(%L)', gisa())) = '42501');
select teste('e nao alcanca as linhas da outra pela tabela',
  (select count(*) from paciente_fases where paciente_id = gisa()) = 0);
commit;

-- Sem fase registrada, a resposta e vazia.
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000fe02', true);
select teste('quem nao foi colocada em fase nenhuma recebe vazio, sem explicacao',
  not (minha_fase() ->> 'temFase')::boolean);
select teste('e sem lista de fases junto',
  jsonb_array_length(minha_fase() -> 'fases') = 0);
commit;

-- -----------------------------------------------------------------------------
-- A fase no panorama
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select teste('o panorama traz a fase atual',
  (select x ->> 'fase' from jsonb_array_elements(panorama_dos_pacientes(28)) x
    where x ->> 'nome' = 'Fabia Fase') = 'Restricao');
select teste('e desde quando',
  (select (x ->> 'faseDesde')::date from jsonb_array_elements(panorama_dos_pacientes(28)) x
    where x ->> 'nome' = 'Fabia Fase') = hoje_sp() - 2);
select teste('quem nao tem fase vem nula, e nao com texto inventado',
  (select x ->> 'fase' from jsonb_array_elements(panorama_dos_pacientes(28)) x
    where x ->> 'nome' = 'Gisa Fase') is null);

select teste('o prontuario traz o caminho todo, do mais novo para o mais velho',
  jsonb_array_length(fases_do_paciente(fabia())) = 4);
select teste('com a observacao, que aqui PODE aparecer',
  fases_do_paciente(fabia())::text like '%voltou apos sintoma%');
commit;

select
  count(*) filter (where passou) || '/' || count(*) || ' verificações das fases passaram'
    as resultado
from resultados_teste;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% verificação(ões) das fases falharam', v_falhas;
  end if;
end;
$$;
