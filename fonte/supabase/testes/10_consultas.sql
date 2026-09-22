-- =============================================================================
-- Bateria das consultas e do panorama (0035)
--
-- O que não pode falhar nunca:
--
--   * a ANOTAÇÃO CLÍNICA não sai para a paciente. Nem pela tabela, nem pela
--     função dela, nem sabendo o id da consulta. É o dado mais sensível que
--     entrou no banco até aqui: é onde a profissional escreve o que pensou;
--   * a paciente vê as consultas DELA e nenhuma outra;
--   * a paciente não marca, não altera e não apaga consulta;
--   * o panorama é só da profissional -- ele reúne a ficha de TODO MUNDO
--     numa resposta só, e vazar essa função vaza a clínica inteira.
-- =============================================================================

truncate resultados_teste;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000ca01', 'consulta-a@paciente.test'),
  ('00000000-0000-0000-0000-00000000ca02', 'consulta-b@paciente.test');

insert into pacientes (email, nome, plano_id, data_inicio, data_fim) values
  ('consulta-a@paciente.test', 'Marta Consulta', 'mensal', hoje_sp() - 30, hoje_sp() + 30),
  ('consulta-b@paciente.test', 'Nina Consulta', 'mensal', hoje_sp() - 30, hoje_sp() + 30);

create or replace function marta() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'consulta-a@paciente.test' $$;
create or replace function nina() returns uuid language sql stable security definer as $$
  select id from pacientes where email = 'consulta-b@paciente.test' $$;
create or replace function consulta_de(p_paciente uuid, p_resumo text) returns uuid
language sql stable security definer as $$
  select id from consultas where paciente_id = p_paciente and resumo = p_resumo limit 1 $$;
-- `security definer` pelo motivo de sempre, e aqui ele e ainda mais literal:
-- a paciente NAO TEM politica de leitura nesta tabela, entao um count comum
-- na sessao dela devolve zero. O teste compararia 4 com 0 e "falharia"
-- provando exatamente o que queria provar.
create or replace function quantas_consultas(p_paciente uuid) returns integer
language sql stable security definer as $$
  select count(*)::integer from consultas
  where paciente_id = p_paciente and status <> 'cancelada' $$;

grant execute on function marta(), nina(), consulta_de(uuid, text), quantas_consultas(uuid)
  to anon, authenticated;

-- -----------------------------------------------------------------------------
-- A profissional marca e anota
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select salvar_consulta(null, marta(), hoje_sp() - 14, '14:00'::time, 'primeira', 'concluida',
  'Primeira consulta, montou o plano base.', 'ANOTACAO SIGILOSA: contexto familiar.');
select salvar_consulta(null, marta(), hoje_sp() + 1, '15:00'::time, 'retorno', 'agendada',
  null, null);
select salvar_consulta(null, nina(), hoje_sp() - 7, null, 'retorno', 'concluida',
  'Ajuste no jantar.', 'Outra anotacao sigilosa.');

select teste('a consulta nasce com o que ela escreveu',
  (consultas_de(marta()) -> 1 ->> 'resumo') = 'Primeira consulta, montou o plano base.');
select teste('a Marta ficou com duas consultas', jsonb_array_length(consultas_de(marta())) = 2);
select teste('a hora fica NULA quando ela so marcou o dia',
  (consultas_de(nina()) -> 0 -> 'hora') = 'null'::jsonb);
select teste('consulta sem data e recusada',
  estado_de(format('select salvar_consulta(null, %L, null, null, ''retorno'', ''agendada'', null, null)',
    marta())) = '22023');
-- Data no PASSADO de proposito: uma consulta agendada para hoje viraria o
-- "proximo retorno" da Marta e quebraria o teste do panorama la embaixo --
-- que foi exatamente o que aconteceu na primeira versao desta bateria.
select salvar_consulta(null, marta(), hoje_sp() - 20, null, 'telepatia', 'concluida',
  'Com tipo torto', null);
select teste('tipo desconhecido vira o padrao, e o resumo nao se perde',
  (select tipo from consultas where resumo = 'Com tipo torto') = 'retorno');
select salvar_consulta(null, marta(), hoje_sp() - 21, null, 'retorno', 'dormindo',
  'Com status torto', null);
select teste('status desconhecido tambem vira o padrao',
  (select status from consultas where resumo = 'Com status torto') = 'agendada');
commit;

-- -----------------------------------------------------------------------------
-- A ANOTACAO CLINICA NAO SAI PARA A PACIENTE
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000ca01', true);

-- Pela tabela: nao ha politica de leitura para ela, de proposito.
select teste('ela NAO le a tabela de consultas', (select count(*) from consultas) = 0);

-- Pela funcao dela: vem sem `resumo` e sem `observacoes`.
select teste('ela ve as consultas dela, e so as dela',
  jsonb_array_length(minhas_consultas())
  = quantas_consultas(marta()));
select teste('e vem SEM a anotacao clinica',
  not (minhas_consultas() -> 0 ? 'observacoes'));
select teste('e SEM o resumo da consulta',
  not (minhas_consultas() -> 0 ? 'resumo'));
select teste('o que vem e so data, hora, tipo e situacao',
  (minhas_consultas() -> 0 ? 'data') and (minhas_consultas() -> 0 ? 'tipo')
  and (minhas_consultas() -> 0 ? 'status'));

-- Sabendo o id, tambem nao.
select teste('pedir o historico pelo id da propria ficha e recusado',
  estado_de(format('select consultas_de(%L)', marta())) = '42501');
select teste('e pelo id da outra tambem',
  estado_de(format('select consultas_de(%L)', nina())) = '42501');

-- O panorama reune a clinica inteira: vazar essa funcao vaza tudo.
select teste('o panorama e recusado para a paciente',
  estado_de('select panorama_dos_pacientes()') = '42501');

-- Escrever, nao.
select teste('ela nao marca consulta para si mesma',
  estado_de(format('select salvar_consulta(null, %L, %L::date, null, ''retorno'', ''agendada'', null, null)',
    marta(), hoje_sp() + 3)) = '42501');
select teste('ela nao altera a consulta dela',
  estado_de(format('select salvar_consulta(%L, %L, %L::date, null, ''retorno'', ''concluida'', ''Eu mesma'', null)',
    consulta_de(marta(), 'Primeira consulta, montou o plano base.'), marta(), hoje_sp())) = '42501');
select teste('ela nao apaga consulta',
  estado_de(format('select excluir_consulta(%L)',
    consulta_de(marta(), 'Primeira consulta, montou o plano base.'))) = '42501');
select teste('nem altera a tabela direto',
  nao_alterou('update consultas set observacoes = null'));
select teste('nem insere consulta direto',
  recusou(format('insert into consultas (paciente_id, data) values (%L, %L)', marta(), hoje_sp())));
commit;

-- A Nina nao ve nada da Marta.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000ca02', true);
select teste('a outra paciente ve so a consulta dela',
  jsonb_array_length(minhas_consultas()) = 1);
select teste('e a dela tambem vem sem anotacao',
  not (minhas_consultas() -> 0 ? 'observacoes'));
commit;

begin;
select teste('a anotacao sigilosa continua no banco, intacta',
  (select count(*) from consultas where observacoes like 'ANOTACAO SIGILOSA%') = 1);
commit;

-- -----------------------------------------------------------------------------
-- O panorama, do lado da profissional
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

select teste('o panorama traz todas as pacientes',
  jsonb_array_length(panorama_dos_pacientes()) = (select count(*) from pacientes));

select teste('o panorama traz o nome da paciente',
  (select e ->> 'nome' from jsonb_array_elements(panorama_dos_pacientes()) e
   where (e ->> 'id')::uuid = marta()) = 'Marta Consulta');
select teste('a proxima consulta da Marta e a de amanha',
  (select e -> 'proximaConsulta' ->> 'data' from jsonb_array_elements(panorama_dos_pacientes()) e
   where (e ->> 'id')::uuid = marta()) = (hoje_sp() + 1)::text);

-- Consulta de ontem que ninguem concluiu nao vira "proximo retorno".
select salvar_consulta(null, nina(), hoje_sp() - 2, null, 'retorno', 'agendada', null, null);
select teste('consulta agendada no passado nao vira proximo retorno',
  (select e -> 'proximaConsulta' from jsonb_array_elements(panorama_dos_pacientes()) e
   where (e ->> 'id')::uuid = nina()) = 'null'::jsonb);

select teste('a ultima consulta concluida e a que aparece',
  (select e -> 'ultimaConsulta' ->> 'resumo' from jsonb_array_elements(panorama_dos_pacientes()) e
   where (e ->> 'id')::uuid = nina()) = 'Ajuste no jantar.');

select teste('sem registro nenhum, ultimoRegistro vem NULO e nao uma data qualquer',
  (select e -> 'ultimoRegistro' from jsonb_array_elements(panorama_dos_pacientes()) e
   where (e ->> 'id')::uuid = marta()) = 'null'::jsonb);

-- Um registro de meta passa a aparecer como ultimo registro.
select salvar_meta(null, marta(), 'Agua', null, null, 'diaria', 2, 'litros',
  hoje_sp() - 10, null, 'ativa');
select registrar_meta((select id from metas where paciente_id = marta() limit 1),
  hoje_sp() - 2, 2, null);
select teste('o registro de meta vira o ultimo registro',
  (select e ->> 'ultimoRegistro' from jsonb_array_elements(panorama_dos_pacientes()) e
   where (e ->> 'id')::uuid = marta()) = (hoje_sp() - 2)::text);
select teste('e a meta ativa vem junto, com os registros crus',
  (select jsonb_array_length(e -> 'metas') from jsonb_array_elements(panorama_dos_pacientes()) e
   where (e ->> 'id')::uuid = marta()) = 1);

-- Meta pausada nao entra: a lista mostra o que esta valendo.
select definir_status_meta((select id from metas where paciente_id = marta() limit 1), 'pausada');
select teste('meta pausada sai do panorama',
  (select jsonb_array_length(e -> 'metas') from jsonb_array_elements(panorama_dos_pacientes()) e
   where (e ->> 'id')::uuid = marta()) = 0);
commit;

-- -----------------------------------------------------------------------------
-- Apagar a paciente leva as consultas
-- -----------------------------------------------------------------------------
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
delete from pacientes where id = marta();
select teste('excluir a paciente leva as consultas dela',
  (select count(*) from consultas where paciente_id not in (select id from pacientes)) = 0);
commit;

select
  count(*) filter (where passou) || '/' || count(*) || ' verificações das consultas passaram'
    as resultado
from resultados_teste;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% verificação(ões) das consultas falharam', v_falhas;
  end if;
end;
$$;
