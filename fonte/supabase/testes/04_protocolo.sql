-- =============================================================================
-- Bateria do protocolo alimentar
--
-- O protocolo é a dieta de uma pessoa. Duas coisas não podem falhar nunca:
--
--   * a paciente vê o SEU protocolo, publicado, e só ele — nem rascunho pela
--     metade, nem versão antiga, nem, jamais, o de outra paciente;
--   * o que ela publicou não se perde ao publicar de novo.
--
-- Quem garante isso é o banco, não a tela. Por isso os testes entram pela
-- porta da frente: papel `authenticated`, sessão de gente de verdade.
-- =============================================================================

truncate resultados_teste;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'protocolo-a@paciente.test'),
  ('00000000-0000-0000-0000-0000000000f2', 'protocolo-b@paciente.test');

insert into pacientes (email, nome, plano_id, data_inicio, data_fim) values
  ('protocolo-a@paciente.test', 'Alana Protocolo', 'mensal', hoje_sp() - 5, hoje_sp() + 25),
  ('protocolo-b@paciente.test', 'Bruna Protocolo', 'mensal', hoje_sp() - 5, hoje_sp() + 25);

-- Um protocolo pequeno, no formato que o interpretador devolve.
create or replace function protocolo_exemplo(p_arroz text default '200g')
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'orientacoes', jsonb_build_array('Comer proteína em TODAS as refeições'),
    'refeicoes', jsonb_build_array(
      jsonb_build_object(
        'nome', 'Almoço',
        'opcoes', jsonb_build_array(
          jsonb_build_object(
            'rotulo', '',
            'itens', jsonb_build_array(
              jsonb_build_object('alimento', 'Arroz cozido', 'quantidade', p_arroz,
                                 'substituicoes', jsonb_build_array('Batata doce cozida - 250g'))
            ),
            'notas', jsonb_build_array('VEGETAIS: mínimo 100g')
          )
        )
      )
    ),
    'secoes', jsonb_build_array()
  );
$$;


-- Contagens recortadas na paciente A. A B existe só para provar isolamento;
-- sem o recorte, o rascunho dela entraria em toda contagem "global" abaixo.
create or replace function alana() returns uuid language sql stable as $$
  select id from pacientes where email = 'protocolo-a@paciente.test';
$$;

create or replace function protos(p_situacao text) returns integer language sql stable as $$
  select count(*)::int from protocolos where situacao = p_situacao and paciente_id = alana();
$$;

create or replace function versao_no_ar() returns integer language sql stable as $$
  select versao from protocolos where situacao = 'publicado' and paciente_id = alana();
$$;

-- -----------------------------------------------------------------------------
-- Rascunho: existe para ela, não existe para a paciente
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select salvar_rascunho_protocolo(
  (select id from pacientes where email = 'protocolo-a@paciente.test'),
  'Protocolo de emagrecimento', protocolo_exemplo(), null
);

select teste('o rascunho fica guardado', protos('rascunho') = 1);

select teste('salvar de novo sobrescreve, não duplica',
  (select count(*) from (
     select salvar_rascunho_protocolo(
       (select id from pacientes where email = 'protocolo-a@paciente.test'),
       'Protocolo de emagrecimento', protocolo_exemplo('210g'), null)) t
   ) = 1
   and (select count(*) from protocolos where situacao = 'rascunho') = 1);

select teste('e a segunda gravação é a que vale',
  (select conteudo #>> '{refeicoes,0,opcoes,0,itens,0,quantidade}'
     from protocolos where situacao = 'rascunho' and paciente_id = alana()) = '210g');

select teste('a lista dela mostra quem ainda não tem protocolo',
  (select count(*) from jsonb_array_elements(protocolos_das_pacientes()) e
    where e ->> 'situacao' = 'sem') >= 2);

select teste('e mostra que a Alana tem rascunho',
  (select (e ->> 'temRascunho')::boolean from jsonb_array_elements(protocolos_das_pacientes()) e
    where e ->> 'nome' = 'Alana Protocolo'));
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', true);

select teste('a paciente NÃO vê o rascunho dela mesma',
  (select count(*) from protocolos) = 0);

select teste('e meu_protocolo() não devolve nada enquanto é rascunho',
  meu_protocolo() is null);

select teste('a home dela não mostra o atalho',
  (meu_acesso() ->> 'protocolo')::boolean = false);

select teste('a paciente não consegue publicar sozinha',
  recusou(format('select publicar_protocolo(%L)',
    (select id from pacientes where email = 'protocolo-a@paciente.test'))));

select teste('nem escrever protocolo',
  recusou(format('select salvar_rascunho_protocolo(%L, %L, %L::jsonb, null)',
    (select id from pacientes where email = 'protocolo-a@paciente.test'),
    'Invadido', '{"refeicoes":[]}')));

select teste('nem abrir a ficha de protocolo de ninguém',
  recusou(format('select protocolo_do_paciente(%L)',
    (select id from pacientes where email = 'protocolo-a@paciente.test'))));

select teste('nem ver a lista de todas',
  recusou('select protocolos_das_pacientes()'));
commit;

-- -----------------------------------------------------------------------------
-- Publicar
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select publicar_protocolo((select id from pacientes where email = 'protocolo-a@paciente.test'));

select teste('publicar não deixa rascunho para trás', protos('rascunho') = 0);

select teste('e a versão publicada é a 1', versao_no_ar() = 1);

select teste('publicar sem rascunho é recusado',
  recusou(format('select publicar_protocolo(%L)',
    (select id from pacientes where email = 'protocolo-a@paciente.test'))));

-- Protocolo sem refeição nenhuma não vai para o ar: seria uma tela vazia
-- aparecendo para a paciente como se fosse a dieta dela.
select salvar_rascunho_protocolo(
  (select id from pacientes where email = 'protocolo-b@paciente.test'),
  'Vazio', '{"orientacoes":[],"refeicoes":[],"secoes":[]}'::jsonb, null);

select teste('protocolo sem refeição nenhuma não é publicado',
  recusou(format('select publicar_protocolo(%L)',
    (select id from pacientes where email = 'protocolo-b@paciente.test'))));
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', true);

select teste('agora a paciente vê o protocolo dela',
  (meu_protocolo() ->> 'titulo') = 'Protocolo de emagrecimento');

select teste('com o item e a substituição no lugar',
  (meu_protocolo() #>> '{conteudo,refeicoes,0,opcoes,0,itens,0,substituicoes,0}')
    = 'Batata doce cozida - 250g');

select teste('e a observação da refeição junto',
  (meu_protocolo() #>> '{conteudo,refeicoes,0,opcoes,0,notas,0}') = 'VEGETAIS: mínimo 100g');

select teste('a home dela passa a mostrar o atalho',
  (meu_acesso() ->> 'protocolo')::boolean);

select teste('ela enxerga exatamente um protocolo, o seu',
  (select count(*) from protocolos) = 1);

select teste('e não consegue mexer no próprio protocolo',
  nao_alterou('update protocolos set titulo = ''Mudei'''));

select teste('nem apagar',
  nao_alterou('delete from protocolos'));
commit;

-- A outra paciente não vê nada disso.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f2', true);

select teste('a paciente B não vê o protocolo da paciente A',
  (select count(*) from protocolos) = 0);

select teste('e meu_protocolo() dela volta vazio',
  meu_protocolo() is null);
commit;

-- -----------------------------------------------------------------------------
-- Ajustes da semana: chegam sem versão nova
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
select definir_ajustes_protocolo(
  (select id from pacientes where email = 'protocolo-a@paciente.test'),
  'Essa semana, trocar o lanche da tarde por fruta.');

select teste('o ajuste não cria versão nova',
  (select count(*) from protocolos
    where paciente_id = (select id from pacientes where email = 'protocolo-a@paciente.test')) = 1);

select teste('ajuste em paciente sem protocolo publicado é recusado',
  recusou(format('select definir_ajustes_protocolo(%L, %L)',
    (select id from pacientes where email = 'protocolo-b@paciente.test'), 'oi')));
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', true);
select teste('e a paciente lê o ajuste em cima do protocolo',
  (meu_protocolo() ->> 'ajustes') = 'Essa semana, trocar o lanche da tarde por fruta.');
commit;

-- -----------------------------------------------------------------------------
-- Segunda versão: a anterior vira história, não sumiço
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select salvar_rascunho_protocolo(
  (select id from pacientes where email = 'protocolo-a@paciente.test'),
  'Protocolo — fase 2', protocolo_exemplo('180g'), null);
select publicar_protocolo((select id from pacientes where email = 'protocolo-a@paciente.test'));

select teste('a versão nova é a 2', versao_no_ar() = 2);

select teste('e a antiga foi arquivada, não apagada', protos('arquivado') = 1);

select teste('o histórico dela mostra a versão anterior',
  jsonb_array_length(protocolo_do_paciente(
    (select id from pacientes where email = 'protocolo-a@paciente.test')) -> 'historico') = 1);

-- Restaurar devolve como rascunho, nunca direto para a paciente.
select restaurar_protocolo(
  (select id from protocolos where situacao = 'arquivado' and paciente_id = alana()));

select teste('restaurar cria rascunho, e não republica sozinho',
  protos('rascunho') = 1 and versao_no_ar() = 2);

select teste('e o rascunho restaurado traz o conteúdo da versão antiga',
  (select conteudo #>> '{refeicoes,0,opcoes,0,itens,0,quantidade}'
     from protocolos where situacao = 'rascunho' and paciente_id = alana()) = '210g');

select descartar_rascunho_protocolo(
  (select id from pacientes where email = 'protocolo-a@paciente.test'));
select teste('descartar rascunho não mexe no que está no ar',
  protos('rascunho') = 0 and protos('publicado') = 1);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f1', true);
select teste('a paciente continua vendo só a versão no ar',
  (select count(*) from protocolos) = 1
  and (meu_protocolo() ->> 'titulo') = 'Protocolo — fase 2');
commit;

-- -----------------------------------------------------------------------------
-- Grupos de alimentos: a lista que ela monta uma vez e usa em toda paciente
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select salvar_grupo_protocolo(null, 'Frutas', jsonb_build_array(
  jsonb_build_object('alimento', 'Banana', 'quantidade', '1 unidade'),
  jsonb_build_object('alimento', 'Mamão', 'quantidade', '150g')));

select teste('o grupo fica guardado com os alimentos',
  jsonb_array_length((select itens from grupos_protocolo where nome = 'Frutas')) = 2);

select teste('e aparece na lista dela',
  (select count(*) from jsonb_array_elements(listar_grupos_protocolo()) e
    where e ->> 'nome' = 'Frutas') = 1);

select teste('grupo sem nome é recusado',
  recusou($$select salvar_grupo_protocolo(null, '   ', '[]'::jsonb)$$));

select teste('grupo com lista que não é lista é recusado',
  recusou($$select salvar_grupo_protocolo(null, 'Torto', '{"a":1}'::jsonb)$$));

select teste('nome repetido é recusado',
  recusou($$select salvar_grupo_protocolo(null, 'frutas', '[]'::jsonb)$$));

-- Editar o grupo NÃO mexe em protocolo já publicado: a dieta que a paciente
-- está seguindo não muda sozinha porque ela ajustou uma lista.
select salvar_grupo_protocolo(
  (select id from grupos_protocolo where nome = 'Frutas'),
  'Frutas', jsonb_build_array(jsonb_build_object('alimento', 'Uva', 'quantidade', '100g')));

select teste('editar o grupo não mexe no protocolo que já está no ar',
  (select conteudo #>> '{refeicoes,0,opcoes,0,itens,0,alimento}'
     from protocolos where situacao = 'publicado' and paciente_id = alana()) = 'Arroz cozido');

select excluir_grupo_protocolo((select id from grupos_protocolo where nome = 'Frutas'));
select teste('apagar o grupo tira ele da lista', (select count(*) from grupos_protocolo) = 0);
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f2', true);
select teste('a paciente não vê a tabela de grupos',
  (select count(*) from grupos_protocolo) = 0);
select teste('nem consegue listar', recusou('select listar_grupos_protocolo()'));
select teste('nem criar', recusou($$select salvar_grupo_protocolo(null, 'Meu', '[]'::jsonb)$$));
commit;

-- -----------------------------------------------------------------------------
-- Anônimo não chega perto
-- -----------------------------------------------------------------------------
begin;
set local role anon;
select teste('anônimo: barrado na tabela de protocolos', recusou('select 1 from protocolos'));
select teste('anônimo: barrado em meu_protocolo()', recusou('select meu_protocolo()'));
commit;

-- -----------------------------------------------------------------------------
-- Excluir a paciente leva o protocolo junto
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
delete from pacientes where email = 'protocolo-a@paciente.test';
select teste('excluir a paciente apaga o protocolo dela',
  (select count(*) from protocolos
    where paciente_id not in (select id from pacientes)) = 0);
commit;

select
  count(*) filter (where passou) || '/' || count(*) || ' verificações do protocolo passaram' as resultado
from resultados_teste;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% verificação(ões) do protocolo falharam', v_falhas;
  end if;
end;
$$;
