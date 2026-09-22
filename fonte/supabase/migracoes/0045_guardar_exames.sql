-- =============================================================================
-- CENTRAL DO PACIENTE — 0045: guardar exames
--
-- O segundo dos "futuros" que ela aprovou, e o único do sistema inteiro que
-- guarda ARQUIVO. Isso muda o que pode dar errado.
--
-- ATÉ AQUI, TUDO ERA TEXTO. Um vazamento de texto mostra um número de
-- registro. Um vazamento de arquivo mostra o PDF do laboratório com nome
-- completo, CPF, data de nascimento e o resultado — de uma pessoa que não
-- é quem está olhando. É outro tamanho de erro, e por isso este módulo tem
-- duas trancas em vez de uma:
--
--   1. a TABELA de metadados, com RLS como todo o resto;
--   2. o BALDE de arquivos, PRIVADO, com política própria sobre o caminho.
--
-- As duas são necessárias. A tabela sozinha esconderia a linha mas o
-- arquivo continuaria alcançável por quem tivesse o endereço; o balde
-- sozinho protegeria o arquivo mas a lista mostraria que ele existe.
--
-- O CAMINHO É A CHAVE: "<id-da-paciente>/<arquivo>". A política olha a
-- primeira pasta. Não é convenção de organização — é o que separa uma
-- paciente da outra no armazenamento.
--
-- BALDE PRIVADO, e nunca público. Balde público é endereço que funciona
-- para qualquer um que o tenha, para sempre, sem login — e endereço de
-- arquivo vaza em histórico de navegador, em print, em encaminhamento de
-- WhatsApp. O aplicativo pede um endereço assinado que expira.
--
-- A PACIENTE TAMBÉM ENVIA, e isso é o caso comum: ela faz o exame, recebe
-- o PDF no e-mail e manda. Hoje isso vira foto no WhatsApp da
-- nutricionista, que é o pior lugar possível para guardar dado de saúde.
-- =============================================================================

-- O balde. `public = false` é a linha mais importante do arquivo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'exames',
  'exames',
  false,
  -- 10 MB. Um exame em PDF tem centenas de kilobytes; uma foto de celular
  -- tem uns 3 MB. O limite existe porque o plano grátis tem 1 GB no total,
  -- e um vídeo enviado por engano comeria um décimo disso.
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create table if not exists exames (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes(id) on delete cascade,
  -- O caminho dentro do balde. É o que liga esta linha ao arquivo.
  caminho text not null unique,
  /** O nome que o arquivo tinha no computador dela. */
  nome text not null,
  tipo text not null,
  tamanho bigint not null default 0,
  /** A data DO EXAME, que não é a data do envio. */
  data date,
  descricao text,
  -- Quem mandou. A tela mostra, porque "a paciente mandou isto" e "eu
  -- guardei isto" são coisas diferentes na hora de ler.
  origem text not null default 'nutricionista'
    check (origem in ('nutricionista', 'paciente')),
  criado_em timestamptz not null default now()
);

comment on table exames is
  'Metadados dos exames. O arquivo vive no balde privado `exames`, e as duas coisas são protegidas separadamente.';

create index if not exists exames_por_paciente on exames (paciente_id, data desc nulls last);

alter table exames enable row level security;

grant select, insert, update, delete on exames to authenticated;

drop policy if exists exames_admin on exames;
create policy exames_admin on exames
  for all using (e_admin()) with check (e_admin());

-- A paciente lê os PRÓPRIOS exames -- os que ela mandou e os que a
-- nutricionista guardou. Esconder dela um exame que é dela seria estranho:
-- o resultado é dela, e ela já o tem no e-mail.
drop policy if exists exames_paciente_le on exames;
create policy exames_paciente_le on exames
  for select using (paciente_id = meu_paciente_id());

-- Ela cria a linha apenas para SI MESMA, e apenas marcada como vinda dela.
-- Sem o `origem = 'paciente'` no `with check`, um envio poderia se passar
-- por documento guardado pela nutricionista.
drop policy if exists exames_paciente_envia on exames;
create policy exames_paciente_envia on exames
  for insert with check (
    paciente_id = meu_paciente_id()
    and origem = 'paciente'
    and tem_acesso()
  );

-- Apaga o que ELA mandou, e só. O que a nutricionista guardou é registro
-- clínico e não sai pela mão da paciente. O que ela mandou, sim: mandar o
-- arquivo errado -- ou o de outra pessoa -- acontece, e deixar desfazer é
-- proteção, não permissividade.
drop policy if exists exames_paciente_apaga on exames;
create policy exames_paciente_apaga on exames
  for delete using (
    paciente_id = meu_paciente_id() and origem = 'paciente'
  );

-- -----------------------------------------------------------------------------
-- As políticas do BALDE
-- -----------------------------------------------------------------------------
--
-- Recaem sobre `storage.objects`, que é uma tabela como outra qualquer. O
-- recorte é a PRIMEIRA PASTA do caminho.
--
-- `split_part(name, '/', 1)` em vez de `storage.foldername(name)`: a
-- segunda é função do Supabase e não existiria no Postgres em que a bateria
-- roda. Uma política que não pode ser testada é uma política em que eu
-- estaria só acreditando.

drop policy if exists exames_balde_admin on storage.objects;
create policy exames_balde_admin on storage.objects
  for all
  using (bucket_id = 'exames' and e_admin())
  with check (bucket_id = 'exames' and e_admin());

drop policy if exists exames_balde_paciente_le on storage.objects;
create policy exames_balde_paciente_le on storage.objects
  for select using (
    bucket_id = 'exames'
    and meu_paciente_id() is not null
    and split_part(name, '/', 1) = meu_paciente_id()::text
  );

drop policy if exists exames_balde_paciente_envia on storage.objects;
create policy exames_balde_paciente_envia on storage.objects
  for insert with check (
    bucket_id = 'exames'
    and tem_acesso()
    and meu_paciente_id() is not null
    and split_part(name, '/', 1) = meu_paciente_id()::text
  );

drop policy if exists exames_balde_paciente_apaga on storage.objects;
create policy exames_balde_paciente_apaga on storage.objects
  for delete using (
    bucket_id = 'exames'
    and meu_paciente_id() is not null
    and split_part(name, '/', 1) = meu_paciente_id()::text
    -- Só o que ela mandou. O arquivo que a nutricionista guardou fica.
    and exists (
      select 1 from exames e
       where e.caminho = storage.objects.name and e.origem = 'paciente')
  );

-- -----------------------------------------------------------------------------
-- As funções
-- -----------------------------------------------------------------------------

/**
 * Registra um exame já enviado ao balde.
 *
 * O CAMINHO NÃO É ACEITO COMO VEIO. A função confere que a primeira pasta
 * é a paciente certa — senão bastaria mandar um caminho com o id de outra
 * pessoa para ligar o exame dela à ficha errada.
 *
 * `p_paciente` nulo quer dizer "eu", e é o que a paciente manda. O id que
 * vem da tela não é consultado em momento nenhum quando é ela quem envia.
 */
create or replace function registrar_exame(
  p_paciente uuid, p_caminho text, p_nome text, p_tipo text,
  p_tamanho bigint, p_data date, p_descricao text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
  v_origem text;
  v_id uuid;
begin
  if e_admin() and p_paciente is not null then
    v_paciente := p_paciente;
    v_origem := 'nutricionista';
  else
    if not tem_acesso() then
      raise exception 'Seu acesso não está liberado.' using errcode = '42501';
    end if;
    -- O id que veio da tela é ignorado de propósito.
    v_paciente := meu_paciente_id();
    v_origem := 'paciente';
  end if;

  if v_paciente is null then
    raise exception 'Não encontrei o cadastro da paciente.' using errcode = '42501';
  end if;
  if coalesce(trim(p_caminho), '') = '' then
    raise exception 'Faltou o arquivo.' using errcode = '22023';
  end if;

  -- A tranca do caminho: a pasta tem que ser a da paciente.
  if split_part(p_caminho, '/', 1) <> v_paciente::text then
    raise exception 'O arquivo não está na pasta desta paciente.' using errcode = '42501';
  end if;

  insert into exames (paciente_id, caminho, nome, tipo, tamanho, data, descricao, origem)
  values (v_paciente, trim(p_caminho),
          coalesce(nullif(trim(p_nome), ''), 'exame'),
          coalesce(nullif(trim(p_tipo), ''), 'application/pdf'),
          greatest(coalesce(p_tamanho, 0), 0),
          p_data, nullif(trim(p_descricao), ''), v_origem)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function registrar_exame(uuid, text, text, text, bigint, date, text) to authenticated;

/** Os exames de uma paciente, para a nutricionista. */
create or replace function exames_do_paciente(p_paciente uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê os exames pela ficha.' using errcode = '42501';
  end if;
  if not exists (select 1 from pacientes where id = p_paciente) then
    raise exception 'Paciente não encontrada.' using errcode = '22023';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', e.id, 'caminho', e.caminho, 'nome', e.nome, 'tipo', e.tipo,
      'tamanho', e.tamanho, 'data', e.data, 'descricao', e.descricao,
      'origem', e.origem, 'criadoEm', e.criado_em)
    -- Pela data DO EXAME; sem data, pelo envio. Exame de janeiro enviado
    -- hoje pertence a janeiro na leitura clínica.
    order by coalesce(e.data, e.criado_em::date) desc, e.criado_em desc)
    from exames e where e.paciente_id = p_paciente
  ), '[]'::jsonb);
end;
$$;

revoke all on function exames_do_paciente(uuid) from anon, public;
grant execute on function exames_do_paciente(uuid) to authenticated;

/** Os meus exames, para a paciente. */
create or replace function meus_exames()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
begin
  v_paciente := meu_paciente_id();
  if v_paciente is null or not tem_acesso() then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', e.id, 'caminho', e.caminho, 'nome', e.nome, 'tipo', e.tipo,
      'tamanho', e.tamanho, 'data', e.data, 'descricao', e.descricao,
      'origem', e.origem, 'criadoEm', e.criado_em)
    order by coalesce(e.data, e.criado_em::date) desc, e.criado_em desc)
    from exames e where e.paciente_id = v_paciente
  ), '[]'::jsonb);
end;
$$;

grant execute on function meus_exames() to authenticated;

/**
 * Apaga um exame.
 *
 * Devolve o CAMINHO, para a tela apagar o arquivo do balde em seguida.
 * Apagar só a linha deixaria o arquivo órfão ocupando espaço para sempre —
 * e num plano de 1 GB isso se acumula em silêncio.
 */
create or replace function apagar_exame(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caminho text;
  v_origem text;
  v_paciente uuid;
begin
  select caminho, origem, paciente_id into v_caminho, v_origem, v_paciente
    from exames where id = p_id;
  if v_caminho is null then
    raise exception 'Exame não encontrado.' using errcode = '22023';
  end if;

  if e_admin() then
    delete from exames where id = p_id;
    return v_caminho;
  end if;

  -- A paciente apaga o que ELA mandou, e só. O que a nutricionista guardou
  -- é registro clínico.
  if v_paciente = meu_paciente_id() and v_origem = 'paciente' then
    delete from exames where id = p_id;
    return v_caminho;
  end if;

  raise exception 'Você não pode apagar este arquivo.' using errcode = '42501';
end;
$$;

grant execute on function apagar_exame(uuid) to authenticated;

/**
 * Quanto espaço os exames ocupam.
 *
 * O plano grátis tem 1 GB. Sem este número, o dia em que acabar chega sem
 * aviso — e o sintoma é envio que falha, não uma mensagem dizendo o motivo.
 */
create or replace function espaco_dos_exames()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê o espaço.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'arquivos', (select count(*) from exames),
    'bytes', coalesce((select sum(tamanho) from exames), 0),
    'pacientesComExame', (select count(distinct paciente_id) from exames));
end;
$$;

revoke all on function espaco_dos_exames() from anon, public;
grant execute on function espaco_dos_exames() to authenticated;

/**
 * A pasta da própria paciente dentro do balde.
 *
 * O envio acontece do navegador direto para o balde, então a tela precisa
 * saber para qual pasta mandar. Devolver o próprio id não abre nada: é o id
 * DELA, e quem tranca é a política do balde, que confere a pasta de novo —
 * mandar para a pasta de outra pessoa é recusado ali, e `registrar_exame`
 * confere uma terceira vez.
 *
 * Existe como função separada, e não como campo novo em `meu_acesso()`,
 * porque `meu_acesso()` é chamada em toda tela e mexer nela para servir a
 * um módulo só seria carregar o peso em todas.
 */
create or replace function minha_pasta_de_exames()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case when tem_acesso() then meu_paciente_id()::text else null end;
$$;

grant execute on function minha_pasta_de_exames() to authenticated;
