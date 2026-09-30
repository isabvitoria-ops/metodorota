-- =============================================================================
-- Bateria da conversa por refeicao (0058)
--
-- O que nao pode falhar:
--   * a conversa de uma refeicao NAO se mistura com a de outra;
--   * a paciente le e escreve so na PROPRIA conversa, e nao se passa pela
--     nutricionista;
--   * uma paciente nao alcanca a conversa da outra, nem sabendo o id;
--   * "lida" so muda para as mensagens da OUTRA ponta.
-- =============================================================================

truncate resultados_teste;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000c0a01', 'conversa-a@paciente.test'),
  ('00000000-0000-0000-0000-0000000c0a02', 'conversa-b@paciente.test');
insert into pacientes (email, nome, plano_id, data_inicio, data_fim) values
  ('conversa-a@paciente.test', 'Ana Conversa', 'mensal', hoje_sp() - 5, hoje_sp() + 25),
  ('conversa-b@paciente.test', 'Bia Conversa', 'mensal', hoje_sp() - 5, hoje_sp() + 25);

create or replace function ana_c() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'conversa-a@paciente.test' $$;
create or replace function bia_c() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'conversa-b@paciente.test' $$;
create or replace function quantas_msgs(p_paciente uuid, p_refeicao text) returns integer
  language sql stable security definer as $$
  select count(*)::integer from mensagens_refeicao
   where paciente_id = p_paciente and lower(btrim(refeicao)) = lower(btrim(p_refeicao)) $$;
create or replace function total_msgs() returns integer
  language sql stable security definer as $$ select count(*)::integer from mensagens_refeicao $$;
grant execute on function ana_c(), bia_c(), quantas_msgs(uuid, text), total_msgs() to anon, authenticated;

-- A paciente escreve --------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000c0a01', true);

select enviar_mensagem_refeicao(null, 'Jantar', 'me deu inchaco depois do arroz');
select enviar_mensagem_refeicao(null, 'Almoço', 'esse ficou otimo');
select teste('a mensagem entrou no jantar', quantas_msgs(ana_c(), 'Jantar') = 1);
select teste('e o almoco tem a sua propria, separada', quantas_msgs(ana_c(), 'Almoço') = 1);
select enviar_mensagem_refeicao(null, '  jantar ', 'e ficou pesado');
select teste('maiuscula e espaco nao criam outra conversa', quantas_msgs(ana_c(), 'JANTAR') = 2);

select teste('a conversa do jantar traz so as 2 do jantar',
  jsonb_array_length(conversa_da_refeicao(null, 'Jantar')) = 2);
select teste('e nao traz as do almoco',
  conversa_da_refeicao(null, 'Jantar')::text not like '%otimo%');
select teste('a ordem e da mais antiga para a mais nova',
  conversa_da_refeicao(null, 'Jantar') -> 0 ->> 'texto' = 'me deu inchaco depois do arroz');
select teste('a paciente assina como paciente',
  (conversa_da_refeicao(null, 'Jantar') -> 0 ->> 'autor') = 'paciente');

-- O id que vem da tela e ignorado: nao escreve na conversa da outra.
select enviar_mensagem_refeicao(bia_c(), 'Jantar', 'tentando falar na conversa da outra');
select teste('mandar o id da OUTRA nao coloca a mensagem la', quantas_msgs(bia_c(), 'Jantar') = 0);
select teste('ficou na conversa dela mesma', quantas_msgs(ana_c(), 'Jantar') = 3);

-- Nao se passa pela nutricionista.
select teste('nao insere linha assinada como nutri',
  recusou(format($q$insert into mensagens_refeicao (paciente_id, refeicao, autor, texto)
                     values (%L, 'Jantar', 'nutri', 'falso')$q$, ana_c())));
select teste('nao apaga nem edita o que ja foi dito',
  nao_alterou($q$update mensagens_refeicao set texto = 'outra coisa'$q$)
  and nao_alterou($q$delete from mensagens_refeicao$q$));

-- Validacoes.
select teste('mensagem vazia e recusada',
  estado_de($q$select enviar_mensagem_refeicao(null, 'Jantar', '   ')$q$) = '22023');
select teste('mensagem enorme e recusada',
  estado_de(format('select enviar_mensagem_refeicao(null, %L, %L)', 'Jantar', repeat('a', 1001))) = '22023');
select teste('sem dizer a refeicao e recusado',
  estado_de($q$select enviar_mensagem_refeicao(null, '  ', 'oi')$q$) = '22023');
commit;

-- A nutricionista responde ---------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select teste('ela ve a conversa do jantar da Ana', jsonb_array_length(conversa_da_refeicao(ana_c(), 'Jantar')) = 3);
select teste('o resumo mostra 3 nao lidas no jantar e 1 no almoco',
  (select bool_and((r ->> 'naoLidas')::int = case when lower(r ->> 'refeicao') = 'jantar' then 3 else 1 end)
     from jsonb_array_elements(resumo_das_conversas(ana_c())) r));
select enviar_mensagem_refeicao(ana_c(), 'Jantar', 'vamos reduzir o arroz e observar');
select teste('a resposta entrou, assinada como nutri',
  (conversa_da_refeicao(ana_c(), 'Jantar') -> 3 ->> 'autor') = 'nutri');
select teste('marcar lida devolve quantas eram da paciente', marcar_conversa_lida(ana_c(), 'Jantar') = 3);
select teste('marcar de novo nao muda nada', marcar_conversa_lida(ana_c(), 'Jantar') = 0);
select teste('o almoco continua nao lido (so o jantar foi aberto)',
  (select (r ->> 'naoLidas')::int from jsonb_array_elements(resumo_das_conversas(ana_c())) r
    where lower(r ->> 'refeicao') = 'almoço') = 1);
select teste('paciente que nao existe e recusada',
  estado_de(format('select enviar_mensagem_refeicao(%L, %L, %L)', gen_random_uuid(), 'Jantar', 'oi')) = '22023');
commit;

-- A paciente ve a resposta e marca como lida ---------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000c0a01', true);
select teste('ela ve 1 nao lida (a resposta da nutri)',
  (select (r ->> 'naoLidas')::int from jsonb_array_elements(resumo_das_conversas(null)) r
    where lower(r ->> 'refeicao') = 'jantar') = 1);
select teste('ao abrir, marca so a mensagem da nutri', marcar_conversa_lida(null, 'Jantar') = 1);
select teste('as mensagens dela mesma continuam como estavam (a nutri ja leu)',
  (select count(*) from mensagens_refeicao where autor = 'paciente' and lida_em is not null) = 3);
commit;

-- A OUTRA paciente nao alcanca nada -------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000c0a02', true);
select teste('nao le a tabela da outra', (select count(*) from mensagens_refeicao) = 0);
select teste('a conversa que ela abre, mesmo passando o id da Ana, e a DELA (vazia)',
  jsonb_array_length(conversa_da_refeicao(ana_c(), 'Jantar')) = 0);
select teste('o resumo dela vem vazio', jsonb_array_length(resumo_das_conversas(ana_c())) = 0);
select teste('marcar como lida com o id da Ana nao mexe em nada', marcar_conversa_lida(ana_c(), 'Jantar') = 0);
commit;

-- Visitante sem login ----------------------------------------------------------------------
begin;
set local role anon;
do $$
declare v_erro boolean;
begin
  v_erro := false;
  begin perform enviar_mensagem_refeicao(null, 'Jantar', 'oi'); exception when others then v_erro := true; end;
  perform teste('visitante NAO envia mensagem', v_erro);
  v_erro := false;
  begin perform conversa_da_refeicao(null, 'Jantar'); exception when others then v_erro := true; end;
  perform teste('visitante NAO le conversa', v_erro);
  v_erro := false;
  begin perform count(*) from mensagens_refeicao; exception when others then v_erro := true; end;
  perform teste('visitante NAO le a tabela', v_erro);
end;
$$;
commit;

select case when bool_and(passou) then count(*) || '/' || count(*) || ' verificacoes da conversa por refeicao passaram'
            else (count(*) filter (where not passou)) || ' verificacoes da conversa por refeicao falharam' end
    as resultado
from resultados_teste;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% verificacao(oes) da conversa por refeicao falharam', v_falhas;
  end if;
end;
$$;
