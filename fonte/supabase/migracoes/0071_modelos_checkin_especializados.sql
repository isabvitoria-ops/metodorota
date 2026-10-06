-- =============================================================================
-- 0071 — Modelos de check-in especializados
--
-- O "Feedback Semanal" (52 perguntas) era o único modelo. Agora ele é
-- desativado e 3 modelos focados tomam o lugar:
--
--   1. Estética e Performance (B01-B11, B13, E01-E06) — 18 perguntas
--   2. Intestino (B01-B03, I01-I11) — 14 perguntas
--   3. GLP-1 (B01-B03, G01-G12) — 15 perguntas
--
-- As perguntas são copiadas do modelo original, mantendo tipo, opções,
-- pesos, eixos, cadência, alertas e regras de exibição.
--
-- Dados históricos do modelo antigo ficam intactos — a desativação impede
-- apenas novos envios.
--
-- NOTA: esta migração foi aplicada manualmente via SQL Editor antes de ser
-- versionada. O `IF NOT EXISTS` garante idempotência.
-- =============================================================================

-- Desativar o modelo antigo
update questionarios
   set ativo = false
 where id = 'c0000000-0000-0000-0000-000000000001'
   and ativo = true;

-- Criar os novos modelos (idempotente)
insert into questionarios (id, titulo, descricao, periodicidade, ativo)
values
  ('c0000000-0000-0000-0000-000000000010',
   'Estética e Performance',
   'Base + estética/performance (sem ciclo/texto livre)',
   'semanal', true),
  ('c0000000-0000-0000-0000-000000000011',
   'Intestino',
   'Base + intestino completo (sem ciclo/texto livre)',
   'semanal', true),
  ('c0000000-0000-0000-0000-000000000012',
   'GLP-1',
   'Base + perguntas específicas GLP-1 (sem ciclo/texto livre)',
   'semanal', true)
on conflict (id) do nothing;

-- Copiar perguntas do modelo original para os novos modelos.
-- As perguntas já foram inseridas manualmente; este bloco é idempotente.
do $$
declare
  v_src_id uuid := 'c0000000-0000-0000-0000-000000000001';
  v_codigos_ep text[] := array[
    'B01','B02','B03','B04','B05','B06','B07','B08','B09','B10','B11','B13',
    'E01','E02','E03','E04','E05','E06'
  ];
  v_codigos_int text[] := array[
    'B01','B02','B03',
    'I01','I02','I03','I04','I05','I06','I07','I08','I09','I10','I11'
  ];
  v_codigos_glp text[] := array[
    'B01','B02','B03',
    'G01','G02','G03','G04','G05','G06','G07','G08','G09','G10','G11','G12'
  ];
begin
  -- Estética e Performance
  insert into questionario_perguntas (
    questionario_id, codigo, texto, tipo, opcoes, ordem, ativa, obrigatoria,
    peso, eixo_id, cadencia, alerta, regra_exibicao
  )
  select 'c0000000-0000-0000-0000-000000000010', p.codigo, p.texto, p.tipo,
         p.opcoes, p.ordem, p.ativa, p.obrigatoria, p.peso, p.eixo_id,
         p.cadencia, p.alerta, p.regra_exibicao
    from questionario_perguntas p
   where p.questionario_id = v_src_id
     and p.codigo = any(v_codigos_ep)
  on conflict do nothing;

  -- Intestino
  insert into questionario_perguntas (
    questionario_id, codigo, texto, tipo, opcoes, ordem, ativa, obrigatoria,
    peso, eixo_id, cadencia, alerta, regra_exibicao
  )
  select 'c0000000-0000-0000-0000-000000000011', p.codigo, p.texto, p.tipo,
         p.opcoes, p.ordem, p.ativa, p.obrigatoria, p.peso, p.eixo_id,
         p.cadencia, p.alerta, p.regra_exibicao
    from questionario_perguntas p
   where p.questionario_id = v_src_id
     and p.codigo = any(v_codigos_int)
  on conflict do nothing;

  -- GLP-1
  insert into questionario_perguntas (
    questionario_id, codigo, texto, tipo, opcoes, ordem, ativa, obrigatoria,
    peso, eixo_id, cadencia, alerta, regra_exibicao
  )
  select 'c0000000-0000-0000-0000-000000000012', p.codigo, p.texto, p.tipo,
         p.opcoes, p.ordem, p.ativa, p.obrigatoria, p.peso, p.eixo_id,
         p.cadencia, p.alerta, p.regra_exibicao
    from questionario_perguntas p
   where p.questionario_id = v_src_id
     and p.codigo = any(v_codigos_glp)
  on conflict do nothing;
end;
$$;

-- Conferência
select q.titulo, count(qp.id) as perguntas
  from questionarios q
  left join questionario_perguntas qp on qp.questionario_id = q.id
 where q.id in (
   'c0000000-0000-0000-0000-000000000010',
   'c0000000-0000-0000-0000-000000000011',
   'c0000000-0000-0000-0000-000000000012'
 )
 group by q.titulo;
