-- =============================================================================
-- Bateria do diario de fotos (0057)
--
-- Foto de refeicao e dado de saude, e aqui ha ARQUIVO. Como nos exames, a
-- bateria tenta atravessar as DUAS trancas: a tabela e o balde (pelo caminho).
--
--   * a paciente registra, le e apaga as PROPRIAS fotos, e mais nada;
--   * nao registra na pasta da outra, nem foto de amanha ou de mes passado;
--   * so a nutricionista curte; a paciente nao consegue se curtir;
--   * a outra paciente nao le nem apaga, nem sabendo o caminho.
-- =============================================================================

truncate resultados_teste;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000d1a01', 'diario-a@paciente.test'),
  ('00000000-0000-0000-0000-0000000d1a02', 'diario-b@paciente.test'),
  ('00000000-0000-0000-0000-0000000d1a03', 'diario-c@paciente.test');

insert into pacientes (email, nome, plano_id, data_inicio, data_fim) values
  ('diario-a@paciente.test', 'Ana Diario', 'mensal', hoje_sp() - 5, hoje_sp() + 25),
  ('diario-b@paciente.test', 'Bia Diario', 'mensal', hoje_sp() - 5, hoje_sp() + 25),
  ('diario-c@paciente.test', 'Cida Diario', 'mensal', hoje_sp() - 5, hoje_sp() + 25);

create or replace function ana() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'diario-a@paciente.test' $$;
create or replace function bia() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'diario-b@paciente.test' $$;
create or replace function cida() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'diario-c@paciente.test' $$;
-- `security definer`: dentro da sessao da paciente a RLS esconde a linha e um
-- select simples devolve NULL -- comparar com NULL passa por engano.
create or replace function quantas_fotos(p_paciente uuid) returns integer
  language sql stable security definer as $$
  select count(*)::integer from diario_fotos where paciente_id = p_paciente $$;
create or replace function foto_de(p_paciente uuid, p_refeicao text) returns uuid
  language sql stable security definer as $$
  select id from diario_fotos where paciente_id = p_paciente and refeicao = p_refeicao
   order by criado_em limit 1 $$;
create or replace function curtida_de(p_id uuid) returns boolean
  language sql stable security definer as $$
  select curtida from diario_fotos where id = p_id $$;
create or replace function arquivos_do_diario() returns integer
  language sql stable security definer as $$
  select count(*)::integer from storage.objects where bucket_id = 'diario-fotos' $$;
grant execute on function ana(), bia(), cida(), quantas_fotos(uuid), foto_de(uuid, text),
  curtida_de(uuid), arquivos_do_diario() to anon, authenticated;

-- O balde nasce PRIVADO ---------------------------------------------------------
begin;
select teste('o balde do diario existe', exists (select 1 from storage.buckets where id = 'diario-fotos'));
select teste('e NAO e publico', not (select public from storage.buckets where id = 'diario-fotos'));
select teste('tem limite de tamanho (5 MB)', (select file_size_limit from storage.buckets where id = 'diario-fotos') = 5242880);
select teste('so aceita imagem -- nao pdf, nem video, nem executavel',
  (select allowed_mime_types from storage.buckets where id = 'diario-fotos') @> array['image/jpeg']
  and not ((select allowed_mime_types from storage.buckets where id = 'diario-fotos')
    && array['application/pdf', 'video/mp4', 'application/x-msdownload']));
commit;

-- A paciente registra a propria foto -----------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000d1a01', true);

select teste('ela descobre a propria pasta', minha_pasta_do_diario() = ana()::text);
select registrar_diario_foto(ana()::text || '/cafe.jpg', 'cafe', 'ovo e fruta', null);
select teste('registrou a foto', quantas_fotos(ana()) = 1);
select teste('a data padrao e hoje', (select data from diario_fotos where id = foto_de(ana(), 'cafe')) = hoje_sp());
select registrar_diario_foto(ana()::text || '/almoco.jpg', 'almoco', '   ', hoje_sp() - 1);
select teste('aceita a refeicao de ontem', quantas_fotos(ana()) = 2);
select teste('legenda so com espaco vira vazia',
  (select legenda is null from diario_fotos where id = foto_de(ana(), 'almoco')));
select teste('nasce sem curtida', curtida_de(foto_de(ana(), 'cafe')) = false);

select teste('refeicao inventada e recusada',
  estado_de(format('select registrar_diario_foto(%L, %L, null, null)', ana()::text || '/x.jpg', 'brunch')) = '23514');
select teste('foto de amanha e recusada',
  estado_de(format('select registrar_diario_foto(%L, %L, null, %L)', ana()::text || '/x.jpg', 'cafe', hoje_sp() + 1)) = '22023');
select teste('foto de mais de 7 dias e recusada',
  estado_de(format('select registrar_diario_foto(%L, %L, null, %L)', ana()::text || '/x.jpg', 'cafe', hoje_sp() - 8)) = '22023');
select teste('sem foto e recusado',
  estado_de(format('select registrar_diario_foto(%L, %L, null, null)', '   ', 'cafe')) = '22023');
select teste('na pasta da OUTRA paciente e recusado',
  estado_de(format('select registrar_diario_foto(%L, %L, null, null)', bia()::text || '/roubada.jpg', 'cafe')) = '42501');
select teste('nada disso gravou linha', quantas_fotos(ana()) = 2 and quantas_fotos(bia()) = 0);

select teste('ela ve o proprio diario', jsonb_array_length(meu_diario(60)) = 2);
select teste('o mais recente vem primeiro (hoje antes de ontem)', meu_diario(60) -> 0 ->> 'refeicao' = 'cafe');

-- Ela nao se curte.
select teste('a paciente NAO chama a funcao de curtir',
  estado_de(format('select curtir_diario_foto(%L, true)', foto_de(ana(), 'cafe'))) = '42501');
select teste('nem atualiza a coluna direto',
  nao_alterou(format($q$update diario_fotos set curtida = true where id = %L$q$, foto_de(ana(), 'cafe'))));
select teste('nem cria a linha ja curtida',
  recusou(format($q$insert into diario_fotos (paciente_id, caminho, refeicao, curtida)
                    values (%L, %L, 'cafe', true)$q$, ana(), ana()::text || '/trapaca.jpg')));
select teste('continua sem curtida', curtida_de(foto_de(ana(), 'cafe')) = false);
commit;

-- O teto de 12 por dia --------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000d1a03', true);
do $$
declare i integer;
begin
  for i in 1..12 loop
    perform registrar_diario_foto(cida()::text || '/f' || i || '.jpg', 'outro', null, null);
  end loop;
end;
$$;
select teste('registrou 12 no dia', quantas_fotos(cida()) = 12);
select teste('a 13a e recusada',
  estado_de(format('select registrar_diario_foto(%L, %L, null, null)', cida()::text || '/f13.jpg', 'outro')) = '22023');
commit;

-- A nutricionista ve e curte ---------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select teste('ela lista o diario da paciente', jsonb_array_length(diario_do_paciente(ana(), 60)) = 2);
select teste('curtir devolve verdadeiro', curtir_diario_foto(foto_de(ana(), 'cafe'), true) = true);
select teste('a curtida ficou gravada, com a hora',
  curtida_de(foto_de(ana(), 'cafe'))
  and (select curtida_em is not null from diario_fotos where id = foto_de(ana(), 'cafe')));
select teste('tirar a curtida devolve falso', curtir_diario_foto(foto_de(ana(), 'cafe'), false) = false);
-- (em consulta separada: a mesma consulta nao enxerga a propria alteracao)
select teste('e limpa a hora',
  (select curtida_em is null from diario_fotos where id = foto_de(ana(), 'cafe')));
select curtir_diario_foto(foto_de(ana(), 'cafe'), true);
select teste('foto que nao existe e recusada',
  estado_de(format('select curtir_diario_foto(%L, true)', gen_random_uuid())) = '22023');
commit;

-- A paciente ve a curtida -----------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000d1a01', true);
select teste('a paciente ve que a nutricionista curtiu',
  (select bool_or((f ->> 'curtida')::boolean) from jsonb_array_elements(meu_diario(60)) f where f ->> 'refeicao' = 'cafe'));
commit;

-- A OUTRA paciente nao alcanca nada --------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000d1a02', true);

select teste('o diario dela vem vazio', jsonb_array_length(meu_diario(60)) = 0);
select teste('nao le a linha da outra na tabela', (select count(*) from diario_fotos) = 0);
select teste('nem pela funcao da nutricionista',
  estado_de(format('select diario_do_paciente(%L, 60)', ana())) = '42501');
select teste('nao curte',
  estado_de(format('select curtir_diario_foto(%L, true)', foto_de(ana(), 'cafe'))) = '42501');
select teste('nao apaga a foto da outra, mesmo com o id',
  estado_de(format('select apagar_diario_foto(%L)', foto_de(ana(), 'cafe'))) = '42501');
select teste('e a foto continua la', quantas_fotos(ana()) = 2);
commit;

-- O BALDE: a segunda tranca -----------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public, storage;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000d1a01', true);
insert into storage.objects (bucket_id, name) values ('diario-fotos', ana()::text || '/cafe.jpg');
select teste('ela poe arquivo na PROPRIA pasta', arquivos_do_diario() = 1);
select teste('mas NAO na pasta da outra',
  nao_alterou(format($q$insert into storage.objects (bucket_id, name) values ('diario-fotos', %L)$q$, bia()::text || '/intruso.jpg')));
select teste('nem na raiz do balde',
  nao_alterou($q$insert into storage.objects (bucket_id, name) values ('diario-fotos', 'solto.jpg')$q$));
commit;

begin;
set local role authenticated;
set local search_path = public, storage;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000d1a02', true);
select teste('a outra NAO alcanca o arquivo, mesmo sabendo o caminho',
  (select count(*) from storage.objects where bucket_id = 'diario-fotos') = 0);
select teste('e nao apaga o arquivo da outra',
  nao_alterou(format($q$delete from storage.objects where name = %L$q$, ana()::text || '/cafe.jpg')));
commit;

-- Apagar ----------------------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000d1a01', true);
select teste('ela apaga a propria foto e recebe o caminho de volta',
  apagar_diario_foto(foto_de(ana(), 'almoco')) like '%/almoco.jpg');
select teste('e a linha sumiu', quantas_fotos(ana()) = 1);
commit;

begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select teste('a nutricionista apaga qualquer uma e recebe o caminho',
  apagar_diario_foto(foto_de(ana(), 'cafe')) like '%/cafe.jpg');
select teste('e a linha sumiu', quantas_fotos(ana()) = 0);
commit;

-- Visitante sem login ------------------------------------------------------------------
begin;
set local role anon;
do $$
declare v_erro boolean;
begin
  v_erro := false;
  begin perform meu_diario(60); exception when others then v_erro := true; end;
  perform teste('visitante sem login NAO chama meu_diario', v_erro);
  v_erro := false;
  begin perform count(*) from diario_fotos; exception when others then v_erro := true; end;
  perform teste('visitante sem login NAO le a tabela', v_erro);
  v_erro := false;
  begin perform registrar_diario_foto('x/y.jpg', 'cafe', null, null); exception when others then v_erro := true; end;
  perform teste('visitante sem login NAO registra foto', v_erro);
end;
$$;
commit;

select case when bool_and(passou) then count(*) || '/' || count(*) || ' verificacoes do diario de fotos passaram'
            else (count(*) filter (where not passou)) || ' verificacoes do diario de fotos falharam' end
    as resultado
from resultados_teste;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% verificacao(oes) do diario de fotos falharam', v_falhas;
  end if;
end;
$$;
