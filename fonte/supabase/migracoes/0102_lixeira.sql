-- 0102 — Lixeira de 30 dias (lote 2 da auditoria, aprovado por ela em 23/11/2026).
--
-- Apagar uma paciente, uma receita, um exame (pela nutricionista) ou um grupo
-- de protocolo deixa de ser para sempre: o item vai para a lixeira por 30
-- dias, com "Desfazer" na hora e "Restaurar" em Configurações.
--
-- COMO FUNCIONA: uma FOTOGRAFIA, e não um "escondido".
-- Esconder a paciente (uma coluna "apagada") obrigaria a mexer nas 125
-- funções que leem `pacientes` — e a que esquecesse mostraria quem foi
-- apagada. Em vez disso, antes de apagar, `lixeira_guardar` copia a linha e
-- TUDO o que o banco apagaria junto (segue as chaves estrangeiras "on delete
-- cascade", em qualquer profundidade, lendo o próprio catálogo do Postgres —
-- tabela nova entra sozinha). Depois apaga de verdade, do jeito de sempre.
-- Restaurar devolve as linhas na ordem certa (pai antes de filho) e religa o
-- que tinha ficado sem dono ("on delete set null", ex.: compromisso da agenda).
--
-- Quem vê: só a nutricionista. A paciente não percebe nada.
-- O que a paciente apaga dela (exame que ELA mandou, foto do diário) continua
-- apagando de vez, como antes. Pedido de LGPD: "Apagar de vez" na lixeira.
-- Arquivos (exame, foto do diário) ficam guardados enquanto o item está na
-- lixeira; ao apagar de vez, a função devolve os caminhos e a tela os remove.

create table if not exists public.lixeira (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('paciente', 'receita', 'exame', 'grupo_protocolo')),
  titulo text not null,
  detalhe text,
  tabela text not null,
  registro_id uuid not null,
  -- { "tabela": [linhas…], … } — a fotografia completa.
  dados jsonb not null,
  -- [{ "tabela", "coluna", "pk", "linhas": [[pk, valor], …] }]
  religar jsonb not null default '[]'::jsonb,
  apagado_em timestamptz not null default now(),
  apagado_por uuid
);
create index if not exists lixeira_apagado_em on public.lixeira (apagado_em);

alter table public.lixeira enable row level security;
revoke all on public.lixeira from anon, authenticated;
grant select on public.lixeira to authenticated;
drop policy if exists lixeira_admin on public.lixeira;
create policy lixeira_admin on public.lixeira for select to authenticated using (e_admin());

-- ---------------------------------------------------------------------------
-- Guardar: fotografa a linha e tudo o que cairia junto, e apaga.
-- Interna: só as funções de cada tipo chamam.
-- ---------------------------------------------------------------------------
create or replace function public.lixeira_guardar(
  p_tabela regclass, p_id uuid, p_tipo text, p_titulo text, p_detalhe text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dados jsonb;
  v_religar jsonb := '[]'::jsonb;
  v_fila text[];
  v_tab text;
  v_fk record;
  v_valores text[];
  v_novas jsonb;
  v_antes int;
  v_depois int;
  v_pk text;
  v_pares jsonb;
  v_id uuid;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista.' using errcode = '42501';
  end if;

  execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]'') from %s x where x.id = $1', p_tabela)
    into v_novas using p_id;
  if jsonb_array_length(v_novas) = 0 then
    raise exception 'Não achei o que apagar.' using errcode = 'P0002';
  end if;
  v_dados := jsonb_build_object(p_tabela::text, v_novas);
  v_fila := array[p_tabela::text];

  while array_length(v_fila, 1) > 0 loop
    v_tab := v_fila[1];
    v_fila := v_fila[2:];
    for v_fk in
      select c.conrelid::regclass::text as filho, c.confdeltype as acao,
             a.attname as coluna, ra.attname as referida
        from pg_constraint c
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
        join pg_attribute ra on ra.attrelid = c.confrelid and ra.attnum = c.confkey[1]
       where c.contype = 'f' and c.confrelid = v_tab::regclass and array_length(c.conkey, 1) = 1
    loop
      select array_agg(distinct r ->> v_fk.referida) into v_valores
        from jsonb_array_elements(v_dados -> v_tab) r
       where r ->> v_fk.referida is not null;
      continue when v_valores is null;

      if v_fk.acao = 'c' then
        execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]'') from %s x where x.%I::text = any($1)', v_fk.filho, v_fk.coluna)
          into v_novas using v_valores;
        continue when jsonb_array_length(v_novas) = 0;
        v_antes := coalesce(jsonb_array_length(v_dados -> v_fk.filho), 0);
        select jsonb_agg(distinct e) into v_novas
          from (select jsonb_array_elements(coalesce(v_dados -> v_fk.filho, '[]'::jsonb)) e
                union select jsonb_array_elements(v_novas)) u;
        v_depois := jsonb_array_length(v_novas);
        v_dados := v_dados || jsonb_build_object(v_fk.filho, v_novas);
        if v_depois > v_antes then
          v_fila := v_fila || v_fk.filho;
        end if;
      elsif v_fk.acao in ('n', 'd') then
        select a.attname into v_pk
          from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = i.indkey[0]
         where i.indrelid = v_fk.filho::regclass and i.indisprimary and i.indnatts = 1;
        if v_pk is null then
          raise exception 'A tabela % não tem chave simples; não sei religar.', v_fk.filho;
        end if;
        execute format('select coalesce(jsonb_agg(jsonb_build_array(x.%I::text, x.%I::text)), ''[]'') from %s x where x.%I::text = any($1)',
                       v_pk, v_fk.coluna, v_fk.filho, v_fk.coluna)
          into v_pares using v_valores;
        if jsonb_array_length(v_pares) > 0 then
          v_religar := v_religar || jsonb_build_array(jsonb_build_object(
            'tabela', v_fk.filho, 'coluna', v_fk.coluna, 'pk', v_pk, 'linhas', v_pares));
        end if;
      end if;
    end loop;
  end loop;

  insert into lixeira (tipo, titulo, detalhe, tabela, registro_id, dados, religar, apagado_por)
  values (p_tipo, p_titulo, p_detalhe, p_tabela::text, p_id, v_dados, v_religar, auth.uid())
  returning id into v_id;

  execute format('delete from %s where id = $1', p_tabela) using p_id;
  return v_id;
end;
$$;
revoke all on function public.lixeira_guardar(regclass, uuid, text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Os quatro tipos. Cada um devolve o id na lixeira (para o "Desfazer").
-- ---------------------------------------------------------------------------
create or replace function public.lixeira_apagar_paciente(p_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_nome text;
begin
  if not e_admin() then raise exception 'Só a nutricionista.' using errcode = '42501'; end if;
  select nome into v_nome from pacientes where id = p_id;
  return lixeira_guardar('public.pacientes'::regclass, p_id, 'paciente', coalesce(v_nome, 'Paciente'),
    'Com todos os registros dela');
end; $$;

create or replace function public.lixeira_apagar_receita(p_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_nome text;
begin
  if not e_admin() then raise exception 'Só a nutricionista.' using errcode = '42501'; end if;
  select titulo into v_nome from receitas where id = p_id;
  return lixeira_guardar('public.receitas'::regclass, p_id, 'receita', coalesce(v_nome, 'Receita'), 'Receita');
end; $$;

create or replace function public.lixeira_apagar_grupo_protocolo(p_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_nome text;
begin
  if not e_admin() then raise exception 'Só a nutricionista.' using errcode = '42501'; end if;
  select nome into v_nome from grupos_protocolo where id = p_id;
  return lixeira_guardar('public.grupos_protocolo'::regclass, p_id, 'grupo_protocolo', coalesce(v_nome, 'Grupo'), 'Grupo de protocolo');
end; $$;

-- O grupo de protocolo já tinha função própria: passa a ir para a lixeira.
create or replace function public.excluir_grupo_protocolo(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista apaga grupos.' using errcode = '42501';
  end if;
  perform lixeira_apagar_grupo_protocolo(p_id);
end; $$;

-- Exame: o da nutricionista vai para a lixeira e o arquivo FICA (a função
-- devolve nulo, então a tela não remove nada). O que a paciente mandou e ela
-- mesma apaga continua indo de vez, como antes.
create or replace function public.apagar_exame(p_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_caminho text;
  v_origem text;
  v_paciente uuid;
  v_nome text;
  v_data text;
begin
  select e.caminho, e.origem, e.paciente_id, p.nome,
         coalesce(nullif(trim(e.nome), ''), 'Exame') || coalesce(' de ' || to_char(e.data, 'DD/MM/YYYY'), '')
    into v_caminho, v_origem, v_paciente, v_nome, v_data
    from exames e left join pacientes p on p.id = e.paciente_id where e.id = p_id;
  if v_caminho is null then
    raise exception 'Exame não encontrado.' using errcode = '22023';
  end if;

  if e_admin() then
    perform lixeira_guardar('public.exames'::regclass, p_id, 'exame', v_data, v_nome);
    return null;
  end if;

  if v_paciente = meu_paciente_id() and v_origem = 'paciente' then
    delete from exames where id = p_id;
    return v_caminho;
  end if;

  raise exception 'Você não pode apagar este arquivo.' using errcode = '42501';
end; $$;

-- O id na lixeira do exame que acabou de ir para lá (para o "Desfazer").
create or replace function public.lixeira_ultimo(p_registro uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select id from lixeira where registro_id = p_registro and e_admin() order by apagado_em desc limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Listar, restaurar, apagar de vez.
-- ---------------------------------------------------------------------------
create or replace function public.lixeira_itens()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not e_admin() then raise exception 'Só a nutricionista.' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', l.id, 'tipo', l.tipo, 'titulo', l.titulo, 'detalhe', l.detalhe,
      'apagadoEm', l.apagado_em,
      'diasRestantes', greatest(0, 30 - (hoje_sp() - (l.apagado_em at time zone 'America/Sao_Paulo')::date))
    ) order by l.apagado_em desc)
    from lixeira l
  ), '[]'::jsonb);
end; $$;

create or replace function public.lixeira_restaurar(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_item lixeira;
  v_faltam text[];
  v_feitas text[] := '{}';
  v_tab text;
  v_pronta boolean;
  v_r jsonb;
  v_par jsonb;
  v_tipo text;
begin
  if not e_admin() then raise exception 'Só a nutricionista.' using errcode = '42501'; end if;
  select * into v_item from lixeira where id = p_id for update;
  if not found then
    raise exception 'Este item não está mais na lixeira.' using errcode = 'P0002';
  end if;

  select array_agg(k) into v_faltam from jsonb_object_keys(v_item.dados) k;

  -- Pai antes de filho: entra a tabela cujos pais (dentro da fotografia) já entraram.
  while array_length(v_faltam, 1) > 0 loop
    v_pronta := false;
    foreach v_tab in array v_faltam loop
      if not exists (
        select 1 from pg_constraint c
         where c.contype = 'f' and c.conrelid = v_tab::regclass and c.confrelid <> c.conrelid
           and c.confrelid::regclass::text = any(v_faltam)
           and not (c.confrelid::regclass::text = any(v_feitas))
      ) then
        begin
          execute format('insert into %s select * from jsonb_populate_recordset(null::%s, $1)', v_tab, v_tab)
            using v_item.dados -> v_tab;
        exception
          when unique_violation then
            raise exception 'Não deu para restaurar: já existe outro cadastro igual (por exemplo, outra paciente com o mesmo e-mail). Mude o outro cadastro e tente de novo.'
              using errcode = '23505';
          when foreign_key_violation then
            raise exception 'Não deu para restaurar: algo que este item usava foi apagado depois.'
              using errcode = '23503';
        end;
        v_feitas := v_feitas || v_tab;
        v_faltam := array_remove(v_faltam, v_tab);
        v_pronta := true;
      end if;
    end loop;
    if not v_pronta then
      raise exception 'Não consegui achar a ordem para restaurar.' using errcode = 'P0001';
    end if;
  end loop;

  -- O prazo do check-in é recalculado ao gravar; devolve a marca que estava.
  if v_item.dados ? 'questionario_envios' then
    update questionario_envios q set atrasado = (x ->> 'atrasado')::boolean
      from jsonb_array_elements(v_item.dados -> 'questionario_envios') x
     where q.id = (x ->> 'id')::uuid;
  end if;

  -- Religa o que tinha ficado sem dono (só se continua sem dono).
  for v_r in select * from jsonb_array_elements(v_item.religar) loop
    select format_type(a.atttypid, a.atttypmod) into v_tipo
      from pg_attribute a where a.attrelid = (v_r ->> 'tabela')::regclass and a.attname = v_r ->> 'coluna';
    for v_par in select * from jsonb_array_elements(v_r -> 'linhas') loop
      execute format('update %s set %I = $1::%s where %I::text = $2 and %I is null',
                     v_r ->> 'tabela', v_r ->> 'coluna', v_tipo, v_r ->> 'pk', v_r ->> 'coluna')
        using v_par ->> 1, v_par ->> 0;
    end loop;
  end loop;

  -- A paciente volta com o histórico dela; o "cadastrada" que o gatilho cria
  -- agora seria falso, então vira "restaurada da lixeira".
  if v_item.tipo = 'paciente' then
    delete from historico_admin
     where paciente_id = v_item.registro_id and evento = 'paciente_cadastrado' and criado_em = now();
    insert into historico_admin (paciente_id, ator_perfil_id, evento, detalhe)
    values (v_item.registro_id, auth.uid(), 'restaurada_da_lixeira', jsonb_build_object('apagada_em', v_item.apagado_em));
  end if;

  delete from lixeira where id = p_id;
end; $$;

-- Os arquivos que acompanham um item (para a tela remover do armazenamento).
create or replace function public.lixeira_arquivos_de(p_dados jsonb)
returns jsonb language sql immutable set search_path = public as $$
  select coalesce(jsonb_agg(a), '[]'::jsonb) from (
    select jsonb_build_object('balde', 'exames', 'caminho', e ->> 'caminho') a
      from jsonb_array_elements(coalesce(p_dados -> 'exames', '[]'::jsonb)) e where e ->> 'caminho' is not null
    union all
    select jsonb_build_object('balde', 'diario-fotos', 'caminho', f ->> 'caminho')
      from jsonb_array_elements(coalesce(p_dados -> 'diario_fotos', '[]'::jsonb)) f where f ->> 'caminho' is not null
  ) x;
$$;

create or replace function public.lixeira_apagar_de_vez(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_arquivos jsonb;
begin
  if not e_admin() then raise exception 'Só a nutricionista.' using errcode = '42501'; end if;
  delete from lixeira where id = p_id returning lixeira_arquivos_de(dados) into v_arquivos;
  return coalesce(v_arquivos, '[]'::jsonb);
end; $$;

create or replace function public.lixeira_esvaziar(p_confirmacao text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_arquivos jsonb;
begin
  if not e_admin() then raise exception 'Só a nutricionista.' using errcode = '42501'; end if;
  if p_confirmacao is distinct from 'EXCLUIR' then
    raise exception 'Para esvaziar, digite EXCLUIR.' using errcode = '22023';
  end if;
  with apagados as (delete from lixeira returning dados)
  select coalesce(jsonb_agg(a), '[]'::jsonb) into v_arquivos
    from apagados, jsonb_array_elements(lixeira_arquivos_de(dados)) a;
  return v_arquivos;
end; $$;

-- Passou de 30 dias, some de vez. A tela chama ao abrir a lixeira.
create or replace function public.lixeira_limpar_vencidos()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_arquivos jsonb;
begin
  if not e_admin() then raise exception 'Só a nutricionista.' using errcode = '42501'; end if;
  with apagados as (
    delete from lixeira where (apagado_em at time zone 'America/Sao_Paulo')::date <= hoje_sp() - 30 returning dados)
  select coalesce(jsonb_agg(a), '[]'::jsonb) into v_arquivos
    from apagados, jsonb_array_elements(lixeira_arquivos_de(dados)) a;
  return v_arquivos;
end; $$;

revoke all on function public.lixeira_apagar_paciente(uuid) from public, anon;
revoke all on function public.lixeira_apagar_receita(uuid) from public, anon;
revoke all on function public.lixeira_apagar_grupo_protocolo(uuid) from public, anon;
revoke all on function public.lixeira_ultimo(uuid) from public, anon;
revoke all on function public.lixeira_itens() from public, anon;
revoke all on function public.lixeira_restaurar(uuid) from public, anon;
revoke all on function public.lixeira_apagar_de_vez(uuid) from public, anon;
revoke all on function public.lixeira_esvaziar(text) from public, anon;
revoke all on function public.lixeira_limpar_vencidos() from public, anon;
grant execute on function public.lixeira_apagar_paciente(uuid) to authenticated;
grant execute on function public.lixeira_apagar_receita(uuid) to authenticated;
grant execute on function public.lixeira_apagar_grupo_protocolo(uuid) to authenticated;
grant execute on function public.lixeira_ultimo(uuid) to authenticated;
grant execute on function public.lixeira_itens() to authenticated;
grant execute on function public.lixeira_restaurar(uuid) to authenticated;
grant execute on function public.lixeira_apagar_de_vez(uuid) to authenticated;
grant execute on function public.lixeira_esvaziar(text) to authenticated;
grant execute on function public.lixeira_limpar_vencidos() to authenticated;
