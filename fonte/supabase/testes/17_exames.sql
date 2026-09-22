-- =============================================================================
-- Bateria dos exames (0045)
--
-- Este e o unico modulo que guarda ARQUIVO, e isso muda o tamanho do erro.
-- Ate aqui, um vazamento mostrava um numero. Aqui mostraria o PDF do
-- laboratorio com nome completo, CPF e resultado de quem nao esta olhando.
--
-- Por isso a bateria testa as DUAS trancas, e tenta atravessar as duas:
--
--   * a tabela de metadados;
--   * o balde de arquivos, pelo caminho.
--
-- Uma sozinha nao basta: a tabela esconderia a linha e o arquivo continuaria
-- alcancavel por quem tivesse o endereco; o balde protegeria o arquivo e a
-- lista mostraria que ele existe.
-- =============================================================================

truncate resultados_teste;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000ea01', 'exame-a@paciente.test'),
  ('00000000-0000-0000-0000-00000000ea02', 'exame-b@paciente.test');

insert into pacientes (email, nome, plano_id, data_inicio, data_fim) values
  ('exame-a@paciente.test', 'Elisa Exame', 'mensal', hoje_sp() - 5, hoje_sp() + 25),
  ('exame-b@paciente.test', 'Olga Exame', 'mensal', hoje_sp() - 5, hoje_sp() + 25);

create or replace function elisa() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'exame-a@paciente.test' $$;
create or replace function olga() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'exame-b@paciente.test' $$;
-- `security definer`: dentro da sessao da paciente a RLS esconde a linha e
-- um `select` simples devolveria NULL -- comparar com NULL passa por engano.
create or replace function quantos_exames(p_paciente uuid) returns integer
  language sql stable security definer as $$
  select count(*)::integer from exames where paciente_id = p_paciente $$;
create or replace function exame_de(p_paciente uuid, p_origem text) returns uuid
  language sql stable security definer as $$
  select id from exames where paciente_id = p_paciente and origem = p_origem
   order by criado_em limit 1 $$;
create or replace function caminho_de(p_id uuid) returns text
  language sql stable security definer as $$
  select caminho from exames where id = p_id $$;
create or replace function origem_de(p_id uuid) returns text
  language sql stable security definer as $$
  select origem from exames where id = p_id $$;
create or replace function arquivos_no_balde() returns integer
  language sql stable security definer as $$
  select count(*)::integer from storage.objects where bucket_id = 'exames' $$;

grant execute on function elisa(), olga(), quantos_exames(uuid), exame_de(uuid, text),
  caminho_de(uuid), origem_de(uuid), arquivos_no_balde() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- O balde NASCE PRIVADO -- e a linha mais importante da migracao
-- -----------------------------------------------------------------------------
begin;
select teste('o balde dos exames existe',
  exists (select 1 from storage.buckets where id = 'exames'));
select teste('e NAO e publico',
  not (select public from storage.buckets where id = 'exames'));
select teste('tem limite de tamanho por arquivo',
  (select file_size_limit from storage.buckets where id = 'exames') = 10485760);
select teste('e so aceita pdf e imagem -- nao video, nem executavel',
  (select allowed_mime_types from storage.buckets where id = 'exames')
    @> array['application/pdf', 'image/jpeg']
  and not ((select allowed_mime_types from storage.buckets where id = 'exames')
    && array['video/mp4', 'application/x-msdownload']));
commit;

-- -----------------------------------------------------------------------------
-- A nutricionista guarda um exame
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select registrar_exame(elisa(), elisa()::text || '/hemograma.pdf', 'hemograma.pdf',
  'application/pdf', 240000, hoje_sp() - 20, 'coletado em jejum');
select teste('gravou', quantos_exames(elisa()) = 1);
select teste('marcado como vindo da nutricionista',
  origem_de(exame_de(elisa(), 'nutricionista')) = 'nutricionista');

-- A tranca do caminho: mandar a pasta de outra pessoa e recusado.
select teste('caminho na pasta de OUTRA paciente e recusado',
  estado_de(format('select registrar_exame(%L, %L, %L, %L, 1, null, null)',
    elisa(), olga()::text || '/intruso.pdf', 'x.pdf', 'application/pdf')) = '42501');
select teste('e sem arquivo tambem',
  estado_de(format('select registrar_exame(%L, %L, %L, %L, 1, null, null)',
    elisa(), '   ', 'x.pdf', 'application/pdf')) = '22023');
commit;

-- -----------------------------------------------------------------------------
-- A paciente manda o dela
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000ea01', true);

select registrar_exame(null, elisa()::text || '/vitamina-d.pdf', 'vitamina-d.pdf',
  'application/pdf', 180000, hoje_sp() - 3, null);
select teste('a paciente consegue mandar o proprio exame', quantos_exames(elisa()) = 2);
select teste('e vem marcado como vindo dela',
  origem_de(exame_de(elisa(), 'paciente')) = 'paciente');

-- O ID QUE VEM DA TELA E IGNORADO: mandar o id da outra nao muda de dona.
select registrar_exame(olga(), elisa()::text || '/tentativa.pdf', 'tentativa.pdf',
  'application/pdf', 1000, null, null);
select teste('mandar o id da OUTRA nao coloca o exame na ficha dela',
  quantos_exames(olga()) = 0);
select teste('o exame ficou com ela mesma', quantos_exames(elisa()) = 3);

-- E o caminho continua trancado mesmo para ela.
select teste('ela nao registra na pasta da outra',
  estado_de(format('select registrar_exame(null, %L, %L, %L, 1, null, null)',
    olga()::text || '/roubado.pdf', 'x.pdf', 'application/pdf')) = '42501');

select teste('ela descobre a propria pasta para poder enviar',
  minha_pasta_de_exames() = elisa()::text);
select teste('ela ve os proprios exames', jsonb_array_length(meus_exames()) = 3);
select teste('inclusive o que a nutricionista guardou',
  meus_exames()::text like '%hemograma%');
commit;

-- -----------------------------------------------------------------------------
-- A OUTRA paciente nao alcanca nada -- as duas trancas
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000ea02', true);

select teste('a lista dela vem vazia', jsonb_array_length(meus_exames()) = 0);
select teste('a pasta que ela recebe e a DELA, nunca a da outra',
  minha_pasta_de_exames() = olga()::text);
select teste('e ela nao le a linha da outra na tabela',
  (select count(*) from exames) = 0);
select teste('nem pela funcao da nutricionista',
  estado_de(format('select exames_do_paciente(%L)', elisa())) = '42501');
select teste('nem ve quanto espaco esta ocupado',
  estado_de('select espaco_dos_exames()') = '42501');

-- Sabendo o id do exame da outra, nao apaga.
select teste('nao apaga o exame da outra, mesmo com o id',
  estado_de(format('select apagar_exame(%L)', exame_de(elisa(), 'paciente'))) = '42501');
select teste('e o exame continua la', quantos_exames(elisa()) = 3);
commit;

-- -----------------------------------------------------------------------------
-- O BALDE: a segunda tranca, pelo caminho
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public, storage;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000ea01', true);

insert into storage.objects (bucket_id, name)
values ('exames', elisa()::text || '/hemograma.pdf');
select teste('ela poe arquivo na PROPRIA pasta', arquivos_no_balde() = 1);

select teste('mas NAO na pasta da outra',
  nao_alterou(format($q$insert into storage.objects (bucket_id, name)
                        values ('exames', %L)$q$, olga()::text || '/intruso.pdf')));
select teste('nem na raiz do balde, fora de qualquer pasta',
  nao_alterou($q$insert into storage.objects (bucket_id, name)
                 values ('exames', 'solto.pdf')$q$));
commit;

begin;
set local role authenticated;
set local search_path = public, storage;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000ea02', true);

-- A OUTRA paciente, com o endereco exato do arquivo na mao.
select teste('a outra NAO alcanca o arquivo, mesmo sabendo o caminho',
  (select count(*) from storage.objects where bucket_id = 'exames') = 0);
select teste('e nao apaga o arquivo da outra',
  nao_alterou(format($q$delete from storage.objects where name = %L$q$,
    elisa()::text || '/hemograma.pdf')));
commit;

-- -----------------------------------------------------------------------------
-- Apagar: ela desfaz o proprio envio, e nao o registro clinico
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000ea01', true);

select teste('ela apaga o que MANDOU, e recebe o caminho de volta',
  apagar_exame(exame_de(elisa(), 'paciente')) like '%/vitamina-d.pdf');
select teste('e a linha sumiu', quantos_exames(elisa()) = 2);

-- O que a nutricionista guardou e registro clinico.
select teste('mas NAO apaga o que a nutricionista guardou',
  estado_de(format('select apagar_exame(%L)', exame_de(elisa(), 'nutricionista'))) = '42501');
select teste('e ele continua la', quantos_exames(elisa()) = 2);
commit;

-- -----------------------------------------------------------------------------
-- A nutricionista apaga qualquer um, e ve o espaco
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select teste('ela ve os exames da paciente',
  jsonb_array_length(exames_do_paciente(elisa())) = 2);
select teste('ordenados pela data DO EXAME, e nao do envio',
  (exames_do_paciente(elisa()) -> 0 ->> 'nome') = 'tentativa.pdf');
select teste('com a origem junto, porque "ela mandou" e "eu guardei" sao coisas diferentes',
  (exames_do_paciente(elisa()) -> 0) ? 'origem');

select teste('o espaco e contado', (espaco_dos_exames() ->> 'arquivos')::integer = 2);
select teste('em bytes, para a tela poder avisar antes de acabar',
  (espaco_dos_exames() ->> 'bytes')::bigint > 0);

select teste('ela apaga o que a paciente mandou tambem',
  apagar_exame(exame_de(elisa(), 'nutricionista')) like '%hemograma%');
select teste('exame que nao existe e recusado',
  estado_de(format('select apagar_exame(%L)',
    '00000000-0000-0000-0000-0000000000ef')) = '22023');
commit;

select
  count(*) filter (where passou) || '/' || count(*) || ' verificações dos exames passaram'
    as resultado
from resultados_teste;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% verificação(ões) dos exames falharam', v_falhas;
  end if;
end;
$$;
