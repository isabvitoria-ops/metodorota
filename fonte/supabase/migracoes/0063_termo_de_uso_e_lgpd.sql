-- =============================================================================
-- 0063 — Termo de uso e privacidade (LGPD): aceite, cópia dos dados e exclusão
--
-- O app guarda dado de saúde, que a LGPD trata como dado SENSÍVEL. Faltavam
-- três coisas, todas pequenas:
--
--   1. o ACEITE: a paciente lê o termo e aceita no primeiro acesso, e fica
--      registrado QUAL texto ela aceitou e quando. Mudou o texto, sobe a
--      versão e todas aceitam de novo;
--   2. a CÓPIA: a paciente baixa os dados dela; a nutricionista baixa a ficha
--      completa (inclui as anotações clínicas, que são da profissional);
--   3. a EXCLUSÃO a pedido: a paciente pede, a nutricionista vê o pedido e
--      apaga pela ficha (a exclusão em si já existia).
--
-- E uma quarta coisa, do mesmo gesto de "primeira entrada": as BOAS-VINDAS. Na
-- primeira vez que a paciente entra, o app ensina a colocar o site na tela
-- inicial do celular. Aparece UMA vez só, e o registro mora no banco (e não no
-- aparelho), para não reaparecer se ela trocar de telefone ou limpar o navegador.
--
-- O TEXTO MORA NUMA TABELA PRÓPRIA, e não em `configuracoes`, por dois motivos:
--   * `configuracoes` só é lida por quem entrou; a página de privacidade tem
--     que abrir ANTES do login (a paciente lê o termo antes de aceitar);
--   * cada versão fica guardada. "O que ela aceitou em março" é uma pergunta
--     que o texto atual não responde.
-- Escrever na tabela só pelo `publicar_termo`, que sobe a versão sozinho.
-- =============================================================================

create table if not exists termo_de_uso (
  versao integer primary key check (versao > 0),
  texto text not null check (length(trim(texto)) >= 200),
  publicado_em timestamptz not null default now(),
  publicado_por uuid
);

comment on table termo_de_uso is
  'Cada versão do termo de uso e privacidade. A atual é a de maior número. Nunca se edita uma versão: publica-se outra.';

alter table termo_de_uso enable row level security;
revoke all on termo_de_uso from anon, authenticated;
-- Leitura aberta de propósito: é um texto público, e ele precisa abrir antes do login.
grant select on termo_de_uso to anon, authenticated;
drop policy if exists termo_leitura on termo_de_uso;
create policy termo_leitura on termo_de_uso for select to anon, authenticated using (true);

insert into termo_de_uso (versao, texto) values (1, btrim($termo$
TERMO DE USO E POLÍTICA DE PRIVACIDADE

Este aplicativo é a ferramenta de acompanhamento nutricional da sua nutricionista. Ao continuar, você concorda com o que está escrito aqui. Se tiver qualquer dúvida, fale com ela pelo WhatsApp que aparece no aplicativo antes de aceitar.

1. Que dados são guardados
Seu cadastro (nome, e-mail, telefone, plano e datas), as informações que você registra (medidas, respostas de questionários, sintomas, fotos de refeições, exames que você envia) e as que a nutricionista registra sobre você (avaliações, metas, protocolo, anotações de consulta). Também ficam registrados o seu acesso ao aplicativo e a sua pontuação no desafio.

2. Para que usamos
Somente para o seu acompanhamento nutricional: montar e ajustar o seu plano, acompanhar a sua evolução e cuidar da sua saúde. Não usamos para propaganda e não vendemos nem cedemos seus dados a ninguém.

3. Por que podemos usar
Porque você consente com este termo e porque são dados necessários para a tutela da sua saúde por profissional da área. Dados de saúde são sensíveis e recebem cuidado especial.

4. Quem vê
A nutricionista responsável vê todos os seus dados. Você vê os seus. Uma paciente nunca vê os dados de outra. Para o aplicativo funcionar, os dados ficam guardados em um serviço de hospedagem seguro (Supabase), que apenas armazena e não os usa para outro fim. Ranking e placar do desafio mostram só o seu primeiro nome e a abreviação do sobrenome.

5. Fotos e exames
Ficam guardados em área privada, que só abre com o seu login ou o da nutricionista. Os endereços de acesso expiram.

6. Por quanto tempo
Durante o seu acompanhamento e depois dele, pelo tempo que as normas da profissão exigem para a guarda do prontuário. Passado esse prazo, os dados podem ser apagados.

7. Os seus direitos
Você pode, a qualquer momento: pedir uma cópia dos seus dados (botão “Baixar meus dados” na página Privacidade e meus dados), corrigir dados errados, pedir a exclusão dos seus dados (botão “Pedir exclusão”) e retirar o seu consentimento. A exclusão pode ser limitada pelo que a lei obriga a profissional a guardar; nesse caso a nutricionista explica o motivo.

8. Segurança
O acesso é por e-mail e senha. A comunicação é criptografada e cada paciente só alcança os próprios dados. Se perceber qualquer problema, avise a nutricionista imediatamente.

9. Mudanças neste texto
Se este termo mudar, o aplicativo mostra o novo texto e pede o seu aceite de novo. Fica registrado qual versão você aceitou e quando.
$termo$, E' \n\r'))
on conflict (versao) do nothing;

-- O aceite ---------------------------------------------------------------------
create table if not exists aceites_do_termo (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references perfis (id) on delete cascade,
  paciente_id uuid references pacientes (id) on delete set null,
  versao integer not null references termo_de_uso (versao),
  aceito_em timestamptz not null default now(),
  unique (perfil_id, versao)
);

comment on table aceites_do_termo is
  'Quem aceitou qual versão do termo, e quando. Só se grava pela função aceitar_termo.';

alter table aceites_do_termo enable row level security;
revoke all on aceites_do_termo from anon, authenticated;
grant select on aceites_do_termo to authenticated;
drop policy if exists aceites_leitura on aceites_do_termo;
create policy aceites_leitura on aceites_do_termo for select to authenticated
  using (e_admin() or perfil_id = auth.uid());

-- As boas-vindas ---------------------------------------------------------------
create table if not exists boas_vindas_vistas (
  perfil_id uuid primary key references perfis (id) on delete cascade,
  visto_em timestamptz not null default now()
);

alter table boas_vindas_vistas enable row level security;
revoke all on boas_vindas_vistas from anon, authenticated;
grant select on boas_vindas_vistas to authenticated;
drop policy if exists boas_vindas_leitura on boas_vindas_vistas;
create policy boas_vindas_leitura on boas_vindas_vistas for select to authenticated
  using (e_admin() or perfil_id = auth.uid());

create or replace function concluir_boas_vindas()
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Entre na sua conta.' using errcode = '42501';
  end if;
  insert into boas_vindas_vistas (perfil_id) values (auth.uid()) on conflict (perfil_id) do nothing;
end;
$$;

revoke all on function concluir_boas_vindas() from public, anon;
grant execute on function concluir_boas_vindas() to authenticated;

create or replace function versao_do_termo() returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(max(versao), 0) from termo_de_uso $$;

revoke all on function versao_do_termo() from public, anon;
grant execute on function versao_do_termo() to authenticated;

/** O estado do aceite de quem está usando: a nutricionista nunca fica pendente. */
create or replace function meu_termo()
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'versao', versao_do_termo(),
    'aceito', e_admin() or exists (
      select 1 from aceites_do_termo a
       where a.perfil_id = auth.uid() and a.versao = versao_do_termo()),
    'aceitoEm', (select a.aceito_em from aceites_do_termo a
                  where a.perfil_id = auth.uid() and a.versao = versao_do_termo()),
    -- A nutricionista nunca vê as boas-vindas.
    'boasVindasVistas', e_admin() or exists (
      select 1 from boas_vindas_vistas b where b.perfil_id = auth.uid())
  )
$$;

revoke all on function meu_termo() from public, anon;
grant execute on function meu_termo() to authenticated;

create or replace function aceitar_termo(p_versao integer)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Entre na sua conta para aceitar.' using errcode = '42501';
  end if;
  if p_versao is distinct from versao_do_termo() then
    raise exception 'O texto do termo mudou. Recarregue a página e leia de novo.' using errcode = '22023';
  end if;
  insert into aceites_do_termo (perfil_id, paciente_id, versao)
  values (auth.uid(), meu_paciente_id(), p_versao)
  on conflict (perfil_id, versao) do nothing;
  return meu_termo();
end;
$$;

revoke all on function aceitar_termo(integer) from public, anon;
grant execute on function aceitar_termo(integer) to authenticated;

/** A nutricionista publica uma versão nova. Texto igual ao atual não sobe versão. */
create or replace function publicar_termo(p_texto text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_atual text;
  v_nova integer;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista publica o termo.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_texto, ''))) < 200 then
    raise exception 'O termo precisa ter pelo menos algumas frases (200 letras).' using errcode = '22023';
  end if;
  select texto into v_atual from termo_de_uso order by versao desc limit 1;
  if trim(v_atual) is not distinct from trim(p_texto) then
    return jsonb_build_object('versao', versao_do_termo(), 'mudou', false);
  end if;
  v_nova := versao_do_termo() + 1;
  insert into termo_de_uso (versao, texto, publicado_por) values (v_nova, trim(p_texto), auth.uid());
  return jsonb_build_object('versao', v_nova, 'mudou', true);
end;
$$;

revoke all on function publicar_termo(text) from public, anon;
grant execute on function publicar_termo(text) to authenticated;

/** Quantas pacientes com conta já aceitaram a versão atual. */
create or replace function situacao_dos_aceites()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_aceitaram integer;
  v_total integer;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê os aceites.' using errcode = '42501';
  end if;
  select count(*) into v_total from pacientes where perfil_id is not null;
  select count(*) into v_aceitaram
    from pacientes p
   where p.perfil_id is not null
     and exists (select 1 from aceites_do_termo a
                  where a.perfil_id = p.perfil_id and a.versao = versao_do_termo());
  return jsonb_build_object('versao', versao_do_termo(), 'aceitaram', v_aceitaram, 'comConta', v_total,
                            'pendentes', v_total - v_aceitaram);
end;
$$;

revoke all on function situacao_dos_aceites() from public, anon;
grant execute on function situacao_dos_aceites() to authenticated;

-- A cópia dos dados ----------------------------------------------------------------
/**
 * A cópia que a PACIENTE baixa: o que ela registra e o que ela vê. As anotações
 * clínicas da profissional, as condutas e a base de conhecimento ficam de fora
 * (são o trabalho dela, não registro da paciente); a nutricionista entrega a
 * ficha completa se a paciente pedir formalmente (exportar_ficha_completa).
 */
create or replace function exportar_meus_dados()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_id uuid := meu_paciente_id();
  v jsonb;
begin
  if v_id is null then
    raise exception 'Sem cadastro de paciente.' using errcode = '42501';
  end if;
  v := jsonb_build_object(
    'geradoEm', now(),
    'cadastro', (select to_jsonb(p) - 'observacoes' - 'perfil_id' from pacientes p where p.id = v_id),
    'aceitesDoTermo', coalesce((select jsonb_agg(to_jsonb(a) - 'perfil_id') from aceites_do_termo a where a.perfil_id = auth.uid()), '[]'::jsonb)
  );
  -- Só as tabelas em que a paciente se reconhece. A lista é explícita de propósito:
  -- tabela nova NÃO entra na cópia sem alguém decidir se ela deve entrar.
  v := v || jsonb_build_object(
    'avaliacoesFisicas', coalesce((select jsonb_agg(to_jsonb(t)) from avaliacoes_fisicas t where t.paciente_id = v_id), '[]'::jsonb),
    'cardio', coalesce((select jsonb_agg(to_jsonb(t)) from cardio_sessoes t where t.paciente_id = v_id), '[]'::jsonb),
    'treinos', coalesce((select jsonb_agg(to_jsonb(t)) from treinos t where t.paciente_id = v_id), '[]'::jsonb),
    'sessoesDeTreino', coalesce((select jsonb_agg(to_jsonb(t)) from treino_sessoes t where t.paciente_id = v_id), '[]'::jsonb),
    'metas', coalesce((select jsonb_agg(to_jsonb(t)) from metas t where t.paciente_id = v_id), '[]'::jsonb),
    'metasSemanais', coalesce((select jsonb_agg(to_jsonb(t)) from metas_semanais t where t.paciente_id = v_id), '[]'::jsonb),
    'protocolos', coalesce((select jsonb_agg(to_jsonb(t)) from protocolos t where t.paciente_id = v_id), '[]'::jsonb),
    'exames', coalesce((select jsonb_agg(to_jsonb(t)) from exames t where t.paciente_id = v_id), '[]'::jsonb),
    'diarioDeFotos', coalesce((select jsonb_agg(to_jsonb(t)) from diario_fotos t where t.paciente_id = v_id), '[]'::jsonb),
    'mensagensPorRefeicao', coalesce((select jsonb_agg(to_jsonb(t)) from mensagens_refeicao t where t.paciente_id = v_id), '[]'::jsonb),
    'questionarios', coalesce((select jsonb_agg(to_jsonb(t)) from questionario_envios t where t.paciente_id = v_id), '[]'::jsonb),
    'rastreabilidade', coalesce((select jsonb_agg(to_jsonb(t)) from reintroducao_registros t where t.paciente_id = v_id), '[]'::jsonb),
    'pontos', coalesce((select jsonb_agg(to_jsonb(t)) from pontos_lancamentos t where t.paciente_id = v_id), '[]'::jsonb),
    'acoesDoDesafio', coalesce((select jsonb_agg(to_jsonb(t)) from desafio_envios t where t.paciente_id = v_id), '[]'::jsonb),
    'cobrancas', coalesce((select jsonb_agg(to_jsonb(t)) from cobrancas t where t.paciente_id = v_id), '[]'::jsonb),
    'recebimentos', coalesce((select jsonb_agg(to_jsonb(t)) from recebimentos t where t.paciente_id = v_id), '[]'::jsonb)
  );
  return v;
end;
$$;

revoke all on function exportar_meus_dados() from public, anon;
grant execute on function exportar_meus_dados() to authenticated;

/**
 * A ficha COMPLETA, para a nutricionista entregar a pedido formal da paciente
 * ou levar para outro lugar. Percorre toda tabela que tem `paciente_id`: tabela
 * nova entra sozinha, para a cópia não ficar incompleta sem ninguém notar.
 */
create or replace function exportar_ficha_completa(p_paciente uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v jsonb;
  t record;
  linhas jsonb;
begin
  if not e_admin() then
    raise exception 'Só a nutricionista exporta a ficha completa.' using errcode = '42501';
  end if;
  select to_jsonb(p) into v from pacientes p where p.id = p_paciente;
  if v is null then
    raise exception 'Paciente não encontrada.' using errcode = '22023';
  end if;
  v := jsonb_build_object('geradoEm', now(), 'cadastro', v);
  for t in
    select c.table_name
      from information_schema.columns c
      join information_schema.tables tb
        on tb.table_schema = c.table_schema and tb.table_name = c.table_name and tb.table_type = 'BASE TABLE'
     where c.table_schema = 'public' and c.column_name = 'paciente_id'
     order by c.table_name
  loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from public.%I x where x.paciente_id = $1', t.table_name)
      into linhas using p_paciente;
    v := v || jsonb_build_object(t.table_name, linhas);
  end loop;
  v := v || jsonb_build_object(
    'indicacoesFeitas', coalesce((select jsonb_agg(to_jsonb(i)) from indicacoes i where i.paciente_indicadora_id = p_paciente), '[]'::jsonb),
    'aceitesDoTermo', coalesce((select jsonb_agg(to_jsonb(a)) from aceites_do_termo a where a.paciente_id = p_paciente), '[]'::jsonb)
  );
  return v;
end;
$$;

revoke all on function exportar_ficha_completa(uuid) from public, anon;
grant execute on function exportar_ficha_completa(uuid) to authenticated;

-- O pedido de exclusão ----------------------------------------------------------------
create table if not exists pedidos_lgpd (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid references pacientes (id) on delete set null,
  -- Fica guardado mesmo depois de a ficha ser apagada: é o registro de que o pedido existiu.
  paciente_nome text not null,
  tipo text not null default 'exclusao' check (tipo in ('exclusao')),
  motivo text,
  criado_em timestamptz not null default now(),
  atendido_em timestamptz,
  atendido_por uuid
);

alter table pedidos_lgpd enable row level security;
revoke all on pedidos_lgpd from anon, authenticated;
grant select on pedidos_lgpd to authenticated;
drop policy if exists pedidos_lgpd_leitura on pedidos_lgpd;
create policy pedidos_lgpd_leitura on pedidos_lgpd for select to authenticated
  using (e_admin() or paciente_id = meu_paciente_id());

create or replace function pedir_exclusao_dos_meus_dados(p_motivo text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := meu_paciente_id();
  v_pedido uuid;
begin
  if v_id is null then
    raise exception 'Sem cadastro de paciente.' using errcode = '42501';
  end if;
  -- Um pedido em aberto por vez: apertar o botão duas vezes não duplica.
  select id into v_pedido from pedidos_lgpd where paciente_id = v_id and atendido_em is null limit 1;
  if v_pedido is not null then
    return v_pedido;
  end if;
  insert into pedidos_lgpd (paciente_id, paciente_nome, motivo)
  values (v_id, (select nome from pacientes where id = v_id), nullif(trim(coalesce(p_motivo, '')), ''))
  returning id into v_pedido;
  insert into historico_admin (paciente_id, ator_perfil_id, evento, detalhe)
  values (v_id, auth.uid(), 'pedido_exclusao_lgpd', jsonb_build_object('pedido', v_pedido));
  return v_pedido;
end;
$$;

revoke all on function pedir_exclusao_dos_meus_dados(text) from public, anon;
grant execute on function pedir_exclusao_dos_meus_dados(text) to authenticated;

/** A nutricionista marca o pedido como atendido (depois de apagar a ficha, ou de explicar por que guarda). */
create or replace function atender_pedido_lgpd(p_pedido uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista atende o pedido.' using errcode = '42501';
  end if;
  update pedidos_lgpd set atendido_em = now(), atendido_por = auth.uid()
   where id = p_pedido and atendido_em is null;
end;
$$;

revoke all on function atender_pedido_lgpd(uuid) from public, anon;
grant execute on function atender_pedido_lgpd(uuid) to authenticated;
