-- =============================================================================
-- Bateria do termo de uso e da LGPD (0063)
--
-- O que nao pode falhar:
--   * o texto do termo abre sem login (a paciente le antes de aceitar);
--   * cada paciente aceita por si e so ve o proprio aceite; aceitar versao
--     velha e recusado; mudou o texto, sobe a versao e todas aceitam de novo;
--   * a nutricionista nunca fica "pendente"; so ela publica o termo;
--   * a copia da paciente traz o que e dela e NAO traz a anotacao clinica;
--     a ficha completa so a nutricionista exporta, e inclui a anotacao;
--   * o pedido de exclusao e unico por paciente em aberto, a outra nao o ve, e
--     sobrevive a exclusao da ficha.
-- =============================================================================

truncate resultados_teste;
delete from pontos_lancamentos;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000c4a01', 'lgpd-a@paciente.test'),
  ('00000000-0000-0000-0000-0000000c4a02', 'lgpd-b@paciente.test');
insert into pacientes (email, nome, plano_id, data_inicio, data_fim, observacoes) values
  ('lgpd-a@paciente.test', 'Ana Lgpd', 'mensal', hoje_sp() - 5, hoje_sp() + 25, 'obs privada da nutri'),
  ('lgpd-b@paciente.test', 'Bia Lgpd', 'mensal', hoje_sp() - 5, hoje_sp() + 25, null);

create or replace function lg_a() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'lgpd-a@paciente.test' $$;
create or replace function lg_b() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'lgpd-b@paciente.test' $$;
grant execute on function lg_a(), lg_b() to anon, authenticated;

-- Dados de cada uma: um ponto no livro e, so da Ana, uma consulta com anotacao clinica.
insert into pontos_lancamentos (paciente_id, pontos, tipo, descricao) values
  (lg_a(), 10, 'acao', 'ponto da Ana'), (lg_b(), 20, 'acao', 'ponto da Bia');
insert into consultas (paciente_id, tipo, status, data, observacoes)
values (lg_a(), 'retorno', 'concluida', hoje_sp(), 'ANOTACAO CLINICA SECRETA');

-- O texto abre sem login --------------------------------------------------------
begin;
set local role anon;
do $$
declare v_erro boolean;
begin
  perform teste('visitante le o termo (a pagina abre antes do login)',
    (select count(*) from termo_de_uso where versao = 1) = 1);
  v_erro := false;
  begin insert into termo_de_uso (versao, texto) values (99, repeat('x', 300)); exception when others then v_erro := true; end;
  perform teste('visitante NAO escreve no termo', v_erro);
  v_erro := false;
  begin perform count(*) from aceites_do_termo; exception when others then v_erro := true; end;
  perform teste('visitante NAO le os aceites', v_erro);
end;
$$;
commit;

-- A paciente aceita ------------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000c4a01', true);
select teste('Ana comeca pendente', not (meu_termo() ->> 'aceito')::boolean);
select teste('aceitar uma versao que nao e a atual e recusado',
  estado_de($q$select aceitar_termo(7)$q$) = '22023');
select teste('Ana ainda nao viu as boas-vindas', not (meu_termo() ->> 'boasVindasVistas')::boolean);
select concluir_boas_vindas();
select concluir_boas_vindas();
select teste('Ana concluiu as boas-vindas (duas vezes nao duplica)',
  (meu_termo() ->> 'boasVindasVistas')::boolean and (select count(*) from boas_vindas_vistas) = 1);
select aceitar_termo(1);
select teste('Ana aceitou a versao 1', (meu_termo() ->> 'aceito')::boolean and (meu_termo() ->> 'versao')::int = 1);
select aceitar_termo(1);
select teste('aceitar duas vezes nao duplica', (select count(*) from aceites_do_termo where perfil_id = auth.uid()) = 1);
select teste('Ana nao publica termo', estado_de($q$select publicar_termo(repeat('texto novo ', 40))$q$) = '42501');
select teste('Ana nao ve a situacao dos aceites', estado_de($q$select situacao_dos_aceites()$q$) = '42501');
select teste('Ana nao exporta a ficha completa', estado_de($q$select exportar_ficha_completa(lg_a())$q$) = '42501');
commit;

begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000c4a02', true);
select teste('Bia nao viu as boas-vindas (a marca da Ana nao vale para ela)', not (meu_termo() ->> 'boasVindasVistas')::boolean);
select teste('Bia continua pendente (o aceite da Ana nao vale para ela)', not (meu_termo() ->> 'aceito')::boolean);
select teste('Bia nao ve o aceite da Ana', (select count(*) from aceites_do_termo) = 0);
commit;

-- A nutricionista -------------------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select teste('a nutricionista nunca fica pendente', (meu_termo() ->> 'aceito')::boolean);
select teste('a nutricionista nao ve as boas-vindas', (meu_termo() ->> 'boasVindasVistas')::boolean);
select teste('situacao: 1 aceitou, o resto pendente',
  (situacao_dos_aceites() ->> 'aceitaram')::int = 1 and (situacao_dos_aceites() ->> 'pendentes')::int >= 1);
select teste('texto curto demais e recusado', estado_de($q$select publicar_termo('curto')$q$) = '22023');
select teste('o texto gravado nao tem quebra de linha sobrando nas pontas', (select texto = btrim(texto, E' \n\r') from termo_de_uso where versao = 1));
select teste('publicar o MESMO texto nao sobe versao',
  not (publicar_termo((select texto from termo_de_uso where versao = 1)) ->> 'mudou')::boolean
  and versao_do_termo() = 1);
select publicar_termo('NOVO TERMO. ' || repeat('Este e o texto novo do termo de uso. ', 12)) as nova
\gset
select teste('texto novo sobe para a versao 2', versao_do_termo() = 2);
select teste('a versao 1 continua guardada', (select count(*) from termo_de_uso where versao = 1) = 1);
select teste('o aceite da Ana na v1 continua guardado',
  (select count(*) from aceites_do_termo where versao = 1 and paciente_id = lg_a()) = 1);
select teste('a nutricionista continua nao pendente na v2', (meu_termo() ->> 'aceito')::boolean);
commit;

begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000c4a01', true);
select teste('mudou o texto: a Ana volta a ficar pendente', not (meu_termo() ->> 'aceito')::boolean);
select aceitar_termo(2);
select teste('Ana aceita a v2', (meu_termo() ->> 'aceito')::boolean);
commit;

-- A copia dos dados ----------------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000c4a01', true);
select exportar_meus_dados() as copia
\gset
commit;

select teste('a copia da Ana traz o cadastro dela', (:'copia'::jsonb -> 'cadastro' ->> 'nome') = 'Ana Lgpd');
select teste('a copia NAO traz a observacao privada da nutri', not (:'copia'::jsonb -> 'cadastro' ? 'observacoes'));
select teste('a copia traz os pontos da Ana', jsonb_array_length(:'copia'::jsonb -> 'pontos') = 1
  and (:'copia'::jsonb -> 'pontos' -> 0 ->> 'descricao') = 'ponto da Ana');
select teste('a copia NAO traz a anotacao clinica nem a tabela de consultas',
  not (:'copia'::jsonb ? 'consultas') and position('ANOTACAO CLINICA' in :'copia') = 0);
select teste('a copia NAO traz nada da Bia', position('ponto da Bia' in :'copia') = 0);

begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select exportar_ficha_completa(lg_a()) as ficha
\gset
select teste('a nutricionista nao tem copia propria (nao e paciente)',
  estado_de($q$select exportar_meus_dados()$q$) = '42501');
commit;

select teste('a ficha completa traz a anotacao clinica', position('ANOTACAO CLINICA' in :'ficha') > 0);
select teste('a ficha completa traz as observacoes do cadastro', position('obs privada da nutri' in :'ficha') > 0);
select teste('a ficha completa NAO traz a Bia', position('ponto da Bia' in :'ficha') = 0);
select teste('a ficha completa lista os aceites da Ana', jsonb_array_length(:'ficha'::jsonb -> 'aceitesDoTermo') = 2);

-- O pedido de exclusao --------------------------------------------------------------------
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000c4a01', true);
select pedir_exclusao_dos_meus_dados('nao uso mais') as pedido
\gset
select teste('o pedido foi criado', (select count(*) from pedidos_lgpd) = 1);
select teste('pedir de novo devolve o MESMO pedido (um em aberto por vez)',
  pedir_exclusao_dos_meus_dados(null) = :'pedido'::uuid and (select count(*) from pedidos_lgpd) = 1);
select teste('Ana nao atende o proprio pedido', estado_de(format($q$select atender_pedido_lgpd('%s')$q$, :'pedido')) = '42501');
commit;

begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000c4a02', true);
select teste('Bia nao ve o pedido da Ana', (select count(*) from pedidos_lgpd) = 0);
commit;

begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select teste('a nutricionista ve o pedido, com o motivo',
  (select count(*) from pedidos_lgpd where atendido_em is null and motivo = 'nao uso mais') = 1);
select atender_pedido_lgpd(:'pedido'::uuid);
select teste('atendido fica marcado', (select atendido_em is not null from pedidos_lgpd where id = :'pedido'::uuid));
delete from pacientes where id = lg_a();
select teste('apagada a ficha, o pedido continua, com o nome e sem o vinculo',
  (select count(*) from pedidos_lgpd where id = :'pedido'::uuid and paciente_id is null and paciente_nome = 'Ana Lgpd') = 1);
commit;

select teste('o termo e as funcoes novas estao registrados nas migracoes',
  exists (select 1 from funcoes_das_migracoes where nome = 'exportar_ficha_completa'));

select case when bool_and(passou) then count(*) || '/' || count(*) || ' verificacoes do termo e da LGPD passaram'
            else (count(*) filter (where not passou)) || ' verificacoes do termo e da LGPD falharam' end
    as resultado
from resultados_teste;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% verificacao(oes) do termo e da LGPD falharam', v_falhas;
  end if;
end;
$$;
