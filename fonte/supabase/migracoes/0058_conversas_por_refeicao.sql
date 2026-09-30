-- =============================================================================
-- 0058 — Conversa por refeição
--
-- Cada refeição do plano ganha a sua própria conversa, entre a paciente e a
-- nutricionista. "Me deu inchaço no jantar" fica NO jantar, e não perdido num
-- chat geral misturado com o resto.
--
-- A CHAVE DA CONVERSA é (paciente, nome da refeição), sem diferenciar maiúscula
-- de minúscula. O protocolo não dá id às refeições — elas são texto que ela
-- escreve — então o nome é o que existe. Consequência que vale saber: se ela
-- RENOMEAR uma refeição no protocolo, a conversa antiga fica guardada com o
-- nome de antes (nada se perde), mas a refeição renomeada começa uma conversa
-- nova.
--
-- Só as duas pontas leem: a paciente lê e escreve na PRÓPRIA conversa, a
-- nutricionista em qualquer uma. Outra paciente não alcança nada. Não há
-- edição nem apagamento: o que foi dito fica dito.
-- =============================================================================

create table if not exists mensagens_refeicao (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes (id) on delete cascade,
  refeicao text not null check (char_length(btrim(refeicao)) between 1 and 80),
  autor text not null check (autor in ('paciente', 'nutri')),
  texto text not null check (char_length(btrim(texto)) between 1 and 1000),
  criado_em timestamptz not null default now(),
  -- Quando a OUTRA ponta abriu a conversa e viu esta mensagem.
  lida_em timestamptz
);

comment on table mensagens_refeicao is
  'Conversa paciente x nutricionista, uma por refeição do plano. Chave: paciente + nome da refeição (sem diferenciar maiúscula).';

create index if not exists mensagens_refeicao_conversa
  on mensagens_refeicao (paciente_id, (lower(btrim(refeicao))), criado_em);

alter table mensagens_refeicao enable row level security;
revoke all on mensagens_refeicao from anon;
grant select, insert on mensagens_refeicao to authenticated;

drop policy if exists mensagens_refeicao_admin on mensagens_refeicao;
create policy mensagens_refeicao_admin on mensagens_refeicao
  for all using (e_admin()) with check (e_admin());

drop policy if exists mensagens_refeicao_paciente_le on mensagens_refeicao;
create policy mensagens_refeicao_paciente_le on mensagens_refeicao
  for select using (paciente_id = meu_paciente_id());

-- Ela escreve só para si mesma e só assinando como paciente: sem o
-- `autor = 'paciente'` no `with check`, uma mensagem poderia se passar por
-- resposta da nutricionista.
drop policy if exists mensagens_refeicao_paciente_escreve on mensagens_refeicao;
create policy mensagens_refeicao_paciente_escreve on mensagens_refeicao
  for insert with check (
    paciente_id = meu_paciente_id()
    and autor = 'paciente'
    and tem_acesso()
  );

/**
 * Envia uma mensagem. A nutricionista informa a paciente; a paciente NÃO: o id
 * que vem da tela é ignorado quando é ela quem escreve, e a mensagem sempre
 * vai para a conversa dela mesma.
 */
create or replace function enviar_mensagem_refeicao(p_paciente uuid, p_refeicao text, p_texto text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
  v_autor text;
  v_refeicao text := btrim(coalesce(p_refeicao, ''));
  v_texto text := btrim(coalesce(p_texto, ''));
  v_id uuid;
begin
  if e_admin() and p_paciente is not null then
    if not exists (select 1 from pacientes where id = p_paciente) then
      raise exception 'Paciente não encontrada.' using errcode = '22023';
    end if;
    v_paciente := p_paciente;
    v_autor := 'nutri';
  else
    if not tem_acesso() then
      raise exception 'Seu acesso não está liberado.' using errcode = '42501';
    end if;
    v_paciente := meu_paciente_id();
    if v_paciente is null then
      raise exception 'Não encontrei o seu cadastro.' using errcode = '42501';
    end if;
    v_autor := 'paciente';
  end if;

  if char_length(v_refeicao) not between 1 and 80 then
    raise exception 'Faltou dizer de qual refeição é a conversa.' using errcode = '22023';
  end if;
  if char_length(v_texto) = 0 then
    raise exception 'Escreva a mensagem.' using errcode = '22023';
  end if;
  if char_length(v_texto) > 1000 then
    raise exception 'A mensagem passou de 1000 letras. Divida em duas.' using errcode = '22023';
  end if;

  insert into mensagens_refeicao (paciente_id, refeicao, autor, texto)
  values (v_paciente, v_refeicao, v_autor, v_texto)
  returning id into v_id;
  return v_id;
end;
$$;

/** A conversa de UMA refeição, da mais antiga à mais nova. */
create or replace function conversa_da_refeicao(p_paciente uuid, p_refeicao text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
begin
  if e_admin() and p_paciente is not null then
    v_paciente := p_paciente;
  else
    if not tem_acesso() then
      return '[]'::jsonb;
    end if;
    v_paciente := meu_paciente_id();
  end if;
  if v_paciente is null then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', m.id, 'autor', m.autor, 'texto', m.texto,
      'criadoEm', m.criado_em, 'lida', m.lida_em is not null)
      order by m.criado_em, m.id)
    from mensagens_refeicao m
    where m.paciente_id = v_paciente
      and lower(btrim(m.refeicao)) = lower(btrim(coalesce(p_refeicao, '')))
  ), '[]'::jsonb);
end;
$$;

/**
 * Marca como lidas as mensagens da OUTRA ponta. Quem abre a conversa lê o que
 * o outro escreveu — nunca marca as próprias. Devolve quantas mudaram.
 */
create or replace function marcar_conversa_lida(p_paciente uuid, p_refeicao text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
  v_do_outro text;
  v_n integer;
begin
  if e_admin() and p_paciente is not null then
    v_paciente := p_paciente;
    v_do_outro := 'paciente';
  else
    v_paciente := meu_paciente_id();
    v_do_outro := 'nutri';
  end if;
  if v_paciente is null or (v_do_outro = 'nutri' and not tem_acesso()) then
    return 0;
  end if;

  update mensagens_refeicao
     set lida_em = now()
   where paciente_id = v_paciente
     and autor = v_do_outro
     and lida_em is null
     and lower(btrim(refeicao)) = lower(btrim(coalesce(p_refeicao, '')));
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

/**
 * Uma linha por refeição que já tem conversa: quantas mensagens, quantas ainda
 * não foram lidas por quem está perguntando, e quando foi a última.
 */
create or replace function resumo_das_conversas(p_paciente uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
  v_do_outro text;
begin
  if e_admin() and p_paciente is not null then
    v_paciente := p_paciente;
    v_do_outro := 'paciente';
  else
    if not tem_acesso() then
      return '[]'::jsonb;
    end if;
    v_paciente := meu_paciente_id();
    v_do_outro := 'nutri';
  end if;
  if v_paciente is null then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'refeicao', r.nome, 'total', r.total, 'naoLidas', r.nao_lidas,
      'ultimaEm', r.ultima, 'ultimoAutor', r.ultimo_autor)
      order by r.ultima desc)
    from (
      select
        (array_agg(m.refeicao order by m.criado_em desc))[1] as nome,
        count(*) as total,
        count(*) filter (where m.autor = v_do_outro and m.lida_em is null) as nao_lidas,
        max(m.criado_em) as ultima,
        (array_agg(m.autor order by m.criado_em desc))[1] as ultimo_autor
      from mensagens_refeicao m
      where m.paciente_id = v_paciente
      group by lower(btrim(m.refeicao))
    ) r
  ), '[]'::jsonb);
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'enviar_mensagem_refeicao(uuid, text, text)', 'conversa_da_refeicao(uuid, text)',
    'marcar_conversa_lida(uuid, text)', 'resumo_das_conversas(uuid)'] loop
    execute format('revoke all on function %s from anon, public', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
