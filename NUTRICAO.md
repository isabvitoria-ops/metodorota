# Módulo profissional de nutrição — FASE 1: auditoria

Levantamento do que existe hoje, antes de qualquer alteração. Nada foi
modificado para escrever este documento.

Data do levantamento: 16/09/2026.

---

## 1. O que a aplicação é hoje

**Stack.** React 18 + TypeScript (modo estrito, com `noUncheckedIndexedAccess`),
Vite 5, react-router-dom 6. Banco Supabase — PostgreSQL 17.6, região
`sa-east-1`. Sem framework de componentes: o CSS é próprio, 2.300 linhas num
arquivo só.

**Tamanho.** 257 arquivos TypeScript, 24.387 linhas. 21 migrações, 5.562
linhas de SQL. 107 funções no banco.

**Publicação.** O site é **um arquivo HTML só** (1,18 MB), gerado por
`npm run html-pages` e servido pelo GitHub Pages em `isabvitoria-ops/metodorota`.
Isso é uma restrição de verdade para o que vem pela frente — ver §6.

**Testes.** 104 testes de unidade (`npm test`) e 257 verificações no banco,
em quatro baterias (`npm run test:banco`), incluindo testes de política de
acesso que assumem a identidade de cada perfil e tentam o que não deveriam
conseguir.

---

## 2. Duas aplicações no mesmo repositório

Isto é o achado mais importante da auditoria, e muda a ordem das etapas.

### A Central (no ar)

`src/central/` — 103 arquivos, 15.993 linhas. É o que está publicado.

| Área | Rotas |
|---|---|
| Paciente | Início, Rastreabilidade, Desafio, Trocas, Substituições, Comer fora, Guias, Salvos, Busca |
| Nutricionista | `/admin` → Painel, Pacientes, Alimentos, Equivalências, Conteúdos, Desafio, Rastreabilidade, Configurações |
| Conta | Entrar, Definir senha, Recuperar senha, Sem acesso, Diagnóstico |

### O "Consultório" (desligado)

`src/app/Consultorio.tsx` mais `src/components/`, `src/repositories/`,
`src/services/`, `src/store/`, `src/data/`, `src/hooks/`, `src/modals/`,
`src/types/` — cerca de **8.400 linhas**.

É um protótipo anterior de painel da nutricionista, com ficha de paciente,
plano, alimentos e equivalências. Está **fora do ar por padrão**
(`VITE_APP_ANTIGO=1` para ligar) por dois motivos registrados no código: o
login aceita qualquer senha e os pacientes são inventados.

**Duas consequências práticas:**

1. Ele já faz, com dados falsos, uma parte do que este módulo novo vai fazer
   de verdade. Não vou ressuscitá-lo — autenticação falsa e paciente fictício
   não entram num sistema com dado clínico real. Mas o que der para aproveitar
   dele, aproveito (ver §3).
2. Ele **está dentro do arquivo publicado**. Mesmo desligado, o código viaja
   no 1,18 MB que toda paciente baixa.

---

## 3. Já existe uma TACO no repositório

`src/data/tacoRaw.ts` — **591 alimentos** da TACO 4ª edição (NEPA/UNICAMP),
com os **códigos oficiais preservados** (1 a 597, sem duplicados).

Por alimento, oito valores por 100 g de parte comestível:

kcal · proteína · lipídios · carboidrato · fibra · cálcio · ferro · sódio

Conferi por amostragem contra a TACO publicada. "Arroz, tipo 1, cozido"
(código 3) traz 128,26 kcal / 2,52 g proteína / 0,23 g lipídios / 28,06 g
carboidrato — a TACO publica 128 / 2,5 / 0,2 / 28,1. Batem, com uma casa
decimal a mais do que a tabela impressa.

**O que falta em relação à TACO completa:**

- **6 alimentos** (591 dos 597 da 4ª edição);
- **cerca de 20 nutrientes**: colesterol, todas as vitaminas, magnésio,
  fósforo, potássio, zinco, cobre, manganês, ácidos graxos saturados /
  monoinsaturados / poli-insaturados, cinzas, umidade;
- a **casa decimal a mais** precisa ser explicada. Pode ser a origem do dado
  (planilha analítica em vez da tabela impressa) ou pode ser transformação
  de alguém no caminho. Enquanto não bater com o arquivo oficial, o certo é
  registrar a fonte como "TACO 4ª ed. (via protótipo do repositório)" e não
  como "TACO oficial".

---

## 4. O que existe de alimento hoje, e por que não serve para prescrição

A tabela `alimentos` (254 registros em produção) é a lista de **substituição**
dela — a do material impresso. Dezessete colunas, e **nenhuma delas é
nutriente**: não há kcal, proteína, carboidrato nem gordura.

```
id, nome, grupo_id, unidade_base_id, porcao_quantidade, porcao_unidade_id,
quantidade_livre, medidas (jsonb), sem_gluten, sem_lactose, tags,
imagem_url, observacao, nivel_acesso, ativo, criado_em, atualizado_em
```

Ela responde "100 g de arroz equivalem a 50 g de pão", que é o que a paciente
precisa. Não responde "quantas kcal tem", que é o que a prescrição precisa.

**Decisão que proponho:** não transformar esta tabela. Ela é curada por você,
é pequena, é o que a paciente vê, e misturar 8.000 alimentos importados nela
quebraria a tela de substituições. O banco nutricional entra em tabelas
novas, e ganha um vínculo opcional com esta quando você quiser ligar as duas.

---

## 5. Perfis e segurança — o que já está pronto

**Papéis:** `perfis.papel` aceita `admin` e `paciente`. Hoje: 1 admin (você),
8 pacientes.

**RLS:** as 25 tabelas de produção têm política de acesso ligada. Nenhuma
exceção.

**O padrão que o projeto já segue**, e que o módulo novo vai seguir igual:

- a paciente **não tem política de escrita** nas tabelas sensíveis. Tudo o
  que ela grava passa por função `security definer` que confere acesso e dono
  antes de escrever;
- funções que recebem um id de paciente conferem `e_admin() or p_paciente =
  meu_paciente_id()`, com `coalesce(..., false)` — sem isso um nulo passa
  pela checagem;
- o visitante sem login não alcança nenhuma função nem nenhuma tabela. Hoje:
  zero funções e zero tabelas abertas ao `anon`.

Três vazamentos desse tipo já foram encontrados e fechados neste projeto
(`saldo_de_pontos`, `indicacoes_validadas`, `inicio_da_reintroducao`). O
módulo novo vai nascer com a checagem, não ganhá-la depois.

**O que ainda não existe:** `professional_id`. Hoje há uma nutricionista, e o
código assume isso. Para o SaaS do seu §26, as tabelas novas já nascem com a
coluna.

---

## 6. As três restrições reais

Estas não são preferências minhas. São limites do que existe.

### 6.1 Não consigo baixar TACO nem USDA daqui

Testei agora. O ambiente onde eu trabalho bloqueia a internet, com exceção de
uma lista curta:

| Origem | Situação |
|---|---|
| `fdc.nal.usda.gov` (USDA FoodData Central) | **bloqueado** |
| `api.nal.usda.gov` (API do USDA) | **bloqueado** |
| `nepa.unicamp.br` (TACO oficial) | **bloqueado** |
| `github.com` / `raw.githubusercontent.com` | liberado |
| `registry.npmjs.org` | liberado |

Procurei os dados no npm: existem clientes da API do USDA (que precisam da
API bloqueada), e nenhum pacote com a TACO.

**Os caminhos honestos são dois:**

1. **Você me manda o arquivo oficial**, como fez com os dois PDFs. A TACO tem
   planilha em `.xls` no site do NEPA. Para o USDA, o download é o CSV do
   FoodData Central. É o caminho que respeita o seu §35.
2. **Eu uso uma cópia hospedada no GitHub**, registrando no banco de onde ela
   veio. Funciona, mas é reprodução, não fonte oficial — e o seu §29 pede
   rastreabilidade. Se for por aqui, vale conferir uma amostra contra a tabela
   impressa antes de confiar.

Enquanto isso, os 591 alimentos que já estão no repositório dão para começar.

### 6.2 O USDA inteiro não cabe

O banco hoje ocupa 15 MB. O plano gratuito do Supabase vai até 500 MB.

| Conjunto do USDA | Alimentos | Cabe? |
|---|---|---|
| Foundation Foods | ~300 | sim |
| SR Legacy | ~7.800 | sim, ~60 MB com todos os nutrientes |
| **Branded Foods** | **~450.000** | **não** — passaria de 1 GB |

Branded são produtos industrializados **norte-americanos**. Para atender
brasileira, o valor está em TACO + SR Legacy. Proponho deixar Branded de
fora, e a arquitetura aceita incluí-lo depois se você mudar de plano.

### 6.3 O site é um arquivo só

Tudo — código, CSS, imagens — vai num `index.html` de 1,18 MB. Não há
carregamento sob demanda: o roteador tem `lazy()`, mas o gerador do arquivo
único junta tudo de novo.

O módulo profissional é grande. Os **dados** ficam no Postgres e não pesam no
arquivo, mas as **telas** pesam. Estimo +200 a 300 KB.

Duas saídas, e prefiro a segunda:

1. aceitar o arquivo crescer para perto de 1,5 MB;
2. **publicar a área da nutricionista separada da Central**. A paciente baixa
   só o que usa, e o módulo profissional pode crescer à vontade. É mais
   trabalho agora e resolve de vez. Também tira os 8.400 linhas do Consultório
   do arquivo da paciente.

---

## 7. O que vou construir, e onde

### Banco — migrações novas, nada alterado

| Tabela | Para quê |
|---|---|
| `profissionais` | `professional_id` do §26. Nasce com você. |
| `funcionalidades` | as feature flags do §27, por perfil |
| `fontes_alimentares` | TACO, USDA, "Meus alimentos" — com versão e data |
| `alimentos_fonte` | o alimento como a fonte publica, com o id original |
| `nutrientes` | catálogo: nome, unidade, código da fonte |
| `alimentos_nutrientes` | o valor de cada nutriente de cada alimento |
| `medidas_caseiras` | colher, xícara, fatia → gramas |
| `meus_alimentos` | o §6 — banco próprio, nunca sobrescreve TACO/USDA |
| `avaliacoes` | antropometria e composição corporal, com histórico |
| `dobras_cutaneas` | pontos anatômicos por avaliação |
| `calculos_energeticos` | qual equação, quais entradas, qual resultado |
| `planos_alimentares` | prescrição, com versão |
| `plano_refeicoes` / `plano_itens` | refeições e alimentos |
| `receitas` / `receita_ingredientes` | o §22 |
| `grupos_substituicao` | o §21, com critério de equivalência |
| `importacoes` | relatório de cada importação — §28 |

**Nenhuma tabela existente muda de forma.** O único acréscimo é uma coluna
opcional em `alimentos`, ligando um alimento da sua lista curada ao alimento
da fonte, quando você quiser.

### Código — pastas novas

```
src/central/admin/nutricao/     telas do módulo (só admin)
src/central/nutricao/calculos/  as equações, uma por arquivo
src/central/nutricao/unidades/  conversões
src/central/types/nutricao.ts   tipos
supabase/migracoes/0022+        banco
supabase/testes/04_nutricao.sql bateria
```

### Arquivos existentes que serão tocados, e como

| Arquivo | Alteração |
|---|---|
| `src/central/rotas.ts` | acrescentar as rotas do módulo |
| `src/central/admin/AdminApp.tsx` | uma aba "Nutrição" |
| `src/central/types/index.ts` | exportar os tipos novos |
| `src/central/dados/repositorio.ts` + as duas implementações | métodos novos |
| `supabase/migracoes/0002_funcoes.sql` → substituída por migração nova | `meu_acesso()` passa a devolver as feature flags |

Nenhuma tela da paciente é alterada. O `CentralApp.tsx` não é tocado.

### O que a paciente vê

**Nada.** As rotas ficam sob `/admin`, que já é bloqueada para quem não é
admin no roteador e no banco. As flags nascem assim:

```
nutrition_calculator_enabled   nutricionista ON   paciente OFF
food_database_enabled          nutricionista ON   paciente OFF
prescription_enabled           nutricionista ON   paciente OFF
patient_nutrition_view_enabled                    paciente OFF
patient_diet_enabled                              paciente OFF
```

Nenhuma vira ON sozinha.

---

## 8. Ordem, e o que muda em relação ao seu §33

Sua ordem está certa. Duas trocas que a auditoria justifica:

- **A TACO vem antes do USDA e antes de mais nada** depois das flags, porque
  os 591 alimentos já estão aqui. Dá para ter banco nutricional funcionando
  sem depender de download nenhum.
- **A decisão do §6.3 (arquivo único) vem antes da primeira tela**, porque
  mudar isso depois significa refazer a publicação.

| Fase | Entrega | Depende de você? |
|---|---|---|
| 1 | esta auditoria | — |
| 2 | permissões e feature flags | não |
| 3 | banco nutricional (tabelas, índices, RLS) | não |
| 4 | TACO — os 591 que já temos | não |
| 4b | TACO completa (597 × 30 nutrientes) | **sim — o arquivo oficial** |
| 5 | USDA SR Legacy + Foundation | **sim — o CSV** |
| 6 | "Meus alimentos" | não |
| 7 | calculadoras energéticas + testes | não |
| 8 | composição corporal + testes | não |
| 9 | prescrição | não |
| 10 | receitas e substituições | não |
| 11 | histórico e versionamento | não |
| 12 | bateria completa | não |

---

## 9. Riscos de quebrar o que já funciona

| Risco | Como fica contido |
|---|---|
| `meu_acesso()` ganha campos e quebra a sessão | a função é substituída inteira numa migração, e a bateria `01_acesso.sql` (65 verificações) roda antes de publicar |
| importar alimentos polui a lista da paciente | tabelas separadas; `alimentos` não recebe linha importada |
| o arquivo publicado fica pesado demais | decidido antes da primeira tela (§6.3) |
| RLS nova com furo | a bateria nova segue o padrão das outras: assume a identidade de cada perfil e tenta o que não deveria conseguir |
| conta de nutriente errada e ninguém percebe | §34 — teste com valor conhecido para cada equação, antes da tela |

---

## 10. O que preciso de você para seguir

Três decisões. Nenhuma impede começar as fases 2, 3 e 4.

1. **Arquivo único ou área separada** (§6.3). Recomendo separar.
2. **TACO oficial**: você manda o `.xls` do NEPA, ou eu uso cópia do GitHub
   com a origem registrada?
3. **USDA**: você manda o CSV do FoodData Central? Sem ele, o módulo nasce só
   com TACO — o que, para paciente brasileira, cobre a maior parte.
