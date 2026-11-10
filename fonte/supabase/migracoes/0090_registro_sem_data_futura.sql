-- 0090 · Rastreabilidade: registro não pode ter data no futuro
--
-- A tela da paciente deixava escolher qualquer dia, e a função dela gravava
-- o que viesse. (A função da nutricionista já recusava data futura desde a
-- 0025.) Um registro de amanhã entra na linha do tempo, na contagem da
-- semana e no rastreio como se tivesse acontecido.
--
-- A trava fica na TABELA, num gatilho, e não dentro de cada função: assim
-- vale para registrar, para editar e para qualquer caminho novo que apareça.
-- Não mexe em nenhum registro existente.

create or replace function reintroducao_sem_data_futura()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.data > hoje_sp() then
    raise exception 'Esta data ainda não chegou (%). Escolha hoje ou um dia que já passou.',
      to_char(new.data, 'DD/MM/YYYY')
      using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function reintroducao_sem_data_futura() from anon, authenticated, public;

drop trigger if exists reintroducao_registros_sem_data_futura on reintroducao_registros;
create trigger reintroducao_registros_sem_data_futura
  before insert or update of data on reintroducao_registros
  for each row execute function reintroducao_sem_data_futura();
