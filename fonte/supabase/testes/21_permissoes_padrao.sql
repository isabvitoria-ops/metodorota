-- =============================================================================
-- Bateria das permissões que o Supabase dá sozinho.
--
-- Todo objeto criado em `public` nasce, no Supabase, com EXECUTE explícito
-- para `anon` (visitante sem login) e `authenticated` (qualquer conta
-- logada). O ambiente de teste agora imita isso (00_ambiente.sql), e esta
-- bateria confere o resultado nas funções que as migrações criaram:
--
--   1. nenhuma função `security definer` pode ser executada por quem não
--      entrou — ela passa por cima das políticas de acesso;
--   2. as auxiliares que recebem o id de QUALQUER paciente sem conferir o
--      dono não podem ser chamadas por conta logada.
--
-- A vistoria de 27/09 achou sete funções no caso 1 e duas no caso 2.
-- Nenhuma devolvia dado, mas a proteção dependia de sorte.
-- =============================================================================

truncate resultados_teste;

select teste(
  'visitante sem login não executa função security definer: ' || f.assinatura,
  not has_function_privilege('anon', f.assinatura::regprocedure, 'execute')
)
from funcoes_das_migracoes f
where f.definer
  -- As auxiliares da própria bateria (00_ambiente.sql) não vão para produção.
  and f.nome not in ('teste', 'nao_alterou', 'recusou', 'estado_de', 'conferir', 'aceitou');

select teste(
  'conta logada não chama a auxiliar sem dono: ' || f.assinatura,
  not has_function_privilege('authenticated', f.assinatura::regprocedure, 'execute')
)
from funcoes_das_migracoes f
where f.nome in ('reintroducao_json', 'rastreio_ativo');

-- E o que a paciente usa continua aberto para ela.
select teste(
  'conta logada continua chamando ' || nome,
  has_function_privilege('authenticated', nome::regproc, 'execute')
)
from unnest(array['meu_acesso', 'minha_reintroducao', 'meus_exames', 'meus_questionarios',
                  'minha_fase', 'responder_questionario', 'registrar_exame', 'apagar_exame',
                  'minha_pasta_de_exames']) as nome;

select
  count(*) filter (where passou) || '/' || count(*) || ' verificações das permissões padrão passaram'
    as resultado
from resultados_teste;

select string_agg(nome, e'\n') as falhas from resultados_teste where not passou;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% verificação(ões) das permissões padrão falharam', v_falhas;
  end if;
end;
$$;
