-- 0103 — Quem esfriou (lote 3 da auditoria; regras dela em 23/11/2026).
--
-- No topo de Pacientes, quem deu sinal de que está se afastando. Os
-- motivos, como ela decidiu:
-- (1 e 2 só para quem está com acesso: quem saiu não tem o que responder.)
--   1. check-in com PRAZO VENCIDO sem resposta (só modelo com prazo; sem
--      prazo não há o que vencer)                 → mensagem para a paciente;
--   2. alimento EM TESTE na reintrodução e nenhum rastreio há mais de 7
--      dias (os mesmos 7 de "Sem registro" na lista) → mensagem para a paciente;
--   3. cobrança em aberto com vencimento passado  → mensagem de cobrança;
--   4. com acesso e SEM RETORNO MARCADO            → só um aviso para ela.
--      Sem número de dias: "nem todo mundo precisa de consulta a cada 30 dias".
--
-- Só datas e fatos; nenhuma frase diz se está bom ou ruim. Só a nutricionista.

create or replace function public.quem_esfriou()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hoje date := hoje_sp();
  v_semana date := semana_de(hoje_sp());
begin
  if not e_admin() then
    raise exception 'Só a nutricionista.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(x order by x ->> 'nome')
      from (
        select jsonb_build_object(
          'id', p.id,
          'nome', p.nome,
          'telefone', p.telefone,
          'comAcesso', p.status = 'ativo' and v_hoje between p.data_inicio and p.data_fim,
          -- O dia mais recente com qualquer registro dela.
          'ultimoRegistro', (
            select max(d) from (
              select max(r.data) d from reintroducao_registros r where r.paciente_id = p.id
              union all select max(h.data) from hidratacao_registros h where h.paciente_id = p.id
              union all select max(f.data) from diario_fotos f where f.paciente_id = p.id
              union all select max(mr.data) from meta_registros mr join metas m on m.id = mr.meta_id where m.paciente_id = p.id
              union all select max((e.respondido_em at time zone 'America/Sao_Paulo')::date) from questionario_envios e where e.paciente_id = p.id
            ) u),
          -- 1. Check-in desta semana com o prazo já vencido e sem resposta.
          'checkins', coalesce((
            select jsonb_agg(jsonb_build_object('titulo', q.titulo, 'venceuEm', v_semana + (q.prazo_dias - 1)))
              from questionarios q
              join questionario_pacientes a on a.questionario_id = q.id and a.paciente_id = p.id
             where p.status = 'ativo' and v_hoje between p.data_inicio and p.data_fim
               and q.ativo and q.periodicidade = 'semanal' and q.prazo_dias is not null
               and v_hoje > v_semana + (q.prazo_dias - 1)
               and not exists (select 1 from questionario_envios e
                                where e.questionario_id = q.id and e.paciente_id = p.id and e.periodo = v_semana)
          ), '[]'::jsonb),
          -- 2. Alimento em teste e nenhum rastreio há mais de 7 dias.
          'reintroducao', (
            select jsonb_build_object(
                     'emTeste', (select jsonb_agg(coalesce(ra.nome, i.nome_livre) order by i.atualizado_em)
                                   from reintroducao_itens i left join reintroducao_alimentos ra on ra.id = i.alimento_id
                                  where i.paciente_id = p.id and i.status = 'em_teste'),
                     'ultimoRastreio', (select max(r.data) from reintroducao_registros r where r.paciente_id = p.id))
             where p.status = 'ativo' and v_hoje between p.data_inicio and p.data_fim
               and exists (select 1 from reintroducao_itens i where i.paciente_id = p.id and i.status = 'em_teste')
               and coalesce(
                     (select max(r.data) from reintroducao_registros r where r.paciente_id = p.id),
                     (select min((i.atualizado_em at time zone 'America/Sao_Paulo')::date) from reintroducao_itens i
                       where i.paciente_id = p.id and i.status = 'em_teste')
                   ) < v_hoje - 7),
          -- 3. Cobrança em aberto e vencida.
          'cobrancas', coalesce((
            select jsonb_agg(jsonb_build_object('id', c.id, 'competencia', c.competencia, 'valor', c.valor, 'vencimento', c.vencimento)
                             order by c.vencimento)
              from cobrancas c where c.paciente_id = p.id and c.status = 'aberta' and c.vencimento < v_hoje
          ), '[]'::jsonb),
          -- 4. Com acesso e sem retorno marcado.
          'semRetorno', p.status = 'ativo' and v_hoje between p.data_inicio and p.data_fim
                        and not exists (select 1 from consultas c
                                         where c.paciente_id = p.id and c.status = 'agendada' and c.data >= v_hoje),
          'ultimaConsulta', (select max(c.data) from consultas c where c.paciente_id = p.id and c.status = 'concluida')
        ) x
        from pacientes p
      ) t
     where jsonb_array_length(x -> 'checkins') > 0
        or x -> 'reintroducao' <> 'null'::jsonb
        or jsonb_array_length(x -> 'cobrancas') > 0
        or (x ->> 'semRetorno')::boolean
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.quem_esfriou() from public, anon;
grant execute on function public.quem_esfriou() to authenticated;
