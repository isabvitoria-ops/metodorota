-- =============================================================================
-- Bateria do acesso por código (0110):
--   * só a nutricionista gera; o código vale uma vez e gerar outro cancela;
--   * o banco guarda só o sha256;
--   * quem está no navegador não confere nem conclui código (só o servidor);
--   * e-mail de outra ficha ou da nutricionista é recusado;
--   * concluir liga a conta à ficha, troca o e-mail e gasta o código;
--   * 30 erradas em 15 minutos param a conferência.
-- =============================================================================

truncate resultados_teste;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000f7c01', 'cod-a-antigo@paciente.test');
insert into pacientes (email, nome, plano_id, data_inicio, data_fim) values
  ('cod-a@paciente.test', 'Ana Codigo', 'mensal', hoje_sp() - 5, hoje_sp() + 25),
  ('cod-b@paciente.test', 'Bia Outra', 'mensal', hoje_sp() - 5, hoje_sp() + 25);
create or replace function cod_ana() returns uuid language sql stable security definer as $$
  select id from pacientes where nome = 'Ana Codigo' $$;
grant execute on function cod_ana() to anon, authenticated;
create table cod_guardado (codigo text, segundo text);
grant all on cod_guardado to authenticated;

-- A paciente não gera código.
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000f7c01', true);
select teste('paciente não gera código', estado_de(format('select gerar_codigo_de_acesso(%L)', cod_ana())) = '42501');
select teste('nem confere código pelo navegador', estado_de('select conferir_codigo_de_acesso(''X'', ''a@b.c'')') = '42501');
select teste('nem conclui', estado_de(format('select concluir_codigo_de_acesso(''X'', %L, ''a@b.c'')', cod_ana())) = '42501');
select teste('nem lê os códigos', estado_de('select count(*) from codigos_de_acesso') = '42501');
commit;

-- A nutricionista gera.
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
insert into cod_guardado (codigo) select gerar_codigo_de_acesso(cod_ana()) ->> 'codigo';
commit;

select teste('o código tem 8 caracteres no formato XXXX-XXXX, sem letra ambígua',
  (select codigo ~ '^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$' from cod_guardado));
select teste('o banco guarda só o sha256, não o código',
  (select count(*) from codigos_de_acesso where codigo_hash = _hash_do_codigo((select codigo from cod_guardado))) = 1
  and not exists (select 1 from codigos_de_acesso where codigo_hash like '%' || replace((select codigo from cod_guardado), '-', '') || '%'));

-- O servidor (aqui como dono do banco) confere.
select teste('código errado é recusado',
  conferir_codigo_de_acesso('ZZZZ-ZZZZ', 'novo@paciente.test') ->> 'motivo' = 'codigo');
select teste('e a tentativa fica anotada', (select count(*) from tentativas_de_codigo) = 1);
select teste('código certo, digitado de qualquer jeito, passa',
  (conferir_codigo_de_acesso(lower(replace((select codigo from cod_guardado), '-', ' ')), 'Novo@Paciente.test') ->> 'ok')::boolean);
select teste('e-mail de outra ficha é recusado',
  conferir_codigo_de_acesso((select codigo from cod_guardado), 'cod-b@paciente.test') ->> 'motivo' = 'email_de_outra');
select teste('e-mail da nutricionista é recusado',
  conferir_codigo_de_acesso((select codigo from cod_guardado), 'nutri@central.test') ->> 'motivo' = 'email_de_outra');
select teste('e-mail inválido é recusado',
  conferir_codigo_de_acesso((select codigo from cod_guardado), 'sem-arroba') ->> 'motivo' = 'email_invalido');
select teste('conta que já existe e não é de ninguém vem com o id',
  conferir_codigo_de_acesso((select codigo from cod_guardado), 'cod-a-antigo@paciente.test') ->> 'usuarioId' = '00000000-0000-0000-0000-0000000f7c01');

-- Conclui com uma conta nova (o servidor cria a conta antes).
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000f7c02', 'novo@paciente.test');
select teste('concluir com conta de outro e-mail é recusado',
  estado_de(format('select concluir_codigo_de_acesso(%L, %L, %L)', (select codigo from cod_guardado),
    '00000000-0000-0000-0000-0000000f7c01', 'novo@paciente.test')) = '22023');
select concluir_codigo_de_acesso((select codigo from cod_guardado), '00000000-0000-0000-0000-0000000f7c02', 'Novo@Paciente.test');
select teste('a ficha fica ligada à conta nova, com o e-mail novo',
  (select perfil_id = '00000000-0000-0000-0000-0000000f7c02' and email = 'novo@paciente.test' from pacientes where id = cod_ana()));
select teste('a paciente entra e vê a ficha dela', (
  select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000f7c02', true) is not null
     and meu_paciente_id() = cod_ana()));
select teste('o código foi gasto: não passa de novo',
  conferir_codigo_de_acesso((select codigo from cod_guardado), 'outro@paciente.test') ->> 'motivo' = 'codigo');

-- Gerar outro cancela o que ainda valia.
begin;
set local role authenticated;
set local search_path = public;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
update cod_guardado set codigo = gerar_codigo_de_acesso(cod_ana()) ->> 'codigo';
update cod_guardado set segundo = gerar_codigo_de_acesso(cod_ana()) ->> 'codigo';
commit;
select teste('gerar outro cancela o anterior',
  conferir_codigo_de_acesso((select codigo from cod_guardado), 'x@paciente.test') ->> 'motivo' = 'codigo'
  and (conferir_codigo_de_acesso((select segundo from cod_guardado), 'x@paciente.test') ->> 'ok')::boolean);

-- Muitas tentativas param a conferência.
insert into tentativas_de_codigo (em) select now() from generate_series(1, 30);
select teste('com 30 erradas em 15 minutos, para',
  conferir_codigo_de_acesso((select segundo from cod_guardado), 'x@paciente.test') ->> 'motivo' = 'muitas_tentativas');

select case when bool_and(passou) then count(*) || '/' || count(*) || ' verificacoes do acesso por codigo passaram'
            else (count(*) filter (where not passou)) || ' verificacoes do acesso por codigo falharam' end
    as resultado
from resultados_teste;

do $$
declare v_falhas integer;
begin
  select count(*) into v_falhas from resultados_teste where not passou;
  if v_falhas > 0 then
    raise exception '% verificacao(oes) do acesso por codigo falharam', v_falhas;
  end if;
end;
$$;
