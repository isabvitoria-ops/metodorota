/**
 * Gera `supabase/migracoes/0004_dados_iniciais.sql` a partir dos arquivos de
 * dados em TypeScript.
 *
 * Existe para que o seed do banco e os dados que o app usa em modo local não
 * possam divergir: há uma fonte só, e o SQL é derivado dela. Rode com
 * `npm run seed` sempre que mexer em src/central/dados/sementes/.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const { UNIDADES } = await import("@/central/dados/sementes/unidades.ts");
const { GRUPOS } = await import("@/central/dados/sementes/grupos.ts");
const { ALIMENTOS } = await import("@/central/dados/sementes/alimentos.ts");
const { EQUIVALENCIAS } = await import("@/central/dados/sementes/equivalencias.ts");
const { CATEGORIAS_COMER_FORA } = await import("@/central/dados/sementes/comerFora.ts");
const { GUIAS } = await import("@/central/dados/sementes/guias.ts");
const { PLANOS } = await import("@/central/dados/sementes/planos.ts");
const { CONFIGURACOES } = await import("@/central/dados/sementes/configuracoes.ts");

const txt = (v) => (v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const num = (v) => (v === null || v === undefined ? "null" : String(v));
const bool = (v) => (v === null || v === undefined ? "null" : v ? "true" : "false");
const arr = (v) => (v && v.length ? `array[${v.map(txt).join(", ")}]::text[]` : "'{}'::text[]");
const json = (v) => `${txt(JSON.stringify(v ?? {}))}::jsonb`;

const linhas = [];
const p = (s) => linhas.push(s);

p(`-- =============================================================================
-- CENTRAL DO PACIENTE — 0004: dados iniciais
--
-- ARQUIVO GERADO. Não edite à mão: ele sai de src/central/dados/sementes/
-- pelo comando \`npm run seed\`. Editar aqui faz o banco e o modo local do app
-- discordarem na primeira vez que alguém rodar o gerador de novo.
--
-- Tudo é \`on conflict do nothing\`: rodar duas vezes não duplica nem apaga o
-- que você já tiver cadastrado pelo painel.
-- =============================================================================
`);

p("-- Planos ----------------------------------------------------------------------");
for (const x of PLANOS) {
  p(`insert into planos (id, nome, duracao_dias, descricao, ordem, ativo) values (${txt(x.id)}, ${txt(x.nome)}, ${num(x.duracaoDias)}, ${txt(x.descricao)}, ${num(x.ordem)}, true) on conflict (id) do nothing;`);
}

p("\n-- Unidades --------------------------------------------------------------------");
UNIDADES.forEach((x, i) => {
  p(`insert into unidades (id, rotulo, abreviacao, singular, continua, ordem) values (${txt(x.id)}, ${txt(x.rotulo)}, ${txt(x.abreviacao)}, ${txt(x.singular)}, ${bool(x.continua)}, ${i}) on conflict (id) do nothing;`);
});

p("\n-- Grupos alimentares ----------------------------------------------------------");
for (const x of GRUPOS) {
  p(`insert into grupos_alimentares (id, nome, descricao, ordem, regra, troca_por_porcao, troca_para_grupos, tags) values (${txt(x.id)}, ${txt(x.nome)}, ${txt(x.descricao)}, ${num(x.ordem)}, ${x.regra ? json(x.regra) : "null"}, ${bool(x.trocaPorPorcao)}, ${arr(x.trocaParaGrupos)}, ${arr(x.tags)}) on conflict (id) do nothing;`);
}

p("\n-- Alimentos -------------------------------------------------------------------");
for (const x of ALIMENTOS) {
  p(`insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values (${txt(x.id)}, ${txt(x.nome)}, ${txt(x.grupoId)}, ${txt(x.unidadeBaseId)}, ${num(x.porcao?.quantidade ?? null)}, ${txt(x.porcao?.unidadeId ?? null)}, ${bool(x.quantidadeLivre)}, ${json(x.medidas)}, ${bool(x.atributos.semGluten)}, ${bool(x.atributos.semLactose)}, ${arr(x.tags)}, ${txt(x.observacao)}) on conflict (id) do nothing;`);
}

p("\n-- Equivalências ---------------------------------------------------------------");
for (const x of EQUIVALENCIAS) {
  p(`insert into equivalencias (id, origem_alimento_id, destino_alimento_id, tipo, regra, bidirecional, fonte, observacao) values (${txt(x.id)}, ${txt(x.origemAlimentoId)}, ${txt(x.destinoAlimentoId)}, ${txt(x.regra.tipo)}, ${json(x.regra)}, ${bool(x.bidirecional)}, ${txt(x.fonte)}, ${txt(x.observacao)}) on conflict (id) do nothing;`);
}

p("\n-- Comer fora ------------------------------------------------------------------");
for (const x of CATEGORIAS_COMER_FORA) {
  const corpo = { introducao: x.introducao, decisoes: x.decisoes, lembretes: x.lembretes };
  p(`insert into conteudos (id, tipo, titulo, tema, resumo, icone, ordem, status, corpo, tags) values (${txt(x.id)}, 'comer_fora', ${txt(x.nome)}, null, ${txt(x.resumo)}, ${txt(x.icone)}, ${num(x.ordem)}, ${txt(x.status === "publicado" ? "publicado" : "rascunho")}, ${json(corpo)}, ${arr(x.tags)}) on conflict (id) do nothing;`);
}

p("\n-- Guias -----------------------------------------------------------------------");
for (const x of GUIAS) {
  p(`insert into conteudos (id, tipo, titulo, tema, resumo, icone, ordem, status, corpo, tags) values (${txt(x.id)}, 'guia', ${txt(x.titulo)}, ${txt(x.tema)}, ${txt(x.resumo)}, null, ${num(x.ordem)}, ${txt(x.status === "publicado" ? "publicado" : "rascunho")}, ${json({ secoes: x.secoes })}, ${arr(x.tags)}) on conflict (id) do nothing;`);
}

p("\n-- Configurações ---------------------------------------------------------------");
for (const x of CONFIGURACOES) {
  p(`insert into configuracoes (chave, valor, descricao) values (${txt(x.chave)}, ${json(x.valor)}, ${txt(x.descricao)}) on conflict (chave) do nothing;`);
}

p("");
const destino = fileURLToPath(new URL("../supabase/migracoes/0004_dados_iniciais.sql", import.meta.url));
writeFileSync(destino, linhas.join("\n"));
console.log(`0004_dados_iniciais.sql gerado — ${linhas.length} linhas`);

/*
 * Segundo arquivo: `supabase/atualizar-lista.sql`.
 *
 * O 0004 é `on conflict do nothing` de propósito — rodar de novo não pode
 * desfazer o que ela editou pelo painel. Só que é justamente isso que o
 * impede de CORRIGIR um alimento que já existe no banco com valor antigo.
 *
 * Então a atualização mora num arquivo separado, que ela roda sabendo o que
 * faz: ele sobrescreve nome, grupo, porção e observação de todo alimento das
 * sementes. `ativo` fica de fora — esconder um alimento é decisão dela, e
 * uma atualização de lista não pode religar o que ela escondeu.
 */
const atual = [];
const a = (s) => atual.push(s);

a(`-- =============================================================================
-- CENTRAL DO PACIENTE — atualizar o conteúdo (lista de substituição + Comer fora)
--
-- ARQUIVO GERADO por \`npm run seed\`. Não edite à mão.
--
-- Rode num banco que JÁ EXISTE, para trazer o conteúdo novo. Diferente do
-- 0004, este arquivo SOBRESCREVE o que já estiver cadastrado com os mesmos
-- identificadores: alimentos (nome, grupo, porção, observação) e categorias
-- de Comer fora (título, situação e conteúdo inteiro).
--
-- O que ele NÃO mexe: a coluna \`ativo\` dos alimentos, suas configurações já
-- salvas, e nada de paciente — cadastro, plano, convite e histórico ficam
-- intactos. Categoria que VOCÊ criou pelo painel também fica: ele só toca nos
-- identificadores que vêm das sementes.
--
-- O que ele APAGA, de propósito: as categorias que saíram do ar (Refeição
-- livre e Subway, que virou lanchonete dentro de Hambúrguer) e os favoritos
-- que apontavam para conteúdo que não existe mais.
--
-- Onde rodar: Supabase → SQL Editor → New query → colar tudo → Run.
-- =============================================================================

-- Colunas novas. \`if not exists\` para o arquivo poder rodar mais de uma vez.
alter table grupos_alimentares add column if not exists troca_para_grupos text[] not null default '{}';
alter table alimentos add column if not exists quantidade_livre boolean not null default false;
`);

a("-- Grupos alimentares ----------------------------------------------------------");
for (const x of GRUPOS) {
  a(`insert into grupos_alimentares (id, nome, descricao, ordem, regra, troca_por_porcao, troca_para_grupos, tags) values (${txt(x.id)}, ${txt(x.nome)}, ${txt(x.descricao)}, ${num(x.ordem)}, ${x.regra ? json(x.regra) : "null"}, ${bool(x.trocaPorPorcao)}, ${arr(x.trocaParaGrupos)}, ${arr(x.tags)}) on conflict (id) do update set nome = excluded.nome, descricao = excluded.descricao, ordem = excluded.ordem, regra = excluded.regra, troca_por_porcao = excluded.troca_por_porcao, troca_para_grupos = excluded.troca_para_grupos, tags = excluded.tags, atualizado_em = now();`);
}

a("\n-- Alimentos -------------------------------------------------------------------");
for (const x of ALIMENTOS) {
  a(`insert into alimentos (id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id, quantidade_livre, medidas, sem_gluten, sem_lactose, tags, observacao) values (${txt(x.id)}, ${txt(x.nome)}, ${txt(x.grupoId)}, ${txt(x.unidadeBaseId)}, ${num(x.porcao?.quantidade ?? null)}, ${txt(x.porcao?.unidadeId ?? null)}, ${bool(x.quantidadeLivre)}, ${json(x.medidas)}, ${bool(x.atributos.semGluten)}, ${bool(x.atributos.semLactose)}, ${arr(x.tags)}, ${txt(x.observacao)}) on conflict (id) do update set nome = excluded.nome, grupo_id = excluded.grupo_id, unidade_base_id = excluded.unidade_base_id, porcao_quantidade = excluded.porcao_quantidade, porcao_unidade_id = excluded.porcao_unidade_id, quantidade_livre = excluded.quantidade_livre, sem_gluten = excluded.sem_gluten, sem_lactose = excluded.sem_lactose, tags = excluded.tags, observacao = excluded.observacao, atualizado_em = now();`);
}

a("\n-- Comer fora e guias ----------------------------------------------------------");
for (const x of CATEGORIAS_COMER_FORA) {
  const corpo = {
    introducao: x.introducao,
    decisoes: x.decisoes,
    estabelecimentos: x.estabelecimentos,
    lembretes: x.lembretes,
    logo: x.logo,
  };
  a(`insert into conteudos (id, tipo, titulo, tema, resumo, icone, ordem, status, corpo, tags) values (${txt(x.id)}, 'comer_fora', ${txt(x.nome)}, null, ${txt(x.resumo)}, ${txt(x.icone)}, ${num(x.ordem)}, ${txt(x.status === "publicado" ? "publicado" : "rascunho")}, ${json(corpo)}, ${arr(x.tags)}) on conflict (id) do update set titulo = excluded.titulo, resumo = excluded.resumo, icone = excluded.icone, ordem = excluded.ordem, status = excluded.status, corpo = excluded.corpo, tags = excluded.tags, atualizado_em = now();`);
}

/*
 * Limpeza do que saiu do ar por decisão dela.
 *
 * O upsert acima corrige o que existe, mas não apaga o que deixou de existir:
 * uma categoria removida das sementes continuaria publicada no banco dela. E
 * favorito que aponta para conteúdo apagado vira link morto na tela de Salvos
 * — some junto, senão a paciente clica e não chega a lugar nenhum.
 */
const CATEGORIAS_REMOVIDAS = [
  // A conta que morava na "Refeição livre" virou a frase do topo de Comer fora.
  "refeicao-livre",
  // O Subway não boia mais na raiz: virou lanchonete dentro de Hambúrguer.
  "subway",
];

// O tema inteiro "No dia a dia" saiu dos Guias a pedido dela.
const GUIAS_REMOVIDOS = ["refeicao-livre", "comer-fora", "industrializados", "doces", "alcool"];

// Opções que saíram quando as seções viraram repetição das casas.
const OPCOES_REMOVIDAS = [
  "hamburguer:hamburguer-simples",
  "hamburguer:hamburguer-denso",
  "hamburguer:hamburguer-completa",
  "japonesa:sunomono",
  "japonesa:missoshiro",
  "japonesa:edamame",
  "japonesa:sashimi",
  "japonesa:niguiri",
  "japonesa:temaki-simples",
  "japonesa:fritos",
  "japonesa:molhos-cremosos",
  "massas:massa-camarao",
  "massas:massa-frango",
  "massas:massa-lasanha",
  "pizza:pizza-fina",
  "pizza:pizza-grossa",
  "acai:acai-500",
  "acai:acai-300",
  "doces:doce-acai",
  "subway:subway-melhor",
  "subway:subway-boa",
  "subway:subway-ocasional",
];

/*
 * Os DELETE são escopados por `tipo`, e isso não é zelo à toa.
 *
 * Categoria de Comer fora e guia dividem a tabela `conteudos`, e o id é a
 * chave primária das duas. O guia "Doces" e a categoria "Doces e sobremesas"
 * nasceram com o mesmo id — no banco dela, quem entrou foi a categoria, e o
 * guia sumiu calado no `on conflict do nothing`. Um delete sem `tipo` agora
 * apagaria a categoria achando que apagava o guia.
 */
a(`
-- O que saiu do ar, e os favoritos que apontavam para lá.
delete from favoritos where tipo = 'categoria' and ref_id in (${CATEGORIAS_REMOVIDAS.map(txt).join(", ")});
delete from favoritos where tipo = 'guia' and ref_id in (${GUIAS_REMOVIDOS.map(txt).join(", ")});
delete from favoritos where tipo = 'opcao' and ref_id in (${OPCOES_REMOVIDAS.map(txt).join(", ")});
delete from conteudos where tipo = 'comer_fora' and id in (${CATEGORIAS_REMOVIDAS.map(txt).join(", ")});
delete from conteudos where tipo = 'guia' and id in (${GUIAS_REMOVIDOS.map(txt).join(", ")});
`);

a("-- Configurações ---------------------------------------------------------------");
for (const x of CONFIGURACOES) {
  // `do nothing`: chave nova entra, chave existente fica como ela editou.
  a(`insert into configuracoes (chave, valor, descricao) values (${txt(x.chave)}, ${json(x.valor)}, ${txt(x.descricao)}) on conflict (chave) do nothing;`);
}

a(`
-- Conferência: deve listar um total por grupo, e nenhum alimento com porção
-- e "quantidade livre" ao mesmo tempo.
select g.nome as grupo,
       count(*) as alimentos,
       count(a.porcao_quantidade) as com_porcao,
       count(*) filter (where a.quantidade_livre) as livres
  from alimentos a
  join grupos_alimentares g on g.id = a.grupo_id
 group by g.nome, g.ordem
 order by g.ordem;

-- E as categorias de Comer fora, com quantas casas cada uma tem.
select titulo,
       status,
       jsonb_array_length(coalesce(corpo -> 'estabelecimentos', '[]'::jsonb)) as casas
  from conteudos
 where tipo = 'comer_fora'
 order by ordem;
`);

const destinoAtual = fileURLToPath(new URL("../supabase/atualizar-conteudo.sql", import.meta.url));
writeFileSync(destinoAtual, atual.join("\n"));
console.log(`atualizar-conteudo.sql gerado — ${atual.length} linhas`);
