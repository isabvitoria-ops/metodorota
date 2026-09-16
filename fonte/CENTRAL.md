# Central do Paciente — arquitetura e manutenção

Ferramenta de consulta do paciente (troca de alimentos, comer fora,
substituições, guias, salvos) com área administrativa da nutricionista,
autenticação e controle de validade de acesso.

Para colocar no ar pela primeira vez, veja **[PUBLICAR.md](PUBLICAR.md)**.

---

## 1. A regra que governa o sistema

> **Convite não é acesso.**
> Acesso = conta autenticada **+** paciente cadastrado e vinculado **+** não
> suspenso **+** hoje dentro do período.

Essa frase existe em **um** lugar executável: a função `tem_acesso()` em
`supabase/migracoes/0002_funcoes.sql`. Todas as políticas de leitura de
conteúdo chamam ela. O frontend não recalcula a regra — ele pergunta
(`meu_acesso()`) e obedece.

Três consequências que valem saber:

- **Expirar é automático.** "Expirado" não é um status gravado: é o resultado
  de comparar a data de fim com hoje, toda vez que alguém pergunta. Não há
  rotina diária para falhar, e não há dia em que um plano vencido continue
  aberto porque alguém esqueceu de rodar algo.
- **Esconder no frontend não protege nada.** Se o paciente vencido digitar a
  URL antiga, o banco devolve zero linhas. Os portões de tela
  (`ExigeAcesso`, `ExigeAdmin`) só existem para levar a pessoa à tela certa.
- **Vencer não apaga ninguém.** Expirar, suspender e excluir são três coisas
  diferentes, e só a última pede confirmação.

Isso não é uma promessa: são 61 verificações rodando num Postgres de verdade.
Ver a seção 7.

---

## 2. Stack

| Camada | Escolha | Por quê |
|---|---|---|
| Build | Vite | Já era do projeto |
| Interface | React 18 + TypeScript | Já era do projeto |
| Rotas | react-router-dom | Já era dependência |
| Estado | Zustand | Já era dependência |
| Banco, login, arquivos | Supabase (PostgreSQL) | Pedido do briefing; RLS resolve o controle de acesso no lugar certo |
| Hospedagem | Vercel | Pedido do briefing; publica a cada envio ao GitHub |
| Estilo | CSS puro com variáveis | Sem framework: a identidade visual inteira é um bloco de variáveis |
| Testes | `node:test` nativo + psql + Playwright | Nenhuma dependência de teste instalada |

**Nenhuma dependência nova foi adicionada** em relação ao que o projeto já
tinha. A fonte de título é servida pelo próprio app.

---

## 3. Estrutura

```
supabase/
  instalar.sql          Tudo junto, para colar no SQL Editor (GERADO)
  tornar-admin.sql      Promove a sua conta a administradora
  migracoes/
    0001_esquema.sql      tabelas e índices
    0002_funcoes.sql      tem_acesso(), situacao, gatilhos, meu_acesso()
    0003_rls.sql          as políticas de acesso
    0004_dados_iniciais.sql  dados de partida (GERADO de src/central/dados/sementes)
    0005_permissoes.sql   grants explícitos
  testes/
    00_ambiente.sql       imita o Supabase num Postgres local
    01_acesso.sql         a bateria de segurança

src/central/
  rotas.ts              todos os caminhos em um lugar

  dados/                DE ONDE VEM O DADO
    repositorio.ts        a interface, e quem escolhe a implementação
    repositorioSupabase.ts  produção
    repositorioLocal.ts     modo demonstração (sementes + navegador)
    mapeadores.ts         linha do banco ↔ objeto do app
    catalogo.ts           o catálogo em memória, carregado uma vez
    indiceBusca.ts        monta a busca global a partir do catálogo
    sementes/             OS DADOS INICIAIS — é aqui que você escreve

  utils/                AS CONTAS (lógica pura, sem tela)
    calculoTroca.ts       o motor da Troca Inteligente
    porcoes.ts            porções, frações e combinações
    medidas.ts            conversão de unidade e arredondamento
    situacao.ts           a mesma regra de validade do banco, em TypeScript
    buscaAlimentos.ts / buscaGlobal.ts / texto.ts / armazenamento.ts

  autenticacao/         CONTA E PORTÕES
    SessaoContexto.tsx    quem está usando e o que pode ver
    Protegido.tsx         ExigeSessao / ExigeAcesso / ExigeAdmin
    Entrar / DefinirSenha / RecuperarSenha / SemAcesso

  admin/                ÁREA DA NUTRICIONISTA
    Painel, Pacientes, FichaPaciente, Alimentos,
    Equivalencias, Conteudos, Configuracoes

  pages/                TELAS DO PACIENTE (uma por arquivo)
  components/           peças reutilizadas
  hooks/                favoritos, pacientes, catálogo
  types/                o contrato de todos os dados
  styles/central.css    a identidade visual inteira
```

A regra que mantém isso saudável: **tela não conhece banco, banco não conhece
tela, e conta nenhuma acontece dentro de componente.** Se um número aparece na
interface, ele veio de uma função em `utils/`.

---

## 4. O banco

### Tabelas

| Tabela | Para quê |
|---|---|
| `perfis` | Uma linha por conta autenticada. Diz quem é admin. |
| `planos` | Mensal, trimestral, semestral, anual. |
| `pacientes` | O cadastro: e-mail, plano, período, status, último acesso. |
| `convites` | Registro de cada envio de convite. |
| `historico_admin` | Cadastro, convite, ativação, renovação, suspensão, reativação. |
| `unidades` | g, ml, unidade, fatia, colher… |
| `grupos_alimentares` | Carboidratos, proteínas, vegetais livres… |
| `alimentos` | Nome, grupo, porção de referência, restrições, tags. |
| `equivalencias` | As trocas com valor próprio. |
| `conteudos` | Guias e comer fora (o formato muda dentro de `corpo`). |
| `favoritos` | O que cada paciente salvou. |
| `configuracoes` | WhatsApp, nome da Central, dias de alerta. |

### Como o paciente se liga à conta

```
auth.users (Supabase)  →  perfis  →  pacientes  →  plano + período + status
```

O e-mail é a chave de encontro. A nutricionista cadastra o paciente antes de
existir conta; quando a pessoa cria a conta, um gatilho liga as duas pontas.
Se ela criar conta sem ter sido cadastrada, fica com uma conta autenticada e
**zero** acesso — que é exatamente o comportamento desejado.

### Situações

| Situação | De onde vem |
|---|---|
| `convite_pendente` | ainda não há conta vinculada |
| `nao_iniciado` | hoje é antes da data de início |
| `ativo` | dentro do período |
| `proximo_do_vencimento` | dentro do período, faltando ≤ 15 dias (configurável) |
| `expirado` | hoje é depois da data de fim |
| `suspenso` | decisão manual da nutricionista |

Só `convite_pendente`, `ativo` e `suspenso` são gravados. As outras três são
calculadas na hora, no fuso de São Paulo.

### Níveis de acesso do conteúdo

`publico` (qualquer conta autenticada, mesmo sem plano válido), `paciente`
(exige acesso liberado) e `premium` (reservado para planos específicos, ainda
sem uso). Guias e alimentos nascem como `paciente`.

---

## 5. O motor da Troca Inteligente

Nenhuma combinação está escrita à mão. O cálculo tenta, nesta ordem:

1. equivalência cadastrada no sentido pedido;
2. a mesma equivalência lida ao contrário, se for bidirecional;
3. a razão entre as porções dos dois alimentos, dentro do mesmo grupo;
4. nada disso fechou → a tela diz o que falta, e não mostra número.

Três formatos de regra são aceitos: **proporcional** (o caso comum),
**tabela de pontos** (para trocas que não escalam em linha reta — interpola
entre os pontos e nunca extrapola) e **fixa**.

O caminho 3 é o que faz o catálogo crescer sozinho: cadastrar a porção de um
alimento novo já o habilita em todas as trocas do grupo dele.

---

## 6. Como fazer as coisas

### Adicionar um alimento

Área da nutricionista → **Alimentos** → **Novo alimento**. O campo que mais
importa é a porção: com ela preenchida, o alimento entra em todas as trocas do
grupo, sem escrever equivalência nenhuma. Sem ela, aparece como "sem porção" e
fica fora da calculadora — em vez de ganhar um valor inventado.

Para editar direto no código (os dados de partida), o arquivo é
`src/central/dados/sementes/alimentos.ts`. Depois de mexer, rode:

```bash
npm run seed        # regenera 0004_dados_iniciais.sql
npm run instalador  # regenera supabase/instalar.sql
```

### Adicionar uma equivalência

Área da nutricionista → **Equivalências** → **Nova equivalência**. Só é preciso
quando a troca **não** for a razão entre as porções — por exemplo quando a
lista de substituição traz um valor próprio para aquele par.

### Adicionar um restaurante ou categoria de comer fora

**Conteúdos** → aba **Comer fora** → **Nova categoria**. Cada categoria é um
conjunto de decisões ("a massa", "a proteína", "o molho"), e cada decisão tem
opções classificadas em melhor escolha / boa opção / mais ocasional. Categoria
em rascunho aparece só para você.

As calorias de cada opção têm um interruptor próprio: o número fica guardado
mesmo quando não é exibido.

### Adicionar um guia

**Conteúdos** → aba **Guias** → **Novo guia**. Cada seção tem título,
parágrafos e marcadores, escritos um por linha. Enquanto não houver seção
nenhuma, o guia aparece como "em breve" para o paciente.

### Mudar a identidade visual

Tudo no primeiro bloco de `src/central/styles/central.css`:

```css
.central {
  --primary: #3a6355;
  --background: #f6f4f1;
  --surface: #ffffff;
  --text: #1f1d1b;
  --border: #e6e1d9;
  --success: #3d6650;
  --warning: #7d5c14;
  --danger: #8f4034;
  --radius: 20px;
  --font-display: "Fraunces", Georgia, serif;
}
```

Nenhuma regra do arquivo escreve cor no meio do caminho. Depois de mexer, rode
`npm test`: há um teste que confere o contraste de cada par que aparece na tela
contra a régua da WCAG e diz qual combinação reprovou e por quanto.

### Mudar o WhatsApp, o nome e o lema

Área da nutricionista → **Configurações**. Não precisa publicar de novo. O lema
é a frase de identidade da tela inicial; deixar em branco esconde a linha.

---

## 7. O que foi verificado rodando

| Bateria | Como rodar | Resultado |
|---|---|---|
| Motor de cálculo e contraste | `npm test` | 32 testes |
| Segurança do banco | `npm run test:banco` | 61 verificações |
| Interface no navegador | Playwright, ver seção abaixo | 57 verificações |

A bateria de segurança sobe um Postgres limpo, aplica as migrações e assume a
identidade de sete pessoas diferentes para perguntar ao banco o que cada uma
consegue ver e fazer. Entre o que ela prova:

- paciente ativa lê conteúdo; expirada, suspensa, não iniciada e avulsa não;
- a URL protegida direta não devolve nada para quem não tem acesso;
- paciente não estica a própria data de fim, não se promove a admin, não mexe
  no cadastro de outra pessoa;
- paciente A não lê a linha, o perfil nem os favoritos do paciente B;
- renovar restaura o acesso sem duplicar paciente, e fica no histórico;
- quem se cadastra sozinho fica autenticado e sem acesso a nada;
- sem login, a leitura é barrada antes mesmo da política.

Precisa de um Postgres local:

```bash
npm run test:banco     # usa PGHOST=/tmp PGPORT=5433 por padrão
```

---

## 8. Prévia publicada

`npm run artefato` monta uma versão da Central que roda em qualquer host
estático: caminhos relativos, rotas por hash (`#/trocas`) e sem Service
Worker. É o que está publicado como prévia — abre no celular, funciona
inteiro e não encosta em banco nenhum.

Depois de rodar o comando, o que sobe é `dist-demo/artefato.html` mais a pasta
`dist-demo/assets`. A pasta inteira é descartável e está fora do Git.

### Arquivo único

`npm run html-unico` gera **`site/index.html`**: a Central inteira num
arquivo só, com o código, o estilo e as duas fontes embutidos. Cerca de 1 MB.

Abre com dois cliques, sem servidor, sem internet e sem pasta de apoio — dá
para mandar por e-mail, guardar num pendrive ou subir em qualquer hospedagem
que sirva arquivo estático. É o mesmo conteúdo da prévia publicada.

O gerador confere duas coisas antes de escrever: que não sobrou nada
buscando a internet dentro do CSS, e que as fontes continuam lá depois do
corte. Se qualquer uma falhar, ele para em vez de gerar um arquivo quebrado.

> O arquivo NÃO vai para a raiz do projeto. O `index.html` de lá é o molde
> que o Vite usa para montar o app — sobrescrever aquele arquivo quebraria o
> build.

### Versão publicada no GitHub Pages

`npm run html-pages` gera **`site-pages/index.html`** e um
**`site-pages/404.html`** idêntico. É a mesma ideia do arquivo único, com três
diferenças que o GitHub Pages exige:

- a base é `/metodorota/`, porque o site mora numa subpasta do domínio;
- as rotas são de caminho (`/metodorota/trocas`), não de hash;
- o `404.html` é cópia do `index.html`, porque o Pages não sabe reescrever
  rota interna — ele devolve o 404, e o app assume dali.

As chaves do Supabase entram embutidas no arquivo no momento do build, lidas
do `.env.local`. São a URL do projeto e a chave pública (`anon`/`publishable`),
que é feita para ficar no navegador; quem protege o dado é a RLS do banco, não
o sigilo dessa chave. A chave `service_role` nunca entra em build nenhum.

Os dois arquivos vão para a raiz do repositório `metodorota`.

### Tela de diagnóstico

`/diagnostico` é uma rota **pública de propósito** — ela existe justamente para
quando o login não está funcionando, então não pode depender de login. Mostra:
modo (Supabase ou demonstração), URL do projeto, começo da chave pública (nunca
ela inteira), URL atual, endereço que sai nos convites, papel, situação do
plano, se tem acesso, quantos itens o catálogo carregou, uma leitura de teste
no banco e a sessão.

Nenhum dado de paciente aparece ali. A leitura de teste corre contra um limite
de 10 segundos, então a tela responde mesmo com a rede bloqueada, em vez de
ficar girando.

## 9. Modo demonstração

Sem as variáveis de ambiente do Supabase, o app abre inteiro com dados de
exemplo, sem login, e o que for salvo fica só no navegador. Uma faixa amarela
avisa o tempo todo.

Serve para três coisas: abrir o projeto e ver tudo antes de configurar serviço
nenhum; rodar a bateria de interface sem depender de rede; e continuar
trabalhando se o Supabase estiver fora do ar.

---

## 10. O app antigo de acompanhamento

O produto anterior deste repositório (check-in diário, plano alimentar, diário,
evolução, painel da nutricionista, base TACO) continua inteiro em `src/app/`,
`src/components/patient`, `src/components/nutri` e `src/repositories`.

Ele está **desligado por padrão**. Motivo: roda sobre dados fictícios em
memória e aceita qualquer senha, então não pode dividir endereço com a Central,
que vai ter paciente de verdade. Para usar em desenvolvimento, coloque
`VITE_APP_ANTIGO=1` no `.env.local` e acesse `/consultorio`.

Nada foi apagado. Quando for a vez de trazê-lo para o Supabase, o caminho já
está aberto: ele fala com `src/repositories/`, que é o mesmo formato de troca
que a Central usa em `dados/repositorio.ts`.

---

## 11. Comandos

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # cálculo + contraste da paleta
npm run test:banco   # segurança do banco (precisa de Postgres local)
npm run typecheck
npm run lint
npm run build
npm run preview
npm run seed         # regenera 0004_dados_iniciais.sql das sementes
npm run instalador   # regenera supabase/instalar.sql
npm run artefato     # build da prévia para host estático
npm run html-unico   # gera site/index.html, a Central num arquivo só
npm run html-pages   # gera site-pages/index.html + 404.html para o GitHub Pages
```

---

## 12. O que já está cadastrado, e o que falta

O briefing pede para não inventar valor nutricional nem recomendação. Tudo
abaixo veio dos seus materiais; onde eles não dizem, o campo fica vazio e a
tela mostra o estado de preparo.

**Comer fora** tem dois níveis. A categoria responde "como montar esta
refeição"; a casa dentro dela responde "e naquele lugar ali, o que eu peço?".

| Categoria | O que tem |
|---|---|
| Hambúrguer | McDonald's, Burger King e Subway em *Lanchonetes*; Artesanal em *Artesanais* |
| Comida japonesa | Restaurante japonês |
| Massas | Spoleto e Restaurante italiano |
| Pizza | Pizzaria |
| Açaí | Açaiteria |
| Doces e sobremesas | As 5 meias refeições doces, classificadas |
| Cinema | O tamanho da pipoca |
| Barzinho | Com drink e Com chopp, duas doses cada |

Cada casa tem melhor escolha, boa opção e mais ocasional, com kcal por item e
total. Categoria com **uma casa só** mostra o conteúdo dela direto — a lista de
um item era um toque a mais para chegar ao mesmo lugar.

**As seções de "montagem" saíram** onde a casa passou a dizer o mesmo de forma
mais concreta: hambúrguer, japonesa, massas, pizza e açaí. O que não estava nos
combos mudou de lugar em vez de sumir — a nota do salmão foi para as
observações do restaurante japonês, as orientações de molho e de recheio
viraram lembretes de Massas e Pizza. Um teste garante que nenhuma categoria
tenha casa e decisão ao mesmo tempo, que é a forma de a repetição voltar.

Restaurantes e Delivery seguem reservados, sem conteúdo.

**A aba "Refeição livre" saiu** a pedido dela. A conta que morava lá (duas
meias equivalem a uma completa) não era de uma categoria só — vale para a
seção inteira —, então virou a configuração `comer_fora_introducao`: aparece
no topo de Comer fora e ela edita pelo painel, sem publicar de novo.

**Logos**: `logo` existe na casa e na categoria, guardado como data URI dentro
do próprio cadastro. Não é bucket de arquivo de propósito — a logo precisa
aparecer também na versão de arquivo único, que roda sem rede. O painel reduz
a imagem para 128 px antes de gravar, recusa SVG com script dentro, e sem logo
a tela desenha a inicial num círculo em vez de deixar buraco. McDonald's e
Burger King vieram do simple-icons (CC0); "Artesanal" não é marca, então leva
uma ilustração desenhada, não uma foto. As demais a nutricionista envia.

**Do guia de supermercado** — três guias no tema Compras: a regra de ouro dos
rótulos, as marcas por categoria (iogurte, pão de forma, geleia, frutas e
vegetais congelados, prontos) e a lista de proteínas para ter em casa.

**Do e-book de marmitas** — três guias no tema Marmitas: por onde começar
(higienização e armazenamento das frutas), as nove receitas da semana, e os
atalhos de quem está sem tempo, com os links de compra já clicáveis.

**Ainda sem conteúdo:** o guia "Variar em casa" (reservado para as suas ideias
de variação), os quatro guias de Digestão e os dois de Restrições. O tema
inteiro "No dia a dia" saiu a pedido dela — o texto do guia "Refeição livre"
está no histórico do Git, se ela quiser trazê-lo de volta em outro tema.

**Imagens**: toda casa e toda categoria publicada tem a sua, embutida como
data URI. McDonald's e Burger King vêm do simple-icons (CC0); o resto é
ilustração desenhada, porque marca não se imita e este ambiente não alcança
banco de imagem. Categoria com uma casa só empresta a imagem dela no cartão
da grade. Dois testes guardam isso: nenhuma fica sem imagem, e nenhuma aponta
para endereço de fora — que quebraria a versão de arquivo único.

**No catálogo de alimentos**, a lista de substituição está inteira:

| Grupo | Itens | Situação |
|---|---|---|
| Carboidratos | 67 | todos com porção |
| Proteínas | 44 | todos com porção |
| Gorduras | 62 | todos com porção |
| Frutas | 54 | 53 com porção + o limão, que é livre |
| Vegetais livres | 27 | quantidade livre, mínimo de 150 g no almoço e no jantar |

Nenhum alimento ficou pendente. Mais a equivalência do briefing (100 g de arroz
= 80 g de macarrão), que continua cadastrada como regra explícita — as demais
trocas saem da razão entre as porções, sem uma linha por par.

**A regra de mão única**: 1 porção de carboidrato equivale a 1 porção de fruta,
e fruta não vira carboidrato. Ela mora em `trocaParaGrupos`, no grupo dos
carboidratos, e não em código: o motor recusa o sentido proibido, a lista de
destinos nem oferece a opção, e a frase que aparece nas duas telas
("Sabia? Uma porção de carboidratos pode virar uma porção de frutas — mas nunca
o contrário.") é derivada do mesmo campo. Mudar o dado muda as três coisas
juntas.

**Glúten e lactose** ficaram em branco de propósito. Boa parte da lista existe
nas duas versões ("com ou sem glúten", "com ou sem lactose"), então marcar
qualquer coisa seria inventar. `null` quer dizer "ainda não informei", e é
diferente de `false`.

**Conferir antes de publicar:** o WhatsApp `(31) 99450-3318` e o nome
`Isabela Marçal` foram lidos do rodapé dos seus materiais, e o lema está como
"Na sexta o cardápio muda — mas o plano continua." Os três estão em Configurações,
na área da nutricionista, e mudam sem publicar de novo.

## 13. Preparado para depois

- **Conteúdo por plano ou por paciente**: a coluna `nivel_acesso` já existe em
  `alimentos` e `conteudos`; falta a tabela de exceção por paciente e mais uma
  condição na política.
- **Fotos e materiais**: o Supabase Storage já vem no projeto;
  `alimentos.imagem_url` e `conteudos.imagem_url` estão prontos.
- **Frações de porção**: `utils/porcoes.ts` já calcula "0,5 porção de arroz +
  0,5 de abóbora"; falta a tela.
- **Regras não lineares**: o motor já aceita tabela de pontos e regra fixa.
- **Pagamento**: fora de escopo por decisão do briefing. O controle financeiro é
  externo e a validade do acesso é manual.
- **200 pacientes**: o banco está indexado por status, data de fim e perfil; a
  lista é uma consulta só sobre uma tabela pequena. A ordem de grandeza que
  exigiria repensar algo é outra.
