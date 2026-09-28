-- =============================================================================
-- Bateria do Cerebro do Nutri (0053)
--
-- E a base privada de material da nutricionista. UMA UNICA REGRA vale para
-- tudo aqui: so a admin le, so a admin escreve, so a admin pergunta e so a
-- admin ve as sugestoes. Uma paciente logada -- mesmo ativa, mesmo com a
-- URL exata -- nao alcanca nada.
--
-- Duas trancas, como nos exames:
--   * a tabela (RLS so para admin);
--   * o balde (politica so para admin, para nao vazar o PDF).
--
-- Esta bateria tenta atravessar as duas.
-- =============================================================================

truncate resultados_teste;

create or replace function conta_fontes() returns integer
  language sql stable security definer as $$
  select count(*)::integer from base_conhecimento $$;
create or replace function conta_trechos() returns integer
  language sql stable security definer as $$
  select count(*)::integer from base_conhecimento_trechos $$;
create or replace function conta_sugestoes(p_paciente uuid) returns integer
  language sql stable security definer as $$
  select count(*)::integer from base_conhecimento_sugestoes where paciente_id = p_paciente $$;
create or replace function arquivos_no_cerebro() returns integer
  language sql stable security definer as $$
  select count(*)::integer from storage.objects where bucket_id = 'cerebro-do-nutri' $$;
create or replace function primeira_sugestao(p_paciente uuid) returns uuid
  language sql stable security definer as $$
  select id from base_conhecimento_sugestoes where paciente_id = p_paciente
   order by criado_em desc limit 1 $$;
create or replace function ativa_paciente() returns uuid
  language sql stable security definer as $$
  select id from pacientes where email = 'ativa@paciente.test' $$;

grant execute on function conta_fontes(), conta_trechos(), conta_sugestoes(uuid),
  arquivos_no_cerebro(), primeira_sugestao(uuid), ativa_paciente() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- O balde nasce privado, so pdf, com limite
-- -----------------------------------------------------------------------------
begin;
select teste('o balde do cerebro existe',
  exists (select 1 from storage.buckets where id = 'cerebro-do-nutri'));
select teste('e NAO e publico',
  not (select public from storage.buckets where id = 'cerebro-do-nutri'));
select teste('tem limite de 20 MB por arquivo',
  (select file_size_limit from storage.buckets where id = 'cerebro-do-nutri') = 20971520);
select teste('so aceita pdf (nao imagem, nao video, nao qualquer coisa)',
  (select allowed_mime_types from storage.buckets where id = 'cerebro-do-nutri')
    = array['application/pdf']);
commit;

-- -----------------------------------------------------------------------------
-- A admin trabalha: registra fonte, gera trechos, busca, salva sugestao
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select registrar_fonte(
  'Artigo sobre SII', 'Revista de Gastro', 'texto', null,
  'A dieta de baixo FODMAP reduz sintomas em pacientes com sindrome do intestino irritavel. '
  'Recomenda-se retirada de 4 a 6 semanas seguida de reintroducao gradual.',
  0) as fonte_id
\gset

select teste('a admin cria fonte de texto', conta_fontes() = 1);
select teste('devolve id de fonte', :'fonte_id' is not null);

-- Salva trechos, com e sem embedding. Um trecho sem embedding e cenario
-- valido (Voyage AI nao configurada ainda).
select salvar_trechos(:'fonte_id'::uuid, $$[
  {"ordem": 0, "trecho": "A dieta de baixo FODMAP reduz sintomas em SII."},
  {"ordem": 1, "trecho": "Reintroducao gradual apos 4 a 6 semanas de retirada."}
]$$::jsonb);

select teste('salvou dois trechos', conta_trechos() = 2);
select teste('e ambos sem embedding (chave ainda nao configurada)',
  (select count(*) from base_conhecimento_trechos where embedding is null) = 2);

-- Repetir a chamada substitui os trechos, nao duplica.
select salvar_trechos(:'fonte_id'::uuid, $$[
  {"ordem": 0, "trecho": "So um trecho agora, o resto foi reprocessado."}
]$$::jsonb);
select teste('reprocessar substitui os trechos, nao duplica', conta_trechos() = 1);
commit;

-- -----------------------------------------------------------------------------
-- Uma fonte com trechos citando "diabetes" e "diabeticos", para a busca
-- textual provar que o unaccent + portuguese esta funcionando
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select registrar_fonte(
  'Diabetes tipo 2 na pratica', 'Manual da SBD', 'texto', null,
  'Diabeticos tipo 2 se beneficiam de dieta com baixo indice glicemico.', 0) as fonte_dm
\gset

select salvar_trechos(:'fonte_dm'::uuid, $$[
  {"ordem": 0, "trecho": "Diabeticos tipo 2 se beneficiam de baixo indice glicemico."},
  {"ordem": 1, "trecho": "Fibra soluvel e componente central do plano alimentar."}
]$$::jsonb);

-- Sem embedding, cai na busca textual.
select teste('busca textual acha "diabetes" mesmo com acento e plural',
  jsonb_array_length(buscar_no_cerebro('diabetes', null, 5)) > 0);
select teste('busca textual traz citacao com titulo e trecho',
  buscar_no_cerebro('diabetes', null, 5) -> 0 ? 'titulo'
  and buscar_no_cerebro('diabetes', null, 5) -> 0 ? 'trecho');
commit;

-- -----------------------------------------------------------------------------
-- A admin registra sugestao e fecha o laco (aceita, edita, rejeita)
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select registrar_sugestao(ativa_paciente(),
  'Que dieta aplicar para SII com constipacao?',
  'Baixo FODMAP com atencao a fibra soluvel.',
  $$[{"trechoId":"x","titulo":"Artigo sobre SII"}]$$::jsonb) as sug_id
\gset

select teste('sugestao gravada', conta_sugestoes(ativa_paciente()) = 1);
select teste('e ja veio respondida (chave configurada nesse cenario)',
  (select respondido_em is not null
     from base_conhecimento_sugestoes where id = :'sug_id'::uuid));

-- Fluxo "aceita".
select dar_feedback_sugestao(:'sug_id'::uuid, 'aceita', 'Baixo FODMAP com atencao a fibra soluvel.', null);
select teste('aceita grava feedback e conduta final',
  (select feedback = 'aceita' and conduta_final is not null and motivo is null
     from base_conhecimento_sugestoes where id = :'sug_id'::uuid));

-- Fluxo "rejeitada": limpa a conduta final, mantem o motivo.
select registrar_sugestao(ativa_paciente(),
  'Outra pergunta', 'Uma resposta inicial.', '[]'::jsonb) as sug2
\gset
select dar_feedback_sugestao(:'sug2'::uuid, 'rejeitada', 'nao vale', 'Fonte fraca para esta paciente.');
select teste('rejeitada guarda motivo e apaga conduta final',
  (select feedback = 'rejeitada' and conduta_final is null and motivo is not null
     from base_conhecimento_sugestoes where id = :'sug2'::uuid));

-- Fluxo "editada": conduta final com o texto editado.
select registrar_sugestao(ativa_paciente(),
  'Terceira pergunta', 'Resposta bruta da IA.', '[]'::jsonb) as sug3
\gset
select dar_feedback_sugestao(:'sug3'::uuid, 'editada', 'Conduta que eu ajustei.', null);
select teste('editada guarda o texto novo',
  (select feedback = 'editada' and conduta_final = 'Conduta que eu ajustei.'
     from base_conhecimento_sugestoes where id = :'sug3'::uuid));

select teste('feedback invalido e recusado',
  estado_de(format('select dar_feedback_sugestao(%L, %L, %L, %L)',
    :'sug3', 'quem_sabe', 'x', null)) = '22023');

-- Sugestoes do paciente vem em ordem.
select teste('sugestoes_do_paciente devolve as tres',
  jsonb_array_length(sugestoes_do_paciente(ativa_paciente())) = 3);
commit;

-- -----------------------------------------------------------------------------
-- A paciente NAO alcanca nada -- a tranca principal
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);

select teste('a paciente NAO le fontes', (select count(*) from base_conhecimento) = 0);
select teste('a paciente NAO le trechos', (select count(*) from base_conhecimento_trechos) = 0);
select teste('a paciente NAO le sugestoes -- nem as dela mesma',
  (select count(*) from base_conhecimento_sugestoes) = 0);

select teste('a paciente NAO registra fonte',
  estado_de($$select registrar_fonte('x', null, 'texto', null, 'y', 0)$$) = '42501');
select teste('a paciente NAO salva trecho',
  estado_de(format('select salvar_trechos(%L, %L::jsonb)',
    gen_random_uuid(), '[]')) = '42501');
select teste('a paciente NAO consulta o cerebro',
  estado_de($$select buscar_no_cerebro('SII', null, 5)$$) = '42501');
select teste('a paciente NAO registra sugestao (nem para ela mesma)',
  estado_de(format('select registrar_sugestao(%L, %L, %L, %L::jsonb)',
    ativa_paciente(), 'pergunta', 'resposta', '[]')) = '42501');
select teste('a paciente NAO da feedback',
  estado_de(format('select dar_feedback_sugestao(%L, %L, %L, %L)',
    primeira_sugestao(ativa_paciente()), 'aceita', 'x', null)) = '42501');
select teste('a paciente NAO ve as sugestoes de ninguem',
  estado_de(format('select sugestoes_do_paciente(%L)', ativa_paciente())) = '42501');
select teste('a paciente NAO lista fontes',
  estado_de('select fontes_do_cerebro()') = '42501');
select teste('a paciente NAO apaga fonte',
  estado_de(format('select apagar_fonte(%L)', gen_random_uuid())) = '42501');
commit;

-- -----------------------------------------------------------------------------
-- O balde: a paciente NAO poe arquivo, e nao le
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
insert into storage.objects (bucket_id, name)
values ('cerebro-do-nutri', 'artigo-sii.pdf');
select teste('a admin poe pdf no balde', arquivos_no_cerebro() = 1);
commit;

begin;
set local role authenticated;
set local search_path = public, storage;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);

select teste('a paciente NAO ve o arquivo do balde',
  (select count(*) from storage.objects where bucket_id = 'cerebro-do-nutri') = 0);
select teste('a paciente NAO poe arquivo no balde',
  nao_alterou($q$insert into storage.objects (bucket_id, name)
                 values ('cerebro-do-nutri', 'intrusao.pdf')$q$));
select teste('e NAO apaga o pdf existente',
  nao_alterou($q$delete from storage.objects where bucket_id = 'cerebro-do-nutri'$q$));
commit;

-- -----------------------------------------------------------------------------
-- Apagar fonte e verificar contadores
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select teste('a admin lista as duas fontes',
  jsonb_array_length(fontes_do_cerebro()) = 2);
select teste('pendentes de embedding calculadas',
  (trechos_pendentes_de_embedding() ->> 'pendentes')::integer > 0);

-- Apagar deve cascatear para os trechos.
select apagar_fonte(id) from base_conhecimento where titulo = 'Artigo sobre SII';
select teste('apagar cascateia os trechos', conta_trechos() = 2);
commit;

select
  count(*) filter (where passou) || '/' || count(*) || ' verificacoes do Cerebro do Nutri passaram'
    as resultado
from resultados_teste;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% verificacao(oes) do Cerebro falharam', v_falhas;
  end if;
end;
$$;
