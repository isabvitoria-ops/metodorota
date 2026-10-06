-- =============================================================================
-- 0069 — Reduzir perguntas por versao
--
-- Contagem anterior: V1=25, V2=38, V3=49.  Depois desta migracao: V1=19,
-- V2=24, V3=24.
--
-- Criterios:
--   - Perguntas redundantes desativadas (ex.: B04 qualidade sono + B03 horas
--     sono -> so horas).
--   - Modulos fora do foco removidos daquela versao (ex.: estetica sai de V2
--     e V3; intestino detalhado sai de V3 porque o modulo GLP-1 ja cobre).
--   - Perguntas condicionais e periodicas (quinzenal, mensal) preservadas
--     quando relevantes — elas nao aparecem toda semana.
--   - Perguntas de seguranca (alertas) nunca removidas.
--   - Dados historicos intactos: perguntas desativadas ficam com ativa=false
--     e as respostas antigas permanecem.
--
-- Resumo por versao:
--
--   V1 (Estetica / Comum) — 19 perguntas:
--     BASE: B01 B02 B03 B05 B06 B07 B08 B09(q) B10(q) B11 B12 B14
--     ESTETICA: E01 E03 E04 E06(m)
--     INTESTINO: I01 I02
--     ACOMPANHAMENTO: P01(m)
--
--   V2 (Intestinal) — 24 perguntas:
--     BASE: B01 B02 B03 B05 B07 B08 B11 B12 B14
--     INTESTINO: I01 I02 I03 I04 I05(cond) I07(cond) I08(cond) I09 I10
--                I11 I12 I14 I15 I16(cond)
--     ACOMPANHAMENTO: P01(m)
--
--   V3 (GLP-1 / Ozempic / Mounjaro) — 24 perguntas:
--     BASE: B01 B02 B07 B08 B11 B12 B14
--     INTESTINO: I01 I02 I11
--     GLP-1: G01 G02 G03 G04(cond) G05 G06 G07 G08 G09(cond) G10
--            G11(q) G12(q) G13 G14(q)
-- =============================================================================

begin;

-- 1. Desativar perguntas que nao pertencem mais a nenhuma versao
update questionario_perguntas
   set ativa = false
 where questionario_id = 'c0000000-0000-0000-0000-000000000001'
   and codigo in ('B04','B13','E02','E05','I06','I13','P02');

-- 2. Ajustar versoes das perguntas que permanecem ativas

-- B03, B05: remover V3 (sono e disposicao menos centrais para GLP-1)
update questionario_perguntas
   set versoes = '["V1","V2"]'::jsonb
 where questionario_id = 'c0000000-0000-0000-0000-000000000001'
   and codigo in ('B03','B05');

-- B06: somente V1 (pular refeicoes nao e foco intestinal nem GLP-1)
-- B09: somente V1 (vegetais, quinzenal, foco estetico)
-- B10: somente V1 (alcool, quinzenal, foco estetico)
-- E01, E03, E04: somente V1 (modulo estetica inteiro)
-- E06: somente V1 (cintura, mensal, foco estetico)
update questionario_perguntas
   set versoes = '["V1"]'::jsonb
 where questionario_id = 'c0000000-0000-0000-0000-000000000001'
   and codigo in ('B06','B09','B10','E01','E03','E04','E06');

-- I03: somente V2 (desconforto abdominal: porteira para I05-I08)
update questionario_perguntas
   set versoes = '["V2"]'::jsonb
 where questionario_id = 'c0000000-0000-0000-0000-000000000001'
   and codigo = 'I03';

-- I04, I05, I07, I09, I12, I14, I15: somente V2
-- (intestino detalhado nao precisa em V3 porque o modulo GLP-1 cobre)
update questionario_perguntas
   set versoes = '["V2"]'::jsonb
 where questionario_id = 'c0000000-0000-0000-0000-000000000001'
   and codigo in ('I04','I05','I07','I09','I12','I14','I15');

-- P01: somente V1 e V2 (avaliacao mensal, V3 ja tem muita pergunta)
update questionario_perguntas
   set versoes = '["V1","V2"]'::jsonb
 where questionario_id = 'c0000000-0000-0000-0000-000000000001'
   and codigo = 'P01';

-- 3. Conferencia
do $$
declare
  v1 integer; v2 integer; v3 integer;
begin
  select count(*) into v1
    from questionario_perguntas
   where questionario_id = 'c0000000-0000-0000-0000-000000000001'
     and ativa and versoes @> '"V1"'::jsonb;
  select count(*) into v2
    from questionario_perguntas
   where questionario_id = 'c0000000-0000-0000-0000-000000000001'
     and ativa and versoes @> '"V2"'::jsonb;
  select count(*) into v3
    from questionario_perguntas
   where questionario_id = 'c0000000-0000-0000-0000-000000000001'
     and ativa and versoes @> '"V3"'::jsonb;

  if v1 <> 19 then raise exception 'V1 deveria ter 19, tem %', v1; end if;
  if v2 <> 24 then raise exception 'V2 deveria ter 24, tem %', v2; end if;
  if v3 <> 24 then raise exception 'V3 deveria ter 24, tem %', v3; end if;

  raise notice 'Reducao OK: V1=%, V2=%, V3=%', v1, v2, v3;
end $$;

commit;
