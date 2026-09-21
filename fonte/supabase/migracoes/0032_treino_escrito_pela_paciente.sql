-- =============================================================================
-- CENTRAL DO PACIENTE — 0032: o treino também pode ser escrito pela paciente
--
-- "Eu escrevo lá dentro o treino do paciente. Ou então ele mesmo pode
-- escrever, não precisa ser eu."
--
-- A 0030 já deixava a NUTRICIONISTA escrever o plano. O que faltava era a
-- outra metade: a paciente que treina por conta própria, ou que recebeu o
-- treino de um personal de fora, poder digitar o dela — sem depender de
-- ninguém, sem anexar arquivo, sem pesar um quilobyte a mais no site.
--
-- O QUE **NÃO** MUDA, E É O PONTO DELICADO DESTA MIGRAÇÃO
--
-- "Não pode editar o treino prescrito pelo profissional." Continua valendo,
-- literalmente. O que a paciente ganha é escrever um treino PRÓPRIO, marcado
-- como próprio, e nunca encostar num que tenha vindo da nutricionista.
--
-- Por isso a coluna `origem`: sem ela, "treino da paciente" e "treino da
-- profissional" seriam a mesma linha, e a única forma de distinguir seria
-- adivinhar pelo texto. Uma permissão que depende de adivinhação não é uma
-- permissão.
--
-- A RLS DE ESCRITA NÃO FOI AFROUXADA. Nenhuma política nova de insert ou
-- update para a paciente: ela continua sem poder escrever direto na tabela.
-- Toda escrita passa por `salvar_treino`, que é onde a regra mora e onde ela
-- pode ser testada. Afrouxar a RLS *e* a função daria dois caminhos para a
-- mesma porta, e o dia em que eles discordassem o errado seria o silencioso.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Quem escreveu
-- -----------------------------------------------------------------------------

alter table treinos
  add column if not exists origem text not null default 'nutricionista';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'treinos_origem_conhecida') then
    alter table treinos add constraint treinos_origem_conhecida
      check (origem in ('nutricionista', 'paciente'));
  end if;
end $$;

-- `default 'nutricionista'` e não 'paciente': todo treino que já existe no
-- banco foi escrito por ela, na tela dela. Um default errado aqui tornaria
-- editável, de uma vez só, todo plano que ela já prescreveu.

-- -----------------------------------------------------------------------------
-- Leitura: ela passa a enxergar o treino próprio mesmo desativado
-- -----------------------------------------------------------------------------

-- O plano que a paciente escreveu é dado DELA. Quando a nutricionista manda
-- um treino e ele vira o ativo, o da paciente é desativado pela regra de "um
-- ativo por paciente" — e, com a política antiga, sumiria da tela sem aviso,
-- como se tivesse sido apagado. Ela escreveu; continua podendo ver.
--
-- Isto não abre nada: a condição de dono (`meu_paciente_id()`) é a mesma. O
-- treino INATIVO da nutricionista continua escondido, que é o comportamento
-- que a bateria já cobrava.
drop policy if exists treinos_paciente on treinos;
create policy treinos_paciente on treinos for select
  using (paciente_id = meu_paciente_id() and (ativo or origem = 'paciente'));

drop policy if exists exercicios_paciente on treino_exercicios;
create policy exercicios_paciente on treino_exercicios for select
  using (exists (select 1 from treinos t
                 where t.id = treino_id
                   and t.paciente_id = meu_paciente_id()
                   and (t.ativo or t.origem = 'paciente')));

-- -----------------------------------------------------------------------------
-- `meu_treino()` passa a dizer de quem é o treino e se ela pode mexer
-- -----------------------------------------------------------------------------

/**
 * O treino ativo da paciente, com os exercícios em ordem. Nulo se não há.
 *
 * `podeEditar` vem do banco, e não da tela. A tela usa para decidir se mostra
 * o lápis; mas quem recusa a gravação é `salvar_treino`. Se a regra morasse
 * só no JavaScript, bastaria abrir o console para editar o plano prescrito.
 */
create or replace function meu_treino()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
  v_treino treinos;
begin
  v_paciente := meu_paciente_id();
  if v_paciente is null then return null; end if;

  select * into v_treino from treinos
  where paciente_id = v_paciente and ativo
  order by atualizado_em desc limit 1;

  -- Sem treino ativo, mas com um próprio guardado: é o dela, é o que ela vê.
  -- Acontece quando a nutricionista apaga o plano que tinha mandado.
  if v_treino.id is null then
    select * into v_treino from treinos
    where paciente_id = v_paciente and origem = 'paciente'
    order by atualizado_em desc limit 1;
  end if;

  if v_treino.id is null then return null; end if;

  return jsonb_build_object(
    'id', v_treino.id,
    'nome', v_treino.nome,
    'observacao', v_treino.observacao,
    'origem', v_treino.origem,
    'podeEditar', v_treino.origem = 'paciente',
    'exercicios', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', e.id, 'nome', e.nome, 'ordem', e.ordem,
               'seriesPlanejadas', e.series_planejadas,
               'repeticoesMin', e.repeticoes_min,
               'repeticoesMax', e.repeticoes_max,
               'observacao', e.observacao) order by e.ordem, e.criado_em)
      from treino_exercicios e where e.treino_id = v_treino.id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function meu_treino() from anon, public;
grant execute on function meu_treino() to authenticated;

/**
 * Se a paciente pode escrever um treino AGORA, e por quê não quando não pode.
 *
 * Uma função só, usada pela tela e pela gravação, para que o botão e a regra
 * não possam discordar: o dia em que a tela achar que pode e o banco achar
 * que não, quem escreve dez minutos de treino perde os dez minutos.
 */
create or replace function posso_escrever_treino()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_paciente uuid;
  v_da_nutri treinos;
  v_meu treinos;
begin
  v_paciente := meu_paciente_id();
  if v_paciente is null then
    return jsonb_build_object('pode', false, 'motivo', 'sem_cadastro');
  end if;

  select * into v_da_nutri from treinos
  where paciente_id = v_paciente and ativo and origem = 'nutricionista' limit 1;

  select * into v_meu from treinos
  where paciente_id = v_paciente and origem = 'paciente'
  order by atualizado_em desc limit 1;

  -- Com plano da profissional no ar, a paciente não escreve por cima nem ao
  -- lado. Dois planos ativos ao mesmo tempo fariam a tela de registro
  -- oferecer duas listas de exercício, e a evolução compararia sessões de
  -- treinos diferentes como se fossem o mesmo.
  if v_da_nutri.id is not null then
    return jsonb_build_object(
      'pode', false,
      'motivo', 'treino_da_nutricionista',
      'meuTreinoId', v_meu.id);
  end if;

  return jsonb_build_object('pode', true, 'motivo', null, 'meuTreinoId', v_meu.id);
end;
$$;

revoke all on function posso_escrever_treino() from anon, public;
grant execute on function posso_escrever_treino() to authenticated;

-- -----------------------------------------------------------------------------
-- Escrita
-- -----------------------------------------------------------------------------

/**
 * Grava o plano inteiro de uma vez: o treino e os exercícios dele.
 *
 * Agora com DOIS chamadores possíveis, e as regras de cada um separadas na
 * cara, porque é aqui que um descuido vira paciente editando prescrição:
 *
 *   NUTRICIONISTA — escreve para qualquer paciente, qualquer treino. É a
 *   profissional; o plano é o ofício dela.
 *
 *   PACIENTE — escreve só para si (`p_paciente` é IGNORADO, senão bastaria
 *   mandar o id de outra), só treino com `origem = 'paciente'`, e só
 *   enquanto não houver plano ativo da nutricionista.
 */
create or replace function salvar_treino(
  p_id uuid,
  p_paciente uuid,
  p_nome text,
  p_observacao text,
  p_ativo boolean,
  p_exercicios jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin boolean;
  v_paciente uuid;
  v_origem text;
  v_ativo boolean;
  v_id uuid;
  v_item jsonb;
  v_ordem integer := 0;
  v_alvo treinos;
begin
  v_admin := e_admin();

  if v_admin then
    v_paciente := p_paciente;
    v_origem := 'nutricionista';
    v_ativo := coalesce(p_ativo, false);
  else
    -- O id que veio da tela não é consultado em nenhum momento.
    v_paciente := meu_paciente_id();
    v_origem := 'paciente';
    -- O treino que ela escreve é para usar hoje; nascer desativado faria a
    -- tela de registro não achar exercício nenhum logo depois de salvar.
    v_ativo := true;

    if v_paciente is null then
      raise exception 'Sem cadastro de paciente.' using errcode = '42501';
    end if;

    if exists (select 1 from treinos
               where paciente_id = v_paciente and ativo and origem = 'nutricionista') then
      raise exception 'Sua nutricionista enviou um treino; ele não pode ser alterado aqui.'
        using errcode = '42501';
    end if;

    if p_id is not null then
      select * into v_alvo from treinos where id = p_id;
      -- Treino de outra pessoa e treino da nutricionista dão o MESMO erro e a
      -- MESMA mensagem: responder "esse não é seu" para um id e "esse é da
      -- nutricionista" para outro contaria, id a id, o que existe no banco.
      if v_alvo.id is null
         or v_alvo.paciente_id <> v_paciente
         or v_alvo.origem <> 'paciente' then
        raise exception 'Este treino não pode ser alterado aqui.' using errcode = '42501';
      end if;
    end if;
  end if;

  if v_paciente is null then
    raise exception 'Paciente não informado.' using errcode = 'P0002';
  end if;
  if not exists (select 1 from pacientes where id = v_paciente) then
    raise exception 'Paciente não encontrado.' using errcode = 'P0002';
  end if;
  if p_exercicios is null or jsonb_typeof(p_exercicios) <> 'array' then
    raise exception 'Os exercícios precisam ser uma lista.' using errcode = '22023';
  end if;

  if p_id is null then
    insert into treinos (paciente_id, nome, observacao, ativo, origem)
    values (v_paciente, coalesce(nullif(btrim(p_nome), ''), 'Treino'),
            nullif(btrim(coalesce(p_observacao, '')), ''), v_ativo, v_origem)
    returning id into v_id;
  else
    update treinos
    set nome = coalesce(nullif(btrim(p_nome), ''), nome),
        observacao = nullif(btrim(coalesce(p_observacao, '')), ''),
        ativo = case when v_admin then coalesce(p_ativo, ativo) else true end,
        atualizado_em = now()
    where id = p_id and paciente_id = v_paciente
    returning id into v_id;
    if v_id is null then
      raise exception 'Treino não encontrado.' using errcode = 'P0002';
    end if;
  end if;

  -- Um treino ativo por paciente. Dois ativos fariam a tela dela escolher
  -- um dos dois em silêncio, e o outro nunca apareceria.
  --
  -- Salvando pela paciente, a desativação alcança SÓ os treinos próprios. A
  -- checagem acima já garante que não há plano ativo da nutricionista, então
  -- este filtro não muda nenhum resultado hoje — ele existe para que, no dia
  -- em que aquela checagem mudar, o pior caso seja um treino duplicado da
  -- paciente, e não o plano da profissional desligado por ela.
  if v_ativo then
    update treinos set ativo = false
    where paciente_id = v_paciente
      and id <> v_id
      and (v_admin or origem = 'paciente');
  end if;

  delete from treino_exercicios where treino_id = v_id;
  for v_item in select * from jsonb_array_elements(p_exercicios) loop
    if btrim(coalesce(v_item ->> 'nome', '')) = '' then continue; end if;
    insert into treino_exercicios
      (treino_id, nome, ordem, series_planejadas, repeticoes_min, repeticoes_max, observacao)
    values (
      v_id, btrim(v_item ->> 'nome'), v_ordem,
      nullif(v_item ->> 'seriesPlanejadas', '')::integer,
      nullif(v_item ->> 'repeticoesMin', '')::integer,
      nullif(v_item ->> 'repeticoesMax', '')::integer,
      nullif(btrim(coalesce(v_item ->> 'observacao', '')), '')
    );
    v_ordem := v_ordem + 1;
  end loop;

  return jsonb_build_object('id', v_id, 'origem', v_origem);
end;
$$;

revoke all on function salvar_treino(uuid, uuid, text, text, boolean, jsonb) from anon, public;
grant execute on function salvar_treino(uuid, uuid, text, text, boolean, jsonb) to authenticated;

/** Apagar: a nutricionista, qualquer um; a paciente, só o que ela escreveu. */
create or replace function excluir_treino(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alvo treinos;
begin
  if e_admin() then
    delete from treinos where id = p_id;
    return;
  end if;

  select * into v_alvo from treinos where id = p_id;
  if v_alvo.id is null
     or v_alvo.paciente_id is distinct from meu_paciente_id()
     or v_alvo.origem <> 'paciente' then
    raise exception 'Este treino não pode ser apagado aqui.' using errcode = '42501';
  end if;

  delete from treinos where id = p_id;
end;
$$;

revoke all on function excluir_treino(uuid) from anon, public;
grant execute on function excluir_treino(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- A nutricionista enxerga de quem é cada plano
-- -----------------------------------------------------------------------------

/**
 * Os treinos de uma paciente, agora com `origem`.
 *
 * Sem isso, ela abriria a tela e veria um treino que não se lembra de ter
 * escrito, sem nada na tela explicando de onde veio.
 */
create or replace function treinos_do_paciente(p_paciente uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not e_admin() then
    raise exception 'Só a nutricionista vê os treinos.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', t.id, 'nome', t.nome, 'observacao', t.observacao, 'ativo', t.ativo,
             'origem', t.origem,
             'exercicios', coalesce((
               select jsonb_agg(jsonb_build_object(
                        'id', e.id, 'nome', e.nome, 'ordem', e.ordem,
                        'seriesPlanejadas', e.series_planejadas,
                        'repeticoesMin', e.repeticoes_min,
                        'repeticoesMax', e.repeticoes_max,
                        'observacao', e.observacao) order by e.ordem, e.criado_em)
               from treino_exercicios e where e.treino_id = t.id
             ), '[]'::jsonb))
           order by t.ativo desc, t.atualizado_em desc)
    from treinos t where t.paciente_id = p_paciente
  ), '[]'::jsonb);
end;
$$;

revoke all on function treinos_do_paciente(uuid) from anon, public;
grant execute on function treinos_do_paciente(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- A porta do treino fica sempre aberta
-- -----------------------------------------------------------------------------

/**
 * Antes: "tem treino?" — e quem não tinha plano nem sessão não via o atalho.
 * Isso agora é uma porta trancada por dentro: a paciente que poderia escrever
 * o próprio treino nunca chegaria à tela onde se escreve.
 *
 * Quem tem cadastro de paciente tem a tela. Quem não tem, não — e continua
 * sendo `meu_paciente_id()` quem responde isso.
 */
create or replace function tenho_treino()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select meu_paciente_id() is not null;
$$;

revoke all on function tenho_treino() from anon, public;
grant execute on function tenho_treino() to authenticated;
